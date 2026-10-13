# Keyboard Map — Bicycle Day (T4 final)

Single meaning per key. **Auto (level 0): only Energy (Z X N), Calm (V B), images ([ ] ;), camera (arrows, mouse), presets and the tools work; every other key shows a hint (the engine decides the rest).** A level may only ENABLE or DISABLE a key (disabled = greyed in the help overlay). Extreme mode (HCX/hcOn) only adds things, never remaps. Modifier convention for adjustable keys: key = toggle/primary, Shift+key = amount DOWN, Alt+key = amount UP (Ctrl unused).

CL: 0 auto, 1 assisted, 2 manual. Lmin = minimum control level that enables the key.

| key | meaning (single) | min level | notes |
|---|---|---|---|
| Escape | stop play/live; close help/drawer | 0 | |
| F1–F12 | unused | 0 | |
| Digit0 | unused | 0 | |
| Digit1–Digit8 | recall preset n | 0 | Shift+Digit n saves preset n |
| Shift+Digit1..8 | save preset n | 0 | |
| ArrowLeft/Right/Up/Down | rotate / zoom (held) | 0 | Shift+Left/Right = seek ±10 s |
| Shift+ArrowLeft/Right | seek −/+10 s | 0 | |
| Space | pause / resume | 0 | |
| Enter | surge swell (hold) | 1 | |
| KeyA | mood: dark | 1 | |
| KeyS | mood: black & white | 1 | |
| KeyD | mood: blaze | 1 | |
| KeyG | strobe (hold) | 1 | |
| KeyJ | strobe grid (hold) | 1 | |
| KeyQ | effect: warp | 1 | |
| KeyW | effect: kaleidoscope | 1 | Shift/Alt+W = USER.kal amount |
| KeyE | effect: trails | 1 | Shift/Alt+E = USER.fb amount |
| KeyR | effect: melt | 1 | |
| KeyY | effect: tiles (checker) | 1 | Shift/Alt+Y = USER.tile amount |
| KeyU | effect: Kali style | 1 | |
| KeyI | effect: Julia style | 1 | |
| KeyO | effect: tunnel | 1 | |
| KeyP | effect: source stretch | 1 | style cycle via Settings only |
| KeyT | tile mode cycle (off/checker/wave/shatter) | 1 | Shift/Alt+T = USER.tile amount |
| KeyZ | Energy − (5 steps, picture only) | 0 | every level; in manual Energy scales the toggled effects |
| KeyX | Energy + | 0 | every level |
| KeyC | palette cycle (6 palettes) | 1 | Shift+C = previous palette |
| KeyM | cycle control level (auto/assisted/manual) | 0 | |
| KeyN | Energy 4 (Extreme) ↔ previous Energy (also showcase next) | 0 | |
| KeyF | fullscreen | 0 | |
| KeyH | help overlay | 0 | |
| KeyL | live-coding overlay cycle (auto: engine picks per scene, L = hint) | 1 | |
| KeyB | Calm +10 % (more calm) | 0 | held repeats; Shift+B = mark moment |
| KeyV | Calm −10 % (less calm, more wild) | 0 | held repeats |
| KeyB (Shift) | bookmark (save) moment | 0 | dev snapshot tool |
| BracketLeft | previous image | 0 | |
| BracketRight | next image | 0 | |
| Comma | transition time shorter | 1 | auto: the engine picks the transition per scene |
| Period | transition time longer | 1 | |
| Semicolon | auto-image cadence cycle | 0 | |

Notes:
- Assisted (CL 1): a toggled effect or the palette stays on for its own life, drawn per press: random 4.5-15 s by default, or the pupitre `hold` slider (2-30 s fixed, 31 = until switched off).
- Old pause keys K / Enter (pause) removed; Enter is now surge (levels 1–2).
- Digit row now presets; Shift+Digit1..5 image switching removed (use V / [ / ]).
- Digits 1–3 no longer select tile modes (use T).
- Extreme mode (HCX) may add visuals but never remaps keys.
- Live/mic: no seek; arrows still rotate/zoom via holds.
