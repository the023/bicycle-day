# Bicycle Day

A generative, psychedelic animation built from one image (default: the 1943 "Bicycle Day" poster).
WebGL2 shader (warp, kaleidoscope, feedback trails) + a Web Audio synth, in a single HTML file. No dependencies.

## Run

```bash
npm run build          # src/ + assets/poster.jpg  →  dist/bicycle-day.html
xdg-open dist/bicycle-day.html   # or just double-click it; click the page to play
```

Chrome / Firefox / Safari with WebGL2. Sound on. Mouse to the bottom edge shows pause, seek, volume (Space = pause, ←/→ = ±10 s).

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

## Layout

```
src/index.html      the whole app (HTML + CSS + JS + shaders); poster is a __POSTER__ placeholder
assets/poster.jpg   default image (1024 px)
build.mjs           inlines the poster, syntax-checks the inline scripts, writes dist/
dist/               the deliverable single file (committed so it can be opened without building)
```

The poster artwork is third-party; swap `assets/poster.jpg` for your own if you publish this.
