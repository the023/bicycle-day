"""T154: Live effect usage per Energy (REAL TIME: one browser run per Energy x seed, a fake mic plays the wav).
usage: python3 tools/measure_live.py <wav> [--sec 240] [--energy 0,1,2,3,4] [--seeds 1,2] [--out /tmp/live-tables.md]
Live = the same pipeline as the mic (liveUp / liveLoop in 13-live.js): level=0 (auto), quality low, res .05.
PLOG (window.__plog) is armed after startLive: P sampled every 0.5 s of live time (same fields as measure.py).
LIVE.state is sampled every 0.5 s of wall time (build / drop / breakdown / groove / calm = 0.5 s sample counts).
Scoring = measure.py (stats / mean_stats, "active" = above the effect's `visible` in VIS, seeds averaged).
One browser at a time, nice 10. Markdown on stdout and in --out. Page errors go to stderr."""
import argparse, collections, os, subprocess, sys, tempfile, time
sys.dont_write_bytecode = True   # no __pycache__ in tools/
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import measure as M
from pw import GL_ARGS, NO_SANDBOX
ROOT = os.path.dirname(HERE)
URL = "file://" + os.path.join(ROOT, "dist", "bicycle-day.html")
ARGS = GL_ARGS + [NO_SANDBOX, "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
STATES = ["build", "drop", "breakdown", "groove", "calm"]
ZCOLS = [("zoom<.25 %", 2), ("zoom<.5 %", 1), ("zoom>1.5 %", 4)]   # indexes into M.stats()["zoom"] = (<.7, <.5, <.25, min, >1.5)

def prep_wav(wav, sec):
    """16-bit PCM is used as is; anything else (or a file that is not 16-bit) is converted into a temp wav cut to sec."""
    codec = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name",
                                     "-of", "csv=p=0", wav]).decode().strip()
    if codec == "pcm_s16le": return wav
    out = os.path.join(tempfile.mkdtemp(prefix="measure_live_"), "live16.wav")
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", wav, "-t", str(sec), "-c:a", "pcm_s16le", out])
    return out

def run(pw, wav, sec, e, seed):
    """one Live run: returns (P log, state samples, VIS, page errors)"""
    b = pw.chromium.launch(args=ARGS + ["--use-file-for-fake-audio-capture=" + wav])
    try:
        ctx = b.new_context(viewport={"width": 640, "height": 360}); ctx.grant_permissions(["microphone"]); p = ctx.new_page(); errs = []
        p.on("pageerror", lambda x: errs.append(str(x)))
        p.goto(URL + "?live=mic&res=.05&quality=low&energy=%s&level=0&seed=%s" % (e, seed), wait_until="load", timeout=120000)
        p.wait_for_function("() => typeof ready !== 'undefined' && ready", timeout=120000)
        p.evaluate("() => startLive(true)")
        p.wait_for_function("() => typeof LIVE !== 'undefined' && LIVE && liveOn", timeout=60000)
        p.evaluate("() => { PLOG = window.__plog = []; PLOG.nx = 0; window.__lvst = []; setInterval(() => { if (LIVE) __lvst.push(LIVE.state); }, 500); }")
        time.sleep(sec)
        log = p.evaluate("() => __plog.map(x => Object.assign({}, x))")
        st = p.evaluate("() => __lvst"); vis = p.evaluate("() => VIS")
        return log, st, vis, errs
    finally:
        b.close()

def cell(s, k):
    return "-" if s[k] is None else "%.0f%% / %.2f" % (s[k][0], s[k][1])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wav", help="the input track (required; 16-bit PCM is used as is, else converted)")
    ap.add_argument("--sec", type=float, default=240, help="real seconds of Live per run")
    ap.add_argument("--energy", default="0,1,2,3,4"); ap.add_argument("--seeds", default="1,2")
    ap.add_argument("--out", default="/tmp/live-tables.md")
    a = ap.parse_args(); os.nice(10)
    L = lambda x: [y for y in x.split(",") if y != ""]
    if not os.path.exists(a.wav): raise SystemExit("no such file: " + a.wav)
    wav = os.path.abspath(prep_wav(os.path.abspath(a.wav), a.sec)); seeds = L(a.seeds)
    from playwright.sync_api import sync_playwright
    rows = []; allerr = []
    with sync_playwright() as pw:
        for e in L(a.energy):
            ss, states = [], []
            for s in seeds:
                t1 = time.time()
                log, st, vis, errs = run(pw, wav, a.sec, e, s)
                if not M.VIS: M.VIS.update(vis)
                if errs: allerr += ["E%s seed%s: %s" % (e, s, x) for x in errs[:2]]
                ss.append(M.stats(log)); states.append(collections.Counter(st))
                print("# live E%s seed%s %.0fs: %d P samples, %d state samples" % (e, s, time.time() - t1, len(log), len(st)), file=sys.stderr, flush=True)
            r = M.mean_stats(ss)
            r["states"] = {k: sum(c[k] for c in states) / len(states) for k in STATES}
            rows.append((e, r))
    for x in allerr: print("<!-- page error: %s -->" % x, file=sys.stderr)
    out = ["## Live effect usage (real time, %g s per run, seeds %s averaged, quality low, level auto)" % (a.sec, a.seeds), "",
           "| E | n | scenes | " + " | ".join(k for k, _ in M.FX) + " | " + " | ".join(c for c, _ in ZCOLS) +
           " | light set max / mean | load | " + " | ".join(STATES) + " |",
           "|---|---|---|" + "---|" * len(M.FX) + "---|" * len(ZCOLS) + "---|---|" + "---|" * len(STATES)]
    for e, r in rows:
        load = sum(r[k][1] / M.VIS[k][1] for k, _ in M.FX if r[k] and k in M.VIS and M.VIS[k][1])
        out.append("| %s | %d | %d | " % (e, r["n"], r["scenes"]) + " | ".join(cell(r, k) for k, _ in M.FX) + " | " +
                   " | ".join("%.0f" % r["zoom"][i] for _, i in ZCOLS) + " | %d / %.2f | %.2f | " % (r["lset"][0], r["lset"][1], load) +
                   " | ".join("%.0f" % r["states"][k] for k in STATES) + " |")
    out += ["", "cells: %% active (above the effect's `visible` in VIS; moods: value > .15) / mean. zoom columns: %% of samples below / above the level. "
            "light set = how many of %s are active in one sample. load = sum over the effects of mean / light level (VIS). "
            "states = mean number of 0.5 s state samples per run (seeds averaged; 'listening' not shown)." % ", ".join(M.LSET), ""]
    txt = "\n".join(out)
    open(a.out, "w").write(txt + "\n"); print(txt)

if __name__ == "__main__": main()
