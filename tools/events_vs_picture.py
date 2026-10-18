"""T104: musical event times vs picture change times (generated mode, seed=3, 5 min).

Run:  nice -n 10 python3 tools/events_vs_picture.py [--out FILE] [--seed N]
Needs dist/bicycle-day.html (npm run build) built with window.__pic (?debug=1, read only).
Events: global `EVT` array if the page has one (T99 schema {t,k,s,d,sec,e}), else the old plans:
window.*PLAN section starts (via vplan()) and, for styles without a plan, ARC.marks riser start/end, hit, exhale.
Picture change near an event (+-3 s, 0.1 s grid), one channel per kind: section = scene id `wi` changes; hit = `trP` rises past .5 or blaze > .25;
riser end = local max of `sg`; fill / phrase = minor index `mi` changes (the tm > .2 delay is reported, not failed). Column cz = slow-start gate at the event.
--pixels: stills at event -.5 / +.5 for hits and riser ends (max 4 per style), mean PIL diff / median of 3 non-event pairs; ratio > 1.5 = visible.
Run Python without -I (playwright lives in the user site-packages).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check import make_page  # noqa: E402

STYLES = ["electro", "chiptune", "chiptune2", "drone", "gamelan", "minimal", "berlin", "lofi",
          "ambient", "gnossienne3", "tempest", "gymnopedie"]
WIN, STEP, PASS_S = 3.0, 0.1, 1.0

JS = """([evs, win, step]) => {
  // one channel per event kind, so a hit cannot pass on a section's change: section = wi change (also reports trP > .5);
  // hit = trP rising past .5 or blaze > .25; riser = local max of sg around the riser end; fill / phrase = mi change (reports the tm > .2 delay)
  const out = [], g = (t) => window.__pic(t);
  for (const ev of evs) {
    const ref = ev.k === 'riser' ? ev.t + (ev.d || 0) : ev.t, t0 = Math.max(0, ref - win), t1 = Math.min(TOTAL, ref + win);
    const r = { ev, ref, hit: null, note: '', cz: g(ref).cz };
    if (ev.k === 'riser') {
      let best = -1, bt = null; for (let t = t0; t <= t1 + 1e-9; t += step) { const v = g(t).sg; if (v > best + 1e-9) { best = v; bt = t; } }
      r.hit = best > .02 ? [bt, 'sg'] : null; r.note = 'peak sg ' + best.toFixed(2);
    } else {
      let prev = g(t0); const base = prev;
      for (let t = t0 + step; t <= t1 + 1e-9 && (r.hit === null || ev.k === 'fill' || ev.k === 'phrase'); t += step) {
        const p = g(t);
        if (ev.k === 'section') { if (p.wi !== base.wi) r.hit = [t, 'wi']; else if (p.trP > .5 && prev.trP <= .5) r.hit = [t, 'trP']; }
        else if (ev.k === 'hit') { if (p.trP > .5 && prev.trP <= .5) r.hit = [t, 'trP']; else if (p.blaze > .25 && prev.blaze <= .25) r.hit = [t, 'blaze']; }
        else if (p.mi !== prev.mi && (r.hit === null || Math.abs(t - ref) < Math.abs(r.hit[0] - ref))) r.hit = [t, 'mi'];   // the mi change nearest the event (phrases can be dense)
        prev = p;
      }
      if (r.hit && r.hit[1] === 'mi') { let u = r.hit[0]; for (; u <= t1 + 2 && g(u).tm <= .2; u += step); r.note = 'tm>.2 at ' + (u - ref >= 0 ? '+' : '') + (u - ref).toFixed(1); }
      if (ev.k === 'section') { let tt = null; for (let t = t0; t <= t1 + 1e-9; t += step) if (g(t).trP > .5) { tt = t; break; } if (tt !== null) r.note = 'trP>.5 at ' + (tt - ref >= 0 ? '+' : '') + (tt - ref).toFixed(1); }
    }
    out.push(r);
  }
  return out;
}"""


def events_for(page, style):
    """-> list of {t,k,s}"""
    evt = page.evaluate("() => (typeof EVT !== 'undefined' && Array.isArray(EVT) && EVT.length) ? EVT.map(e => ({t: e.t, k: e.k, s: e.s ?? 0, d: e.d ?? 0})) : null")
    if evt:
        return evt, "EVT"
    plan = page.evaluate("() => vplan().map(x => ({a: x.a, e: x.e}))")
    if plan:
        kinds = page.evaluate("""() => { const P = MUSIC === 'electro' ? window.ELECTRO_PLAN : MUSIC === 'drone' ? window.DRONEPLAN : MUSIC.startsWith('chiptune') ? window.CHIPPLAN : MUSIC === 'gamelan' ? window.GAMELANPLAN : MUSIC === 'minimal' ? window.MINIMALPLAN : MUSIC === 'berlin' ? window.BERLINPLAN : MUSIC === 'lofi' ? window.LOFIPLAN : []; return P.map(x => x.kind || 'section'); }""")
        return [{"t": p["a"], "k": "section:" + kinds[i], "s": round(p["e"], 2)} for i, p in enumerate(plan) if i > 0], "plan"
    if style == "ambient":
        m = page.evaluate("() => ({T: TOTAL, m: ARC.marks})")
        T, mk = m["T"], m["m"]
        return [{"t": T * mk["riser"][0], "k": "riser start", "s": 0}, {"t": T * mk["riser"][1], "k": "riser end", "s": 0},
                {"t": T * mk["hit"], "k": "hit", "s": 1}, {"t": T * mk["exhale"], "k": "exhale", "s": 0}], "marks"
    return [], "none"


def pixel_rows(style, seed, evs):
    """Optional: mean abs PIL diff of stills at ref -.5 / +.5 for up to 4 hits / riser ends, vs the median of 3 non-event pairs."""
    import statistics
    import subprocess
    import tempfile
    from PIL import Image, ImageChops, ImageStat
    from check import DIST
    d = tempfile.mkdtemp(prefix="evpix")

    def shot(t, name):
        f = os.path.join(d, name + ".png")
        subprocess.run(["nice", "-n", "10", "google-chrome", "--headless=new", "--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                        "--window-size=480,270", "--virtual-time-budget=120000", "--screenshot=" + f,
                        f"file://{DIST}?t={t:.2f}&res=.3&step=.5&quality=high&seed={seed}&music={style}&min=5"], capture_output=True)
        return Image.open(f).convert("RGB")

    def diff(t):
        return sum(ImageStat.Stat(ImageChops.difference(shot(t - .5, "a"), shot(t + .5, "b"))).mean) / 3
    refs = [(e["t"] + (e.get("d") or 0) if e["k"] == "riser" else e["t"], e["k"]) for e in evs if e["k"] in ("hit", "riser")][:4]
    allt = [e["t"] for e in evs]
    base = []
    for c in range(40, 290, 37):
        if len(base) < 3 and all(abs(c - x) > 4 for x in allt):
            base.append(diff(c))
    med = statistics.median(base) if base else 0
    return [(style, f"{t:.1f}", k + " pixels", "-", "-", f"{(m := diff(t)):.2f} vs median {med:.2f}", f"x{m / med:.1f}" if med else "-", "visible" if med and m / med > 1.5 else "no", "") for t, k in refs]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=None)
    ap.add_argument("--seed", default="3")
    ap.add_argument("--styles", default=",".join(STYLES))
    ap.add_argument("--pixels", action="store_true")
    a = ap.parse_args()
    from playwright.sync_api import sync_playwright
    from check import CHROME_ARGS
    rows, summary = [], []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=CHROME_ARGS)
        for st in a.styles.split(","):
            qs = f"t=1&res=.1&quality=low&seed={a.seed}&music={st}&debug=1&min=5"
            ctx, page, errs = make_page(browser, qs)
            try:
                evs, src = events_for(page, st)
                res = page.evaluate(JS, [evs, WIN, STEP]) if evs else []
                npass = 0
                worst = 0.0
                for r in res:
                    ev, hit = r["ev"], r["hit"]
                    if hit:
                        d = hit[0] - r["ref"]
                        ok = abs(d) <= PASS_S
                        worst = max(worst, abs(d))
                        cell = f"{hit[0]:.1f} ({hit[1]})"
                        dtxt = f"{d:+.1f}"
                    else:
                        ok, cell, dtxt = False, "none in +-3 s", "-"
                        worst = max(worst, WIN)
                    npass += ok
                    rows.append((st, f"{r['ref']:.1f}", ev["k"], f"{ev['s']:.2f}", f"{r['cz']:.2f}", cell, dtxt, "pass" if ok else "FAIL", r["note"]))
                if a.pixels:
                    rows.extend(pixel_rows(st, a.seed, evs))
                if not evs:
                    rows.append((st, "-", "no events today", "-", "-", "-", "-", "n/a", ""))
                summary.append((st, src, len(evs), npass, worst))
                if errs:
                    print(st, "page errors:", errs[:3], file=sys.stderr)
            finally:
                ctx.close()
        browser.close()
    L = ["# T104: musical events vs picture changes (seed=%s, 5 min, generated)" % a.seed, "",
         "Picture change per kind (section: wi; hit: trP > .5 or blaze > .25; riser: sg peak at the riser end; fill/phrase: mi), within +-%.0f s. Pass = |delta| <= %.0f s." % (WIN, PASS_S), "",
         "## Summary", "", "| style | event source | events | pass | worst |delta| s |", "|---|---|---|---|---|"]
    for st, src, n, p, w in summary:
        L.append(f"| {st} | {src} | {n} | {p}/{n} | {w:.1f} |" if n else f"| {st} | {src} | 0 | - | - |")
    L += ["", "## Events", "", "| style | event t (riser: end) | kind | strength | cz | picture change t | delta s | result | note |", "|---|---|---|---|---|---|---|---|---|"]
    L += ["| " + " | ".join(r) + " |" for r in rows]
    txt = "\n".join(L) + "\n"
    print(txt)
    if a.out:
        with open(a.out, "w") as f:
            f.write(txt)


if __name__ == "__main__":
    main()
