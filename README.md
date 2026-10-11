# Bicycle Day

A generative, psychedelic animation built from your images: a WebGL2 shader (warp, kaleidoscope, feedback trails, colour cycling, fractal styles) driven by sound. The sound is either music the app composes itself (Web Audio synth) or music you bring (a file, another browser tab, the microphone). Single HTML file, no dependencies, nothing is uploaded.

The default picture is the Bicycle Day logo. A built-in **gallery** (the 1943 Bicycle Day poster and four public-domain paintings) and your own images can be added, up to 5 at once.

## Run

```bash
npm run build                    # src/ + assets/ (logo, gallery)  →  dist/bicycle-day.html
xdg-open dist/bicycle-day.html   # or double-click it
```

`dist/bicycle-day.html` is committed, so you can also open it without building (Node ≥ 18 is only needed for the build).
Chrome / Edge / Firefox / Safari with WebGL2, sound on. Tab-audio capture (Stream) needs desktop Chrome or Edge.

## Start screen

**Play → Choose your sound**, one of four sources:

| Source | What it does |
|---|---|
| **Generative** | Original music composed by the app (length 1–15 min; journey / waves / slam / intense / hardcore curves; ambient or piano: Gnossienne / Gymnopédie) |
| **Local file** | Pick an audio file; it is analysed first, then played with visuals. You can queue a **next track** (start screen or Settings, during play) and "Play next now" |
| **Tab audio** | Follows music playing in another tab (pick the tab, tick *Share tab audio*; keep both windows visible) |
| **Microphone** | Follows the music in the room (`?live=mic` also opens it) |

**Images**: up to 5 (add with +, ✕ removes, or drop images on the page), plus the built-in **Gallery** (poster and paintings, one click to add). **Settings**: graphics quality (High / Medium / Low; software GL starts on Low), control level, extreme look. **Help**: keyboard overlay.

## Control levels (key M)

| Level | Behaviour |
|---|---|
| **Auto** | The engine alone follows the music. |
| **Assisted** | The engine keeps running; effect and mood keys add on top and fade by themselves after 4.5 s (held keys stay while held). |
| **Manual** | A quiet base plus only what you toggle (stays on until switched off). Generated music uses a 20 min "waves" piece; local / live music plays as usual but the picture ignores the analysis. |

**Extreme** look (key N, or Settings): relentless visuals — no calm start, scenes every 8 s, frequent surges and moods, strobe grid at peaks, fast spin. Look only; the music is not changed. Works with every source at auto / assisted, not in manual. Contains **flashing strobe effects** (full-screen white/dark at 5–11 Hz).

## Keyboard

The same key always means the same thing at every level; a level only enables or greys a key. Keys work at any time while playing. **H** draws the keyboard on screen (greyed = not available at this level, lit = effect on).
Rule for adjustable keys: key = toggle, **Shift+key = less**, **Alt+key = more**.

| Key | Action | From level |
|---|---|---|
| Space | pause / resume | auto |
| ← → ↑ ↓ | rotate / zoom (hold) | auto |
| Shift + ← → | seek −10 s / +10 s | auto |
| 1 … 8 | recall preset n | auto |
| Shift + 1 … 8 | save preset n (Settings also has Load 1–8 / Save 1–8 buttons) | auto |
| Z / X | amount − / + (auto, assisted: global effects amount; manual: intensity) | auto |
| W / E / Y | kaleidoscope / trails / tiles: toggle; Shift/Alt = amount − / + | toggle: assisted; amount: auto |
| T | tile mode: off → checker → wave → shatter (Shift/Alt = tile amount) | auto |
| Q R U I O P | warp / melt / Kali / Julia / tunnel / source stretch: toggle | assisted |
| A S D | mood: dark / black & white / blaze | assisted |
| G / J (hold) | strobe / strobe grid | assisted / auto |
| Enter (hold) | surge: intensity swell | assisted |
| C / Shift+C | palette next / previous (6 palettes) | auto |
| N | extreme look on / off | auto |
| M | control level: auto → assisted → manual | auto |
| V · [ · ] | next image · previous · next | auto |
| ; | auto image: off / 30 s / 60 s / each scene | auto |
| , . | transition time shorter / longer (instant, 1, 3, 5, 10 s; default 3 s) | auto |
| L | live-coding overlay: off / terminal / "crazy" (text goes through the effects) | auto |
| B | bookmark this moment (downloads a `.json` with a reproducible link and a full-resolution `.png`) | auto |
| F · H · Esc | fullscreen · help · stop (in fullscreen the first Esc only leaves fullscreen) | auto |
| mouse | move = kaleidoscope centre, click = ripple, drag = rotate, wheel = zoom | auto |

The full table is in [`KEYMAP.md`](KEYMAP.md). A preset stores the Settings values (effects, tiles, colour, style, transition, …), not the music, the seed or the control level.

## URL parameters

| Param | Meaning | Default |
|---|---|---|
| `arc` | `journey`, `waves`, `slam`, `intense`, `hardcore` (the *extreme* curve) | `journey` |
| `hc` | `1` = extreme look on any curve | off |
| `min` | length in minutes | `5` |
| `music` | `ambient`, `gnossienne`, `gymnopedie` | `ambient` |
| `scale` / `root` | `dorian`, `lydian`, `phrygian`, `minor` / MIDI note | `dorian` / `50` |
| `bpm` | heartbeat tempo range, e.g. `60-130` | per curve |
| `seed` | same seed ≈ same piece (shown at the end) | random |
| `hue` | start hue shift: `random` or radians | `0` |
| `level` | `auto`, `assisted`, `manual` (`ctrl=1` = manual) | saved |
| `quality` | `high`, `medium`, `low` | saved |
| `style` | `kali`, `julia`, `auto` | off |
| `autoimg`, `trans`, `code`, `pal`, `tile`, `tunnel`, `stretch`, `mood`, `surge` | force a setting (testing) | – |
| `live=mic`, `local=<url>` | microphone / play an audio file from an http URL | – |
| `showcase=1` | effects gallery, one effect at a time (`seg=<sec>`; N / P next / previous) | – |
| `t`, `res`, `step` | debug: render one silent still at `t` seconds (see AGENTS.md) | – |

## Layout

```
src/index.html                      the whole app (HTML + CSS + JS + shaders); the logo is a __HOME_LOGO__ placeholder
assets/bicycle-day-logo-home.webp   home screen logo and default picture
assets/gallery/                     built-in gallery images (poster + public-domain paintings, ≤ 1280 px)
build.mjs                           inlines the logo and the gallery, syntax-checks the inline scripts, writes dist/
dist/                               the deliverable single file (committed so it can be opened without building)
tools/                              analysis helpers for the live / local audio features
AGENTS.md, KEYMAP.md                architecture and key map
```

## Privacy and content

Everything runs in your browser. Images and audio you choose, and microphone / tab audio, are analysed locally and never uploaded or recorded. Settings and presets are kept in your browser's localStorage.

The **strobe / extreme** effects can trigger seizures in people with photosensitive epilepsy.

## License

MIT, see [`LICENSE`](LICENSE). The logo is part of this project. Images you load stay yours.

**Gallery credits** (all public domain; resized copies of the files on Wikimedia Commons):

| Image | Work |
|---|---|
| `poster.jpg` | Bicycle Day poster, 1943 |
| `manet-dejeuner-sur-lherbe.jpg` | Édouard Manet, *Le Déjeuner sur l'herbe* (1863) |
| `bosch-garden-of-earthly-delights.jpg` | Hieronymus Bosch, *The Garden of Earthly Delights* (detail) |
| `huys-temptation-of-saint-anthony.jpg` | Pieter Huys, *The Temptation of Saint Anthony* (Louvre) |
| `bruegel-fall-of-the-rebel-angels.jpg` | Pieter Bruegel the Elder, *The Fall of the Rebel Angels* (1562) |
