"""
代码合成全片配乐：D 小调、84 BPM，每章换配器。输出 audio/music/score.wav（48 kHz 单声道）。
"""
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
RNG = np.random.default_rng(1886)


def env_adsr(n, a=0.01, d=0.08, s=0.6, r=0.2):
    t = np.arange(n) / SR
    att = np.minimum(1, t / max(a, 1e-4))
    dec = 1 - (1 - s) * np.clip((t - a) / max(d, 1e-4), 0, 1)
    rel_t = t - (n / SR - r)
    rel = np.where(rel_t > 0, np.clip(1 - rel_t / max(r, 1e-4), 0, 1), 1)
    return att * dec * rel


def osc(freq, n, kind="sine"):
    t = np.arange(n) / SR
    if np.isscalar(freq):
        ph = 2 * np.pi * freq * t
    else:
        ph = 2 * np.pi * np.cumsum(freq) / SR
    if kind == "sine":
        return np.sin(ph)
    if kind == "tri":
        return 2 * np.abs(2 * (t * freq - np.floor(t * freq + 0.5))) - 1
    if kind == "sq":
        return np.sign(np.sin(ph))
    det = RNG.normal(0, 0.4, n)
    return np.sin(ph) + 0.35 * np.sin(2 * ph + 0.2) + 0.08 * np.sin(3 * ph) + 0.015 * det


def tone(freq, dur, kind="saw", a=0.01, d=0.1, s=0.5, r=0.25, gain=0.12):
    n = int(dur * SR)
    return osc(freq, n, kind) * env_adsr(n, a, d, s, r) * gain


def kick(dur=0.28):
    n = int(dur * SR)
    f = np.geomspace(140, 42, n)
    return osc(f, n, "sine") * env_adsr(n, 0.001, 0.06, 0.0, 0.18) * 0.9


def hat(dur=0.05):
    n = int(dur * SR)
    x = RNG.standard_normal(n)
    a = math.exp(-2 * math.pi * 7000 / SR)
    y, z = np.zeros(n), 0.0
    for i, s in enumerate(x):
        z = (1 - a) * s + a * z
        y[i] = x[i] - z
    return y * env_adsr(n, 0.0004, 0.02, 0.0, 0.03) * 0.18


def pluck(freq, dur=0.7):
    return tone(freq, dur, "tri", a=0.002, d=0.08, s=0.15, r=0.45, gain=0.11) + tone(freq * 2.01, dur, "sine", 0.002, 0.05, 0.1, 0.3, 0.04)


def pad(freqs, dur, gain=0.05):
    n = int(dur * SR)
    out = np.zeros(n)
    for f in freqs:
        out += osc(f * 0.997, n, "sine") + osc(f * 1.003, n, "sine")
    return out / (2 * len(freqs)) * env_adsr(n, 0.4, 0.2, 0.7, 0.8) * gain


def bass(freq, dur):
    return tone(freq, dur, "sine", 0.01, 0.08, 0.5, 0.2, 0.16) + tone(freq * 2, dur, "tri", 0.01, 0.1, 0.2, 0.2, 0.04)


def arp(freq, dur, rate=6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    step = np.floor(t * rate) % 3
    f = np.where(step == 0, freq, np.where(step == 1, freq * 1.5, freq * 2))
    return osc(f, n, "sq") * env_adsr(n, 0.01, 0.05, 0.4, 0.1) * 0.06 * (0.4 + 0.6 * ((np.sin(2 * np.pi * t * rate) + 1) / 2))


def put(buf, sig, t):
    i = int(t * SR)
    if i >= len(buf) or i < 0:
        return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n]


def hz(semi, oct=0):
    return 146.832 * (2 ** ((semi + 12 * oct) / 12))  # D3


def main():
    tl = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))
    dur, beat = tl["duration"], tl["beat"]
    buf = np.zeros(int(dur * SR) + SR)
    chs = {c["index"]: c for c in tl["chapters"]}
    dm = [0, 3, 7, 10]  # D F A C
    chords = [
        [hz(s, 1) for s in [0, 3, 7]],
        [hz(s, 1) for s in [5, 8, 12]],
        [hz(s, 1) for s in [7, 10, 14]],
        [hz(s, 1) for s in [3, 7, 10]],
    ]

    def chapter(i):
        return chs[i]["start"], chs[i]["end"]

    # —— 全片心跳底鼓（章节过渡加强）
    t = 0.0
    while t < dur:
        bar = int(round(t / beat)) % 4 == 0
        put(buf, kick(0.32 if bar else 0.22) * (0.55 if bar else 0.28), t)
        t += beat

    # 1 冷开场：低频持续 + 张力上升，啪之前抽空
    s, e = chapter(1)
    cues = chs[1].get("cues", {})
    pa = chs[1]["vo_start"] + cues.get("pa", 26.91)
    put(buf, pad([hz(0, 0), hz(7, 0), hz(3, 1)], e - s, 0.07), s)
    t = s
    while t < pa - 0.6:
        put(buf, hat() * 0.5, t)
        t += beat / 2
    # 抽空
    i0, i1 = int((pa - 0.45) * SR), int(pa * SR)
    buf[i0:i1] *= np.linspace(1, 0.05, max(1, i1 - i0))
    put(buf, kick(0.5) * 1.4, pa)
    # 片名第二次重击
    origin = chs[1]["vo_start"] + cues.get("origin", 39.84)
    put(buf, kick(0.45) * 1.1, origin)

    # 2 拨弦 + 铺底
    s, e = chapter(2)
    put(buf, pad(chords[0], e - s, 0.045), s)
    t, i = s, 0
    melody = [0, 3, 7, 10, 7, 3, 0, -2]
    while t < e:
        put(buf, pluck(hz(melody[i % len(melody)], 2), 0.85), t)
        t += beat * 2
        i += 1

    # 3 钟表机械
    s, e = chapter(3)
    t = s
    while t < e:
        put(buf, hat() * 0.9, t)
        if int(round(t / beat)) % 2 == 0:
            put(buf, tone(880, 0.06, "sine", 0.001, 0.02, 0, 0.03, 0.07), t)
        t += beat / 2
    put(buf, bass(hz(0, 0), e - s) * 0.35, s)

    # 4 低音行走 + 温暖铺底
    s, e = chapter(4)
    put(buf, pad(chords[1], e - s, 0.05), s)
    walk = [0, 0, 3, 5, 7, 5, 3, 0]
    t, i = s, 0
    while t < e:
        put(buf, bass(hz(walk[i % 8], 0), beat * 1.05), t)
        t += beat
        i += 1

    # 5 铜管式推进；ABS 段方波
    s, e = chapter(5)
    put(buf, pad(chords[2], e - s, 0.04), s)
    t, i = s, 0
    brass = [7, 10, 12, 10]
    abs_t = s + (e - s) * 0.72
    while t < e:
        if t < abs_t:
            put(buf, tone(hz(brass[i % 4], 2), beat * 1.6, "saw", 0.02, 0.1, 0.4, 0.3, 0.06), t)
            t += beat * 2
        else:
            put(buf, arp(hz(0, 2), beat * 2, 8), t)
            t += beat * 2
        i += 1

    # 6 极简脉冲，结尾大三
    s, e = chapter(6)
    t = s
    while t < e - 8:
        put(buf, tone(hz(0, 3), 0.12, "sine", 0.001, 0.04, 0, 0.06, 0.08), t)
        t += beat * 2
    put(buf, pad([hz(0, 1), hz(4, 1), hz(7, 1)], 8, 0.07), e - 8)  # D major resolve

    # 7 琶音
    s, e = chapter(7)
    t = s
    while t < e:
        put(buf, arp(hz([0, 3, 7, 10][int((t - s) / (beat * 8)) % 4], 2), beat * 4, 7), t)
        t += beat * 4
    put(buf, pad(chords[3], e - s, 0.035), s)

    # 8 推高后只留单音
    s, e = chapter(8)
    put(buf, pad([hz(0, 1), hz(3, 1), hz(7, 1), hz(10, 1)], min(18, e - s - 6), 0.07), s)
    t = s
    while t < e - 8:
        put(buf, pluck(hz([0, 7, 12, 10][int(round((t - s) / beat)) % 4], 2), 0.9) * 1.2, t)
        t += beat
    put(buf, tone(hz(0, 2), e - (e - 7), "sine", 0.8, 0.2, 0.6, 3.5, 0.18), e - 7)

    peak = np.max(np.abs(buf)) or 1
    buf = buf / peak * 0.7
    out = ROOT / "audio/music/score.wav"
    out.parent.mkdir(parents=True, exist_ok=True)
    import wave
    with wave.open(str(out), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((buf * 32767).astype(np.int16).tobytes())
    print(f"{out}  {dur:.1f}s")


if __name__ == "__main__":
    main()
