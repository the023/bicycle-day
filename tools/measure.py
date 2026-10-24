"""T108/T137: how much each effect is used (silent stills with ?debug=1, window.__plog = P sampled every 0.5 s of song time).
usage: python3 tools/measure.py [--music electro,ambient] [--arc journey] [--energy 0,2] [--level 0,1] [--min 5] [--seeds 1,2] [--res .05] [--local] [--out /tmp/T137-tables.md]
Settings matrix: music x arc x energy x level x min, one row per setting (seeds averaged). Each run goes to song time min*60 = the real end of the piece
(the slow start scales with the piece length, so --min 5 (default) is the representative one; --min 2 is a quick mode, not representative).
One page at a time, nice 10; time and peak memory (sum of PSS of the whole process tree) are printed at the end.
--local also measures /tmp/sections.wav (tools/make_sections_wav.py, or --local-wav) over http.server, Energy/level from the same lists. Live is real-time only: not measured.
Active (T144) = |value| above the effect's `visible` level (VIS in 08z-effects.js, from tools/calib.py; read from the page); the moods (dark mono blaze strobe cells) have no level and keep value / 1 > .15.
"light set at once" = how many of kali, julia, kal, tile are above `visible` in the same sample (max / mean over the samples). "first visible" = first sample where a big effect (not warp/fb/melt/ab) is active. Zoom: % of time < .7, < .5, < .25, > 1.5, min. Markdown on stdout."""
import argparse, itertools, os, subprocess, sys, time, threading, statistics
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "file://" + os.path.join(ROOT, "dist", "bicycle-day.html")
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"]
FX = [("warp", 2), ("kal", 1), ("fb", .9), ("melt", 1.3), ("tile", 1), ("kali", 1), ("julia", 1), ("tun", 1), ("stretch", 1),
      ("ab", 1), ("dark", 1), ("mono", 1), ("blaze", 1), ("strobe", 1), ("cells", 1), ("glitch", 1)]
BIG = [(k, r) for k, r in FX if k not in ("warp", "fb", "melt", "ab")]   # "first visible effect": the baseline ones (warp, fb, melt, ab) are on from the start
LSET = ["kali", "julia", "kal", "tile"]   # the "light set": the deformations that read as a different picture, how many are on at once
VIS = {}   # field -> [visible, light, strong] P values, read from the built page (VIS in 08z-effects.js) at the first run
def active(k, ref, v): return abs(v) > VIS[k][0] if k in VIS else abs(v) / ref > .15
ZOOM = ["zoom<.7 %", "zoom<.5 %", "zoom<.25 %", "zoom min", "zoom>1.5 %"]

class Mem:
    """Peak memory of this process and all its children (the browser), sampled twice a second: sum of PSS (shared pages counted once), RSS sum as the fallback."""
    def __init__(self):
        self.peak = 0; self.stop = False
        try: import psutil; self.ps = psutil
        except ImportError: self.ps = None
        if self.ps: self.th = threading.Thread(target=self.loop, daemon=True); self.th.start()
    def one(self, p):
        try:
            try: return p.memory_full_info().pss
            except Exception: return p.memory_info().rss
        except Exception: return 0
    def loop(self):
        me = self.ps.Process()
        while not self.stop:
            try: self.peak = max(self.peak, sum(self.one(p) for p in [me] + me.children(recursive=True)))
            except Exception: pass
            time.sleep(.5)
    def mb(self): self.stop = True; return self.peak / 1e6 if self.ps else None

def p95(v):
    v = sorted(v); return v[min(len(v) - 1, int(.95 * len(v)))]

def stats(log):
    r = {}
    for k, ref in FX:
        v = [abs(x[k]) for x in log if isinstance(x.get(k), (int, float))]
        if not v: r[k] = None; continue
        r[k] = (100 * sum(active(k, ref, a) for a in v) / len(v), statistics.mean(v), p95(v))
    z = [x["zoom"] for x in log]; n = len(z)
    r["zoom"] = (100 * sum(a < .7 for a in z) / n, 100 * sum(a < .5 for a in z) / n, 100 * sum(a < .25 for a in z) / n, min(z), 100 * sum(a > 1.5 for a in z) / n)
    r["scenes"] = len({x["scene"] for x in log}); r["n"] = n
    fv = [x["t"] for x in log if any(isinstance(x.get(k), (int, float)) and active(k, ref, x[k]) for k, ref in BIG)]
    r["first"] = fv[0] if fv else None
    ls = [sum(active(k, 1, x[k]) for k in LSET) for x in log]; r["lset"] = (max(ls), statistics.mean(ls))
    return r

def run(browser, qs, T, need_local=False):
    ctx = browser.new_context(viewport={"width": 640, "height": 360}); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL + "?" + qs, wait_until="load", timeout=120000)
    page.wait_for_function("() => window.__plog && window.__plog.length && window.__plog[window.__plog.length-1].t >= %s" % (T - .6), timeout=1800000)
    log = page.evaluate("() => window.__plog.map(x => Object.assign({}, x))")
    if not VIS: VIS.update(page.evaluate("() => VIS"))
    if need_local and not page.evaluate("() => !!LOC"): raise SystemExit("local track did not load (fell back to generated)")
    ctx.close()
    if errs: print("<!-- page errors: %s -->" % errs[:2], file=sys.stderr)
    return log

def mean_stats(ss):
    """seeds averaged: % active / mean / p95 per effect, zoom columns, scenes, first visible (seeds without one are left out; '-' if none)"""
    r = {"n": sum(s["n"] for s in ss), "scenes": round(sum(s["scenes"] for s in ss) / len(ss))}
    for k, _ in FX: r[k] = None if any(s[k] is None for s in ss) else tuple(statistics.mean(s[k][i] for s in ss) for i in range(3))
    r["zoom"] = tuple(statistics.mean(s["zoom"][i] for s in ss) for i in range(5))
    r["lset"] = (max(s["lset"][0] for s in ss), statistics.mean(s["lset"][1] for s in ss))
    f = [s["first"] for s in ss if s["first"] is not None]; r["first"] = statistics.mean(f) if f else None
    return r

def table(title, rows):
    out = ["### " + title, "", "| setting | n | scenes | first visible | light set at once max / mean | " + " | ".join(k for k, _ in FX) + " |", "|---|---|---|---|---|" + "---|" * len(FX)]
    for name, s in rows:
        out.append("| %s | %d | %d | %s | %d / %.2f | " % (name, s["n"], s["scenes"], "-" if s["first"] is None else "%.0f s" % s["first"], s["lset"][0], s["lset"][1]) + " | ".join("-" if s[k] is None else "%.0f%% / %.2f / %.2f" % s[k] for k, _ in FX) + " |")
    out += ["", "cells: %% active (above the effect's `visible` level, moods: value > .15) / mean / p95. light set = how many of %s are above `visible` in a sample. first visible = first sample (0.5 s steps) where any of %s is active (mean over seeds)." % (", ".join(LSET), ", ".join(k for k, _ in BIG)), "",
            "| setting | " + " | ".join(ZOOM) + " |", "|---|---|---|---|---|---|"]
    for name, s in rows:
        z = s["zoom"]; out.append("| %s | %.0f | %.0f | %.0f | %.2f | %.0f |" % ((name,) + z))
    return "\n".join(out) + "\n"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--music", default="electro"); ap.add_argument("--arc", default="journey"); ap.add_argument("--energy", default="2"); ap.add_argument("--level", default="0")
    ap.add_argument("--min", default="5", help="piece length in minutes (list ok); the run goes to min*60. 5 = the default piece; 2 = quick, not representative (the slow start scales with the length)")
    ap.add_argument("--seeds", default="1,2"); ap.add_argument("--res", default=".05", help="offscreen buffer scale (the P log does not read pixels)")
    ap.add_argument("--out", default="/tmp/T137-tables.md")
    ap.add_argument("--local", action="store_true", help="also measure a wav as the Local source (Energy / level from the lists, --local-t seconds)")
    ap.add_argument("--local-wav", default=None, help="the wav for --local (default /tmp/sections.wav, made by tools/make_sections_wav.py)"); ap.add_argument("--local-t", type=float, default=80, help="song seconds to measure the Local wav")
    ap.add_argument("--no-gen", action="store_true", help="skip the generated runs")
    a = ap.parse_args(); os.nice(10); t0 = time.time(); mem = Mem()
    from playwright.sync_api import sync_playwright
    L = lambda x: [y for y in x.split(",") if y != ""]
    base = "res=%s&step=.5&quality=low&debug=1" % a.res
    seeds = L(a.seeds); rows, local_rows, per_run = [], [], []; runs = 0
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=ARGS)
        if not a.no_gen:
            for m, arc, e, lv, mn in itertools.product(L(a.music), L(a.arc), L(a.energy), L(a.level), L(a.min)):
                ss = []
                for s in seeds:
                    T = float(mn) * 60; t1 = time.time()
                    ss.append(stats(run(b, "t=%g&min=%s&%s&seed=%s&energy=%s&level=%s&music=%s&arc=%s" % (T, mn, base, s, e, lv, m, arc), T))); runs += 1
                    print("# %s %s E%s L%s %smin seed%s %.0fs" % (m, arc, e, lv, mn, s, time.time() - t1), file=sys.stderr, flush=True)
                rows.append(("%s/%s E%s L%s %smin%s" % (m, arc, e, lv, mn, "" if float(mn) >= 5 else " (not representative)"), mean_stats(ss)))
        if a.local:
            wav = a.local_wav or "/tmp/sections.wav"
            if not a.local_wav: subprocess.check_call([sys.executable, os.path.join(ROOT, "tools", "make_sections_wav.py"), wav])
            import http.server, functools
            class H(http.server.SimpleHTTPRequestHandler):   # T114: CORS header (the page is file://, origin null) - without it some runs silently fell back to generated music
                def end_headers(self): self.send_header("Access-Control-Allow-Origin", "*"); super().end_headers()
                def log_message(self, *x): pass
            srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H, directory=os.path.dirname(os.path.abspath(wav)))); port = srv.server_address[1]
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            try:
                for e, lv in itertools.product(L(a.energy), L(a.level)):
                    t1 = time.time(); log = run(b, "local=http://127.0.0.1:%d/%s&t=%g&%s&energy=%s&level=%s" % (port, os.path.basename(wav), a.local_t, base, e, lv), a.local_t, True); runs += 1
                    local_rows.append(("local E%s L%s %gs" % (e, lv, a.local_t), stats(log))); print("# local E%s L%s %.0fs" % (e, lv, time.time() - t1), file=sys.stderr, flush=True)
            finally: srv.shutdown()
        b.close()
    out = ["## Effect usage (silent stills, 0.5 s samples, res=%s quality=low, seeds %s averaged)" % (a.res, a.seeds), ""]
    if any(float(x) < 5 for x in L(a.min)) and not a.no_gen: out += ["WARNING: --min below 5 is a quick mode, NOT representative (the slow start scales with the piece length).", ""]
    if rows: out.append(table("Generated, one row per setting (music/arc Energy Level length)", rows))
    if local_rows: out.append(table("Local (%s)" % os.path.basename(a.local_wav or "/tmp/sections.wav"), local_rows))
    out.append("Live: real-time only, not measured.")
    mb = mem.mb(); out.append("Runtime %.0f s for %d runs, peak memory %s (sum over the process tree)." % (time.time() - t0, runs, "n/a (pip install psutil)" if mb is None else "%.0f MB PSS" % mb))
    txt = "\n".join(out); open(a.out, "w").write(txt + "\n"); print(txt)

if __name__ == "__main__": main()
