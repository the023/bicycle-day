# Bicycle Day — Agent Guide

**Status, decisions and calibration results: kept outside this repo (private notes); the architecture and invariants below are self-contained.**

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
- **Quality** – `QUAL` (high/medium/low): internal resolution, canvas DPR, warp layers, colour fringing/grain. Chosen on the home screen / panel, saved in localStorage; software GL (SwiftShader/llvmpipe) defaults to low. `?quality=high|medium|low` forces it (tests under headless Chrome should pass `quality=high`).
- **Styles** – opt-in (`USER.style`: off/kali/julia/auto): 2D fractal re-sampling (`kaliFold`, `juliaWarp` in FS_SCENE), inspired by raymarched Shadertoy shaders but written from scratch (no NC-SA code is included). `?style=kali|julia|auto` for tests.
- **Mic input** – `micGain` (GainNode between source and analyser, `MICDB` saved in localStorage `bicycleday.micdb`), `METER` (RMS dBFS from `getFloatTimeDomainData`) drawn in `liveLoop`. Declare any top-level `let/const` used by the UI wiring BEFORE that wiring (TDZ error kills the whole script).
- **Multi-image** – `IM[]` (max 5, #1 = poster; home picker is `multiple`, drop works too), `showImg(n)` crossfades ~1.5 s via `uTex2`/`uImgMix` (`texI()` in FS_SCENE; only the source sampling is mixed, the feedback loop is untouched). Keys `Shift+1..5`, `[` / `]`; thumbnail row `#thumbs`.
- **Presets** – tweak panel values autosave to localStorage (`bicycleday.last`) and 3 slots (`bicycleday.slot1-3`).
- **User tweaks** – `USER` object (sliders/buttons in `#tune`, mouse: move = kaleidoscope centre, click = ripple, drag = rotate, wheel = zoom, keys `1-3`/`T` = tiles). Persistent state on top of the score, never touched by seek. `?tile=<mode>,<N>` forces the tile effect (testing).
- **Surges & moods** – `timelines()` builds seeded, irregular timelines (pure functions of `t`): `surgeAt(t)` = intensity swell (rise 15-30 s, fall 6-15 s, then the image recomposes) scaling warp/kal/Kali/Julia/melt/aberration; `moodAt(t)` = dark / bw / blaze / strobe stretches (blaze also fires at the top of big surges). Mood effects live in `FS_SHOW` (`uDark/uBlaze/uStrobe/uRate`), bw reuses `uMono`. `?mood=dark|bw|blaze|strobe` and `?surge=0..1` force them (testing). Slow start (generated only): `calm(t)` ramps 0→1 over `rampT()` = ¼ of the piece (20 s–3 min); it scales surges, zoom swing, source drift, scene/minor punches and Kali/Julia, and moods only start after the ramp. `FS_SHOW` also does the colour grade (saturation/contrast).
- **Showcase / FX registry** – `?showcase=1[&seg=<sec>]` (default 10 s): top-level `const FX = [{name, set(p, k)}]`, one entry per effect. `render()` first builds its final params object `P` (the uniforms read only `P`), then `showcaseParams(P, t)` replaces it with a neutral baseline (plain image) + the active entry (`k` = 0..1 ease in/hold/out; `P.t` = time). Pure function of `t`; `TOTAL = FX.length*seg`. Label `#fxlabel` ("7/28 · name"), ticks on the seek bar (click snaps to an effect start), keys N/P = next/prev. Reuse `FX` for controlled mode: add an effect = add one entry (fields listed in the comment above `FX`). Test: `&quality=high&showcase=1&t=<segment middle>`.
- **Controlled mode** – `?ctrl=1` / the Controlled card (`CTRL`, generated music only, a 20 min 'waves' piece underneath that does not react to keys). `ctrlParams(P,t,dt)` replaces the engine's P by a quiet base and layers the `FX` entries the user switched on (`CT_KEYS`: each runs on a scratch copy of the base, only its delta is added, eased 0.5-0.8 s; strobe = held G, display pass only). Keys: Q W E R Y U I O P effects (warp, kaleido, trails, melt, tiles, Kali, Julia, tunnel, stretch), A S D G moods (dark, bw, blaze, strobe held), Space held = surge, Z/X intensity, C palette, V next image, arrows rotate/zoom, K or Enter pause, H help overlay. Not a pure function of `t` (live input); other modes unaffected. Adding an effect = add its `FX` entry + a `CT_KEYS` row.
- **Hardcore / strobe grid / code overlay** – `hcOn()` (arc `hardcore`, `?hc=1`, Local card toggle `HCLOC`; never in ctrl/showcase/live-stream) tightens `timelines()` (surges, moods), scene period 8 s / minor 2 s (`SP`/`MP` in render), skips `g15`/`calm`/`opening`, palette flips every 4 beats, fast spin `HCspin(t)` (mirrored in `integrateTo`/`integrateLocal`). Strobe grid = `uCells` in FS_SHOW only (`FX` 'strobe grid', J held, CT_KEYS row; HC drives it at surge peaks). Live-coding overlay `CODE`/`codeFeed(P)` (key L, `bicycleday.code`) only reads P.
- **Piano music** – `MUSIC` (ambient/gnossienne/gymnopedie; chips `#mus`, localStorage `bicycleday.music`, `?music=` for tests). A piano choice makes `setArc(name, 1)` swap in the calm `ARCS.piano` (`arcName` stays the user's arc; always call `applyArc()`). `pianoScore()` builds the whole piece as a sorted note list `NOTES` (song time, seeded in `newSeed()`, so seek just resumes the list); `MEL` = melody notes, `noteGlow(t)` gives the picture a very soft breath (heartbeat off: `hbW` = 0). `buildAudio` branches early for `ARC.piano` (additive-partial piano voice, no drone/arps/gestures).
- **Transport** – `begin(off)` (re)starts sound at song time `off`; `seekTo`, `togglePause` (AudioContext suspend/resume).
- **Live mode (prototype)** – `startLive()` captures a tab's audio via `getDisplayMedia` (Chrome/Edge desktop; `?live=mic` uses the microphone through the same pipeline), `liveStep()` extracts causal features (per-band auto-gain, kicks, build = brightness+level rising, drop = bass slam), produces `LIVE.u`, a position on the `journey` arc, so `render()` reuses all looks. The tab audio is analysed only, never routed to the speakers.
- **Local mode** – `loadLocal()` decodes a file (OfflineAudioContext, 44.1 kHz), `analyseLocal()` runs the `liveStep()` features/detectors offline (FFT 2048, 40 fps, zero-phase smoothing, back-dated scene starts, 0.25 s look-ahead) into a timeline; `localView(t)` writes it into the LIVE-shaped object (`LOC` = active timeline, `LIVE` = view) so `render()` is untouched and the picture stays a pure function of `t`; `integrateLocal()` is the seek fast-forward; Intensity follows ABSOLUTE loudness: `ag` = raw band energy vs the track's 95th percentile; `u = lerp(.04,.88,I*ag-gate)` fades in over 6 s, and tension/boost, scene and minor punches are suppressed while `ag` < .3 (a quiet intro stays still). `playLocal()` plays the buffer (`TOTAL` = file length). `?local=<url>` (needs http, `fetch`) plays it, with `&t=` renders a still.

## Invariants (don't break)

- The picture is a pure function of the audio clock time `t` (`render(t, dt, …)`). Drifting state (`hue`, `rotA`) is integrated per frame and re-derived by `integrateTo(off)` on seek — keep both in sync when changing `render()`.
- Anything added to the **feedback loop** (pass 1) accumulates frame after frame. One-shot flashes (pulse) must be added in the display pass, not pass 1 (this once blew the image out to white).
- Strobe is allowed on purpose (owner's call: tool for people used to fast visuals, not for children): the `strobe` mood flashes full-screen white/dark at 5-11 Hz for 6-14 s. Keep it in the display pass only (never pass 1) so it can't accumulate in the feedback loop.
- The poster must be inlined as a data URI (WebGL rejects `file://` images as textures); user images go through `URL.createObjectURL`, which is fine.

## Testing without a GPU / speakers

Headless Chrome with software GL renders a still at time `t` by stepping the feedback loop silently:

```bash
google-chrome --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1920,1080 --virtual-time-budget=120000 --screenshot=/tmp/f.png \
  "file://$PWD/dist/bicycle-day.html?t=200&res=.3&step=.5&arc=intense&seed=3"
```

`res` shrinks the offscreen buffer, `step` is the simulated frame step (bigger = faster, less exact). Live mode can be tested with real-time fake input: playwright chromium with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-audio-capture=track.wav`, open `?live=mic&debug=1` and read the `LIVE t=…` console lines (state sequence should follow the track's structure). Audio can't be heard this way: smoke-test it by auto-calling `start()` with `--autoplay-policy=no-user-gesture-required` and checking the console for errors.
