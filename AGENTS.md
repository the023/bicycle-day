# Bicycle Day — Agent Guide

## Project Overview

Single-file generative animation: a WebGL2 fragment shader warps one image (kaleidoscope, domain warp, feedback trails, hue/palette cycling) while a Web Audio synth plays generative music. The picture and the sound follow a shared "arc" (intensity over time).
**Stack:** plain HTML/CSS/JS, WebGL2, Web Audio. No runtime dependencies. Node ≥ 18 only for `build.mjs`.

## Commands

```bash
npm run build     # src/index.html + assets/poster.jpg → dist/bicycle-day.html (also syntax-checks inline scripts)
```
Edit `src/index.html`, never `dist/` (generated; committed on purpose so it opens without a build).

## Architecture (all in `src/index.html`)

- **ARCS** – the sequential part: keyframe tables `[position, [warp, kal, folds, feedback, hueSpeed, palette, sideDark, breath, melt, zoom, aberration, brightness]]` + `marks` (riser/hit/exhale) + optional `bpm`/`drive`. `score(u)` interpolates; `energy(u)` (0–1) is derived from it and drives heartbeat tempo, drone filter, bells, arpeggios.
- **Engine** – `FS_SCENE` (warp/kaleidoscope/feedback → offscreen FBO ping-pong), `FS_SHOW` (aberration/vignette/grain → screen), `render()`; `buildAudio()` (drone, pads, bells, arps, heartbeat, one-off gestures; rolling `pump()` scheduler).
- **Preset/params** – URL params + gate UI (arc, duration, image). One seed per play (`newSeed()`) drives all randomness.
- **Scene look** – `LOOK`/`CAM`/`PALS`/`LIVE_LOOK`: per-state emphasis, 6 palettes and camera tilt that change on every drop (live) or every ~45 s (generated). `?pal=<0-5>` forces a palette (testing). Don't end a `gl.uniform…` line with a `//` comment: it swallows the rest of the line (this once disabled hue/palette).
- **Live scenes** – `liveStep()` has a section detector (fast vs slow average of level/brightness/bass; a lasting gap or a drop starts a new scene: `LIVE.scenes`, `LIVE.kinds[n]` 1 energetic / 0 calm). The scene sets palette, lead effect, tile grid and a ~3 s transition envelope `tr` (zoom punch, warp, tile burst); the instantaneous state only nudges the look. The arc position `LIVE.u` rises fast and falls slowly so a theme doesn't flicker.
- **Presets** – tweak panel values autosave to localStorage (`bicycleday.last`) and 3 slots (`bicycleday.slot1-3`).
- **User tweaks** – `USER` object (sliders/buttons in `#tune`, mouse: move = kaleidoscope centre, click = ripple, drag = rotate, wheel = zoom, keys `1-3`/`T` = tiles). Persistent state on top of the score, never touched by seek. `?tile=<mode>,<N>` forces the tile effect (testing).
- **Transport** – `begin(off)` (re)starts sound at song time `off`; `seekTo`, `togglePause` (AudioContext suspend/resume).

- **Live mode (prototype)** – `startLive()` captures a tab's audio via `getDisplayMedia` (Chrome/Edge desktop; `?live=mic` uses the microphone through the same pipeline), `liveStep()` extracts causal features (per-band auto-gain, kicks, build = brightness+level rising, drop = bass slam), produces `LIVE.u`, a position on the `journey` arc, so `render()` reuses all looks. The tab audio is analysed only, never routed to the speakers.

## Invariants (don't break)

- The picture is a pure function of the audio clock time `t` (`render(t, dt, …)`). Drifting state (`hue`, `rotA`) is integrated per frame and re-derived by `integrateTo(off)` on seek — keep both in sync when changing `render()`.
- Anything added to the **feedback loop** (pass 1) accumulates frame after frame. One-shot flashes (pulse) must be added in the display pass, not pass 1 (this once blew the image out to white).
- No strobing / rapid full-screen flashes (photosensitivity). `intense` = big fast motion, still no strobe.
- The poster must be inlined as a data URI (WebGL rejects `file://` images as textures); user images go through `URL.createObjectURL`, which is fine.

## Testing without a GPU / speakers

Headless Chrome with software GL renders a still at time `t` by stepping the feedback loop silently:

```bash
google-chrome --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1920,1080 --virtual-time-budget=120000 --screenshot=/tmp/f.png \
  "file://$PWD/dist/bicycle-day.html?t=200&res=.3&step=.5&arc=intense&seed=3"
```
`res` shrinks the offscreen buffer, `step` is the simulated frame step (bigger = faster, less exact). Live mode can be tested with real-time fake input: playwright chromium with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-audio-capture=track.wav`, open `?live=mic&debug=1` and read the `LIVE t=…` console lines (state sequence should follow the track's structure). Audio can't be heard this way: smoke-test it by auto-calling `start()` with `--autoplay-policy=no-user-gesture-required` and checking the console for errors.
