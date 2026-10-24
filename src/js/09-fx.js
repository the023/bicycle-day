/* ════════════════════════ FX: showcase registry (?showcase=1[&seg=10]) ════════════════════════
   One entry per effect: desc (one plain sentence: what you see) + fields (the P fields it sets, see PF in 08z-effects.js) + set(p, k) overrides the final render() params `p` (all neutral first = plain image). k = 0..1 envelope inside the segment
   (ease in, hold, ease out). p fields: warp kal fold fb fbHue hue pal side breath melt zoom rot ab pulse bright anchor tilt[2] srcZ srcRot palC palD ha
   stretch tun mono tile tileN tileMode kali julia dark blaze strobe rate, and p.t (time). Reusable by a later "controlled mode". */
const FX = [
  { name: 'warp', cls: 'gE', desc: 'The picture bends and ripples as if seen through moving water.', fields: ['warp'], set: (p, k) => { p.warp = 1.4 * k; } },
  { name: 'kaleidoscope: 6 folds', cls: 'gE', desc: 'The picture is mirrored into a six-pointed rotating star.', fields: ['kal', 'fold'], set: (p, k) => { p.kal = .95 * k; p.fold = 6; } },
  { name: 'kaleidoscope: 12 folds', cls: 'gN', desc: 'The same star with twelve narrower wedges.', fields: ['kal', 'fold'], set: (p, k) => { p.kal = .95 * k; p.fold = 12; } },
  { name: 'feedback trails', cls: 'gE', desc: 'Moving parts leave glowing, fading trails and the picture slowly turns.', fields: ['fb', 'warp', 'rot'], set: (p, k) => { p.fb = .85 * k; p.warp = .6 * k; p.rot = .6 * k; } },
  { name: 'hue cycling', cls: 'gX', desc: 'All colours slowly rotate around the colour wheel.', fields: ['hue'], set: (p, k) => { p.hue = p.t * .9 * k; } },
  { name: 'palette: rainbow', cls: 'gX', desc: 'The picture is recoloured in smooth rainbow bands.', fields: ['pal'], set: (p, k) => { p.pal = k; } },
  { name: 'palette: ember', cls: 'gX', desc: 'The picture is recoloured in warm orange and red.', fields: ['pal', 'palC', 'palD', 'ha'], set: (p, k) => { p.pal = k; p.palC = PALS[2].c; p.palD = PALS[2].d; p.ha = .3; } },
  { name: 'palette: violet', cls: 'gX', desc: 'The picture is recoloured in violet and blue.', fields: ['pal', 'palC', 'palD', 'ha'], set: (p, k) => { p.pal = k; p.palC = PALS[5].c; p.palD = PALS[5].d; p.ha = .3; } },
  { name: 'melt', cls: 'gE', desc: 'The picture drips and flows downward like warm wax.', fields: ['melt'], set: (p, k) => { p.melt = 1.3 * k; } },
  { name: 'zoom in', cls: 'gN', desc: 'The picture slowly grows to twice its size.', fields: ['zoom'], set: (p, k) => { p.zoom = Math.exp(Math.LN2 * k); } },   // T74: reaches ×2 at full effect (ln2)
  { name: 'zoom out (tiled)', cls: 'gN', desc: 'The picture shrinks and repeats around itself in a tiled field.', fields: ['zoom'], set: (p, k) => { p.zoom = Math.exp(-Math.LN2 * 2 * k); } },   // T74: reaches ×4 out at full effect (0.25, ln4)
  { name: 'rotate', cls: 'gN', desc: 'The whole picture turns around its centre.', fields: ['rot'], set: (p, k) => { p.rot = 2.2 * k; } },
  { name: 'aberration', cls: 'gN', desc: 'The colours split apart at the edges like a bad lens.', fields: ['ab'], set: (p, k) => { p.ab = 2.4 * k; } },
  { name: 'breath', cls: 'gN', desc: 'The picture swells and relaxes like slow breathing.', fields: ['breath'], set: (p, k) => { p.breath = 7 * k; } },
  { name: 'heartbeat pulse', cls: 'gN', desc: 'The picture throbs briefly with each heartbeat.', fields: ['pulse'], set: (p, k) => { p.pulse = k * Math.pow(Math.max(0, Math.sin(p.t * 5)), 4); } },
  { name: 'camera tilt', cls: 'gN', desc: 'The picture sways as if the camera is tilting.', fields: ['tilt'], set: (p, k) => { p.tilt = [.5 * k * Math.sin(p.t * .7), .5 * k * Math.cos(p.t * .55)]; } },
  { name: 'tiles: checker', cls: 'gE', desc: 'The picture breaks into a checkerboard of tiles that slide.', fields: ['tile', 'tileN', 'tileMode'], set: (p, k) => { p.tile = k; p.tileN = 12; p.tileMode = 0; } },
  { name: 'tiles: wave', cls: 'gN', desc: 'The tiles move in a rolling wave.', fields: ['tile', 'tileN', 'tileMode'], set: (p, k) => { p.tile = k; p.tileN = 12; p.tileMode = 1; } },
  { name: 'tiles: shatter', cls: 'gN', desc: 'The tiles burst apart like broken glass.', fields: ['tile', 'tileN', 'tileMode'], set: (p, k) => { p.tile = k; p.tileN = 12; p.tileMode = 2; } },
  { name: 'style: Kali', cls: 'gE', desc: 'The picture is folded again and again into a sharp fractal lattice.', fields: ['kali'], set: (p, k) => { p.kali = .8 * k; } },
  { name: 'style: Julia', cls: 'gE', desc: 'The picture is pulled into soft swirling spirals.', fields: ['julia'], set: (p, k) => { p.julia = .8 * k; } },
  { name: 'tunnel', cls: 'gE', desc: 'The picture repeats inwards forever, as if flying down a tunnel.', fields: ['tun'], set: (p, k) => { p.tun = k; } },
  { name: 'source stretch', cls: 'gE', desc: 'The picture is smeared outward from one point into long streaks.', fields: ['stretch', 'anchor', 'side'], set: (p, k) => { p.stretch = k; p.anchor = .8; p.side = 0; } },
  { name: 'surge (swell)', cls: 'gM', desc: 'Warp, kaleidoscope, melt, aberration and colour swell together.', fields: ['warp', 'kal', 'melt', 'ab', 'pal'], set: (p, k) => { p.warp = 1.2 * k; p.kal = .5 * k; p.melt = .9 * k; p.ab = 1.2 * k; p.pal = .4 * k; } },
  { name: 'mood: dark', cls: 'gM', desc: 'The screen fades toward black while the picture glows faintly.', fields: ['dark'], set: (p, k) => { p.dark = k; } },
  { name: 'mood: black and white', cls: 'gM', desc: 'All colour drains out and the picture turns black and white.', fields: ['mono'], set: (p, k) => { p.mono = k; } },
  { name: 'mood: blaze', cls: 'gM', desc: 'The picture flares bright and saturated, with a little white.', fields: ['blaze'], set: (p, k) => { p.blaze = k; } },
  { name: 'mood: strobe', cls: 'gM', desc: 'The whole screen flashes white and dark several times a second.', fields: ['strobe', 'rate'], set: (p, k) => { p.strobe = k; p.rate = 7; } },
  { name: 'strobe grid', cls: 'gM', desc: 'A grid of cells flashes one after another.', fields: ['cells'], set: (p, k) => { p.cells = k; } },
  // T161 variants (display pass). The accelerating ones ramp over the whole loop from its start (showcaseParams fills sT0 / cT0 with the loop start)
  { name: 'mood: strobe, accelerating', cls: 'gM', desc: 'The screen flashes white and dark, faster and faster.', fields: ['strobe', 'rate', 'rate1', 'sD'], set: (p, k) => { p.strobe = k; p.rate = ENGINE.strobe.acc[0]; p.rate1 = ENGINE.strobe.acc[1]; p.sD = tuneLen(); } },
  { name: 'mood: strobe, negative', cls: 'gM', desc: 'The screen flashes between the picture and its negative.', fields: ['strobe', 'rate', 'sNeg'], set: (p, k) => { p.strobe = k; p.rate = 7; p.sNeg = 1; } },
  { name: 'strobe grid, colour', cls: 'gM', desc: 'A grid of cells flashes in red, yellow, green, blue and magenta instead of white.', fields: ['cells', 'cCol'], set: (p, k) => { p.cells = k; p.cCol = 1; } },
  { name: 'strobe grid, accelerating', cls: 'gM', desc: 'A grid of cells flashes faster and faster.', fields: ['cells', 'cD'], set: (p, k) => { p.cells = k; p.cD = tuneLen(); } },
  { name: 'glitch', cls: 'gN', desc: 'Slices of the picture shift sideways and tear for a moment.', fields: ['glitch'], set: (p, k) => { p.glitch = .8 * k; } },
];

if (SHOW) { TOTAL = FX.length * SHOW.seg; applyArc(); }
const fxIndex = t => clamp(Math.floor(t / SHOW.seg), 0, FX.length - 1);
let fxShown = -1;
/* T117/T118: ?showcase=1 and ?tune=1 are ONE page. The list on the right chooses the effect; each effect plays alone on the neutral baseline in a loop of SHOW.seg seconds (30).
   An effect with an engine group (zoom kal warp tile tun glitch rot strobe kali julia, rule TUNE_G) is drawn from that group's own ENGINE terms (tuneVals) and has curated sliders in the bottom panel;
   any other effect plays its FX entry (set(p, k)) and the panel says "no sliders". Loop on = the selected effect again and again; off = on to the next effect after the segment (the old showcase).
   Sliders mutate ENGINE and bump ENGINE.v (caches check it); the diff is saved in localStorage bicycleday.engine (read back only with showcase/tune). */
const TUNE = SHOW ? { g: null, i: Math.max(0, Math.min(FX.length - 1, Math.floor(+Q.get('fxi')) || 0)),   // ?fxi=<n>: start on effect n (test hook for stills)
   loop: true, off: 0, draw: 0, pause: 3, dir: 1, tm: 0, tk: 0 } : null;
const tuneLen = () => SHOW.seg, TUNE_A = 3;   // loop length (s); where the effect starts inside the loop (s)
const tuneLt = t => { const d = t - TUNE.off, n = tuneLen(); return TUNE.loop ? ((d % n) + n) % n : Math.max(0, d); };
function tuneRestart() { TUNE.off = isFinite(lastT) ? lastT : 0; }
function showcaseParams(p, t) {   // pure function of t and the tune state: neutral baseline (plain image) + the active effect
  const n = tuneLen(), i = TUNE.loop ? TUNE.i : fxIndex(t), lt = TUNE.loop ? tuneLt(t) : clamp(t - i * n, 0, n), f = lt / n, k = t >= TOTAL && !TUNE.loop ? 0 : smooth(0, .2, f) * (1 - smooth(.8, 1, f)), g = TUNE_G(FX[i].fields);
  pfNeutral(p);   // neutral baseline from the P contract (PF in 08z-effects.js)
  if (g) { const v = tuneVals(g, lt); for (const q in v) p[q] = v[q]; } else FX[i].set(p, k);
  if (p.sD > 0) p.sT0 = t - lt; if (p.cD > 0) p.cT0 = t - lt;   // T161: an accelerating variant ramps from the start of its loop
  p.fbHue = (.006 + .02 * p.pal) * p.ha; p.zoom *= USER.zoom;
  if (i !== fxShown) { fxShown = i; TUNE.i = i; const lb = $('fxlabel'); lb.className = FX[i].cls || ''; lb.textContent = (i + 1) + '/' + FX.length + ' · ' + FX[i].name; fxPanelMark(i); tuneShow(i); }
}

const GROUPS = ['zoom', 'kal', 'warp', 'tile', 'tun', 'glitch', 'rot', 'strobe', 'kali', 'julia'];
const tq = id => document.getElementById(id);   // ($ is defined later in the file order)
const TUNE_G = f => { for (const k of f) { if (k === 'fb') return null; if (k === 'kali') return 'kali'; if (k === 'julia') return 'julia'; if (k === 'zoom') return 'zoom'; if (k === 'kal' || k === 'fold') return 'kal'; if (k === 'warp') return 'warp'; if (k.startsWith('tile')) return 'tile'; if (k === 'tun') return 'tun'; if (k === 'glitch') return 'glitch'; if (k === 'rot') return 'rot'; if (k === 'strobe') return f.includes('sNeg') || f.includes('rate1') ? null : 'strobe'; } return null; };   // T161: the strobe variants play their own FX entry, not the group's plain stretch

function tuneLeaves(g) { const o = [], d = g === 'rot' ? Object.fromEntries(['spinBase', 'spinKal', 'spinWob'].map(k => [k, ENGINE.kal[k]])) : ENGINE[g]; for (const k in d) { const src = g === 'rot' ? ENGINE.kal : d; if (Array.isArray(d[k])) d[k].forEach((_, j) => o.push([k + '[' + j + ']', src[k], j])); else o.push([k, src, k]); } return o; }
function tuneDiff() { const out = {}; for (const g of ['zoom', 'kal', 'warp', 'tile', 'tun', 'glitch', 'strobe', 'kali', 'julia']) for (const k in ENGINE[g]) { if (JSON.stringify(ENGINE[g][k]) !== JSON.stringify(ENGINE_DEF[g][k])) (out[g] || (out[g] = {}))[k] = ENGINE[g][k]; } return out; }   // (rotation sliders live in kal.spin*; the tune-only values pause / direction / tile mode are not ENGINE leaves and are not exported)
function tuneSave() { const d = tuneDiff(), j = JSON.stringify(d); try { if (Object.keys(d).length) localStorage.setItem('bicycleday.engine', j); else localStorage.removeItem('bicycleday.engine'); } catch (e) {} const x = tq('tuneout'); if (x) x.value = Object.keys(d).length ? j : '{}'; return j; }
// Curated sliders (plain names). p = [group, leaf(, index)] in ENGINE; pair = moves both ends of an [a, b] range (shown = the mean); arr = scales a list; ks = scales several leaves of the group together (shown = the first); o = a tune-only value on TUNE (not an ENGINE leaf); rs = timing: the loop restarts on release
const TUNE_CUR = {
  zoom: [
    { n: 'Zoom-in depth', d: 'How big the picture gets in the zoom-in (x).', p: ['zoom', 'fIn'], pair: 1, lo: 1.1, hi: 2, st: .01 },
    { n: 'Zoom-out depth', d: 'How small the picture gets in the zoom-out (lower = deeper).', p: ['zoom', 'fOut'], pair: 1, lo: .1, hi: 1, st: .01 },
    { n: 'Far out depth', d: 'Depth of the very deep zoom-out (New draw plays one every 3rd time).', p: ['zoom', 'fFar'], pair: 1, lo: .1, hi: .6, st: .01 },
    { n: 'Slow glide length (s)', d: 'Whole length of a slow zoom (New draw: even draws play slow ones; the loop cuts them to fit).', p: ['zoom', 'durSlow'], pair: 1, lo: 8, hi: 60, st: 1, rs: 1 },
    { n: 'Slow glide ease (s)', d: 'How long a slow zoom takes to go in and to come back (at most half its length).', p: ['zoom', 'easeSlow'], pair: 1, lo: 3, hi: 25, st: .5, rs: 1 },
    { n: 'Fast jump length (s)', d: 'How long a fast zoom stays (New draw: odd draws play fast ones).', p: ['zoom', 'durFast'], pair: 1, lo: 2, hi: 24, st: .5, rs: 1 },
    { n: 'Fast jump time (s)', d: 'How quickly a fast zoom jumps.', p: ['zoom', 'easeFast'], pair: 1, lo: .2, hi: 4, st: .1, rs: 1 },
    { n: 'Fast jump return (s)', d: 'How long a fast zoom takes to come back.', p: ['zoom', 'easeBack'], lo: .5, hi: 10, st: .5, rs: 1 },
    { n: 'Pause in-out (s)', d: 'Tune only (not an engine value): the wait between the zoom-in and the zoom-out.', o: 'pause', lo: 0, hi: 8, st: .5, rs: 1 }],
  kal: [
    { n: 'Max amount', d: 'Upper limit of the kaleidoscope.', p: ['kal', 'max'], lo: 0, hi: 1.5, st: .01 },
    { n: 'Base amount', d: 'Amount during a surge before its boost (share of the max).', p: ['kal', 'base'], lo: 0, hi: 1, st: .01 },
    { n: 'Surge boost', d: 'How much the surge adds on top.', p: ['kal', 'surge'], lo: 0, hi: 2, st: .01 },
    { n: 'Folds (min)', d: 'Least number of mirror wedges.', p: ['kal', 'foldMin'], lo: 2, hi: 16, st: 1 },
    { n: 'Fold wobble', d: 'How much the wedge count breathes.', p: ['kal', 'foldWob'], lo: 0, hi: 5, st: .1 },
    { n: 'Closer (x)', d: 'Pattern scale: higher = the wedges show a smaller part of the picture, so the shapes are bigger and have less fine detail (1 = the old look).', p: ['kal', 'zoom'], inv: 1, lo: .5, hi: 3, st: .01 }],
  kali: [
    { n: 'Closer (x)', d: 'Higher = closer to the fractal: bigger shapes, less fine detail (1 = the old look).', p: ['kali', 'zoom'], inv: 1.4, lo: .5, hi: 4, st: .01 },
    { n: 'Detail (folds)', d: 'Number of fold passes: fewer = smoother and bigger, more = finer lattice.', p: ['kali', 'iter'], lo: 1, hi: 12, st: 1 },
    { n: 'Fold scale', d: 'How strongly each pass scales the picture up (the slow wobble stays on top).', p: ['kali', 'scale'], lo: .8, hi: 1.8, st: .01 }],
  julia: [
    { n: 'Closer (x)', d: 'Higher = closer to the Julia border: bigger spirals, less fine detail (1 = the old look).', p: ['julia', 'zoom'], inv: .7, lo: .5, hi: 4, st: .01 },
    { n: 'Detail (iterations)', d: 'Number of Julia iterations: fewer = smoother, more = finer spirals.', p: ['julia', 'iter'], lo: 1, hi: 16, st: 1 },
    { n: 'Drift', d: 'How far the Julia constant wanders (0 = it holds still, 1 = the old drift).', p: ['julia', 'drift'], lo: 0, hi: 3, st: .01 }],
  warp: [
    { n: 'Base amount', d: 'Warp during a surge before its boost.', p: ['warp', 'base'], lo: 0, hi: 2, st: .01 },
    { n: 'Surge boost', d: 'How much the surge adds on top.', p: ['warp', 'surge'], lo: 0, hi: 3, st: .01 },
    { n: 'Wobble', d: 'Slow in/out wobble of the warp amount.', p: ['warp', 'wob'], lo: 0, hi: 1, st: .01 }],
  tile: [
    { n: 'Tiles per side', d: 'Grid size (scales the list of sizes; New draw picks another one).', p: ['tile', 'sizes'], arr: 1, lo: 2, hi: 40, st: 1 },
    { n: 'Fade-in ends', d: 'Where in the loop (share) the tiles are fully in.', p: ['tile', 'win', 1], lo: .15, hi: .6, st: .01 },
    { n: 'Fade-out starts', d: 'Where in the loop (share) the tiles begin to leave.', p: ['tile', 'win', 2], lo: .4, hi: .95, st: .01 },
    { n: 'Tile mode', d: '0 checker, 1 wave, 2 shatter (tune only).', o: 'tm', lo: 0, hi: 2, st: 1 }],
  tun: [
    { n: 'Duration (s)', d: 'How long the tunnel stays.', p: ['tun', 'dur'], pair: 1, lo: 3, hi: 24, st: .5 },
    { n: 'Fade-in (s)', d: 'Ease in.', p: ['tun', 'easeIn'], lo: .3, hi: 10, st: .1 },
    { n: 'Fade-out (s)', d: 'Ease out.', p: ['tun', 'easeOut'], lo: .3, hi: 10, st: .1 }],
  glitch: [
    { n: 'Amount', d: 'How strong a burst is (the picture tears sideways).', p: ['glitch', 'amp'], ks: ['amp', 'ampVar'], lo: .05, hi: .6, st: .01 },
    { n: 'Burst length (s)', d: 'How long one burst lasts.', p: ['glitch', 'durMin'], ks: ['durMin', 'durVar'], lo: .2, hi: 5, st: .1 },
    { n: 'Time between (s)', d: 'The engine rolls a burst chance every this many seconds (35 %); here every cell fires.', p: ['glitch', 'cell'], lo: 4, hi: 30, st: 1 }],
  rot: [
    { n: 'Speed (rad/s)', d: 'Steady rotation speed of the picture.', p: ['kal', 'spinBase'], lo: 0, hi: .5, st: .005 },
    { n: 'Speed with kal', d: 'Extra speed that grows with the kaleidoscope (shown here at half).', p: ['kal', 'spinKal'], lo: 0, hi: 1, st: .01 },
    { n: 'Wobble', d: 'Slow speeding up and slowing down.', p: ['kal', 'spinWob'], lo: 0, hi: .5, st: .005 },
    { n: 'Direction', d: '1 one way, -1 the other (tune only; the engine picks per seed).', o: 'dir', lo: -1, hi: 1, st: 2 }],
  strobe: [
    { n: 'Flash rate (Hz)', d: 'Flashes per second.', p: ['strobe', 'rate'], pair: 1, lo: 1, hi: 20, st: .5 },
    { n: 'Strength', d: 'How bright and dark the flashes are.', p: ['strobe', 'amount'], lo: .05, hi: 1.5, st: .01 },
    { n: 'Burst length (s)', d: 'How long the strobe stretch lasts.', p: ['strobe', 'dur'], pair: 1, lo: 2, hi: 24, st: .5 }],
};
function tuneCurGet(c) { if (c.o) return TUNE[c.o] || 0; const o = ENGINE[c.p[0]][c.p[1]]; const v = c.p.length > 2 ? o[c.p[2]] : o; return c.inv ? c.inv / v : c.pair ? (v[0] + v[1]) / 2 : c.arr ? v[1] : v; }   // inv: shown = ref / leaf (a 'closer' factor from a scale, 1 = the old look)
function tuneCurSet(c, v) {
  if (c.o) { TUNE[c.o] = v; return; }
  const o = ENGINE[c.p[0]];
  if (c.inv) { o[c.p[1]] = c.inv / v; return; }
  if (c.ks) { const cur = o[c.ks[0]], s = cur > 0 ? v / cur : 1; for (const k of c.ks) o[k] = cur > 0 ? o[k] * s : v; return; }
  if (c.pair || c.arr) { const a = o[c.p[1]], cur = c.pair ? (a[0] + a[1]) / 2 : a[1], s = cur > 0 ? v / cur : 1; for (let i = 0; i < a.length; i++) a[i] = c.arr ? Math.max(1, Math.round(a[i] * s)) : cur > 0 ? a[i] * s : v; }
  else if (c.p.length > 2) o[c.p[1]][c.p[2]] = v; else o[c.p[1]] = v;
}
// the isolated value(s) of a group at loop time lt (s), from the group's own ENGINE terms. kal / warp / tile / tun / glitch / strobe are exactly 0 outside their event.
// kal, warp: a fixed surge shape (rise 2-12 s, fall 12-22 s) scales the effect: value = s * engine formula at sg = s. tile: the window across the loop. tun: from TUNE_A. zoom: the real zoomPulseAt of one in then one out pulse (hook TUNE_ZL).
// glitch: glitchBurst fires in every cell. strobe: one stretch from TUNE_A. rot: the integrated spin from the loop start (kal0 = .5 stands in for the arc).
const tuneSurge = lt => lt < 12 ? smooth(2, 12, lt) : 1 - smooth(12, 22, lt);
function tuneZoomList() {   // zoom in -> pause -> zoom out (the engine draws in OR out per pulse; this loop plays both with the engine's own ranges). Even draws = slow glides (cut to fit the loop), odd = fast jumps
  const Z = ENGINE.zoom, r = mulberry32(Math.floor(PH * 1e5) + 12345 + 977 * TUNE.draw), rr = (a, b) => a + (b - a) * r(), n = tuneLen(), fast = TUNE.draw % 2 === 1, dr = fast ? Z.durFast : Z.durSlow, er = fast ? Z.easeFast : Z.easeSlow, e2 = fast ? Z.easeBack : null, room = n - 1 - TUNE_A - TUNE.pause;
  const di = Math.max(1, Math.min(fast ? 1e9 : room * .45, rr(dr[0], dr[1]))), ei = rr(er[0], er[1]), fi = Math.min(Z.max, Math.max(Z.min, rr(Z.fIn[0], Z.fIn[1])));
  const far = TUNE.draw % 3 === 2, fr = far ? Z.fFar : Z.fOut, a2 = TUNE_A + di + TUNE.pause, do_ = Math.max(1, Math.min(n - 1 - a2, rr(dr[0], dr[1]))), eo = rr(er[0], er[1]), fo = Math.min(Z.max, Math.max(Z.min, rr(fr[0], fr[1])));
  return [{ a: TUNE_A, b: TUNE_A + di, f: fi, e: ei, e2: e2 ?? ei }, { a: a2, b: a2 + do_, f: fo, e: eo, e2: e2 ?? eo }];
}
if (TUNE) TUNE_ZL = tuneZoomList;
function tuneVals(g, lt) {
  if (g === 'zoom') return { zoom: zoomPulseAt(lt) };
  if (g === 'kal') { const E = ENGINE.kal, s = tuneSurge(lt); return { kal: clamp(s * E.max * (E.base + E.surge * s)), fold: Math.max(E.foldMin, 6 + E.foldWob * wob(lt, 4)) }; }
  if (g === 'kali' || g === 'julia') { const f = lt / tuneLen(); return { [g]: .8 * smooth(0, .2, f) * (1 - smooth(.8, 1, f)) }; }   // same ease in / hold / out as the FX entry
  if (g === 'warp') { const E = ENGINE.warp, s = tuneSurge(lt); return { warp: s * (1 + E.wob * wob(lt, 1)) * (E.base + E.surge * s) }; }
  if (g === 'tile') { const E = ENGINE.tile, w = lt / tuneLen(); return { tile: clamp(smooth(E.win[0], E.win[1], w) * (1 - smooth(E.win[2], E.win[3], w))), tileN: E.sizes[(1 + TUNE.draw) % E.sizes.length], tileMode: Math.round(TUNE.tm || 0) }; }
  if (g === 'tun') { const E = ENGINE.tun, b = TUNE_A + (E.dur[0] + E.dur[1]) / 2; return { tun: smooth(TUNE_A, TUNE_A + E.easeIn, lt) * (1 - smooth(b - E.easeOut, b, lt)) }; }
  if (g === 'glitch') return { glitch: glitchBurst(lt, true) };
  if (g === 'strobe') { const E = ENGINE.strobe, a = TUNE_A, b = a + (E.dur[0] + E.dur[1]) / 2, rp = Math.min(1.5, (b - a) / 2); return { strobe: E.amount * smooth(a, a + rp, lt) * (1 - smooth(b - rp, b, lt)), rate: (E.rate[0] + E.rate[1]) / 2 }; }
  if (g === 'rot') { const E = ENGINE.kal; let a = 0; for (let s = 0; s < lt; s += .1) a += .1 * (E.spinBase + E.spinKal * .5 + E.spinWob * wob(s, 5)); return { rot: TUNE.dir * a }; }
  return {};
}
const TUNE_VMAX = { kal: 1, warp: 2, tile: 1, tun: 1, glitch: .6, rot: 3, strobe: 1, kali: 1, julia: 1 }, TUNE_KEY = { zoom: 'zoom', kal: 'kal', warp: 'warp', tile: 'tile', tun: 'tun', glitch: 'glitch', rot: 'rot', strobe: 'strobe', kali: 'kali', julia: 'julia' };
function tuneStrip() {   // the group's isolated value over the loop + the playhead
  const c = tq('tunecv'); if (!c || !TUNE.g) return; const x = c.getContext('2d'), W = c.width, H = c.height, g = TUNE.g, n = tuneLen();
  x.clearRect(0, 0, W, H); x.fillStyle = '#ffffff10'; x.fillRect(0, 0, W, H); x.strokeStyle = '#ffffff30'; x.fillStyle = '#ffffff90'; x.font = '10px sans-serif';
  for (let s = 0; s < n; s += 5) { const X = s / n * W; x.beginPath(); x.moveTo(X + .5, 0); x.lineTo(X + .5, H); x.stroke(); x.fillText(s + 's', X + 3, H - 3); }
  x.strokeStyle = '#ffd60a'; x.beginPath();
  for (let i = 0; i <= W; i++) { const v = tuneVals(g, i / W * n)[TUNE_KEY[g]], y = g === 'zoom' ? H / 2 - Math.log(v) / Math.log(7) * (H / 2 - 3) : g === 'rot' ? H - 12 - clamp(Math.abs(v) / TUNE_VMAX.rot) * (H - 18) : H - 12 - clamp(v / TUNE_VMAX[g]) * (H - 18); i ? x.lineTo(i, y) : x.moveTo(i, y); }
  x.stroke();
  if (playing) { const X = Math.round(tuneLt(lastT) / n * W) + .5; x.strokeStyle = '#ff453a'; x.beginPath(); x.moveTo(X, 0); x.lineTo(X, H); x.stroke(); }
}
function tuneTick() {   // loop() each frame: playhead redraw ~4x/s; loop on: a piece end never stops the page (jump back to the effect's own segment)
  const n = performance.now(); if (n - TUNE.tk > 250) { TUNE.tk = n; tuneStrip(); }
  if (TUNE.loop && lastT > TOTAL - 8 && !paused) { seekTo(TUNE.i * SHOW.seg); TUNE.off = TUNE.i * SHOW.seg; }
}
function tuneShow(i) {
  const g = TUNE_G(FX[i].fields), f = FX[i]; TUNE.g = g; if (g === 'tile') { const q = {}; f.set(q, 1); if (typeof q.tileMode === 'number') TUNE.tm = q.tileMode; }
  const el = tq('tunebody'); if (!el) return;
  tq('tunehead').textContent = f.name; const warn = f.fields.some(k => k === 'strobe' || k === 'cells') || g === 'strobe';
  tq('tunedesc').innerHTML = (g ? '' : 'no sliders · ') + f.desc + (warn ? ' <b class="twarn">Flashing images</b>' : '');
  tq('tunecv').style.display = g ? '' : 'none';
  if (!g) { el.innerHTML = '<div class="tnone">No sliders for this effect (plain showcase loop).</div>'; return; }
  const leaves = tuneLeaves(g).map(([n, o, k], j) => tuneRow(n, o, k, j, g)).join('');
  const cur = TUNE_CUR[g].map((c, i) => { const v = tuneCurGet(c); return `<label title="${c.d}"><span>${c.n}</span><input type="range" data-c="${i}" min="${c.lo}" max="${c.hi}" step="${c.st}" value="${v}"><input type="number" data-c="${i}" min="${c.lo}" step="${c.st}" value="${+v.toFixed(3)}"></label>`; }).join('');
  el.innerHTML = '<div class="tcur">' + cur + '</div><details id="tuneadv"><summary>Advanced (all values)</summary><div class="tcur">' + leaves + '</div></details>';
  const sync = (sel, v, but) => { for (const r of el.querySelectorAll(sel)) if (r !== but) r.value = v; };
  el.oninput = e => { const t = e.target, j = +t.dataset.j, ci = t.dataset.c; if (t.value === '') return;
    if (ci !== undefined) {   // curated slider
      const c = TUNE_CUR[TUNE.g][+ci], v = +t.value; tuneCurSet(c, v); ENGINE.v++; sync('[data-c="' + ci + '"]', v, t); const td = tq('tunedesc'), hadW = !!td.querySelector('.twarn'); td.textContent = c.n + ': ' + c.d; if (hadW) td.insertAdjacentHTML('beforeend', ' <b class="twarn">Flashing images</b>');
      el.querySelectorAll('[data-j]').forEach(r => { const L = tuneLeaves(TUNE.g)[+r.dataset.j]; if (L) r.value = L[1][L[2]]; });
      codeAdd(null, 'a', 'tune: ' + TUNE.g + '.' + (c.p ? c.p.slice(1).join('.') : c.o) + ' = ' + v.toFixed(2), 'tune ' + TUNE.g + ' ' + c.n); tuneSave(); tuneStrip(); return; }
    if (isNaN(j)) return; const L = tuneLeaves(TUNE.g)[j], v = +t.value; L[1][L[2]] = v; ENGINE.v++; sync('[data-j="' + j + '"]', v, t);
    codeAdd(null, 'a', 'tune: ' + TUNE.g + '.' + L[0] + ' = ' + v.toFixed(2), 'tune ' + TUNE.g + '.' + L[0]); tuneSave(); tuneStrip(); };
  el.onchange = e => { const ci = e.target.dataset.c; if (ci !== undefined && TUNE_CUR[TUNE.g][+ci].rs && !paused) tuneRestart(); };   // timing changed: the loop starts again from the effect's start
  tuneStrip();
}
function tuneRow(n, o, k, j, g) { const v = o[k], def = Number.isInteger(v) && v >= 2, hi = def ? v * 3 : v <= 1 ? (g === 'tile' && n.startsWith('win') ? 1 : 2) : Math.ceil(v * 3), st = def || hi > 20 ? 1 : hi > 2 ? .1 : .01;
  return `<label title="${g}.${n}"><span>${n}</span><input type="range" data-j="${j}" min="0" max="${hi}" step="${st}" value="${v}"><input type="number" data-j="${j}" min="0" step="${st}" value="${v}"></label>`; }
if (TUNE) {
  const d = document.createElement('div'); d.id = 'etune';
  d.innerHTML = '<div class="thead"><b id="tunehead"></b><span class="tbtns"><button id="tuneloop" class="on" title="On: play this effect\'s loop again and again. Off: go on to the next effect when the loop ends">Loop</button><button id="tunerestart" title="Start the loop again from the effect\'s start">Restart</button><button id="tunedraw" title="Draw the random parts again (zoom size and length, tile grid)">New draw</button></span><span id="tunedesc"></span></div><div class="tmain"><div id="tunebody"></div><div class="tside"><canvas id="tunecv" width="240" height="56"></canvas><div class="trow"><button id="tuneexp">Export JSON</button><button id="tunerst">Reset</button></div><textarea id="tuneout" readonly rows="1" placeholder="{}"></textarea></div></div>';
  document.body.appendChild(d); document.body.classList.add('etuning');
  ['pointerdown', 'pointerup', 'pointermove', 'wheel', 'click'].forEach(n => d.addEventListener(n, e => e.stopPropagation()));
  ['keydown', 'keyup'].forEach(n => d.addEventListener(n, e => { const t = e.target; if (t.type === 'number' || t.tagName === 'TEXTAREA' || t.type === 'range' && /^(Arrow|Home$|End$|Page)/.test(e.key)) e.stopPropagation(); }));   // other keys (N/P, space) still reach the app after a slider was touched
  tq('tuneexp').onclick = () => { const j = tuneSave(); tq('tuneout').value = j; try { navigator.clipboard.writeText(j).catch(() => {}); } catch (e) {} toast('Engine JSON copied', 1500); };
  tq('tunerst').onclick = () => { for (const g of ['zoom', 'kal', 'warp', 'tile', 'tun', 'glitch', 'strobe', 'kali', 'julia']) ENGINE[g] = JSON.parse(JSON.stringify(ENGINE_DEF[g])); ENGINE.v++; tuneSave(); codeAdd(null, 'a', 'tune: reset to defaults', 'tune reset'); tuneShow(TUNE.i); };
  tq('tuneloop').onclick = () => {
    const i = TUNE.loop ? TUNE.i : fxIndex(lastT), lt = TUNE.loop ? tuneLt(lastT) : clamp(lastT - i * SHOW.seg, 0, SHOW.seg);
    TUNE.loop = !TUNE.loop; tq('tuneloop').classList.toggle('on', TUNE.loop); TUNE.i = i;
    if (TUNE.loop) TUNE.off = i * SHOW.seg; else seekTo(i * SHOW.seg + lt);
  };
  tq('tunerestart').onclick = () => { if (TUNE.loop) tuneRestart(); else seekTo(fxStart(fxIndex(lastT + .01))); };
  tq('tunedraw').onclick = () => { TUNE.draw++; ENGINE.v++; if (TUNE.loop) tuneRestart(); tuneStrip(); };
  setTimeout(() => tuneShow(TUNE.i), 0);   // after the whole script ran (playing / lastT / paused are declared later in the file order)
  tuneSave();
}
