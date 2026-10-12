"""按口播原文估算关键句的全片时间，用来挑关键帧时间点。

用法：python tools/keyframe_times.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "timeline.json").read_text(encoding="utf-8"))

PICKS = {
    1: [("“啪”", 0.6), ("当晚", 3.0), ("它是怎么来的", 6.5)],
    2: [("想减速", 4.0)],
    3: [("一九零八年", 0), ("刹的却不是车轮", 2.5)],
    4: [("原理是帕斯卡", 5.5)],
    5: [("最终拿下", 1.5), ("两年后", 6.0)],
    6: [("塑料不等于", 3.0), ("这次测试中", 1.5)],
    7: [("而今年", 3.0)],
    8: [("下次坐进车里", 7.0), ("我是阿伟", 1.5)],
}


def at(ch, phrase):
    i = ch["text"].find(phrase)
    assert i >= 0, phrase
    return ch["vo_start"] + i / len(ch["text"]) * ch["vo_duration"]


for ch in TL["chapters"]:
    for phrase, off in PICKS.get(ch["index"], []):
        print(f"ch{ch['index']}  {at(ch, phrase) + off:8.2f}  {phrase}+{off}")
