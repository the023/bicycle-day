# Bicycle Day

A generative, psychedelic animation built from one image (default: the 1943 "Bicycle Day" poster).
WebGL2 shader (warp, kaleidoscope, feedback trails) + a Web Audio synth, in a single HTML file. No dependencies.

## Run

```bash
npm run build          # src/ + assets/poster.jpg  →  dist/bicycle-day.html
xdg-open dist/bicycle-day.html   # or just double-click it; click the page to play
```

Chrome / Firefox / Safari with WebGL2. Sound on. Mouse to the bottom edge shows pause, seek, volume (Space = pause, ←/→ = ±10 s).

## Live mode (prototype)

Click **● Listen to a YouTube tab**: in Chrome's share dialog pick the YouTube *tab* and tick *Share tab audio*, then play the video.
Keep this window visible (second window or screen) — a hidden tab stops animating. The animation follows the music (calm / build / drop / groove / breakdown). Nothing is recorded or uploaded. Chrome or Edge on desktop only; `?live=mic` listens to the microphone instead.

## Options

On the start screen: pick a **curve** (journey / waves / slam / intense), a **duration**, or **drop any image** on the page.
Everything can also be set in the URL:

| Param | Meaning | Default |
|---|---|---|
| `arc` | `journey`, `waves`, `slam`, `intense` | `journey` |
| `min` | length in minutes | `5` |
| `scale` / `root` | `dorian`, `lydian`, `phrygian`, `minor` / MIDI note | `dorian` / `50` |
| `bpm` | heartbeat tempo range, e.g. `60-130` | per arc |
| `seed` | same seed ≈ same piece (omit = new each play; shown at the end) | random |
| `hue` | start hue shift: `random` or radians | `0` |
| `t`, `res`, `step` | debug: render one silent still at `t` seconds (see AGENTS.md) | – |

## Keyboard

Keys work at any time while playing (no need to click first); **H** shows this list on screen (also the *Keyboard shortcuts* button on the start screen), click or Esc closes it.

| Key | Action |
|---|---|
| Space | pause / resume |
| ← → | seek −10 s / +10 s |
| Esc | stop (in fullscreen the first Esc only leaves fullscreen) |
| F | fullscreen |
| H | help overlay |
| B | bookmark this moment: downloads `bicycle-bd-<seed>-<sec>s.json` (state, render values, thumbnail) and keeps it in localStorage — give the file/ID to the developer |
| T / 1 2 3 | tiles on-off / tile mode (again = auto) |
| [ ] V / Shift+1..5 | previous-next image / image number |
| mouse | move = kaleidoscope centre, click = ripple, drag = rotate, wheel = zoom |

Controlled mode adds Q W E R Y U I O P (effects), A S D G (moods), Space (surge), Z X (intensity), C (palette), arrows (rotate / zoom).

**Debug / effects gallery:** open `dist/bicycle-day.html?showcase=1&quality=high` — one effect at a time on a plain image (`seg=<sec>` per effect, N / P = next / previous, click the bar to jump).
**Reproduce a bookmarked frame:** the `url` field in the B file (`?t=<sec>&seed=<n>&arc=…`), see AGENTS.md for the headless-Chrome still command.

## Layout

```
src/index.html      the whole app (HTML + CSS + JS + shaders); poster is a __POSTER__ placeholder
assets/poster.jpg   default image (1024 px)
build.mjs           inlines the poster, syntax-checks the inline scripts, writes dist/
dist/               the deliverable single file (committed so it can be opened without building)
```

The poster artwork is third-party; swap `assets/poster.jpg` for your own if you publish this.
