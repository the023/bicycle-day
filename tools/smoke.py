"""Smoke test in headless Chromium (software GL, quality=low). Target: under 20 s in total.
1. home: the page loads and sits 2 s on the home screen with no console / page error
2. real path: Customize > Generated music > Next > pick a gallery picture > Start; it plays, the picture is added, no error
3. presets on the digit row (Shift+1 saves, 1 recalls) and the autosave survives a reload
usage: python3 tools/smoke.py     (needs playwright)
       SMOKE_HEADED=1 python3 tools/smoke.py     watch it: visible browser, slowed down (SMOKE_SLOW=ms per action, default 600)"""
import os, sys, time
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
base = 'file://' + root + '/dist/bicycle-day.html'
args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
t0 = time.time(); fails = []
def check(name, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + (('  (' + str(detail) + ')') if detail != '' else '')); ok or fails.append(name)
with sync_playwright() as p:
    HEADED = os.environ.get('SMOKE_HEADED') == '1'
    b = p.chromium.launch(args=args, headless=not HEADED, slow_mo=int(os.environ.get('SMOKE_SLOW', 600)) if HEADED else 0); pg = b.new_context(viewport={'width': 1280, 'height': 720}).new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.goto(base + '?quality=low'); pg.wait_for_timeout(2000)
    check('home: no error', not errs, errs[:3])
    try:
        pg.wait_for_function("!document.getElementById('playlast').disabled || !document.getElementById('surprise').disabled", timeout=8000)
        pg.click('#home-start'); pg.click('[data-source="gen"]'); pg.click('#wz-next')
        pg.click('#more-pic summary'); pg.click('#galtoggle')
        n0 = pg.evaluate('IM.length'); pg.click('#ggal > *:nth-child(2)'); pg.wait_for_timeout(500)
        n1 = pg.evaluate('IM.length')
        pg.click('#playgen'); pg.wait_for_function('playing', timeout=8000); pg.wait_for_timeout(2500)
        check('wizard: Generated > picture > Start plays', pg.evaluate('playing'))
        check('wizard: picture added', n1 > n0, '%d -> %d' % (n0, n1))
    except Exception as e:
        check('wizard flow', False, str(e).splitlines()[0][:160])
    check('no error while playing', not errs, errs[:3])
    # presets (digit row) survive a reload
    def setkal(v): pg.evaluate("v => { const e = document.getElementById('u-kal'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }", v)
    try:
        setkal(0.4); pg.evaluate("fireKey('Digit1', 'keydown', true)")
        setkal(1.2); pg.evaluate("fireKey('Digit1')")
        check('preset recall', pg.evaluate('USER.kal') == 0.4, pg.evaluate('USER.kal'))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.reload(); pg.wait_for_timeout(800)
        check('preset restored after reload', pg.evaluate('USER.kal') == 0.4, pg.evaluate('USER.kal'))
    except Exception as e:
        check('presets', False, str(e).splitlines()[0][:160])
    check('no error at the end', not errs, errs[:3]); b.close()
el = time.time() - t0
print('time: %.1f s' % el); el > 20 and print('WARNING: over the 20 s target')
print('SMOKE', 'FAIL: ' + ', '.join(fails) if fails else 'PASS'); sys.exit(1 if fails else 0)
