#!/usr/bin/env python3
"""T169: record canvas + oscillator with MediaRecorder in Chrome, run webmFix (src/js/12z-webm.js), check raw vs fixed with ffprobe / ffmpeg.
Usage: flock /tmp/bd-browser.lock nice -n 10 python3 tools/webm_fix_test.py [seconds=8] [outdir=/tmp/bd-webm]"""
import base64, os, subprocess, sys
from playwright.sync_api import sync_playwright
from pw import launch

SEC = float(sys.argv[1]) if len(sys.argv) > 1 else 8
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/bd-webm"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(OUT, exist_ok=True)
lib = open(os.path.join(ROOT, "src/js/12z-webm.js")).read()
JS = """async (sec) => {
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; document.body.append(cv);
  const g = cv.getContext('2d'), ac = new AudioContext(), o = ac.createOscillator(), d = ac.createMediaStreamDestination();
  o.connect(d); o.start();
  const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...d.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 4e6 }), ch = [];
  rec.ondataavailable = e => { if (e.data.size) ch.push(e.data); };
  const done = new Promise(r => rec.onstop = r);
  let n = 0; const iv = setInterval(() => { n++; g.fillStyle = `hsl(${n * 7 % 360},80%,50%)`; g.fillRect(0, 0, 640, 360); g.fillStyle = '#fff'; g.font = '60px sans-serif'; g.fillText(n, 40 + n % 300, 200); }, 33);
  rec.start(1000); await new Promise(r => setTimeout(r, sec * 1000)); rec.stop(); await done; clearInterval(iv);
  const raw = new Uint8Array(await new Blob(ch).arrayBuffer()), fixed = webmFix(raw.buffer);
  const b64 = a => { let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode.apply(null, a.subarray(i, i + 32768)); return btoa(s); };
  const junk = webmFix(new Uint8Array([1, 2, 3, 4]));   // garbage in -> same bytes out, no throw
  return { raw: b64(raw), fixed: b64(fixed), junkOk: junk.length === 4 };
}"""
with sync_playwright() as p:
    br = launch(p, channel="chrome")
    pg = br.new_page(); pg.goto("about:blank"); pg.add_script_tag(content=lib)
    r = pg.evaluate(JS, SEC); br.close()
for k in ("raw", "fixed"):
    open(f"{OUT}/{k}.webm", "wb").write(base64.b64decode(r[k]))
sh = lambda c: subprocess.run(c, capture_output=True, text=True)
dur = lambda f: sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).stdout.strip()
ok = True
def chk(name, cond, detail=""):
    global ok; ok &= bool(cond); print(("PASS " if cond else "FAIL ") + name, detail)
raw, fixed = f"{OUT}/raw.webm", f"{OUT}/fixed.webm"
print("sizes raw/fixed:", os.path.getsize(raw), os.path.getsize(fixed))
dr, df = dur(raw), dur(fixed)
chk("raw has no duration", dr in ("", "N/A"), dr)
chk("fixed duration ~ recording", df not in ("", "N/A") and abs(float(df) - SEC) < 1.5, f"{df} (rec {SEC})")
def rd(b, p, mark):   # EBML varint at p -> (value, length)
    n = 1
    while not b[p] & (0x80 >> (n - 1)): n += 1
    v = b[p] if mark else b[p] & (0xFF >> n)
    for i in range(1, n): v = v * 256 + b[p + i]
    return v, n
def walk(b, p, e):   # (id, data start, data end) of the children in [p, e)
    while p < e:
        i, a = rd(b, p, True); z, c = rd(b, p + a, False); yield i, p + a + c, p + a + c + z; p += a + c + z
b = open(fixed, "rb").read(); top = list(walk(b, 0, len(b))); seg = [x for x in top if x[0] == 0x18538067]
chk("Segment has a known size, whole file", seg and seg[0][2] == len(b))
kids = list(walk(b, seg[0][1], seg[0][2])); cl = [k for k in kids if k[0] == 0x1F43B675]; cues = [k for k in kids if k[0] == 0x1C53BB6B]
pos = [uv for cp in walk(b, *cues[0][1:]) for tp in walk(b, *cp[1:]) if tp[0] == 0xB7 for uid, a, e in walk(b, *tp[1:]) if uid == 0xF1 for uv in [int.from_bytes(b[a:e], "big")]]
chk("Cues: one per Cluster, each points at a Cluster", len(cues) == 1 and pos == [k[1] - 12 - seg[0][1] for k in cl] and len(cl) >= 1, f"{len(cl)} clusters")
chk("Cues come before the first Cluster", kids.index(cues[0]) < kids.index(cl[0]))
nb = lambda f: int(__import__("re").search(r"(\d+) bytes read", sh(["ffmpeg", "-v", "trace", "-ss", str(SEC * .75), "-i", f, "-frames:v", "1", "-f", "null", "-"]).stderr.split("Statistics:")[-1]).group(1))
chk("seek reads fewer bytes via the index (fixed < raw)", nb(fixed) < nb(raw) or SEC < 20, f"{nb(fixed)} vs {nb(raw)}")
chk("garbage input returned unchanged", r["junkOk"])
s = SEC / 2 + 1
chk(f"seek -ss {s:g} decodes a frame", sh(["ffmpeg", "-v", "error", "-ss", str(s), "-i", fixed, "-frames:v", "1", "-f", "null", "-"]).stderr.strip() == "")
e = sh(["ffmpeg", "-v", "error", "-i", fixed, "-f", "null", "-"]).stderr.strip()
chk("full decode no errors", e == "", e[:200])
sys.exit(0 if ok else 1)
