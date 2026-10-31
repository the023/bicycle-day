"""Shared Playwright launcher for the tools (T193).

Software GL (SwiftShader) flags, the chromium.launch helper and the console / page-error capture.
Tools import it as `from pw import ...` (they run as `python3 tools/x.py`, so tools/ is on sys.path).
Each tool keeps its own difference explicit: `drop=` removes a flag from CHROME_ARGS, `extra=` adds one.
"""
import os

GL_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
NO_SANDBOX = "--no-sandbox"
AUTOPLAY = "--autoplay-policy=no-user-gesture-required"
CHROME_ARGS = GL_ARGS + [NO_SANDBOX, AUTOPLAY]


def nice(n=10):
    """Lower the priority of this process (software GL uses every core)."""
    os.nice(n)


def launch(p, extra=(), drop=(), **kw):
    """Browser from `p` (the sync_playwright() object). args = CHROME_ARGS minus `drop`, then `extra`.
    kw goes to chromium.launch (headless, slow_mo, channel)."""
    args = [a for a in CHROME_ARGS if a not in drop] + list(extra)
    return p.chromium.launch(args=args, **kw)


def capture_errors(page, console=True):
    """List that gets the page's console errors (type error, if console) and page errors ('PAGEERR: ...')."""
    errs = []
    if console:
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)))
    return errs
