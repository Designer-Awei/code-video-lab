"""
把各章口播按时间轴拼成 audio/mix/mix.wav，再标准化到 -14 LUFS。
这一版只留配音原声，不叠配乐，也不加转场和结尾音效。
"""
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000


def load(path):
    with wave.open(str(path)) as w:
        assert w.getframerate() == SR or True
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        a = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    if sr != SR:
        x = np.linspace(0, 1, int(len(a) * SR / sr), endpoint=False)
        xp = np.linspace(0, 1, len(a), endpoint=False)
        a = np.interp(x, xp, a)
    return a


def write(path, a):
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = np.max(np.abs(a)) or 1
    a = a / peak * 0.89
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def main():
    tl = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))
    dur = tl["duration"]
    n = int(dur * SR)
    voice = np.zeros(n)
    for c in tl["chapters"]:
        v = load(ROOT / c["vo_file"])
        i = int(c["vo_start"] * SR)
        k = min(len(v), n - i)
        if k > 0:
            voice[i:i + k] += v[:k]
    mix = voice
    raw = ROOT / "audio/mix/mix_raw.wav"
    out = ROOT / "audio/mix/mix.wav"
    write(raw, mix)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-ar", str(SR), str(out)], check=True)
    print(f"{out}")


if __name__ == "__main__":
    main()
