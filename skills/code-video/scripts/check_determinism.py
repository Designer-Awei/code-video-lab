"""Verify render(t) gives the same pixels after out-of-order calls."""
import argparse
import hashlib
from playwright.sync_api import sync_playwright
from render import launch, page_url

ap=argparse.ArgumentParser()
ap.add_argument('page')
ap.add_argument('--times',type=float,nargs='+',default=[1,2,3])
a=ap.parse_args()
with sync_playwright() as p:
    browser=launch(p)
    page=browser.new_page(viewport={'width':1920,'height':1080})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(page_url(a.page))
    page.wait_for_function("typeof window.render === 'function' && window.ready !== false",timeout=120000)
    def frame(t):
        page.evaluate('(t)=>window.render(t)',t)
        return hashlib.sha256(page.screenshot()).hexdigest()
    before={t:frame(t) for t in a.times}
    for t in reversed(a.times):
        frame(a.times[0]+.131)
        assert frame(t)==before[t],f'Non-deterministic frame at {t}s'
        print(f'PASS {t}s')
    browser.close()
    assert not errors,errors
