"""
Voicebox 本地 TTS 批量生成工具（【Awei 原声】克隆音色）。

用法：
    python tools/voicebox_tts.py audio/vo/segments.json            # 生成全部段落
    python tools/voicebox_tts.py audio/vo/segments.json --only vo_01 vo_03
    python tools/voicebox_tts.py audio/vo/segments.json --force    # 覆盖已有文件

segments.json 格式：
    {"profile": "Awei 原声", "language": "zh", "seed": 42,
     "segments": [{"id": "vo_01_cold-open", "text": "……"}, ...]}

输出：
    audio/vo/<id>.wav        每段一个文件，文件名即段落 id
    audio/vo/manifest.json   每段的 id、文件名、时长（秒）、voicebox generation_id、文本
"""

import argparse
import json
import sys
import time
import urllib.request
import wave
from pathlib import Path

BASE = "http://127.0.0.1:17493"


def _get(path):
    """GET 并解析 JSON。"""
    with urllib.request.urlopen(BASE + path, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def _post(path, payload):
    """POST JSON 并解析返回的 JSON。"""
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))


def find_profile_id(name):
    """按名称查找 voicebox 音色 profile_id。"""
    for p in _get("/profiles"):
        if p["name"] == name:
            return p["id"]
    raise SystemExit(f"找不到音色：{name}")


def wait_for(gen_id, timeout_s=1800):
    """轮询生成状态，直到完成或失败。/generate/{id}/status 是 SSE 长连接，这里改查 /history/{id}。"""
    start = time.time()
    while time.time() - start < timeout_s:
        st = _get(f"/history/{gen_id}")
        status = st.get("status")
        if status in ("completed", "done", "success"):
            return st
        if status in ("failed", "error", "cancelled"):
            raise RuntimeError(f"生成失败 {gen_id}: {st.get('error')}")
        time.sleep(2)
    raise TimeoutError(f"生成超时 {gen_id}")


def download(gen_id, out_path):
    """下载生成的音频到 out_path。"""
    with urllib.request.urlopen(f"{BASE}/audio/{gen_id}", timeout=300) as r:
        out_path.write_bytes(r.read())


def wav_duration(path):
    """读取 wav 时长（秒）。"""
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / float(w.getframerate())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("segments")
    ap.add_argument("--only", nargs="*", default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    seg_path = Path(args.segments)
    cfg = json.loads(seg_path.read_text(encoding="utf-8-sig"))
    out_dir = seg_path.parent
    manifest_path = out_dir / "manifest.json"
    manifest = {}
    if manifest_path.exists():
        manifest = {m["id"]: m for m in json.loads(manifest_path.read_text(encoding="utf-8-sig"))}

    profile_id = find_profile_id(cfg.get("profile", "Awei 原声"))
    for seg in cfg["segments"]:
        sid = seg["id"]
        if args.only and sid not in args.only:
            continue
        out = out_dir / f"{sid}.wav"
        if out.exists() and not args.force:
            print(f"跳过（已存在）{out.name}")
            continue
        print(f"生成 {sid} …", flush=True)
        gen = _post("/generate", {
            "profile_id": profile_id,
            "text": seg["text"],
            "language": cfg.get("language", "zh"),
            "seed": seg.get("seed", cfg.get("seed", 42)),
            "instruct": seg.get("instruct", cfg.get("instruct")),
        })
        wait_for(gen["id"])
        download(gen["id"], out)
        dur = wav_duration(out)
        manifest[sid] = {"id": sid, "file": out.name, "duration": round(dur, 3),
                         "generation_id": gen["id"], "text": seg["text"]}
        print(f"  -> {out.name}  {dur:.2f}s", flush=True)
        manifest_path.write_text(
            json.dumps([manifest[s["id"]] for s in cfg["segments"] if s["id"] in manifest],
                       ensure_ascii=False, indent=2),
            encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
