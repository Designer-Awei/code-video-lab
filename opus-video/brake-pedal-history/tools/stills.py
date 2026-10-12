"""一次打开页面，按多个时间点截帧，并打印页面控制台错误和每帧耗时。

用法：python tools/stills.py <前缀> t1 t2 ... [--query cover=1] [--size 1920x1080]
输出：previews/<前缀>_<t>.png
"""
import argparse, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3] / "skills/code-video/scripts"))
from playwright.sync_api import sync_playwright
from render import launch

ROOT = pathlib.Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("prefix"); ap.add_argument("times", nargs="+", type=float)
ap.add_argument("--query", default=""); ap.add_argument("--size", default="1920x1080")
a = ap.parse_args()
w, h = map(int, a.size.split("x"))
(ROOT / "previews").mkdir(exist_ok=True)
url = (ROOT / "index.html").resolve().as_uri() + (f"?{a.query}" if a.query else "")
with sync_playwright() as p:
    b = launch(p)
    pg = b.new_page(viewport={"width": w, "height": h})
    pg.on("console", lambda m: m.type in ("error", "warning") and print(f"[{m.type}] {m.text}"))
    pg.on("pageerror", lambda e: print(f"[pageerror] {e}"))
    pg.goto(url, timeout=90000)
    pg.wait_for_function("window.ready === true", timeout=120000)
    for t in a.times:
        t0 = time.time()
        pg.evaluate("t => window.render(t)", t)
        out = ROOT / "previews" / f"{a.prefix}_{t:g}.png"
        pg.screenshot(path=str(out))
        print(f"{out.name}  {time.time() - t0:.2f}s")
    b.close()
