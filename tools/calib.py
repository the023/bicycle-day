"""T144: effect visibility calibration. How much of the picture does each effect change at a given P value?
For every effect field (EFFECTS rows with a gauge + ab + glitch) renders silent stills (?neutral=1&pset=<field>:<v>, see AGENTS.md) at v = ref x STEPS on 2 images
and scores each against the neutral frame with SSIM on grayscale (numpy, gaussian 11x11 sigma 1.5): 1-SSIM = how much the eye sees (0 = same picture).
fb and stretch need a companion (trails show only where something moves, stretch needs its anchor): fb is scored against the companion without fb (warp .5), stretch against anchor .8.
Prints a markdown table (effect x value -> 1-SSIM, per image), the P value where the mean 1-SSIM reaches the VIS levels (log-log interpolation), saves contact sheets
(one row per effect: neutral + one cell per value) and calib.json in --out (default /tmp/T144). One browser, one page reused (the URL changes), nice 10. Runtime and peak memory are printed.
usage: python3 tools/calib.py [--t 20] [--res .3] [--quality high] [--images 0,1] [--only kal,tun] [--sheet name.png] [--levels .08,.25,.5] [--out /tmp/T144]
Run without -I (playwright is in the user site-packages)."""
import argparse, io, json, math, os, sys, threading, time
import numpy as np
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "file://" + os.path.join(ROOT, "dist", "bicycle-day.html")
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"]
# field, ref (gauge full scale: EFFECTS.ref; ab 1, glitch .6 = above its engine range), companion P fields (see docstring)
FIELDS = [("warp", 2, ""), ("kal", 1, ""), ("fb", .9, "warp:.5"), ("melt", 1.3, ""), ("tile", 1, ""), ("kali", 1, ""), ("julia", 1, ""),
          ("tun", 1, ""), ("stretch", 1, "anchor:.8"), ("ab", 1, ""), ("glitch", .6, "")]
STEPS = [.05, .1, .15, .2, .25, .3, .4, .5, .7, 1]   # P = ref x step: the useful range, the same for every effect (the owner's 'light' values sit at .2-.5 of the gauge)
TIMES = {"glitch": [0, .5, 1, 1.5]}   # glitch fires in 0.15 s of some 0.5 s slots (seeded): a single t can miss it, so the score is the mean over 4 slots (t0 + these)
IMAGES = {0: "poster", 1: "Manet (painting, photo-like)"}

def gauss(n=11, s=1.5):
    x = np.arange(n) - n // 2; k = np.exp(-x * x / (2 * s * s)); return k / k.sum()
G = gauss()
def blur(a):   # separable gaussian, valid region only
    k = len(G); h = sum(G[i] * a[:, i:a.shape[1] - k + 1 + i] for i in range(k)); return sum(G[i] * h[i:h.shape[0] - k + 1 + i] for i in range(k))
def ssim(a, b):
    """mean SSIM of two grayscale float arrays (0..255)"""
    c1, c2 = (.01 * 255) ** 2, (.03 * 255) ** 2; ma, mb = blur(a), blur(b)
    saa, sbb, sab = blur(a * a) - ma * ma, blur(b * b) - mb * mb, blur(a * b) - ma * mb
    return float((((2 * ma * mb + c1) * (2 * sab + c2)) / ((ma * ma + mb * mb + c1) * (saa + sbb + c2))).mean())
gray = lambda im: np.asarray(im.convert("L"), dtype=np.float64)
def coarse(a, k=4):   # k x k box average: a score that forgives a small shift / scale of sharp edges (SSIM at full size reads those as a big change)
    h, w = a.shape[0] // k * k, a.shape[1] // k * k; return a[:h, :w].reshape(h // k, k, w // k, k).mean((1, 3))

class Mem:
    """peak PSS of this process and its children (the browser), sampled twice a second"""
    def __init__(self):
        self.peak = 0; self.stop = False
        try: import psutil; self.ps = psutil
        except ImportError: self.ps = None
        if self.ps: threading.Thread(target=self.loop, daemon=True).start()
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

def crossing(vs, ys, level):
    """P value where ys (rising with vs, positive) first reaches level: log-log interpolation, extrapolated from the first / last segment"""
    ly = [math.log(max(y, 1e-5)) for y in ys]; lv = [math.log(v) for v in vs]; L = math.log(level)
    for i in range(len(vs) - 1):
        if ly[i] <= L <= ly[i + 1] or (i == 0 and L < ly[0]):
            d = ly[i + 1] - ly[i]; return math.exp(lv[i] + (L - ly[i]) / d * (lv[i + 1] - lv[i])) if d > 1e-9 else vs[i]
    return None   # never reaches it in range

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--t", default="20"); ap.add_argument("--res", default=".3"); ap.add_argument("--quality", default="high"); ap.add_argument("--step", default=".5")
    ap.add_argument("--images", default="0,1"); ap.add_argument("--only", default=""); ap.add_argument("--levels", default=".08,.25,.5"); ap.add_argument("--sheet", default="", help="file name of the contact sheet (one image only; default <out>/sheet-img<N>.png)"); ap.add_argument("--out", default="/tmp/T144")
    ap.add_argument("--w", type=int, default=640); ap.add_argument("--h", type=int, default=360); ap.add_argument("--seed", default="1")
    a = ap.parse_args(); os.nice(10); t0 = time.time(); mem = Mem(); os.makedirs(a.out, exist_ok=True)
    imgs = [int(x) for x in a.images.split(",")]; levels = [float(x) for x in a.levels.split(",")]
    fields = [f for f in FIELDS if not a.only or f[0] in a.only.split(",")]
    from playwright.sync_api import sync_playwright
    n = 0
    def shot(page, g, pset, dt=0):
        nonlocal n; n += 1
        q = "t=%s&res=%s&step=%s&quality=%s&seed=%s&debug=1&neutral=1&g=%d" % (float(a.t) + dt, a.res, a.step, a.quality, a.seed, g) + ("&pset=" + pset if pset else "")
        page.goto(URL + "?" + q, wait_until="load", timeout=120000)
        page.wait_for_function("() => window.__plog && window.__plog.length && window.__plog[window.__plog.length-1].t >= %s" % (float(a.t) + dt - .6), timeout=300000)
        page.add_style_tag(content="body>*:not(#wrap){display:none !important}")   # the home gate fades out slowly; only the canvas is wanted
        return Image.open(io.BytesIO(page.locator("#c").screenshot())).convert("RGB")
    res = {}   # image -> field -> [(v, 1-ssim)]
    frames = {}   # image -> field -> (neutral frame for the row, [frames])
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=ARGS); ctx = b.new_context(viewport={"width": a.w, "height": a.h}); page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.add_init_script("{const g = new URLSearchParams(location.search).get('g'); if (g) window.__sharedImgs = [{g: +g}];}")   # test only: pick the gallery image for the still
        for g in imgs:
            res[g] = {}; frames[g] = {}; base_cache = {}
            def base(comp, dt):   # the frame without the effect (neutral, or its companion), once per (companion, time)
                if (comp, dt) not in base_cache: im = shot(page, g, comp, dt); base_cache[(comp, dt)] = (gray(im), im)
                return base_cache[(comp, dt)]
            for f, ref, comp in fields:
                rows, fr = [], [base(comp, 0)[1]]; ts = TIMES.get(f, [0])
                for s in STEPS:
                    v = round(ref * s, 5); sc = []
                    for dt in ts:
                        im = shot(page, g, "%s:%g" % (f, v) + ("," + comp if comp else ""), dt); bg = base(comp, dt)[0]; ig = gray(im)
                        sc.append((1 - ssim(bg, ig), 1 - ssim(coarse(bg), coarse(ig))))
                        if dt == ts[0]: fr.append(im)
                    rows.append((v, float(np.mean([x[0] for x in sc])), float(np.mean([x[1] for x in sc]))))
                res[g][f] = rows; frames[g][f] = (fr, ref)
                print("# image %d %s %s (%.0f s)" % (g, f, " ".join("%.3f" % y for _, y, _c in rows), time.time() - t0), file=sys.stderr, flush=True)
        b.close()
    # contact sheets: one row per effect, first cell = the baseline (neutral, or the companion), then one cell per value
    TW, TH = 174, 98; NC = len(STEPS) + 1
    for g in imgs:
        sh = Image.new("RGB", (TW * NC, TH * len(fields)), (20, 20, 20)); d = ImageDraw.Draw(sh)
        for r, (f, ref, comp) in enumerate(fields):
            fr, _ = frames[g][f]
            for c, im in enumerate(fr):
                sh.paste(im.resize((TW, TH), Image.LANCZOS), (c * TW, r * TH))
                lab = (f + (" +" + comp if comp else "") + " base") if c == 0 else "%s=%g  1-SSIM %.3f" % (f, res[g][f][c - 1][0], res[g][f][c - 1][1])
                d.rectangle([c * TW, r * TH, c * TW + len(lab) * 6 + 4, r * TH + 11], fill=(0, 0, 0)); d.text((c * TW + 2, r * TH), lab, fill=(255, 255, 0))
        sh.save(a.sheet if a.sheet and len(imgs) == 1 else os.path.join(a.out, "sheet-img%d.png" % g)) 
    out = ["## 1-SSIM vs neutral (grayscale, gaussian SSIM, %dx%d, t=%s, quality=%s, res=%s)" % (a.w, a.h, a.t, a.quality, a.res), "",
           "Cells = `P value: 1-SSIM`. P = ref x %s. fb is scored against warp .5 without fb, stretch against anchor .8 without stretch, glitch = mean of 4 slots. Images: %s." % ("/".join(str(s) for s in STEPS), ", ".join("%d = %s" % (g, IMAGES.get(g, "gallery " + str(g))) for g in imgs)), ""]
    NS = len(STEPS)
    def tab(g, col, title):
        out.extend([title, "", "| effect | " + " | ".join("step %d" % (i + 1) for i in range(NS)) + " |", "|---|" + "---|" * NS])
        for f, ref, comp in fields:
            cells = ["%g: %.3f" % (r[0], r[col]) for r in res[g][f]]; out.append("| %s | " % f + " | ".join(cells + [""] * (NS - len(cells))) + " |")
        out.append("")
    for g in imgs:
        tab(g, 1, "### image %d (%s)" % (g, IMAGES.get(g, ""))); tab(g, 2, "image %d coarse (4x4 box-averaged frames)" % g)
    out += ["### P value where the mean 1-SSIM (over the images) reaches the level (full size; 'coarse' = the same on 4x4 box-averaged frames, forgives a small shift of sharp edges)", "", "| effect | " + " | ".join("%g" % l for l in levels) + " | 1-SSIM at ref | " + " | ".join("coarse %g" % l for l in levels) + " | coarse at ref |", "|---|" + "---|" * (2 * len(levels) + 2)]
    cross, crossc = {}, {}
    for f, ref, comp in fields:
        vs = [r[0] for r in res[imgs[0]][f]]; ys = [np.mean([res[g][f][i][1] for g in imgs]) for i in range(len(vs))]; yc = [np.mean([res[g][f][i][2] for g in imgs]) for i in range(len(vs))]
        cross[f] = [crossing(vs, ys, l) for l in levels]; crossc[f] = [crossing(vs, yc, l) for l in levels]
        fm = lambda c: "never" if c is None else "%.3f" % c
        out.append("| %s | " % f + " | ".join(fm(c) for c in cross[f]) + " | %.3f | " % ys[-1] + " | ".join(fm(c) for c in crossc[f]) + " | %.3f |" % yc[-1])
    json.dump({"levels": levels, "steps": STEPS, "res": {str(g): res[g] for g in imgs}, "cross": cross, "cross_coarse": crossc}, open(os.path.join(a.out, "calib.json"), "w"), indent=1)
    mb = mem.mb(); out += ["", "Runtime %.0f s for %d stills, peak memory %s." % (time.time() - t0, n, "n/a (pip install psutil)" if mb is None else "%.0f MB PSS (sum over the process tree)" % mb)]
    if errs: out.append("page errors: %s" % errs[:2])
    txt = "\n".join(out); open(os.path.join(a.out, "calib-table.md"), "w").write(txt + "\n"); print(txt)

if __name__ == "__main__": main()
