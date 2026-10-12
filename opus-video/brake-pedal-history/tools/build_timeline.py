"""
按配音实际时长生成全片时间轴 timeline.json：画面、配乐、混音都以它为准。

规则：
- 片头留 INTRO_BEATS 拍纯音乐，章节之间留 GAP_BEATS 拍过渡，片尾留 OUTRO_BEATS 拍
- 每章配音的起点吸附到 84 BPM 节拍网格（向上取整到下一拍）

用法：
    python tools/build_timeline.py
"""

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BPM = 84
BEAT = 60.0 / BPM
INTRO_BEATS, GAP_BEATS, OUTRO_BEATS = 1, 4, 12

TITLES = {
    "vo_01_cold-open": "冷开场：一声“啪”",
    "vo_02_no-pedal": "没有踏板的第一辆车",
    "vo_03_hand-to-foot": "从手到脚",
    "vo_04_hydraulic": "一管液体",
    "vo_05_safety": "快与稳",
    "vo_06_strength": "踏板的分寸",
    "vo_07_by-wire": "踏板变成信号",
    "vo_08_outro": "约定",
}


def snap(t):
    """向上吸附到最近的拍点。"""
    return math.ceil(round(t / BEAT, 6)) * BEAT


def main():
    manifest = json.loads((ROOT / "audio/vo/manifest.json").read_text(encoding="utf-8-sig"))
    t = INTRO_BEATS * BEAT
    chapters = []
    for i, m in enumerate(manifest):
        vo_start = snap(t)
        vo_end = vo_start + m["duration"]
        chapters.append({
            "index": i + 1,
            "id": m["id"],
            "title": TITLES.get(m["id"], m["id"]),
            "start": round(0.0 if i == 0 else chapters[-1]["end"], 3),
            "vo_start": round(vo_start, 3),
            "vo_end": round(vo_end, 3),
            "vo_file": f"audio/vo/{m['file']}",
            "vo_duration": m["duration"],
            "text": m["text"],
            **({"cues": m["cues"]} if "cues" in m else {}),
        })
        t = vo_end + GAP_BEATS * BEAT
        chapters[-1]["end"] = round(snap(vo_end + GAP_BEATS * BEAT / 2), 3)
    total = snap(chapters[-1]["vo_end"] + OUTRO_BEATS * BEAT)
    chapters[-1]["end"] = round(total, 3)
    timeline = {"bpm": BPM, "beat": round(BEAT, 6), "fps": 30, "size": [1920, 1080],
                "duration": round(total, 3), "chapters": chapters}
    text = json.dumps(timeline, ensure_ascii=False, indent=2)
    (ROOT / "timeline.json").write_text(text, encoding="utf-8")
    (ROOT / "src" / "timeline.js").write_text(f"window.TIMELINE = {text};\n", encoding="utf-8")
    for c in chapters:
        print(f"{c['index']}. {c['title']:<12} 章节 {c['start']:7.2f}–{c['end']:7.2f}  配音 {c['vo_start']:7.2f}–{c['vo_end']:7.2f}")
    print(f"总时长 {total:.2f}s（{int(total // 60)}分{total % 60:.0f}秒）")


if __name__ == "__main__":
    main()
