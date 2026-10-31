"""T172: a video file as an image source (muted loop). Generates a tiny webm with ffmpeg (skips if missing), adds it through the Images drawer
file input in headless Chromium, checks: IM entry (vid, aspect), texture changes over time, muted, __pic.video, log line, pause, bad file (toast, no entry),
removal, no console errors; takes a zoomable screenshot of the drawer (/tmp/t172_drawer.png, throwaway).
usage: nice -n 10 python3 tools/video_source_test.py   (needs playwright + ffmpeg; run Python without -I)"""
import os, shutil, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = 'file://' + root + '/dist/bicycle-day.html?debug=1&quality=low&res=.1&code=1'
fails = []
def check(name, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + ((' (' + str(detail) + ')') if detail != '' else '')); ok or fails.append(name)
if not shutil.which('ffmpeg'): print('SKIP: no ffmpeg'); sys.exit(0)
d = tempfile.mkdtemp(prefix='t172_'); good = os.path.join(d, 'good.webm'); bad = os.path.join(d, 'bad.webm')
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=15:duration=3', '-c:v', 'libvpx', '-b:v', '300k', good], check=True)
open(bad, 'w').write('not a video')
TEXHASH = """k => { const e = IM[k], f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, e.tex, 0);
  const w = e._w || 1, h = e._h || 1, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(f);
  let s = 0; for (let i = 0; i < px.length; i++) s = (s * 31 + px[i]) >>> 0; return { h: s, w, hh: h }; }"""
args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
with sync_playwright() as p:
    b = p.chromium.launch(args=args); pg = b.new_context(viewport={'width': 1280, 'height': 720}).new_page(); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.goto(url); pg.wait_for_function('typeof ready !== "undefined" && ready === true', timeout=120000)
    n0 = pg.evaluate('IM.length'); pg.evaluate('start()'); pg.wait_for_function('lastT >= 1', timeout=60000)
    check('drawer input accepts video', 'video/*' in pg.evaluate("document.querySelector('#timgs input[type=file]').accept"))
    pg.evaluate("window.__lg = []; const o = window.codeAdd; window.codeAdd = (a, b, l, kd) => { if (kd === 'vid') __lg.push(l); return o(a, b, l, kd); }")   # capture the log line
    pg.set_input_files('#timgs input[type=file]', good); pg.wait_for_function('IM.length > %d' % n0, timeout=20000)
    k = pg.evaluate('IM.length - 1'); e = pg.evaluate('({vid: IM[%d].vid, a: IM[%d].aspect, hasSt: !!IM[%d].st, stream: IM[%d].stream, muted: IM[%d].cam.muted, attr: IM[%d].cam.hasAttribute("muted"), loop: IM[%d].cam.loop, dur: IM[%d].cam.duration})' % ((k,) * 8))
    check('IM entry vid:true, aspect 320/180', e['vid'] is True and abs(e['a'] - 320 / 180) < .01, e)
    check('muted + loop, no stream, stats', e['muted'] and e['attr'] and e['loop'] and e['stream'] is None and e['hasSt'])
    pg.wait_for_timeout(800)   # showImg(first) crossfade starts; let render() upload frames
    h1 = pg.evaluate(TEXHASH, k); pg.wait_for_timeout(700); h2 = pg.evaluate(TEXHASH, k)
    check('texture changes over time', h1['h'] != h2['h'] and h1['w'] == 320, (h1, h2))
    ct = pg.evaluate('IM[%d].cam.currentTime' % k); pg.wait_for_timeout(3500)   # > 3 s clip: it wraps (loop)
    check('video keeps playing (loop)', not pg.evaluate('IM[%d].cam.paused' % k) and pg.evaluate('IM[%d].cam.currentTime' % k) != ct)
    pg.wait_for_function('imMix >= 1', timeout=30000)
    pic = pg.evaluate('__pic(lastT).video'); check('__pic(t).video lists shown videos', pic == [k + 1], pic)
    lg = pg.evaluate('__lg'); check('log line "image N: video, S s loop"', len(lg) == 1 and lg[0] == 'image %d: video, 3 s loop' % (k + 1), lg)
    pg.evaluate('togglePause()'); pg.wait_for_timeout(300); check('pause pauses the video', pg.evaluate('IM[%d].cam.paused' % k))
    pg.evaluate('togglePause()'); pg.wait_for_timeout(300); check('resume plays the video', not pg.evaluate('IM[%d].cam.paused' % k))
    # bad file: toast, no entry
    nb = pg.evaluate('IM.length')
    if nb < 5:
        pg.set_input_files('#timgs input[type=file]', bad); pg.wait_for_timeout(1500)
        check('bad video: no entry + toast', pg.evaluate('IM.length') == nb and 'video' in pg.evaluate("$('toast').textContent").lower(), pg.evaluate("$('toast').textContent"))
    # drawer screenshot (home drawer tile + bottom thumbs)
    pg.evaluate("showImg(%d, true)" % k); pg.wait_for_timeout(500)
    pg.screenshot(path='/tmp/t172_play.png')
    tiles = pg.evaluate("[...document.querySelectorAll('#timgs .im')].map(t => t.textContent.replace('✕', ''))"); check('drawer tile says Video', tiles[k] == 'Video', tiles)
    # remove
    pg.evaluate('window.__v = IM[%d].cam' % k)
    pg.evaluate('removeImg(%d)' % k); pg.wait_for_timeout(300)
    check('remove: entry gone, video released', pg.evaluate('IM.length') == nb - 1 and pg.evaluate('!__v.hasAttribute("src") && __v.paused'), pg.evaluate('IM.length'))
    check('no console errors', not errs, errs[:3])
    # fresh page for the drawer screenshot at home (no playing)
    pg2 = b.new_context(viewport={'width': 1280, 'height': 720}, device_scale_factor=2).new_page(); pg2.goto(url); pg2.wait_for_function('ready === true', timeout=120000)
    pg2.set_input_files('#gimgs input[type=file]', good); pg2.wait_for_function('IM.length > 1', timeout=20000); pg2.wait_for_timeout(500)
    pg2.click('#home-start'); pg2.click('[data-source="gen"]'); pg2.click('#wz-next'); pg2.click('#more-pic summary')   # wizard step 2: the Images strip (#gimgs)
    pg2.wait_for_timeout(600); pg2.locator('#gimgs').scroll_into_view_if_needed(); pg2.screenshot(path='/tmp/t172_drawer.png')
    print('tiles on home:', pg2.evaluate("[...document.querySelectorAll('#gimgs .im')].map(t => t.textContent + ' ' + t.className + ' imTo=' + imTo)"))
    b.close()
shutil.rmtree(d, ignore_errors=True)
print('FAILED: ' + ', '.join(fails) if fails else 'ALL PASS'); sys.exit(1 if fails else 0)
