"""End-to-end smoke test in headless Chromium (software GL): home screen, live mode on a fake microphone, tweak panel, presets, generative start.
usage: python3 tools/smoke.py     (needs playwright; generates /tmp/sections.wav if missing). Prints USER state and any console errors."""
import os, subprocess, sys
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); wav = '/tmp/sections.wav'
if not os.path.exists(wav): subprocess.run([sys.executable, os.path.join(root, 'tools/make_sections_wav.py'), wav], check=True)
base = 'file://' + root + '/dist/bicycle-day.html'
args = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', f'--use-file-for-fake-audio-capture={wav}', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
with sync_playwright() as p:
    b = p.chromium.launch(args=args); pg = b.new_context(viewport={'width': 1280, 'height': 720}).new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.goto(base + '?quality=high'); pg.wait_for_timeout(1500); pg.screenshot(path='/tmp/smoke_gate.png')
    pg.click('#micmode'); pg.wait_for_timeout(4000); pg.mouse.move(900, 200); pg.wait_for_timeout(1200)
    pg.fill('#u-kal', '0.4'); pg.dispatch_event('#u-kal', 'input'); pg.click('#u-col'); pg.click("[data-save='1']")
    pg.fill('#u-kal', '1.2'); pg.dispatch_event('#u-kal', 'input'); pg.click("[data-load='1']")
    pg.click("[data-tm='1']"); pg.click("[data-sm='3']"); pg.mouse.click(400, 300); pg.mouse.wheel(0, -300); pg.keyboard.press('Digit3')
    pg.wait_for_timeout(4000); pg.screenshot(path='/tmp/smoke_live.png')
    print('after load: kal', pg.evaluate('USER.kal'), 'col', pg.evaluate('USER.col'), 'tile mode', pg.evaluate('USER.force'), 'style', pg.evaluate('USER.style'), '| live:', pg.evaluate('liveOn'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500); pg.reload(); pg.wait_for_timeout(1500)
    print('restored after reload: kal', pg.evaluate('USER.kal'), 'col', pg.evaluate('USER.col'))
    pg.click('#playgen'); pg.wait_for_timeout(4000); print('generative playing:', pg.evaluate('playing'))
    print('ERRORS:', errs[:6] or 'none'); b.close()
