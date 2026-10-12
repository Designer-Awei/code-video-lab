"""
真实来源截图工具：用 Playwright 打开新闻/官方页面，定位到关键文字所在区域截图，
并把网址、截图时间写入 source/screenshots/sources.json，便于片尾标注和溯源。

用法：
    python tools/capture_sources.py                 # 截全部
    python tools/capture_sources.py --only zunjie_weibo
    python tools/capture_sources.py --headed        # 显示浏览器（需要手动登录/过验证时用）
"""

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "source" / "screenshots"

# anchor：要定位的关键文字；截图区域从 anchor 所在块开始，向下取 height 像素
TARGETS = [
    {"id": "ithome_zunjie_statement", "url": "https://www.ithome.com/1/010/703.htm",
     "note": "IT之家刊发尊界情况说明全文", "anchor": "关于尊界汽车制动踏板支架底座相关问题的情况说明", "height": 1300},
    {"id": "sina_zunjie_statement", "url": "https://finance.sina.com.cn/roll/2026-10-08/doc-iniuptaz3504565.shtml",
     "note": "封面新闻（新浪财经转载）刊发尊界情况说明全文", "anchor": "尊界汽车回应车辆刹车踏板支架断裂", "height": 1000, "x": 100, "width": 980},
    {"id": "ithome_dongchedi_reply", "url": "https://www.ithome.com/1/010/721.htm",
     "note": "IT之家：懂车帝回应，真实峰值 1612N", "anchor": "懂车帝回应", "height": 1300},
    {"id": "cnr_tracking", "url": "https://finance.cnr.cn/ycbd/20261008/t20261008_527836564.shtml",
     "note": "央广网：事件追踪（测试日期、制动距离、踏板力）", "anchor": "事件追踪", "height": 700, "x": 0, "width": 880},
    {"id": "nbd_three_cars", "url": "https://cd.nbd.com.cn/articles/2026-10-08/4599008.html",
     "note": "每经网：三辆车断口一致，1612 牛", "anchor": "三辆尊界V800", "height": 1300},
    {"id": "bjnews_reply", "url": "https://www.bjnews.com.cn/detail/1791465628129851.html",
     "note": "新京报：尊界回应将免费升级", "anchor": "尊界汽车回应", "height": 1300},
    {"id": "yicai_pedal_force", "url": "https://www.yicai.com/news/103386641.html",
     "note": "第一财经：一个刹车踏板应该扛住多大的力（500N / 1500N 标准解读）", "anchor": "一个刹车踏板", "height": 1500},
    {"id": "ndls_gb21670", "url": "https://www.ndls.org.cn/standard/detail/f30fce6c0dc62cebc6d7a8223c9bbb3d",
     "note": "国家标准馆：GB 21670-2025 条目", "anchor": "GB 21670-2025", "height": 300},
    {"id": "thepaper_intrusion", "url": "https://www.thepaper.cn/newsDetail_forward_34212476",
     "note": "澎湃新闻（2026-10-08）：防侵入式踏板是行业通行方案，正面碰撞时可控脱落或溃缩，避免侵入驾驶舱",
     "anchor": "有些工况下", "height": 640, "x": 80, "width": 760, "pad": 70, "wait": 5000},
    {"id": "autohome_breakaway", "url": "https://chejiahao.autohome.com.cn/info/26621901",
     "note": "汽车之家车家号·科技丛林（2026-10-10）：正面碰撞时踏板可溃缩、可脱开，以免顶伤小腿；正常踩刹车时绝不能断",
     "anchor": "断裂诱导槽是什么", "height": 1040, "x": 70, "width": 800, "pad": 56, "wait": 5000},
    {"id": "sina_breakaway", "url": "https://k.sina.com.cn/article_7879996057_1d5af3299068020vw2.html?from=auto",
     "note": "新浪新闻·科技动态追踪（2026-10-09）：碰撞溃缩是保护设计，正常踩踏断裂是缺陷",
     "anchor": "安全边界", "height": 480, "x": 100, "width": 680, "pad": 28, "wait": 4000},
]


HIDE_OVERLAYS_JS = """() => {
  for (const el of document.querySelectorAll('body *')) {
    const pos = getComputedStyle(el).position;
    if (pos === 'fixed' || pos === 'sticky') el.style.setProperty('display', 'none', 'important');
  }
  for (const s of (window.__hide || [])) document.querySelectorAll(s).forEach(e => e.style.setProperty('display', 'none', 'important'));
}"""


def capture(page, t):
    """打开页面，隐藏悬浮弹窗，定位 anchor 文字并截取其下方区域；找不到 anchor 时截首屏。"""
    page.goto(t["url"], wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(t.get("wait", 4000))
    # 滚过整页，让懒加载的配图出来，再回到顶部定位
    page.evaluate("""async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 200)); }
      window.scrollTo(0, 0);
    }""")
    page.wait_for_timeout(800)
    page.evaluate(f"window.__hide = {json.dumps(t.get('hide', []))}")
    page.evaluate(HIDE_OVERLAYS_JS)
    page.wait_for_timeout(300)
    loc = page.get_by_text(t["anchor"], exact=False).first
    found = False
    try:
        loc.scroll_into_view_if_needed(timeout=5000)
        page.wait_for_timeout(800)
        box = loc.bounding_box()
        found = box is not None
    except Exception:
        box = None
    vp = page.viewport_size
    out = OUT / f"{t['id']}.png"
    if found:
        page.evaluate(HIDE_OVERLAYS_JS)
        y = max(box["y"] - t.get("pad", 80), 0)
        x, w = t.get("x", 0), t.get("width", vp["width"])
        page.screenshot(path=str(out), full_page=True, clip={
            "x": x, "y": y + page.evaluate("window.scrollY"),
            "width": w, "height": t.get("height", 1200)})
    else:
        page.screenshot(path=str(out))
    return out, found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    meta_path = OUT / "sources.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=not args.headed)
        except Exception:
            browser = p.chromium.launch(headless=not args.headed)
        for t in TARGETS:
            if args.only and t["id"] not in args.only:
                continue
            ctx = browser.new_context(
                viewport={"width": 430, "height": 932} if t.get("mobile") else {"width": 1280, "height": 900},
                device_scale_factor=3 if t.get("mobile") else 2,
                is_mobile=bool(t.get("mobile")),
                locale="zh-CN",
                user_agent=t.get("ua") if t.get("ua") else (
                None if not t.get("mobile") else
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"))
            page = ctx.new_page()
            try:
                out, found = capture(page, t)
                meta[t["id"]] = {"file": out.name, "url": t["url"], "note": t["note"],
                                 "anchor_found": found,
                                 "captured_at": datetime.now().isoformat(timespec="seconds")}
                print(f"{'OK ' if found else '?? '}{t['id']} -> {out.name}", flush=True)
            except Exception as e:
                print(f"ERR {t['id']}: {e}", flush=True)
            ctx.close()
            time.sleep(1)
        browser.close()
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
