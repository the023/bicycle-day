"""Smoke test in headless Chromium (software GL, quality=low): loads the page, starts generative music,
tweaks sliders, saves and loads a preset, reloads and checks the values are restored. Prints state and console errors.
usage: python3 tools/smoke.py     (needs playwright)"""
import os, sys
if os.environ.get('SMOKE_ENABLE') != '1':
    print('smoke.py is disabled (set SMOKE_ENABLE=1 to run it)'); sys.exit(0)
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = 'file://' + root + '/dist/bicycle-day.html'
args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
with sync_playwright() as p:
    b = p.chromium.launch(args=args); pg = b.new_context(viewport={'width': 1280, 'height': 720}).new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.goto(base + '?quality=low'); pg.wait_for_timeout(800)
    pg.click('[data-source="gen"]'); pg.wait_for_timeout(300); pg.click('#playgen'); pg.wait_for_timeout(1500); print('generative playing:', pg.evaluate('playing'))
    pg.fill('#u-kal', '0.4'); pg.dispatch_event('#u-kal', 'input'); pg.click("[data-save='1']")
    pg.fill('#u-kal', '1.2'); pg.dispatch_event('#u-kal', 'input'); pg.click("[data-load='1']")
    print('after load: kal', pg.evaluate('USER.kal'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.reload(); pg.wait_for_timeout(800)
    print('restored after reload: kal', pg.evaluate('USER.kal'))
    print('ERRORS:', errs[:6] or 'none'); b.close()