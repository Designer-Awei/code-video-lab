"""
口播整理：自动找停顿 → 对齐到标点 → 拉长气口 → 按新叙事顺序重排 → 输出画面锚点（cues）。

不写死任何切点：换了新录音，只要替换 <id>.orig.wav（文稿有改动就同时替换 <id>.orig.txt）再运行即可。
- 停顿检测：10ms 能量包络，低于 SIL_DB 且持续 ≥ SIL_MIN 秒算一次停顿
- 对齐：先把句末标点（。？！）匹配到估计位置附近最长的停顿，再在句与句之间匹配逗号类停顿；
  句末找不到停顿时退到能量最低点
- 气口：停顿短于 PAUSE 目标的补足（补的是与原停顿同响度的底噪），长的保持原样；逗号处没检测到停顿就不动
- 重排：GROUPS 里每组从某句开头到下一组开头，组前可额外留白

用法：python tools/reorder_vo.py [--id vo_01_cold-open]
"""

import argparse
import json
import re
import shutil
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
VO = ROOT / "audio/vo"

SIL_DB, SIL_MIN, HOP = -40.0, 0.07, 0.01
PUNCT = "，。？！：；、—“”‘’…"
STRONG = "。？！"
PAUSE = {"strong": 0.65, "dash": 0.4, "weak": 0.3}
# 可以拉长的最短原停顿：更短的多半是辅音闭塞或擦音空隙，补停顿会像结巴
STRETCH_MIN = {"strong": 0.12, "dash": 0.06, "weak": 0.12}
ROOM_SEED = 7

# 叙事分组：(锚点名, 该组第一句的开头, 组前额外留白秒)；按新顺序排列
GROUPS = {
    "vo_01_cold-open": [
        ("s1", "十月八号", 0.0),
        ("s3", "三台全新", 0.0),
        ("s4", "当晚", 0.0),
        ("s2", "时速一百公里", 1.8),
        ("s5", "这个测试", 1.2),
    ],
}
# 句内锚点：(锚点名 → 文稿片段)，取片段开口说话的时刻
INNER = {
    "vo_01_cold-open": {
        "press": "测试员", "pa": "啪", "bracket": "刹车踏板支架", "same": "断口几乎",
        "q1": "用户实际", "q2": "但会优化", "q3": "为已交付", "lookdown": "但它让", "origin": "它是怎么来的",
    },
}


def load(path):
    with wave.open(str(path)) as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr, sw


def envelope(a, sr):
    hop = int(sr * HOP)
    n = len(a) // hop
    rms = np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(axis=1)) + 1e-3
    return 20 * np.log10(rms / 32768.0)


def silences(db):
    out, start = [], None
    for i, quiet in enumerate(np.append(db < SIL_DB, False)):
        if quiet and start is None:
            start = i
        elif not quiet and start is not None:
            if (i - start) * HOP >= SIL_MIN:
                out.append([start * HOP, i * HOP])
            start = None
    return out


def boundaries(text):
    """标点串 → [(说话字序号, 文本结束位置, 类型)]，说话字不含标点。"""
    res, spoken = [], 0
    for m in re.finditer(f"[^{PUNCT}]+|[{PUNCT}]+", text):
        s = m.group()
        if s[0] in PUNCT:
            if m.start() == 0 or m.end() == len(text):
                continue
            kind = "strong" if any(c in STRONG for c in s) else "dash" if "—" in s else "weak"
            res.append({"c": spoken, "pos": m.end(), "kind": kind})
        else:
            spoken += len(s)
    return res, spoken


def align(text, db, sils, total):
    bs, n = boundaries(text)
    speech = [i * HOP for i, v in enumerate(db) if v >= SIL_DB]
    t0, t1 = speech[0], speech[-1] + HOP
    used = set()

    def pick(est, lo, hi, win, prefer_long, min_len=0.0):
        best, score = None, -1e9
        for j, (s, e) in enumerate(sils):
            mid = (s + e) / 2
            if j in used or mid <= lo or mid >= hi or abs(mid - est) > win or e - s < min_len:
                continue
            sc = (e - s) * (1.0 if prefer_long else 0.0) - 0.25 * abs(mid - est)
            if sc > score:
                best, score = j, sc
        return best

    power = 10 ** (db / 10)
    win = int(0.12 / HOP)
    smooth_p = np.convolve(power, np.ones(win) / win, mode="same")

    def valley(est):
        """估计位置 ±0.35s 内 120ms 平均功率最低处（宽而安静的谷才是句间，窄谷多是擦音）。"""
        i0, i1 = max(0, int((est - 0.35) / HOP)), int((est + 0.35) / HOP)
        c = i0 + int(np.argmin(smooth_p[i0: i1]))
        r0 = max(0, c - win // 2)
        return (r0 + int(np.argmin(db[r0: c + win // 2]))) * HOP

    anchors = [(0, t0)]
    for b in [b for b in bs if b["kind"] == "strong"]:
        lc, lt = anchors[-1]
        est = lt + (b["c"] - lc) * (t1 - lt) / (n - lc)
        j = pick(est, lt, t1, 1.0, True, STRETCH_MIN["strong"])
        if j is not None:
            used.add(j); b["pause"] = list(sils[j])
        else:
            v = valley(est); b["pause"] = [v, v]
        anchors.append((b["c"], b["pause"][1]))
    anchors.append((n, t1))
    for b in bs:
        if b["kind"] == "strong":
            continue
        k = max(i for i, (c, _) in enumerate(anchors) if c <= b["c"])
        (ca, ta), (cb, tb) = anchors[k], anchors[min(k + 1, len(anchors) - 1)]
        est = ta + (b["c"] - ca) * (tb - ta) / max(1, cb - ca)
        j = pick(est, ta, tb, 0.5, False)
        if j is not None:
            used.add(j); b["pause"] = list(sils[j])
    return bs, t0, t1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", default="vo_01_cold-open")
    vid = ap.parse_args().id
    src, orig, txt = VO / f"{vid}.wav", VO / f"{vid}.orig.wav", VO / f"{vid}.orig.txt"
    if not orig.exists():
        shutil.copy2(src, orig)
    text = txt.read_text(encoding="utf-8").strip()
    a, sr, sw = load(orig)
    total = len(a) / sr
    db = envelope(a, sr)
    sils = silences(db)
    bs, t0, t1 = align(text, db, sils, total)

    floor = [a[int(s * sr): int(e * sr)] for s, e in sils if e - s > 0.1]
    room = float(np.sqrt(np.mean(np.concatenate(floor) ** 2))) if floor else 0.0
    rnd = np.random.default_rng(ROOM_SEED)

    print("停顿对齐：")
    for b in bs:
        p = b.get("pause")
        tag = f"{p[0]:6.2f}–{p[1]:6.2f}" if p else "   （无停顿）  "
        print(f"  {tag}  {b['kind']:<6} …{text[max(0, b['pos'] - 6): b['pos']]}")

    # 句子切分：句末停顿中点
    strong = [b for b in bs if b["kind"] == "strong"]
    cuts = [0.0] + [(b["pause"][0] + b["pause"][1]) / 2 for b in strong] + [total]
    starts = [0] + [b["pos"] for b in strong]
    sent = [{"pos": starts[i], "end": starts[i + 1] if i + 1 < len(starts) else len(text), "t": (cuts[i], cuts[i + 1])}
            for i in range(len(starts))]

    groups = GROUPS[vid]
    gpos = sorted(text.index(f) for _, f, _ in groups)
    pieces, out_t, cues = [], 0.0, {}
    fade = int(0.008 * sr)
    ramp = np.linspace(0, 1, fade, dtype=np.float32)
    new_text = ""
    omap = []  # (orig_s, orig_e, new_s)

    def emit(x):
        nonlocal out_t
        pieces.append(x); out_t += len(x) / sr

    def emit_room(sec):
        if sec > 0:
            emit((rnd.standard_normal(int(sec * sr)) * room).astype(np.float32))

    for name, frag, gap in groups:
        p0 = text.index(frag)
        p1 = min([p for p in gpos if p > p0], default=len(text))
        ss = [s for s in sent if p0 <= s["pos"] < p1]
        new_text += text[p0:p1]
        emit_room(gap)
        os_, oe = ss[0]["t"][0], ss[-1]["t"][1]
        # 组内所有停顿按目标补足，补在停顿中点
        inserts = []
        for b in bs:
            p = b.get("pause")
            if not p or not (os_ < (p[0] + p[1]) / 2 < oe):
                continue
            need = PAUSE[b["kind"]] - (p[1] - p[0])
            if need > 0 and (b["kind"] == "strong" or p[1] - p[0] >= STRETCH_MIN[b["kind"]]):
                inserts.append(((p[0] + p[1]) / 2, need))
        # 组首尾的半个句末停顿也补足到目标的一半
        head = [b for b in strong if abs((b["pause"][0] + b["pause"][1]) / 2 - os_) < 1e-6]
        tail = [b for b in strong if abs((b["pause"][0] + b["pause"][1]) / 2 - oe) < 1e-6]
        if head:
            p = head[0]["pause"]; emit_room(max(0, PAUSE["strong"] / 2 - (p[1] - p[0]) / 2))
        marks = [os_] + [m for m, _ in inserts] + [oe]
        for i in range(len(marks) - 1):
            seg = a[int(marks[i] * sr): int(marks[i + 1] * sr)].copy()
            if len(seg) > 2 * fade:
                seg[:fade] *= ramp; seg[-fade:] *= ramp[::-1]
            omap.append((marks[i], marks[i + 1], out_t))
            emit(seg)
            if i < len(inserts):
                emit_room(inserts[i][1])
        if tail:
            p = tail[0]["pause"]; emit_room(max(0, PAUSE["strong"] / 2 - (p[1] - p[0]) / 2))

    def to_new(t):
        for s, e, n in omap:
            if s <= t < e:
                return n + (t - s)
        for s, e, n in omap:
            if s <= t <= e:
                return n + (t - s)
        return None

    def onset(pos):
        """文稿位置 pos 处开口说话的时刻（新录音时间）。"""
        prev = [b for b in bs if b["pos"] == pos and b.get("pause")]
        if prev:
            return to_new(prev[0]["pause"][1])
        k = sum(1 for c in text[:pos] if c not in PUNCT)
        known = [(0, t0)] + [(b["c"], b["pause"][1]) for b in bs if b.get("pause")] + [(len([c for c in text if c not in PUNCT]), t1)]
        lo = max((x for x in known if x[0] <= k), key=lambda x: x[0])
        hi = min((x for x in known if x[0] > k), key=lambda x: x[0], default=known[-1])
        return to_new(lo[1] + (k - lo[0]) * (hi[1] - lo[1]) / max(1, hi[0] - lo[0]))

    for name, frag, _ in groups:
        cues[name] = onset(text.index(frag))
    for name, frag in INNER.get(vid, {}).items():
        cues[name] = onset(text.index(frag))
    cues = {k: round(v, 3) for k, v in cues.items() if v is not None}

    out = np.concatenate(pieces).clip(-32768, 32767).astype(np.int16)
    with wave.open(str(src), "wb") as w:
        w.setnchannels(1); w.setsampwidth(sw); w.setframerate(sr); w.writeframes(out.tobytes())
    dur = round(len(out) / sr, 3)

    mp = VO / "manifest.json"
    manifest = json.loads(mp.read_text(encoding="utf-8-sig"))
    m = next(x for x in manifest if x["id"] == vid)
    m["duration"], m["text"], m["cues"] = dur, new_text, cues
    mp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"原时长 {total:.2f}s → 新时长 {dur}s")
    for k, v in sorted(cues.items(), key=lambda x: x[1]):
        print(f"  {v:7.3f}  {k}")


if __name__ == "__main__":
    main()
