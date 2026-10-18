"""T108: how much each effect is used, per source (silent stills with ?debug=1, window.__plog = P sampled every 0.5 s of song time).
usage: python3 tools/measure.py [--seeds 1,2,3] [--music ambient,electro] [--out /tmp/T108-tables.md]
Generated: seeds x Energy 2/4 x musics. Local: /tmp/sections.wav (tools/make_sections_wav.py) over http.server, Energy 2/4. Live is real-time only: not measured.
Active = value / gauge ref > .15 (refs = PEFF column 5; moods, glitch, ab: 1). Zoom: % of time < .5, < .25, > 1.5, min. Markdown on stdout."""
import argparse, os, subprocess, sys, time, socket, statistics
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "file://" + os.path.join(ROOT, "dist", "bicycle-day.html")
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"]
FX = [("warp", 2), ("kal", 1), ("fb", .9), ("melt", 1.3), ("tile", 1), ("kali", 1), ("julia", 1), ("tun", 1), ("stretch", 1),
      ("ab", 1), ("dark", 1), ("mono", 1), ("blaze", 1), ("strobe", 1), ("cells", 1), ("glitch", 1)]
ZOOM = ["zoom<.5 %", "zoom<.25 %", "zoom min", "zoom>1.5 %"]

def p95(v):
    v = sorted(v); return v[min(len(v) - 1, int(.95 * len(v)))]

def stats(log):
    r = {}
    for k, ref in FX:
        v = [abs(x[k]) for x in log if isinstance(x.get(k), (int, float))]
        if not v: r[k] = None; continue
        r[k] = (100 * sum(a / ref > .15 for a in v) / len(v), statistics.mean(v), p95(v))
    z = [x["zoom"] for x in log]; n = len(z)
    r["zoom"] = (100 * sum(a < .5 for a in z) / n, 100 * sum(a < .25 for a in z) / n, min(z), 100 * sum(a > 1.5 for a in z) / n)
    r["scenes"] = len({x["scene"] for x in log}); r["n"] = n
    return r

def run(browser, qs, T, need_local=False):
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL + "?" + qs, wait_until="load", timeout=120000)
    page.wait_for_function("() => window.__plog && window.__plog.length && window.__plog[window.__plog.length-1].t >= %s" % (T - .6), timeout=900000)
    log = page.evaluate("() => window.__plog.map(x => Object.assign({}, x))")
    if need_local and not page.evaluate("() => !!LOC"): raise SystemExit("local track did not load (fell back to generated)")
    ctx.close()
    if errs: print("<!-- page errors: %s -->" % errs[:2], file=sys.stderr)
    return log

def table(title, rows):
    out = ["### " + title, "", "| run | n | scenes | " + " | ".join(k for k, _ in FX) + " |", "|---|---|---|" + "---|" * len(FX)]
    for name, s in rows:
        out.append("| %s | %d | %d | " % (name, s["n"], s["scenes"]) + " | ".join("-" if s[k] is None else "%.0f%% / %.2f / %.2f" % s[k] for k, _ in FX) + " |")
    out += ["", "cells: % active / mean / p95", "", "| run | " + " | ".join(ZOOM) + " |", "|---|---|---|---|---|"]
    for name, s in rows:
        z = s["zoom"]; out.append("| %s | %.0f | %.0f | %.2f | %.0f |" % ((name,) + z))
    return "\n".join(out) + "\n"

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--seeds", default="1,2,3"); ap.add_argument("--music", default="ambient,electro"); ap.add_argument("--out", default="/tmp/T108-tables.md")
    ap.add_argument("--local-wav", default=None, help="T114: measure this wav (instead of /tmp/sections.wav) as the Local run"); ap.add_argument("--local-t", type=float, default=80, help="song seconds to measure the Local wav")
    ap.add_argument("--energies", default="2,4", help="Local energies"); ap.add_argument("--no-gen", action="store_true", help="skip the generated runs")
    a = ap.parse_args(); os.nice(10); t0 = time.time()
    from playwright.sync_api import sync_playwright
    base = "res=.1&step=.5&quality=low&debug=1"
    gen, loc = [], []
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=ARGS)
        for m in ([] if a.no_gen else a.music.split(",")):
            for e in (2, 4):
                for s in a.seeds.split(","):
                    t1 = time.time(); log = run(b, "t=600&%s&seed=%s&energy=%d&music=%s" % (base, s, e, m), 600)
                    gen.append(("gen %s E%d seed%s" % (m, e, s), e, m, stats(log))); print("# %s E%d s%s %.0fs" % (m, e, s, time.time() - t1), file=sys.stderr, flush=True)
        wav = a.local_wav or "/tmp/sections.wav"
        if not a.local_wav: subprocess.check_call([sys.executable, os.path.join(ROOT, "tools", "make_sections_wav.py"), wav])
        import http.server, functools, threading
        class H(http.server.SimpleHTTPRequestHandler):   # T114: CORS header (the page is file://, origin null) - without it some runs silently fell back to generated music
            def end_headers(self): self.send_header("Access-Control-Allow-Origin", "*"); super().end_headers()
            def log_message(self, *x): pass
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(H, directory=os.path.dirname(os.path.abspath(wav)))); port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            for e in [int(x) for x in a.energies.split(",")]:
                t1 = time.time(); log = run(b, "local=http://127.0.0.1:%d/%s&t=%g&%s&energy=%d" % (port, os.path.basename(wav), a.local_t, base, e), a.local_t, True)
                loc.append(("local E%d" % e, e, stats(log))); print("# local E%d %.0fs" % (e, time.time() - t1), file=sys.stderr, flush=True)
        finally: srv.shutdown()
        b.close()
    out = ["## T108 effect usage (t=600 generated / 80 s local, 0.5 s samples, res=.1 quality=low)", ""]
    out.append(table("Per run", [(n, s) for n, _, _, s in gen] + [(n, s) for n, _, s in loc]))
    # generated average over seeds, per music/energy
    avg = []
    for m in ([] if a.no_gen else a.music.split(",")):
        for e in (2, 4):
            ss = [s for n, ee, mm, s in gen if ee == e and mm == m]
            if not ss: continue
            r = {"n": sum(s["n"] for s in ss), "scenes": round(sum(s["scenes"] for s in ss) / len(ss))}
            for k, _ in FX: r[k] = None if any(s[k] is None for s in ss) else tuple(statistics.mean(s[k][i] for s in ss) for i in range(3))
            r["zoom"] = tuple(statistics.mean(s["zoom"][i] for s in ss) for i in range(4)); avg.append(("gen %s E%d (mean of %d seeds)" % (m, e, len(ss)), r))
    out.append(table("Generated mean over seeds", avg))
    g2 = [s for n, e, m, s in gen if e == 2 and m == a.music.split(",")[0]]; l2 = [s for n, e, s in loc if e == 2]
    if a.no_gen: g2 = []
    if g2 and l2:
        l = l2[0]; out += ["### Generated (%s, mean of seeds) vs local, Energy 2" % a.music.split(",")[0], "", "| effect | gen % active | gen mean | gen p95 | local % active | local mean | local p95 |", "|---|---|---|---|---|---|---|"]
        for k, _ in FX:
            if l[k] is None or any(s[k] is None for s in g2): continue
            gm = [statistics.mean(s[k][i] for s in g2) for i in range(3)]
            out.append("| %s | %.0f%% | %.2f | %.2f | %.0f%% | %.2f | %.2f |" % ((k,) + tuple(gm) + tuple(l[k])))
        gz = [statistics.mean(s["zoom"][i] for s in g2) for i in range(4)]
        out += ["", "| zoom | <.5 % | <.25 % | min | >1.5 % |", "|---|---|---|---|---|", "| generated | %.0f | %.0f | %.2f | %.0f |" % tuple(gz), "| local | %.0f | %.0f | %.2f | %.0f |" % l["zoom"], ""]
    out.append("Live: real-time only, not measured. Runtime %.0f s." % (time.time() - t0))
    txt = "\n".join(out); open(a.out, "w").write(txt + "\n"); print(txt)

if __name__ == "__main__": main()
