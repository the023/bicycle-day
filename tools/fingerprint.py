"""R1 / T173: golden fingerprint of the app's behaviour. Run it before a refactor (--save) and after (--compare): every case must be SAME.
usage: python3 tools/fingerprint.py [--only plog,audio,stills,local] [--style <music>] [--save [PATH]] [--compare [PATH]]
  plog    generated music x Energy: window.__plog (P every .5 s of song time, silent stills with ?debug=1) -> hash. ambient / electro / gymnopedie (the piano)
          x Energy 0, 2, 4, seed 3, 2 min piece, tiny buffer. The data is kept in the fingerprint file, so DIFF names the first differing P field and time.
  audio   every MUSIC at seed 3: buildAudio into an OfflineAudioContext (22.05 kHz stereo; pump() every 1 s of audio like the real timer): 20 s from 0 and
          20 s from a seek to 60 s (begin(60, false): the rng the real seek uses) -> hash of the samples + the section plan (EVT) + peak. A silent result is
          printed as SILENT (a style that does not play).  --style electro: only that music.
  stills  3 pictures (PNG hash of the page): generated electro E2, ambient Extreme, piano E0, seed 3.
  local   tools/make_sections_wav.py's track (seeded here, so it is the same file every time) played as the Local source: __plog hash.
One browser for the whole run, nice 10, parts run in the order above; the time of each part is printed at the end.
Files: the fingerprints go to tools/.fingerprint.json (gitignored, next to this tool, so --save on main and --compare on a branch work from the same
checkout). --save PATH / --compare PATH use another file: save a baseline once on main (`--save /home/me/base.json`) and compare any worktree with it
(`--compare /home/me/base.json`). Only the cases that were run are written / compared (--save with --only merges into the file). Output: one line
per case, SAME or DIFF (+ detail), a case missing from the baseline is MISSING (counts as a failure); exit status 1 on any DIFF / MISSING / error.
Determinism: everything is a pure function of seed + the code on this machine (software GL, same Chrome); the new context of every case has an empty
localStorage. Needs `npm run build` first (reads dist/bicycle-day.html). Run Python without -I (playwright lives in the user site-packages).
"""
import argparse, functools, hashlib, http.server, json, os, runpy, sys, tempfile, threading, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "file://" + os.path.join(ROOT, "dist", "bicycle-day.html")
DEFAULT_FILE = os.path.join(ROOT, "tools", ".fingerprint.json")
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--autoplay-policy=no-user-gesture-required"]
PARTS = ["plog", "audio", "stills", "local"]

SEED = 3
BASE = "quality=low&res=.05&step=.5&seed=%d&arc=journey&level=0&debug=1" % SEED   # tiny offscreen buffer: same code paths, the cheapest frames
PLOG_MIN = 2   # piece length in minutes for the P logs (the slow start scales with it; 2 min still reaches surges / tiles / moods)
PLOG_MUSIC = [("ambient", "ambient"), ("electro", "electro"), ("piano", "gymnopedie")]
PLOG_ENERGY = [0, 2, 4]
AUDIO_SR = 22050   # half the sample rate = half the render time; every node and every rand() draw is still exercised
AUDIO_SECS = 20
AUDIO_SEEK = 60
AUDIO_SEEK_SECS = 10   # the seek render is shorter: it checks the seeked start, not the whole piece
AUDIO_TOL = (1e-6, 1e-4)   # float noise of Chrome's offline renderer (see the docstring): |a-b| <= abs + rel * max(|a|, |b|) on every block feature
STILLS = [   # (name, query, song time): ?res=.2, step 1 for a readable picture
    ("electro E2", "music=electro&energy=2", 40),
    ("ambient E4", "music=ambient&energy=4", 30),
    ("piano E0", "music=gymnopedie&energy=0", 30),
]
LOCAL_T = 60   # song seconds of sections.wav (80 s long) to log


def log(*a):
    print(*a, flush=True)


def h_json(o):
    return hashlib.sha256(json.dumps(o, sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:16]


def new_page(browser, vp=(640, 360)):
    ctx = browser.new_context(viewport={"width": vp[0], "height": vp[1]})
    page = ctx.new_page()
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)))
    return ctx, page, errs


# ---------------------------------------------------------------- plog
def plog_run(browser, qs, T, local=False):
    """Load a silent still with ?debug=1 up to song time T and return the P log (window.__plog) as plain rows."""
    ctx, page, errs = new_page(browser)
    try:
        page.goto(URL + "?" + qs, wait_until="load", timeout=120000)
        page.wait_for_function("() => window.__plog && window.__plog.length && window.__plog[window.__plog.length-1].t >= %s" % (T - .6), timeout=600000)
        if local and not page.evaluate("() => !!LOC"):
            raise RuntimeError("local track did not load (fell back to generated)")
        rows = page.evaluate("() => window.__plog.map(x => Object.assign({}, x))")
    finally:
        ctx.close()
    if errs:
        raise RuntimeError("page errors: " + "; ".join(errs[:3]))
    return rows


def plog_case(rows):
    return {"hash": h_json(rows), "n": len(rows), "data": rows}


def plog_diff(old, new):
    """First difference between two P logs, as text."""
    if len(old) != len(new):
        return "rows %d -> %d" % (len(old), len(new))
    for a, b in zip(old, new):
        if a != b:
            for k in list(a) + [k for k in b if k not in a]:
                if a.get(k) != b.get(k):
                    return "t=%s field %s: %r -> %r" % (a.get("t"), k, a.get(k), b.get(k))
    return "(rows equal)"


def run_plog(browser, out):
    for mname, music in PLOG_MUSIC:
        for e in PLOG_ENERGY:
            T = PLOG_MIN * 60
            t1 = time.time()
            rows = plog_run(browser, "t=%d&min=%d&music=%s&energy=%d&%s" % (T, PLOG_MIN, music, e, BASE), T)
            out["plog %s E%d" % (mname, e)] = (plog_case(rows), time.time() - t1)


# ---------------------------------------------------------------- audio
AUDIO_JS = """async ([music, off, secs, sr]) => {
  MUSIC = music; applyArc(); newSeed();                       // a fresh play, like begin(0, true)
  if (off) rng = mulberry32(seedUsed + Math.floor(off) + 1);  // a seek, like begin(off, false)
  const oc = new OfflineAudioContext(2, Math.round(sr * secs), sr);
  const pump = buildAudio(oc, .2 - off, off);                  // begin(): t0 = currentTime + .2 - off
  for (let s = 1; s < secs; s++) oc.suspend(s).then(() => { pump(); oc.resume(); });   // the real timer calls pump() every second
  pump();
  const buf = await oc.startRendering();
  const parts = [buf.getChannelData(0), buf.getChannelData(1)];
  let peak = 0, sq = 0, n = 0;
  for (const d of parts) for (let i = 0; i < d.length; i++) { const v = d[i]; if (!(Math.abs(v) <= peak)) peak = Math.abs(v); sq += v * v; n++; }
  const all = new Uint8Array(parts[0].byteLength * 2); all.set(new Uint8Array(parts[0].buffer, parts[0].byteOffset, parts[0].byteLength), 0);
  all.set(new Uint8Array(parts[1].buffer, parts[1].byteOffset, parts[1].byteLength), parts[0].byteLength);
  const hex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  const hs = hex(await crypto.subtle.digest('SHA-256', all)).slice(0, 16);
  const he = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(EVT)))).slice(0, 16);
  const B = Math.round(sr * .1), feat = [];   // per 0.1 s block and channel: rms of the samples and rms of their first difference (a frequency-sensitive proxy)
  for (const d of parts) for (let b0 = 0; b0 + B <= d.length; b0 += B) { let e = 0, e2 = 0; for (let i = b0; i < b0 + B; i++) { e += d[i] * d[i]; const x = i ? d[i] - d[i - 1] : 0; e2 += x * x; } feat.push(Math.sqrt(e / B), Math.sqrt(e2 / B)); }
  return { hash: hs, evt: he, nevt: EVT.length, peak: +peak.toFixed(5), rms: +Math.sqrt(sq / n).toFixed(6), feat };
}"""


def run_audio(browser, out, style):
    ctx, page, errs = new_page(browser)
    try:
        # ?t=0 = a silent still: no home animation loop eating the CPU, the page is ready with the app's globals
        page.goto(URL + "?t=0&" + BASE, wait_until="load", timeout=120000)
        page.wait_for_function("() => typeof ready !== 'undefined' && ready === true", timeout=120000)
        musics = page.evaluate("() => MUSICS")
        if style:
            if style not in musics:
                raise SystemExit("unknown --style %r; known: %s" % (style, ", ".join(musics)))
            musics = [style]
        for m in musics:
            t1 = time.time()
            res = {}
            for label, off, secs in (("0s", 0, AUDIO_SECS), ("seek%d" % AUDIO_SEEK, AUDIO_SEEK, AUDIO_SEEK_SECS)):
                res[label] = page.evaluate(AUDIO_JS, [m, off, secs, AUDIO_SR])
            exact = {k: {f: v[f] for f in ("hash", "evt", "nevt")} for k, v in res.items()}
            out["audio %s" % m] = ({"hash": h_json(exact), "parts": res}, time.time() - t1)
        if errs:
            raise RuntimeError("page errors: " + "; ".join(errs[:3]))
    finally:
        ctx.close()


# ---------------------------------------------------------------- stills
def run_stills(browser, out):
    for name, q, T in STILLS:
        t1 = time.time()
        ctx, page, errs = new_page(browser, (480, 270))
        try:
            page.goto(URL + "?t=%d&%s&%s" % (T, q, BASE.replace("res=.05", "res=.2").replace("step=.5", "step=1").replace("&debug=1", "")), wait_until="load", timeout=120000)
            # the still loop runs synchronously inside onReady, after it sets body.still: once the class is visible the frames are drawn
            page.wait_for_function("() => document.body.classList.contains('still')", timeout=600000)
            page.wait_for_timeout(100)
            page.add_style_tag(content="body *{visibility:hidden !important} #c{visibility:visible !important}")   # the picture only: the buttons / pupitre fade with timers
            png = page.locator("#c").screenshot()
        finally:
            ctx.close()
        if errs:
            raise RuntimeError("page errors: " + "; ".join(errs[:3]))
        out["still %s" % name] = ({"hash": hashlib.sha256(png).hexdigest()[:16], "bytes": len(png)}, time.time() - t1)


# ---------------------------------------------------------------- local
def make_wav(path):
    """tools/make_sections_wav.py, but with a fixed numpy seed (its noise hats use np.random: a different file on every run)."""
    import numpy as np
    np.random.seed(1)
    argv = sys.argv
    sys.argv = ["make_sections_wav.py", path]
    try:
        runpy.run_path(os.path.join(ROOT, "tools", "make_sections_wav.py"), run_name="__main__")
    finally:
        sys.argv = argv


def run_local(browser, out):
    with tempfile.TemporaryDirectory(prefix="fp-wav-") as d:
        wav = os.path.join(d, "sections.wav")
        make_wav(wav)

        class H(http.server.SimpleHTTPRequestHandler):
            def end_headers(self):
                self.send_header("Access-Control-Allow-Origin", "*")   # the page is file:// (origin null)
                super().end_headers()

            def log_message(self, *x):
                pass

        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H, directory=d))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            t1 = time.time()
            rows = plog_run(browser, "local=http://127.0.0.1:%d/sections.wav&t=%d&%s&energy=2" % (srv.server_address[1], LOCAL_T, BASE), LOCAL_T, True)
            out["local sections.wav E2"] = (plog_case(rows), time.time() - t1)
        finally:
            srv.shutdown()


# ---------------------------------------------------------------- compare / main
def audio_verdict(new, old):
    """(ok, text). Exact hash equal = SAME. Otherwise the section plan (EVT) must be identical and every block feature within AUDIO_TOL."""
    bits, worst = [], 0.0
    for k, v in new["parts"].items():
        o = old["parts"].get(k)
        if o is None:
            return False, "part %s missing in baseline" % k
        for f in ("evt", "nevt"):
            if v[f] != o[f]:
                bits.append("%s section plan (EVT) %s -> %s" % (k, o[f], v[f]))
        if len(v["feat"]) != len(o["feat"]):
            bits.append("%s length %d -> %d" % (k, len(o["feat"]), len(v["feat"])))
            continue
        bad = None
        for i, (x, y) in enumerate(zip(o["feat"], v["feat"])):
            d = abs(x - y)
            worst = max(worst, d / (AUDIO_TOL[0] + AUDIO_TOL[1] * max(abs(x), abs(y))))
            if d > AUDIO_TOL[0] + AUDIO_TOL[1] * max(abs(x), abs(y)) and bad is None:
                bad = (i, x, y)
        if bad:
            nb = len(v["feat"]) // 4   # layout: 2 channels x blocks x (rms, rms of diff)
            bits.append("%s block %d (t=%.1fs) %s %.6g -> %.6g" % (k, bad[0] // 2 % nb, bad[0] // 2 % nb * .1, "rms" if bad[0] % 2 == 0 else "rms-diff", bad[1], bad[2]))
    if bits:
        return False, "; ".join(bits[:3])
    if old["hash"] == new["hash"]:
        return True, "SAME"
    return True, "SAME (float noise only: worst %.1g of the tolerance)" % worst


def verdict(key, new, old):
    """(ok, text) for one case."""
    if key.startswith("audio"):
        return audio_verdict(new, old)
    if old["hash"] == new["hash"]:
        return True, "SAME"
    if key.startswith("plog") or key.startswith("local"):
        return False, "DIFF  " + plog_diff(old["data"], new["data"])
    return False, "DIFF  %s -> %s" % (old["hash"], new["hash"])


def main():
    ap = argparse.ArgumentParser(description="Golden fingerprint check (see the module docstring).")
    ap.add_argument("--only", default="", help="comma list of parts: " + ",".join(PARTS))
    ap.add_argument("--style", default=None, help="audio part: only this music (e.g. electro)")
    ap.add_argument("--save", nargs="?", const=DEFAULT_FILE, default=None, metavar="PATH", help="write the fingerprints (default tools/.fingerprint.json)")
    ap.add_argument("--compare", nargs="?", const=DEFAULT_FILE, default=None, metavar="PATH", help="compare with a saved file (default tools/.fingerprint.json)")
    a = ap.parse_args()
    parts = [p for p in a.only.split(",") if p] or PARTS
    for p in parts:
        if p not in PARTS:
            ap.error("unknown part %r (known: %s)" % (p, ",".join(PARTS)))
    if not os.path.exists(URL[len("file://"):]):
        sys.exit("dist/bicycle-day.html missing: run npm run build")
    base = None
    if a.compare:
        if not os.path.exists(a.compare):
            sys.exit("no baseline at %s: run --save first" % a.compare)
        base = json.load(open(a.compare))["cases"]
    os.nice(10)
    from playwright.sync_api import sync_playwright
    out, times, failed = {}, {}, False
    t00 = time.time()
    runners = {"plog": run_plog, "audio": lambda b, o: run_audio(b, o, a.style), "stills": run_stills, "local": run_local}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=ARGS)
        try:
            for part in [p for p in PARTS if p in parts]:
                t1 = time.time()
                before = set(out)
                try:
                    runners[part](browser, out)
                except Exception as e:
                    failed = True
                    log("%-28s ERROR %s" % (part, str(e).splitlines()[0][:200]))
                times[part] = time.time() - t1
                for key in sorted(set(out) - before, key=list(out).index):
                    new, dt = out[key]
                    if base is None:
                        extra = ""
                        if key.startswith("audio"):
                            pk = [v["peak"] for v in new["parts"].values()]
                            extra = "  peak %s%s" % (pk, "  SILENT" if min(pk) < 1e-4 else "")
                        log("%-28s %s%s  (%.1fs)" % (key, new["hash"], extra, dt))
                    else:
                        old = base.get(key)
                        if old is None:
                            failed = True
                            log("%-28s MISSING in baseline  (%.1fs)" % (key, dt))
                        else:
                            ok, txt = verdict(key, new, old)
                            failed = failed or not ok
                            log("%-28s %s  (%.1fs)" % (key, txt if ok or txt.startswith("DIFF") else "DIFF  " + txt, dt))
                        if key.startswith("audio") and min(v["peak"] for v in new["parts"].values()) < 1e-4:
                            log("%-28s SILENT (no sound in this render)" % key)
        finally:
            browser.close()
    if a.save:
        cur = {"cases": {}}
        if os.path.exists(a.save):
            cur = json.load(open(a.save))
        cur["cases"].update({k: v[0] for k, v in out.items()})
        cur["dist_sha"] = hashlib.sha256(open(URL[len("file://"):], "rb").read()).hexdigest()[:16]
        os.makedirs(os.path.dirname(os.path.abspath(a.save)), exist_ok=True)
        json.dump(cur, open(a.save, "w"), separators=(",", ":"))
        log("saved %d cases to %s" % (len(out), a.save))
    log("time: " + "  ".join("%s %.0fs" % (p, times[p]) for p in times) + "  total %.0fs" % (time.time() - t00))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
