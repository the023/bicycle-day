# Keyboard Map — Bicycle Day (T3 audit)

Read-only audit of `KB`, `KB_ACT`, `CT_KEYS`, `ctrlKey`, `tweakKey`, and the main `keydown` handler. Rows are physical keys during playback (many keys do nothing while the gate is open; Esc still works there). `CL`: 0 auto, 1 assisted, 2 manual. `SHOW` = showcase forced CL 0; `liveOn` = stream/live/local mic.

| key | auto (CL 0) | assisted (CL 1) | manual (CL 2) | conflict? |
|---|---|---|---|---|
| Escape | stop play (or stop live) / close help or drawer; fullscreen exit handled by browser | same | same | no |
| F1–F12 | none | none | none | no |
| Digit0 | unused | unused | unused | no |
| Digit1 | tiles: checkerboard mode | tiles: checkerboard mode | tiles: checkerboard mode | no |
| Digit2 | tiles: wave mode | tiles: wave mode | tiles: wave mode | no |
| Digit3 | tiles: shatter mode | tiles: shatter mode | tiles: shatter mode | no |
| Digit4 | unused (Shift+4 image) | unused (Shift+4 image) | unused (Shift+4 image) | no |
| Digit5 | unused (Shift+5 image) | unused (Shift+5 image) | unused (Shift+5 image) | no |
| Digit6–Digit9 | unused | unused | unused | no |
| Shift+Digit1..5 | switch image (when ≥ that many) | same | same | no |
| Q | kaleidoscope amount − | kaleidoscope amount − | warp toggle | **yes** |
| W | kaleidoscope amount + | kaleidoscope amount + | kaleidoscope: 6 folds | **yes** |
| E | tiles amount − | tiles amount − | feedback trails toggle | **yes** |
| R | tiles amount + | tiles amount + | melt toggle | **yes** |
| T | tiles on/off | tiles on/off (help cap remapped to CT key Y) | tiles on/off (help cap remapped to CT key Y) | no* |
| Y | feedback trails amount − | feedback trails amount − | tiles (checker) toggle | **yes** |
| U | feedback trails amount + | feedback trails amount + | Kali style toggle | **yes** |
| I | intensity amount − | intensity amount − | Julia style toggle | **yes** |
| O | intensity amount + | intensity amount + | tunnel toggle | **yes** |
| P | style cycle (none/Kali/Julia/auto) | style cycle | source stretch toggle | **yes** |
| A | unused | mood: dark toggle | mood: dark toggle | **yes** |
| S | unused | mood: black and white toggle | mood: black and white toggle | **yes** |
| D | unused | mood: blaze toggle | mood: blaze toggle | **yes** |
| F | fullscreen | fullscreen | fullscreen | no |
| G | unused | strobe mood hold | strobe mood hold | **yes** |
| H | help overlay toggle | help overlay toggle | help overlay toggle | no |
| J | strobe grid hold | strobe grid hold | strobe grid hold | no |
| K | unused (browser focus) | pause/resume | pause/resume | **yes** |
| L | live-coding overlay cycle (off/overlay/crazy) | same | same | no |
| BracketLeft | previous image | same | same | no |
| BracketRight | next image | same | same | no |
| V | next image | same | same | no |
| B | bookmark (save JSON + PNG) | same | same | no |
| N | extreme/hardcore toggle (or showcase: next effect) | extreme/hardcore toggle | extreme/hardcore toggle | no† |
| M | cycle control level auto→assisted→manual | same | same | no |
| Z | effects amount − | effects amount − (global) | intensity amount − (engine P) | **yes** |
| X | effects amount + | effects amount + (global) | intensity amount + (engine P) | **yes** |
| C | colour cycle (auto/frozen/b&w) | palette cycle (6 palettes) | palette cycle (6 palettes) | **yes** |
| Comma | transition time shorter | transition time shorter | unused (tweakKey off in manual) | **yes** |
| Period | transition time longer | transition time longer | unused (tweakKey off in manual) | **yes** |
| Semicolon | auto-image cadence cycle | auto-image cadence cycle | unused (tweakKey off in manual) | **yes** |
| ShiftLeft (Shift) | modifier: Shift+1..5 switches images | same | same | no |
| Space | pause/resume | surge hold (CT_KEYS) | surge hold (CT_KEYS) | **yes** |
| Enter | browser default / button | pause/resume | pause/resume | **yes** |
| ArrowLeft | seek −10 s | rotate left (held) | rotate left (held) | **yes** |
| ArrowRight | seek +10 s | rotate right (held) | rotate right (held) | **yes** |
| ArrowUp | unused | zoom in (held) | zoom in (held) | **yes** |
| ArrowDown | unused | zoom out (held) | zoom out (held) | **yes** |

\* `KeyT` is not in `CT_KEYS`; all levels run the same `USER.tile` toggle. In assisted/manual the help overlay's `ctrlHelp` happens to resolve the `KeyT` cap through `CT_KEYS` entry `KeyY`, so the on-screen label changes, but the action does not. No functional conflict.

† `KeyN` also means "next effect segment" in showcase mode (`SHOW`), but showcase forces CL 0 and `setHC` is skipped there. Not a control-level conflict, but a mode-dependent one.

Notes:
- In assisted level, `ctrlKey` returns `false` for `KeyZ`/`KeyX` on purpose so they fall through to `tweakKey` (effects amount). In manual they are consumed by `ctrlKey` (intensity).
- `KeyM` level changes reset effects (`resetFx`).
- Most keys guard on `playing || liveOn`; while the gate is open only `Escape` (drawer/help) and form focus behaviour apply.
- Mouse/wheel are not keys: move = kaleidoscope centre, click = ripple, drag = rotate, wheel = zoom.