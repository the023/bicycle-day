"""Automated checks for bicycle-day (T44).

Run:  python3 tools/check.py              all 5 checks in this process, one browser at a time, low priority
      python3 tools/check.py --only N     only check N (1..5)
Opens dist/bicycle-day.html in headless Chromium (software GL) and prints PASS/FAIL.
Run Python without -I (playwright lives in the user site-packages).
"""
import argparse
import json
import os
import sys

from pw import capture_errors, launch, nice

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist", "bicycle-day.html")
URL_BASE = "file://" + DIST

N_CHECKS = 5
# Software GL renders every frame on the CPU. These checks test the UI and the key logic, not the picture, so the
# offscreen buffer is tiny (res=.1 -> 160x90): same code paths and shaders, about half the time. The viewport stays
# 1280x720 because check 2 measures the layout there.
FAST = "quality=low&res=.1"


results = []  # (num, ok)


def record(num, label, ok, detail=""):
    results.append((num, bool(ok)))
    print(f"{num}. {label}: {'PASS' if ok else 'FAIL'}" + (f"  ({detail})" if detail else ""), flush=True)


def wait_ready(page, timeout=60000):
    page.wait_for_function(
        "() => typeof ready !== 'undefined' && ready === true", timeout=timeout
    )


def settle(page, errs, secs=2.5):
    """start() and wait until `secs` s of song time have been drawn (a fixed sleep wastes time when frames are fast and is too short when they are slow)."""
    try:
        page.evaluate("start()")
        page.wait_for_function("() => lastT >= %s" % secs, timeout=60000)
    except Exception as e:
        errs.append("start(): " + str(e))


def make_page(browser, qs="", vp=None, init_local_storage=None):
    if vp is None:
        vp = {"width": 1280, "height": 720}
    ctx = browser.new_context(viewport=vp)
    page = ctx.new_page()
    errs = capture_errors(page)
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

    with sync_playwright() as p:
        browser = launch(p)

        # ---------- 1. no console/page errors across modes ----------
        if want(1):
            label = "no console/page errors at start (auto, assisted, manual, showcase, hc=1)"
            try:
                modes = [
                    ("auto", FAST),
                    ("assisted", FAST + "&level=assisted"),
                    ("manual", FAST + "&level=manual"),
                    ("showcase", FAST + "&showcase=1"),
                    ("hc", FAST + "&hc=1"),
                ]
                bad_modes = []
                for name, qs in modes:
                    ctx, page, errs = make_page(browser, qs=qs)
                    settle(page, errs)
                    ctx.close()
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


        # ---------- 2. pupitre geometry ----------
        # The full pupitre (#pult) is hidden in auto, so it is measured in assisted (same layout as before T78).
        # The minimal auto pupitre (#mpult) is measured in auto: no overflow, and it must be on screen.
        if want(2):
            label = "pupitre geometry at 1280x720 (full: height 100-120; minimal auto: on screen; no horizontal overflow)"
            try:
                geoms = {}
                for qs, sel in [(FAST + "&level=assisted", "pult"), (FAST, "mpult")]:
                    ctx, page, errs = make_page(browser, qs=qs)
                    settle(page, errs)
                    geoms[sel] = page.evaluate(
                        """(sel) => {
                            const q = s => document.querySelector(s);
                            const v = q('#' + sel);
                            const r = v.getBoundingClientRect();
                            const full = sel === 'pult';
                            return {
                                h: r.height, w: r.width, top: r.top,
                                box: [v.scrollWidth, v.clientWidth],
                                pmain: full ? [q('#pmain').scrollWidth, q('#pmain').clientWidth] : [0, 0],
                                pmeta: full ? [q('#pmeta').scrollWidth, q('#pmeta').clientWidth] : [0, 0],
                            };
                        }""",
                        sel,
                    )
                    ctx.close()
                f, m = geoms["pult"], geoms["mpult"]
                ok_geom = (
                    100 <= f["h"] <= 120
                    and f["box"][0] <= f["box"][1] + 1
                    and f["pmain"][0] <= f["pmain"][1] + 1
                    and f["pmeta"][0] <= f["pmeta"][1] + 1
                    and m["h"] > 0
                    and m["w"] > 0
                    and m["top"] >= 0
                    and m["box"][0] <= m["box"][1] + 1
                )
                record(
                    2,
                    label,
                    ok_geom,
                    "full h=%.1f, box=%s, pmain=%s, pmeta=%s | minimal h=%.1f, w=%.0f, box=%s"
                    % (f["h"], f["box"], f["pmain"], f["pmeta"], m["h"], m["w"], m["box"]),
                )
            except Exception as e:
                record(2, label, False, str(e))

        # ---------- 3. keys in auto ----------
        if want(3):
            label = "auto keys: C J T , W Q unchanged; Z X change USER.energy"
            try:
                ctx1, page1, errs1 = make_page(browser, qs=FAST)
                settle(page1, errs1)

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
                # Z/X must change energy
                energy_changes = []
                for code in ["KeyX", "KeyZ"]:
                    before = page1.evaluate("USER.energy")
                    page1.evaluate("fireKey(%s)" % json.dumps(code))
                    page1.wait_for_timeout(80)
                    after = page1.evaluate("USER.energy")
                    if before == after:
                        energy_changes.append(code)
                ok_auto = (not bad_auto) and (not energy_changes)
                ctx1.close()
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
                ctx2, page2, errs2 = make_page(browser, qs=FAST + "&level=assisted")
                settle(page2, errs2)

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

                ctx2.close()
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
                    qs=FAST,
                    init_local_storage={"slot1": {"fx": 0, "inten": -1, "kal": 0}},
                )
                print("MIGRATION PAGE READY", flush=True)
                migrated_energy = page3.evaluate("applyTweaks(lsGet('slot1')); USER.energy")
                ctx3.close()
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


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="bicycle-day automated checks")
    ap.add_argument("--only", type=int, choices=range(1, N_CHECKS + 1), metavar="N",
                    help="run only check N (1..%d) in this process" % N_CHECKS)
    args = ap.parse_args()
    try:
        nice(15)   # software GL uses every core: stay out of the way of the desktop
        if args.only is None:
            sys.exit(main(None))
        sys.exit(main(args.only))
    except SystemExit:
        raise
    except Exception as e:
        print("FATAL:", repr(e))
        sys.exit(1)
