"""Automated checks for bicycle-day (T44).

Run:  python3 tools/check.py              all 5 checks, one process each, at most 2 at a time (CHECK_JOBS=n to change), low priority
      python3 tools/check.py --only N     only check N (1..5), run in this process
Opens dist/bicycle-day.html in headless Chromium (software GL) and prints PASS/FAIL.
Run Python without -I (playwright lives in the user site-packages).
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist", "bicycle-day.html")
URL_BASE = "file://" + DIST

CHROME_ARGS = [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-sandbox",
    "--autoplay-policy=no-user-gesture-required",
]

N_CHECKS = 5
JOBS = int(os.environ.get("CHECK_JOBS", "2"))   # browsers running at the same time (default 2; CHECK_JOBS=1 is the gentlest)
RESULT_RE = re.compile(r"^(\d+)\. .*: (PASS|FAIL)(\s|$)")


results = []  # (num, ok)


def record(num, label, ok, detail=""):
    results.append((num, bool(ok)))
    print(f"{num}. {label}: {'PASS' if ok else 'FAIL'}" + (f"  ({detail})" if detail else ""), flush=True)


def wait_ready(page, timeout=60000):
    page.wait_for_function(
        "() => typeof ready !== 'undefined' && ready === true", timeout=timeout
    )


def make_page(browser, qs="", vp=None, init_local_storage=None):
    if vp is None:
        vp = {"width": 1280, "height": 720}
    ctx = browser.new_context(viewport=vp)
    page = ctx.new_page()
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)))
    if init_local_storage:
        for k, v in init_local_storage.items():
            page.add_init_script(
                "localStorage.setItem(%s, %s);"
                % (json.dumps("bicycleday." + k), json.dumps(json.dumps(v)))
            )
    url = URL_BASE + ("?" + qs if qs else "")
    page.goto(url, wait_until="load", timeout=120000)
    wait_ready(page, 120000)
    return ctx, page, errs


def main(only=None):
    from playwright.sync_api import sync_playwright

    def want(n):
        return only is None or only == n

    # ---------- 1. no console/page errors across modes ----------
    if want(1):
        label = "no console/page errors at start (auto, assisted, manual, showcase, hc=1)"
        try:
            modes = [
                ("auto", "quality=low"),
                ("assisted", "quality=low&level=assisted"),
                ("manual", "quality=low&level=manual"),
                ("showcase", "quality=low&showcase=1"),
                ("hc", "quality=low&hc=1"),
            ]
            bad_modes = []
            for name, qs in modes:
                with sync_playwright() as p:
                    browser = p.chromium.launch(args=CHROME_ARGS)
                    ctx, page, errs = make_page(browser, qs=qs)
                    try:
                        page.evaluate("start()")
                    except Exception as e:
                        errs.append("start(): " + str(e))
                    page.wait_for_timeout(2500)
                    browser.close()
                if errs:
                    bad_modes.append(name + ": " + "; ".join(errs[:3]))
            record(
                1,
                label,
                not bad_modes,
                "FAIL in " + " | ".join(bad_modes) if bad_modes else "all clean",
            )
        except Exception as e:
            record(1, label, False, str(e))

    if not any(want(n) for n in range(2, N_CHECKS + 1)):
        return _finish()

    with sync_playwright() as p:
        browser = p.chromium.launch(args=CHROME_ARGS)

        # ---------- 2. pupitre geometry ----------
        if want(2):
            label = "pupitre geometry at 1280x720 (height 100-120, no horizontal overflow)"
            try:
                ctx, page, errs = make_page(browser, qs="quality=low")
                try:
                    page.evaluate("start()")
                except Exception as e:
                    errs.append("start(): " + str(e))
                page.wait_for_timeout(2500)
                geom = page.evaluate(
                    """() => {
                        const q = s => document.querySelector(s);
                        const r = q('#pult').getBoundingClientRect();
                        return {
                            h: r.height,
                            pult: [q('#pult').scrollWidth, q('#pult').clientWidth],
                            pmain: [q('#pmain').scrollWidth, q('#pmain').clientWidth],
                            pmeta: [q('#pmeta').scrollWidth, q('#pmeta').clientWidth],
                        };
                    }"""
                )
                ok_geom = (
                    100 <= geom["h"] <= 120
                    and geom["pult"][0] <= geom["pult"][1] + 1
                    and geom["pmain"][0] <= geom["pmain"][1] + 1
                    and geom["pmeta"][0] <= geom["pmeta"][1] + 1
                )
                record(
                    2,
                    label,
                    ok_geom,
                    "h=%.1f, pult=%s, pmain=%s, pmeta=%s" % (geom["h"], geom["pult"], geom["pmain"], geom["pmeta"]),
                )
            except Exception as e:
                record(2, label, False, str(e))

        # ---------- 3. keys in auto ----------
        if want(3):
            label = "auto keys: C J T , W Q unchanged; Z X N change USER.energy"
            try:
                ctx1, page1, errs1 = make_page(browser, qs="quality=low")
                try:
                    page1.evaluate("start()")
                except Exception as e:
                    errs1.append("start(): " + str(e))
                page1.wait_for_timeout(2500)

                def snap_state():
                    return page1.evaluate(
                        """() => ({ pal: CT.pal, trans: USER.trans, force: USER.force,
                                    on: CT_KEYS.some(e => e.on), energy: USER.energy })"""
                    )

                bad_auto = []
                for code in ["KeyC", "KeyJ", "KeyT", "Comma", "KeyW", "KeyQ"]:
                    before = snap_state()
                    try:
                        page1.evaluate("fireKey(%s)" % json.dumps(code))
                    except Exception as e:
                        bad_auto.append(code + " (err " + str(e) + ")")
                        continue
                    page1.wait_for_timeout(80)
                    after = snap_state()
                    if not (before["pal"] == after["pal"] and before["trans"] == after["trans"]
                            and before["force"] == after["force"] and before["on"] == after["on"]):
                        bad_auto.append(code)
                # Z/X/N must change energy
                energy_changes = []
                for code in ["KeyX", "KeyZ", "KeyN"]:
                    before = page1.evaluate("USER.energy")
                    page1.evaluate("fireKey(%s)" % json.dumps(code))
                    page1.wait_for_timeout(80)
                    after = page1.evaluate("USER.energy")
                    if before == after:
                        energy_changes.append(code)
                ok_auto = (not bad_auto) and (not energy_changes)
                record(
                    3,
                    label,
                    ok_auto,
                    (("unchanged failed: " + ",".join(bad_auto) + " ") if bad_auto else "")
                    + (("did not change: " + ",".join(energy_changes)) if energy_changes else "ok"),
                )
            except Exception as e:
                record(3, label, False, str(e))

        # ---------- 4. assisted ----------
        if want(4):
            label = "assisted: Shift+W lowers kal no toggle; Shift+C palette -1; Shift+Right +10s"
            try:
                ctx2, page2, errs2 = make_page(browser, qs="quality=low&level=assisted")
                try:
                    page2.evaluate("start()")
                except Exception as e:
                    errs2.append("start(): " + str(e))
                page2.wait_for_timeout(2500)

                # Shift+W lowers kal without toggling
                before_kal = page2.evaluate("USER.kal")
                before_on = page2.evaluate("CT_KEYS.find(e => e.code === 'KeyW').on")
                page2.evaluate("fireKey('KeyW', 'keydown', true)")
                page2.wait_for_timeout(300)
                after_kal = page2.evaluate("USER.kal")
                after_on = page2.evaluate("CT_KEYS.find(e => e.code === 'KeyW').on")
                ok_shiftw = (after_kal < before_kal - 1e-9) and (before_on == after_on)

                # Shift+C goes back one palette
                before_pal = page2.evaluate("CT.pal")
                page2.evaluate("fireKey('KeyC', 'keydown', true)")
                page2.wait_for_timeout(100)
                after_pal = page2.evaluate("CT.pal")
                ok_shiftc = (after_pal == (before_pal + 6) % 7)

                # Shift+ArrowRight seeks +10 s
                before_t = page2.evaluate("lastT")
                page2.evaluate("fireKey('ArrowRight', 'keydown', true)")
                page2.wait_for_timeout(300)
                after_t = page2.evaluate("lastT")
                ok_shiftarrow = (after_t - before_t) >= 9.5

                ok_assisted = ok_shiftw and ok_shiftc and ok_shiftarrow and (not errs2)
                record(
                    4,
                    label,
                    ok_assisted,
                    "shiftW=%s (kal %.3f->%.3f, on %s->%s) shiftC=%s (%s->%s) shiftRight=%s (%.2f->%.2f)"
                    % (ok_shiftw, before_kal, after_kal, before_on, after_on, ok_shiftc, before_pal, after_pal,
                       ok_shiftarrow, before_t, after_t),
                )
            except Exception as e:
                record(4, label, False, str(e))

        # ---------- 5. migration ----------
        if want(5):
            label = "migration old preset {fx:0,inten:-1,kal:0} in slot1 -> USER.energy === 0"
            try:
                print("MIGRATION START", flush=True)
                ctx3, page3, errs3 = make_page(
                    browser,
                    qs="quality=low",
                    init_local_storage={"slot1": {"fx": 0, "inten": -1, "kal": 0}},
                )
                print("MIGRATION PAGE READY", flush=True)
                migrated_energy = page3.evaluate("applyTweaks(lsGet('slot1')); USER.energy")
                record(5, label, migrated_energy == 0, "USER.energy=%s" % migrated_energy)
            except Exception as e:
                record(5, label, False, str(e))

        browser.close()

    return _finish()


def _finish():
    total = len(results)
    passed = sum(1 for _, ok in results if ok)
    print("SUMMARY: %d checks, %d PASS, %d FAIL" % (total, passed, total - passed), flush=True)
    return 1 if total - passed else 0


def run_parallel():
    """Run every check in its own process (Playwright sync API is not thread-safe)."""
    script = os.path.abspath(__file__)
    t_all = time.time()
    procs = {}
    ends = {}
    todo = list(range(1, N_CHECKS + 1))
    running = set()
    # software GL (SwiftShader) uses every core per browser: cap the number of browsers at once and run them at low priority so the machine stays usable
    while todo or running:
        while todo and len(running) < JOBS:
            n = todo.pop(0)
            out = tempfile.TemporaryFile(mode="w+")
            proc = subprocess.Popen(
                [sys.executable, "-u", script, "--only", str(n)],
                stdout=out,
                stderr=subprocess.STDOUT,
                preexec_fn=lambda: os.nice(15),
            )
            procs[n] = (proc, out, time.time())
            running.add(n)
        for n in list(running):
            if procs[n][0].poll() is not None:
                ends[n] = time.time()
                running.discard(n)
        time.sleep(0.05)
    total_wall = time.time() - t_all

    passed = failed = 0
    for n in range(1, N_CHECKS + 1):
        proc, out, t0 = procs[n]
        out.seek(0)
        lines = out.read().splitlines()
        out.close()
        wall = ends[n] - t0
        result = None
        for line in lines:
            m = RESULT_RE.match(line)
            if m and int(m.group(1)) == n:
                result = line
                break
        if result is None:
            result = "%d. (no PASS/FAIL line, child exit %s) FAIL" % (n, proc.returncode)
            ok = False
        else:
            ok = RESULT_RE.match(result).group(2) == "PASS"
        passed += ok
        failed += not ok
        print(f"{result}  [wall {wall:.1f} s]", flush=True)

    print(f"total wall {total_wall:.1f} s", flush=True)
    print("SUMMARY: %d checks, %d PASS, %d FAIL" % (passed + failed, passed, failed), flush=True)
    return 1 if failed else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="bicycle-day automated checks")
    ap.add_argument("--only", type=int, choices=range(1, N_CHECKS + 1), metavar="N",
                    help="run only check N (1..%d) in this process" % N_CHECKS)
    args = ap.parse_args()
    try:
        if args.only is None:
            sys.exit(run_parallel())
        sys.exit(main(args.only))
    except SystemExit:
        raise
    except Exception as e:
        print("FATAL:", repr(e))
        sys.exit(1)
