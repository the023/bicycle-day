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

On the start screen: pick a **curve** (journey / waves / slam / intense / hardcore), a **duration**, or **drop any image** on the page.
Everything can also be set in the URL:

| Param | Meaning | Default |
|---|---|---|
| `arc` | `journey`, `waves`, `slam`, `intense`, `hardcore` | `journey` |
| `hc` | `1` = hardcore look on any arc (8 s scenes, 2 s minor changes, frequent surges / moods, strobe grid at peaks, no calm start) | off |
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
| J (hold) | strobe grid: 3-5 cells of a 4x4 grid flash white / dark / inverted at 8-14 Hz, the rest of the picture stays (also a held row in controlled mode) |
| L | live-coding, cycles off / overlay / crazy: a terminal bottom-left that "types" the current values (~1 line/s, remembered); crazy = the text is part of the picture and goes through warp, kaleidoscope, tiles, trails, palette (`?code=0\|1\|2` forces it) |
| B | bookmark this moment: downloads `bicycle-bd-<seed>-<sec>s.json` (state, render values, thumbnail) and keeps it in localStorage — give the file/ID to the developer |
| T / 1 2 3 | tiles on-off / tile mode (again = auto) |
| Z / X | **effects down / up** (0 = original image, 100 % = normal, up to 150 %), same as the Effects slider |
| Q W · E R · Y U · I O | kaleidoscope · tiles amount · trails · intensity: − / + by 10 % (Settings sliders) |
| P / C | cycle style (none, Kali, Julia, auto) / colour (auto, frozen, b&w) |
| [ ] / V / Shift+1..5 | previous / next image, next image (all levels), image number |
| M | control level: auto / assisted / manual |
| N | hardcore look on / off during play, any source (generated, local, stream, mic) and level auto / assisted (look only, the music is not changed; not in manual). Also *Hardcore* toggles on the Generative / Stream / Live / Local cards and in Settings |
| mouse | move = kaleidoscope centre, click = ripple, drag = rotate, wheel = zoom |

**Control level** (key **M**, chips *Control: Auto / Assisted / Manual* on the start screen and in Settings, remembered; `?level=auto|assisted|manual`, `?ctrl=1` = manual): works with every music source (generated, stream, mic, local).
- **Auto**: the engine alone; Q W / E R / Y U / I O / P / C / Z X are the slider twins above.
- **Assisted**: the engine keeps running and the effect keys add on top of it; a toggled effect fades out by itself after 4.5 s (held keys stay while held). Q W E R Y U I O P (effects: warp, kaleidoscope, trails, melt, tiles, Kali, Julia, tunnel, stretch), A S D G J (moods: dark, b&w, blaze; G strobe and J strobe grid held), Space (held = surge), C (palette), arrows (rotate / zoom, no seek), K or Enter pause. Z / X stay the global Effects amount.
- **Manual**: a quiet base plus only what you toggle (stays on until switched off); generated music plays a 20 min 'waves' piece underneath, local / live play as usual but the picture ignores the analysis. Z / X = intensity.
Esc / stop clears every held key and effect. V = next image at every level.

**Debug / effects gallery:** open `dist/bicycle-day.html?showcase=1&quality=high` — one effect at a time on a plain image (`seg=<sec>` per effect, N / P = next / previous, click the bar to jump); a side panel (hover the right edge) lists all effects, click one to jump to it.
**Reproduce a bookmarked frame:** the `url` field in the B file (`?t=<sec>&seed=<n>&arc=…`), see AGENTS.md for the headless-Chrome still command.

## Layout

```
src/index.html      the whole app (HTML + CSS + JS + shaders); poster is a __POSTER__ placeholder
assets/poster.jpg   default image (1024 px)
build.mjs           inlines the poster, syntax-checks the inline scripts, writes dist/
dist/               the deliverable single file (committed so it can be opened without building)
```

The poster artwork is third-party; swap `assets/poster.jpg` for your own if you publish this.
