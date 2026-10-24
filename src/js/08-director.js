/* ════════════════════════ director: turns the score into per-frame parameters ════════════════════════ */
// microphone input: software gain (dB), level meter state
const METER = { db: -90 };
let micGain = null, TD = null, MICDB = 0, clipT = 0, MICAUTO = true;
// user tweaks (sliders, buttons, mouse): persistent state on top of the score, independent of seek
// Energy (0 calm .. 4 extreme): the ONE user setting of the picture in auto. [arc offset (old Intensity x .25), global amount (old Effects), extreme blend (old Extreme / hk)]
// T134: big = the 'big moves' (tiles, tunnel, glitch, blaze, zoom pulses / punches, the section boost of surges), strobe = the strobe mood: both only calm / soft, generated auto only (the other sources and control levels use 1)
// T147 (generated auto): trn = the shortest scene transition (s) at each Energy (no hard cut at calm / soft); moodRamp = the ease-in / out time (s) of the dark / bw / blaze / strobe moods.
// T143 (generated auto, Energy 0-3): the 'light set' = which of Kali, Julia, kaleidoscope, tiles are on, drawn per scene window (lightSet() in 10-control.js). lsN = chance of 0 / 1 / 2 / 3 of them (max count calm 2, soft 2, normal 3; mean about 1 / 1.3 / 2);
// lsLv = strength of a picked one as a fraction range of its `light` level (VIS: calm between visible and light, soft up to light, normal around the engine); lsFirst = this many windows share the first set (slow start);
// lsw = 1 where the set decides alone (calm, soft: the arc no longer drives these four), 0 where it only adds a floor to the engine (normal, strong); capK x `light` = the soft cap (knee `knee`) on warp, melt, stretch, trails, glitch while lsw is 1
// T151 (Live / Local auto): presence pr = lp[E] x lpS[E][0] in a calm section x lpS[E][1] in a breakdown / calm state, eased (down >= lpT s, up lpT / 3); it scales warp, trails (pr ** lpX[0]), melt (pr ** lpX[1]), aberration (floor included) and stretch (no floor in Live / Local auto: st = [slope, u where it starts]), so they drop below visible in quiet parts and with a low Energy (Local: only lpL of it, its loudness already follows the file) and a drop at normal / strong stays as before
// T153 (Live / Local Extreme): hcAb = [x, +] on the aberration, the generated Extreme keeps 1.8 / .4 (the SRCGAIN gains below 1 also apply in Extreme now)
// T150 (Live / Local auto): lsNL = lsN for them (lighter: no slow start thins the set out), lsTL = share of the scenes that draw tiles which keep them (calm .4, soft .7); a member is divided by its SRCGAIN factor so the set strength is what ends up in P
// T157 (Live / Local auto): acc = chance per accent unit of [strobe, checkerboard, glitch rush, zoom push, warp rise] by Energy (the rest of the units get none); strobe / checkerboard only in builds and energetic grooves, never in breakdown / calm (ENGINE.acc, accUnit)
const EN = { off: [-.25, -.12, 0, .12, .25], offG: [-.35, -.23, 0, .12, .25], amp: [.55, .8, 1, 1.15, 1.25], big: [.35, .6, 1, 1, 1], strobe: [0, .5, 1, 1, 1], hc: [0, 0, 0, 0, 1], trn: [3, 1, 0, 0, 0], moodRamp: [5, 2.5, 1.5, 1.5, 1.5], lsN: [[.05, .6, .35], [0, .4, .6], [0, .35, .55, .1], [0, .35, .55, .1], [0, .35, .55, .1]], lsTL: [.4, .7, 1, 1, 1], lsNL: [[.55, .4, .05], [.35, .5, .15], [.3, .5, .2], [.3, .5, .2], [.3, .5, .2]], lsLv: [[.4, .85], [.6, 1], [.8, 1.2], [.8, 1.2], [.8, 1.2]], lsFirst: 2, lsw: [1, 1, 0, 0, 0], capK: [1, 1.5, 1.5, 1.5, 1.5], knee: .5, lp: [.6, .7, 1, 1, 1], lpS: [[.6, .8], [.6, .8], [.5, .75], [.65, .82], [.65, .82]], lpT: 1.5, lpL: .5, hcAb: [1.1, .2], lpX: [1.3, .5], st: [1.4, .45], acc: [[0, 0, .1, 0, .1], [0, 0, .2, .1, .15], [.08, .08, .25, .15, .15], [.2, .2, .2, .1, .1], [.15, .15, .2, .05, .05]], names: ['calm', 'soft', 'normal', 'strong', 'extreme'] };
// col / src / style only apply in assisted and manual (no UI now); kept so old presets still load.
const USER = { grid: 0, auto: -1, trans: 3, hold: 0, calm: 100, style: null, energy: 2, lv: { warp: 1, melt: 1, kali: 1, julia: 1, tun: 1, stretch: 1 },   // auto -1 = change on some scene changes (seeded, ~2 in 5), only with 2+ images; style null = default: auto (Kali/Julia) for generated pieces, off for live/local
   kal: 1, tile: 1, fb: 1, col: 0, src: 1, force: -1, zoom: 1, rot: 0, cx: 0, cy: 0, tx: 0, ty: 0, rip: { x: 0, y: 0, t0: -1e9 } };
// transition time (USER.trans seconds, 0 = instant): key presses / buttons set the TARGET (USER.*, what the sliders show); render() reads these eased copies (UE) that follow it along a smoothstep of that length.
// Slider drags snap (a dragged slider already moves smoothly). Persistent state like USER: seek never touches it.
const UE = { off4: .5, off: 0, amp: 1, kal: 1, tile: 1, fb: 1, wp: 1, mt: 1, ka: 1, ju: 1, tn: 1, st: 1, monoK: 0, hueK: 1, calm: 1, rs: 0, big: 1, strb: 1, lsw: 0, capK: 1 }, UR = {}, HCr = {};let TRN = 3;   // auto: the transition time (s) the ENGINE picked for the current scene (render() sets it, trPick); assisted / manual / showcase use USER.trans
const transT = () => CL || SHOW ? USER.trans : TRN;
// T138: assisted = the auto engine (same Energy calm taming, same ramp) + the keys; only manual (CL 2) has its own base (EN.off, no calm taming)
// auto: only Energy counts; the sliders (kal, tile, fb + the per-effect lv) and Colour apply in assisted / manual (USER values stay intact, switching level gets them back)
const UT = { off4: () => USER.energy / 4, off: () => (LIVE || LOC || SHOW || CL === 2 ? EN.off : EN.offG)[USER.energy], amp: () => EN.amp[USER.energy], big: () => SHOW || CL === 2 ? 1 : EN.big[USER.energy], strb: () => SHOW || CL === 2 ? 1 : EN.strobe[USER.energy], lsw: () => SHOW || CL === 2 || hcOn() ? 0 : EN.lsw[USER.energy], capK: () => EN.capK[USER.energy], kal: () => CL ? USER.kal : 1, tile: () => CL ? USER.tile : 1, fb: () => CL ? USER.fb : 1,
  wp: () => CL === 1 ? USER.lv.warp : 1, mt: () => CL === 1 ? USER.lv.melt : 1, ka: () => CL === 1 ? USER.lv.kali : 1, ju: () => CL === 1 ? USER.lv.julia : 1, tn: () => CL === 1 ? USER.lv.tun : 1, st: () => CL === 1 ? USER.lv.stretch : 1,
  monoK: () => CL && USER.col === 2 ? 1 : 0, hueK: () => CL && USER.col === 1 ? 0 : 1, calm: () => USER.calm / 100, rs: () => USER.energy === 3 ? 1 : 0 };   // rs = T133 ramp: 1 = the shorter 'strong' ramp   // colour: frozen hue / b&w fade too
function ramp(r, to, dt, T) {   // r = {v, from, to, age, on}: a new target restarts a smoothstep from the current value (frame-rate independent: age advances by dt)
  if (r.to === undefined) { r.v = r.to = to; r.on = false; }
  else if (to !== r.to) { r.from = r.v; r.to = to; r.age = 0; r.on = !r.snap && T > 0; }
  r.snap = false;
  if (r.on) { r.age += dt; const x = clamp(r.age / T); r.v = lerp(r.from, r.to, smooth(0, 1, x)); if (x >= 1) r.on = false; } else r.v = r.to;
  return r.v;
}
const easeUser = dt => { for (const k in UT) { if (k === 'calm') continue; UE[k] = ramp(UR[k] || (UR[k] = {}), UT[k](), dt, transT()); } UE.calm = ramp(UR.calm || (UR.calm = {}), UT.calm(), dt, Math.max(.6, transT())); };const snapUser = k => { if (UR[k]) UR[k].snap = true; };
// palettes: cosine palettes (frequency, phase) + how much the global hue drift may rotate them; a new one on every drop / window
const PALS = [{ c: [1.3, 1.3, 1.3], d: [0, .33, .67], ha: 1 }, { c: [1, .7, .4], d: [0, .15, .2], ha: .3 }, { c: [2, 1, 0], d: [.5, .2, .25], ha: .3 }, { c: [1, 1, .5], d: [.8, .9, .3], ha: .3 }, { c: [1.5, 1.5, 1.5], d: [0, .5, .5], ha: .3 }, { c: [1, 1, 1], d: [.5, .2, .8], ha: .3 }];
// per musical state: emphasis [kaleidoscope, warp, trails, palette strength] (live mode)
const LIVE_LOOK = { drop: [1, 1, .8, 1], build: [.6, 1.3, 1, 1], groove: [.6, 1, 1.15, 1], breakdown: [.15, .8, .6, .6], calm: [.3, .9, .9, .8] };
const CAM = { a: 0 }, BAND = { hi: 0, mid: 0, zt: 0, tt: 0 }, PAL_HI = [0, 1, 2, 4], PAL_LO = [3, 5];
let lastScene = 0, trT0 = -99, lastMinor = 0, tmT0 = -99;   // live: when the current scene started (drives the transition envelope)
const ETR = { pend: 0, n: 0, k: '', t0: -99, D: 1, s: 1, sg: 1, hv: 0, tk: -1 }, ETR_UP = ['zoom punch in', 'zoom punch out', 'tile burst', 'warp flash', 'hue jump', 'rotation kick'], ETR_DN = ['zoom punch out', 'warp flash', 'hue jump', 'rotation kick'], ETR_ROT = .5;   // T155: the Energy-change transition (state + the pools it draws from; up = more energetic picks, down = softer)
const LOOK = { sk: 0, sj: 0, ls: [0, 0, 0, 0], hj: 0, k: 1, w: 1, f: 1, pr: 1, p: 1, c: [1.3, 1.3, 1.3], d: [0, .33, .67], ha: 1 };
// surges + moods: irregular seeded timelines, pure functions of t (so seek and still-rendering work)
// surge = intensity swell (rises 15-30 s, falls 6-15 s, then the picture recomposes for a while); mood = dark / blaze / b&w / strobe stretch
const TLc = {};   // seeded timelines, cached per hardcore flag (a toggle blends both)
// slow start (generated mode): the moves that don't follow the arc (surges, moods, zoom swing, scene punches) fade in over the first quarter of the piece (20 s..3 min)
// hardcore (Energy 4 / key N, or ?hc=1): no calm start, scenes every 8 s, minor changes every 2 s, frequent surges / moods, strobe grid at the peaks
// the look works with every source (generated, local, stream, mic) and control level auto / assisted (manual replaces the engine's look, so it doesn't apply there);
// Extreme = Energy level 4 (or ?hc=1). It only changes the look factors, never the music or the arc.
const hcOn = () => !CTRL && !SHOW && (EN.hc[USER.energy] > 0 || Q.get('hc') === '1');
const HCspin = t => .7 + .5 * Math.sin(t * .9 + PH);   // hardcore spin speed (rad/s), a pure function of t (mirrored in integrateTo / integrateLocal)
const opening = u => LIVE || hcOn() ? 1 : smooth(.02, .35, u) ** 2;   // generated mode: deformation (warp, breath, pulse, spin, zoom wobble, fringing, melt, stretch) ramps up over the first 35 % of the arc
const rampT = (hc = hcOn()) => hc ? 3 : LOC ? clamp(TOTAL * .25, 20, 180) : clamp(TOTAL * .5, 20, 300);   // generated: 50 % of the piece (5 min = 2.5 min); local file: 25 % (timelines() only, Local has no clock ramp)
const calm = t => LIVE || hcOn() ? 1 : Math.pow(clamp((t - 5) / (rampT() - 5)), 1.5);   // generated: from 5 s, almost linear (a smoothstep was flat then jumped at ~45 s)
// T133: generated start = a stepped ramp (0 -> 15 % -> 30 % -> 50 % -> Energy), a pure function of t; replaces the old 13-18 % gate (g15) and calm(t) in generated pieces (render() / __pic use it only there; Local, Live, manual / assisted, showcase and Extreme keep their own gates).
// With a section plan (vplan()) each step starts at the next energetic section (e >= .4, as kindOf) that begins >= gap s after the previous step and eases in over that scene's transition time (5 or 10 s while ramping: the same pick as render()'s TRN);
// without one (ambient, piano) the steps run on the clock (ENGINE.ramp.sec / secLv); the plan mode never falls below that clock curve with times x floor. All times x min(1, TOTAL / 600). Data: ENGINE.ramp.
const RAMPC = [null, null];
function rampCfg(strong) {
  const R = ENGINE.ramp, C = strong ? R.strong : R, k = strong ? C.k : 1, VP = vplan(), pl = VP.length ? VP : null, sc = Math.min(1, TOTAL / 600), key = ENGINE.v + ':' + TOTAL + ':' + PH, c = RAMPC[+strong];
  if (c && c.key === key && c.pl === pl) return c;
  const S = Math.min(R.quiet, R.quietFrac * TOTAL) * k, E = R.ease * k, G = R.gap * sc * k, L = C.lv, st = [];
  if (pl) { let prev = S + E; for (let i = 1; i < L.length; i++) { const j = pl.findIndex(x => x.e >= .4 && x.a >= prev + G); if (j < 0) break; const x = Math.sin((j + PH) * 12.9898 + 9 * 78.233) * 43758.5453; st.push({ a: pl[j].a, d: [5, 10][Math.floor((x - Math.floor(x)) * 2)], dl: L[i] - L[i - 1] }); prev = pl[j].a; } }
  return RAMPC[+strong] = { key, pl, C, L, S, E, st, m: sc * k };
}
function rampLv(t, strong) {
  const c = rampCfg(strong), C = c.C, m = c.m * (c.pl ? ENGINE.ramp.floor : 1), X = C.sec, V = C.secLv;   // the clock curve (the floor in plan mode)
  let np = V[V.length - 1]; if (t <= X[0] * m) np = V[0]; else for (let j = 1; j < X.length; j++) if (t <= X[j] * m) { np = lerp(V[j - 1], V[j], smooth(X[j - 1] * m, X[j] * m, t)); break; }
  if (!c.pl) return np;
  let v = c.L[0] * smooth(c.S, c.S + c.E, t); for (const s of c.st) v += s.dl * smooth(s.a, s.a + s.d, t);
  return Math.max(v, np);
}
const rampIn = (t, rs = UE.rs) => hcOn() ? 1 : rs <= 0 ? rampLv(t, false) : rs >= 1 ? rampLv(t, true) : lerp(rampLv(t, false), rampLv(t, true), rs);   // rs = the strong blend (Energy 3), eased in UE like the other user eases
// the music's own sections (generated styles with a section plan): [{a, b, e}] = start, end, energy 0..1; [] = no plan (ambient, piano, live, local). Built by buildAudio (window.*PLAN), read here.
// [[EVT]] (T101) the generated music's dated events, built by buildAudio's plan loops (data only: nothing reads them yet).
// Record {t, k, s, d, sec, e}: k = section | riser | hit | fill | phrase; s = strength 0..1; d = riser length in s (0 otherwise); sec / e only on section.
// t is the variable the audio starts from (never a rounded window.*PLAN value). buildAudio resets it; ambient and piano publish none.
let EVT = [];
const evtSet = list => { EVT = list.slice().sort((a, b) => a.t - b.t); };
const evtAt = (t, ks) => { let r; for (const x of EVT) { if (x.t > t) break; if (ks.includes(x.k)) r = x; } return r; };   // last event of kind in ks with t <= t
const evtNext = (t, ks) => EVT.find(x => x.t > t && ks.includes(x.k));   // first event of kind in ks with t > t
// T103: EVTM = the music EVT was built for (LOC / LIVE never call buildAudio, so EVT can be stale); evOK() = the event consumers may run; evtIdx(t, ks) = {i: how many events of ks have t <= t, e: the last one} (binary search, filtered lists cached per EVT)
let EVTM = null;
const evOK = () => !(LIVE || LOC || SHOW || CTRL || hcOn()) && EVTM === MUSIC;
const EVC = {};
function evtIdx(t, ks) {
  const key = ks.join(); let c = EVC[key]; if (!c || c.src !== EVT) c = EVC[key] = { src: EVT, a: EVT.filter(x => ks.includes(x.k)) };
  const a = c.a; let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].t <= t) lo = m + 1; else hi = m; }
  return { i: lo, e: lo ? a[lo - 1] : null };
}
const evtSec = (t, sec, e) => ({ t, k: 'section', s: .8, d: 0, sec, e });
// T146: CHLV = the seek-bar chart's level curve = points [t, e] (linear between), published next to EVT by the styles whose heard level moves inside a section (intro ramp, layers entering, build-ups, thinning, fade in / out). Chart only: drawProfile() reads it, nothing else (picture, vplan, EVT consumers); null = the chart uses planE(). Pure function of seed + time, reset with EVT.
let CHLV = null;
const lvlSet = pts => { CHLV = pts.map(q => [Math.max(0, q[0]), clamp(q[1])]).sort((x, y) => x[0] - y[0]); };
function lvlAt(t) {
  const a = CHLV; if (!a || !a.length) return null; if (t <= a[0][0]) return a[0][1]; if (t >= a[a.length - 1][0]) return a[a.length - 1][1];
  let lo = 0, hi = a.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m][0] <= t) lo = m; else hi = m; }
  return lerp(a[lo][1], a[hi][1], (t - a[lo][0]) / Math.max(1e-6, a[hi][0] - a[lo][0]));
}
// sections [{a, b, e0, e1, mid: [[t, e]...]}] -> points: level e0 at the start, e1 at the end, `mid` points between; a 3 s ramp across each boundary (like planE's smoothing)
function lvlSecs(S) {
  const r = [];
  S.forEach((s, i) => { r.push([i ? s.a + 1.5 : 0, s.e0]); for (const m of s.mid || []) if (m[0] > s.a + 1.5 && m[0] < s.b - 1.5) r.push(m); r.push([i < S.length - 1 ? s.b - 1.5 : s.b, s.e1]); });
  return r;
}
// T100: a `phrase` every 8 bars of the beat grid B (bar k starts at B[4k]); `skip` = bar numbers that already start a section (no double event)
const evtPhr = (B, skip, tot) => { const r = []; for (let k = 8; 4 * k < B.length && B[4 * k] < tot; k += 8) if (!skip.includes(k)) r.push({ t: B[4 * k], k: 'phrase', s: .3, d: 0 }); return r; };
const PLAN_K = { intro: .25, build: .55, drop: .9, break: .3, outro: .2 };
// energy of one window.*PLAN entry, exactly as vplan() has always computed it
const planEnergy = x => x.e ?? (x.kind ? PLAN_K[x.kind] ?? .5 : clamp(energy(clamp((x.from + x.to) / 2 / TOTAL)) + (x.eo || 0)));
let VPC = null;
function vplan() {
  if (LIVE || LOC || SHOW || CTRL || EVTM !== MUSIC) return [];
  const gn = gridNb();
  if (VPC && VPC.src === EVT && VPC.tot === TOTAL && VPC.gn === gn) return VPC.p;
  const S = EVT.filter(x => x.k === 'section'), st = S.map((x, i) => i ? Math.max(x.t, 0) : 0);   // exact music times: the sections already sit on the music's own bars (snapping to the picture's grid put them seconds off)
  const p = S.map((x, i) => ({ a: st[i], b: i < S.length - 1 ? Math.max(st[i + 1], st[i]) : TOTAL, e: x.e }));
  VPC = { src: EVT, tot: TOTAL, gn, p }; return p;
}
// energy of the music's current section (smoothed 4 s at each boundary), null without a plan; pure function of t
function planE(t) {
  const VP = vplan(); if (!VP.length) return null;
  let i = VP.findIndex(x => t < x.b); if (i < 0) i = VP.length - 1; const c = VP[i], pe = VP[i - 1] ? VP[i - 1].e : c.e;
  return lerp(pe, c.e, smooth(0, 4, t - c.a));
}
// arc position whose energy matches e (first one on the rise, 0..0.88): lets the picture's base look follow the section energy instead of the clock
let UFE = null;
function uForE(e) {
  if (!UFE || UFE.arc !== ARC) { const tab = []; for (let i = 0; i <= 44; i++) tab.push(energy(i / 50)); UFE = { arc: ARC, tab }; }
  const T = UFE.tab, lo = Math.min(...T), hi = Math.max(...T), g = lerp(lo, hi, clamp(e));
  for (let i = 1; i < T.length; i++) if (T[i] > g) return (i - 1 + (g - T[i - 1]) / Math.max(1e-6, T[i] - T[i - 1])) / 50;
  return .88;
}
// T52: after the intro, sparse glitch bursts (display pass only): each 12 s cell has a 35 % chance of a 1-2.5 s burst at a seeded spot, amplitude .3-.55 (the shader's slot rule keeps it sparse). Pure function of t and PH.
const gHash = (n, s) => { const x = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
const glitchBurst = (t, every = false, chance = ENGINE.glitch.chance, cellLen = ENGINE.glitch.cell) => {   // every: tune mode (09-fx.js) fires a burst in every cell; chance: T152 lets Live / Local roll more often
  const G = ENGINE.glitch, cell = Math.floor(t / cellLen);
  if (!every && gHash(cell, PH) > chance) return 0;
  const dur = G.durMin + G.durVar * gHash(cell, PH + 1), t0 = cell * cellLen + gHash(cell, PH + 2) * Math.max(0, cellLen - dur);
  return t >= t0 && t < t0 + dur ? G.amp + G.ampVar * gHash(cell, PH + 3) : 0;
};
// T152: Live and Local glitch (pure function of t, seed, the live scene, the trT0 of the current scene and the live state; display pass only): a burst just after an energetic scene starts (a drop starts one; chance G.pScene per scene),
// and the generated cell bursts (chance G.pLive) while an energetic scene is not in a calm / breakdown state. Durations and amounts as the generated ones; UE.big and the soft cap scale it downstream (calm ~0).
const glitchLive = t => {
  const G = ENGINE.glitch, n = LIVE.scenes, st = LIVE.state, X = hcOn();   // T153: X = Extreme (more bursts: pSceneX / pLiveX / cellX)
  if (t < 10 || !(LIVE.kinds[n] ?? 1)) return 0;
  const s = t - trT0 - G.delay, dur = G.durMin + G.durVar * gHash(n, PH + 11);
  if (n > 0 && gHash(n, PH + 10) < (X ? G.pSceneX : G.pScene) && s >= 0 && s < dur) return G.amp + G.ampVar * gHash(n, PH + 12);
  return st === 'calm' || st === 'breakdown' ? 0 : X ? glitchBurst(t, false, G.pLiveX, G.cellX) : glitchBurst(t, false, G.pLive);
};
// T157 (Live + Local): build accents. A unit = a stretch of drop / build / groove in an energetic scene (a new one starts on a new scene, when a build starts, and every ENGINE.acc.unit s); each unit draws ONE accent
// from the seed + its number, weighted by Energy (EN.acc; a unit that starts with a build x ENGINE.acc.kBuild on strobe / checkerboard / glitch). Local: the units come from the timeline (LOC.accA / accB / accBld), a pure function of t; Live: causal tracker.
// T161 strobe variants: strobe 0 plain / 1 accelerating / 2 negative, checkerboard 0 plain / 1 accelerating / 2 coloured. Drawn per launch from the seed (ENGINE.strobe.vw / cw; ?svar=0..2 forces one, testing).
// The source of a stretch (generated mood, build accent) writes { v, t0, D } into SVAR each frame; a launch that does not know itself (held G / J, Extreme peaks) is drawn at its rising edge (strobeVars, 10-control.js).
const SVAR = { s: null, c: null }, SV_NAMES = ['plain', 'accelerating', 'negative'], CV_NAMES = ['plain', 'accelerating', 'colour'];
function svDraw(kind, key) {
  if (Q.has('svar')) return +Q.get('svar');
  const w = ENGINE.strobe[kind === 's' ? 'vw' : 'cw'], r = gHash(key, PH + (kind === 's' ? 31 : 32)) * (w[0] + w[1] + w[2]);
  return r < w[0] ? 0 : r < w[0] + w[1] ? 1 : 2;
}
function rampPhase(s, r0, r1, D) {   // cycles since the start of a stretch whose rate climbs linearly r0 -> r1 over D s, then stays at r1: r0 s + k s^2 / 2 (k = (r1 - r0) / D). A closed form of s, so a seek gives the same phase as playing through
  D = Math.max(D, .1); s = Math.max(s, 0); const k = (r1 - r0) / D;
  return s < D ? r0 * s + k * s * s / 2 : r0 * D + k * D * D / 2 + r1 * (s - D);
}
function strobePhase(P) { const r = P.rate1 > 0 && P.sD > 0 ? rampPhase(P.t - P.sT0, P.rate, P.rate1, P.sD) : P.t * P.rate; return r - Math.floor(r); }   // the strobe phase (cycles, 0..1) the shader flashes on
function cellPhase(P) { return P.cD > 0 ? rampPhase(P.t - P.cT0, ENGINE.strobe.acc[0], ENGINE.strobe.acc[1], P.cD) : 0; }
function moodRun(t, hc) {   // the seeded mood stretch running at t (the forced ?mood= one is an endless one from 0), for the strobe variant
  const f = Q.get('mood'); if (f) return { k: f, a: 0, b: ENGINE.strobe.dur[1], rate: 8, v: svDraw('s', 0) };
  return timelines(hc).moods.find(x => t >= x.a && t < x.b) || null;
}
const ACC_NAMES = ['strobe', 'checkerboard', 'glitch rush', 'zoom push', 'warp rise'], ACC = { name: '', k: -1, n: 0 };   // ACC = the accent of the current frame (code log, debug)
const accOkState = s => s === 'drop' || s === 'build' || s === 'groove';
const accNew = () => ({ on: 0, n: 0, t0: 0, bld: 0, sc: -1, st: '' });
function accTrack(a, st, kind, sc, t) {   // advance a unit tracker one step; returns 1 when a new unit starts
  const ok = !!kind && accOkState(st), was = a.st; a.st = st;
  if (!ok) { a.on = 0; return 0; }
  if (a.on && sc === a.sc && !(st === 'build' && was !== 'build') && t - a.t0 < ENGINE.acc.unit) return 0;
  a.on = 1; a.n++; a.t0 = t; a.sc = sc; a.bld = st === 'build' ? 1 : 0; return 1;
}
function accUnit(t) {   // the unit running at t: { n, age, b (end, Local only), bld } or null
  if (LOC) { const i = upper(LOC.accA, t) - 1; return i >= 0 && t < LOC.accB[i] ? { n: i + 1, age: t - LOC.accA[i], b: LOC.accB[i], bld: LOC.accBld[i] } : null; }
  const L = LIVE, a = L.acc || (L.acc = accNew()); accTrack(a, L.state, L.kinds[L.scenes] ?? 1, L.scenes, t);
  return a.on ? { n: a.n, age: t - a.t0, b: 1e9, bld: a.bld } : null;
}
function accDraw(n, bld, E) {   // the accent of unit n: kind index (-1 none), start delay, length, strobe rate
  const A = ENGINE.acc, w = EN.acc[E], kb = bld ? A.kBuild : 1, p = [w[0] * kb, w[1] * kb, w[2] * kb, w[3], w[4]], r = gHash(n, PH + 21); let c = 0, k = -1;
  for (let i = 0; i < 5; i++) { c += p[i]; if (r < c) { k = i; break; } }
  return { k, v: k === 0 ? svDraw('s', n) : k === 1 ? svDraw('c', n) : 0, d0: lerp(A.delay[0], A.delay[1], gHash(n, PH + 22)), D: lerp(A.dur[0], A.dur[1], gHash(n, PH + 23)), rate: lerp(ENGINE.strobe.rate[0], ENGINE.strobe.rate[1], gHash(n, PH + 24)) };
}
function accGate(t, dt) {   // 0..1: strobe and checkerboard are off in breakdown / calm (and before the state is known). Local looks .3 s ahead and behind (off before the state changes, back .3 s after); Live eases (tau .08 s, so ~off in .3 s)
  if (LOC) { for (const d of [-.3, -.15, 0, .15, .3]) if (!accOkState(LST[LOC.st[clamp(Math.round((t + d - LOC.off) * LOC.fps), 0, LOC.nf - 1)]])) return 0; return 1; }
  const L = LIVE; L.sg = (L.sg ?? 0) + ((accOkState(L.state) ? 1 : 0) - (L.sg ?? 0)) * (1 - Math.exp(-dt / .08)); return L.sg;
}
function liveAccents(P, t, dt) {   // called from render() in Live / Local (not showcase / manual); writes the accent and the gate into P (strobe / cells / glitch / zoom / warp)
  const A = ENGINE.acc, g = accGate(t, dt), u = accUnit(t), d = u && accDraw(u.n, u.bld, USER.energy), m = [0, 0, 0, 0, 0];
  if (!hcOn() && !Q.has('mood')) P.strobe = 0;   // the random strobe mood gives way to the build accents (Extreme keeps its own stretches and peaks, gated)
  P.strobe *= g; P.cells *= g; ACC.name = ''; ACC.k = -1; ACC.n = u ? u.n : 0;
  const x = d && d.k >= 0 ? u.age - d.d0 : -1, D = d ? d.D : 0;
  if (x >= 0 && x <= D + A.fade) {
    const end = LOC ? 1 - smooth(u.b - (d.k < 2 ? .3 : 1.5), u.b, t) : 1;   // Local knows where the unit ends: off before it (Live: the gate for strobe / checkerboard, the tail below for the rest)
    const e = d.k < 2 ? smooth(0, .5, x) * (1 - smooth(D - .5, D, x)) * end : (d.k === 2 ? Math.min(1, x / D) : smooth(0, D, x)) * (1 - smooth(D, D + A.fade, x)) * end;
    if (e > .001) {
      ACC.name = ACC_NAMES[d.k]; ACC.k = d.k;
      if (d.k === 0) { const s = e * ENGINE.strobe.amount * g * UE.strb; if (s > P.strobe) { P.strobe = s; P.rate = d.rate; SVAR.s = { v: d.v, t0: t - x, D }; } }   // T161: the variant of this accent (the ramp starts with the accent)
      else if (d.k === 1) { P.cells = Math.max(P.cells, e * A.cells * g); SVAR.c = { v: d.v, t0: t - x, D }; }
      else m[d.k] = d.k === 2 ? (A.glitch[0] + (A.glitch[1] - A.glitch[0]) * Math.pow(Math.min(1, x / D), 1.5)) * (1 - smooth(D, D + A.fade, x)) * end * UE.big : e;   // glitch rush: the slot chance (.08 + .75 amount) climbs to the build's peak
    }
  }
  if (!LOC) { const v = LIVE.av || (LIVE.av = [0, 0, 0, 0, 0]), dec = Math.exp(-dt / A.tail); for (let i = 2; i < 5; i++) m[i] = v[i] = Math.max(m[i], v[i] * dec); }   // Live does not know where a unit ends: glitch / zoom / warp die away over A.tail s instead of being cut
  if (m[2] > 0) P.glitch = Math.max(P.glitch, m[2]);
  if (m[3] > 0) P.zoom *= 1 + A.zoom * m[3] * UE.big;
  if (m[4] > 0) P.warp = P.warp * (1 + A.warp * m[4]) + A.warpAdd * m[4];
}
function accInfo(t) {   // __pic: the unit and its accent at t (Local: a pure function; Live: the current frame)
  const u = LOC ? accUnit(t) : LIVE && LIVE.acc && LIVE.acc.on ? { n: LIVE.acc.n, age: t - LIVE.acc.t0, bld: LIVE.acc.bld } : null; if (!u) return null;
  const d = accDraw(u.n, u.bld, USER.energy); return { n: u.n, bld: u.bld, kind: d.k < 0 ? 'none' : ACC_NAMES[d.k], variant: d.k === 0 ? SV_NAMES[d.v] : d.k === 1 ? CV_NAMES[d.v] : '', start: t - u.age + d.d0, len: d.D, age: u.age };
}
// intro glitch amount 0..1 (display pass only): generated mode, from gs = min(10 s, 8 % of the piece) to 22 %, rising slowly; the last third of that window fades it out; after that, glitchBurst(). Pure function of t.
const glitchAmt = t => {
  if (Q.has('glitch')) return clamp(+Q.get('glitch') || 0);   // test override ?glitch=0..1
  if (LIVE || LOC) return CTRL || SHOW ? 0 : glitchLive(t);   // T152: Live and Local (LOC sets LIVE); T153: Extreme too (glitchLive)
  if (CTRL) return 0;
  const gs = Math.min(10, .08 * TOTAL), ge = .22 * TOTAL;
  if (t <= gs) return 0;
  if (t >= ge) return SHOW ? 0 : glitchBurst(t);   // bursts not in ?showcase (its plain-image baseline)
  return .8 * Math.pow(smooth(gs, ge, t), .7) * (1 - smooth(ge - (ge - gs) / 3, ge, t));   // peak .8, earlier rise (^.7): visible from ~20 s, never a strobe
};
function timelines(hc = hcOn()) {
  const c = TLc[hc ? 1 : 0]; if (c && c.ph === PH && c.tot === TOTAL && c.v === ENGINE.v) return c.tl;
  const r = mulberry32(Math.floor(PH * 1e5) + 77), rr = (a, b) => a + (b - a) * r(), sur = [], moods = [], tun = [];
  let t = hc ? rr(1, 3) : rampT(hc) * (LOC ? .5 : .6) + rr(LOC ? 5 : 10, LOC ? 20 : 25);   // first surge: past half of the ramp, so it never lands on the ramp's steep part
  while (t < 7200) { const rise = hc ? rr(6, 10) : rr(15, 30), fall = hc ? rr(4, 8) : rr(6, 14); sur.push({ a: t, b: t + rise, c: t + rise + fall, h: hc ? rr(.6, 1) : rr(.5, 1) }); t += rise + fall + (hc ? rr(15, 30) : rr(4, 25)); }
  t = hc ? rr(4, 8) : rampT(hc) + rr(15, 40);
  while (t < 7200) {
    const MW = hc ? ENGINE.mood.wHc : ENGINE.mood.w, MS = MW[0] + MW[1] + MW[2] + MW[3], MR = r() * MS, k = MR < MW[0] ? 'dark' : MR < MW[0] + MW[1] ? 'bw' : MR < MW[0] + MW[1] + MW[2] ? 'strobe' : 'blaze', d = hc ? (k === 'blaze' ? rr(3, 5) : rr(4, 8)) : k === 'blaze' ? rr(3, 6) : k === 'strobe' ? rr(ENGINE.strobe.dur[0], ENGINE.strobe.dur[1]) : k === 'dark' ? rr(ENGINE.mood.darkDur[0], ENGINE.mood.darkDur[1]) : rr(10, 25);   // T160: weights from ENGINE.mood
    moods.push({ k, a: t, b: t + d, rate: hc ? rr(8, 14) : rr(ENGINE.strobe.rate[0], ENGINE.strobe.rate[1]), v: k === 'strobe' ? svDraw('s', t) : 0 }); t += d + (hc ? rr(25, 50) : rr(20, 50));
  }
  const TU = ENGINE.tun;
  t = Math.max(rr(TU.first[0], TU.first[1]), rampT(hc) + rr(TU.firstRamp[0], TU.firstRamp[1]));   // tunnel stretches: first one after the calm start, then one every ~1.5-3 min, 9-16 s each
  while (t < 7200) { const d = rr(TU.dur[0], TU.dur[1]); tun.push({ a: t, b: t + d }); t += d + rr(TU.gap[0], TU.gap[1]); }
  const tl = { sur, moods, tun }; TLc[hc ? 1 : 0] = { ph: PH, tot: TOTAL, v: ENGINE.v, tl }; return tl;
}
// T103: the surge list. ev (generated, events on): each riser makes a surge that rises over the riser and peaks at its hit (the first hit within 10 s of the riser's end, else the riser's end), then falls over a seeded 6-15 s;
// the seeded surges stay where no event surge lies within 30 s. Without ev / with Extreme: the seeded list untouched.
let SLC = null;
function surList(hc, ev) {
  if (hc || !ev) return timelines(hc).sur;
  if (SLC && SLC.src === EVT && SLC.ph === PH && SLC.tot === TOTAL && SLC.v === ENGINE.v) return SLC.l;
  const R = EVT.filter(x => x.k === 'riser'), H = EVT.filter(x => x.k === 'hit'), E = [];
  R.forEach((r, j) => { const re = r.t + r.d, h = H.find(x => x.t >= re - .05), tP = h && h.t <= re + 10 ? h.t : re; E.push({ a: r.t, b: tP, c: tP + 6 + 9 * gHash(j, PH + 5), h: r.s }); });
  const l = E.concat(timelines(false).sur.filter(c => !E.some(e => c.a < e.c + 30 && e.a < c.c + 30)));
  SLC = { src: EVT, ph: PH, tot: TOTAL, v: ENGINE.v, l }; return l;
}
function surgeAt(t, hc, ev = false) {
  let r = 0;
  for (const s of surList(hc, ev)) if (t >= s.a && t < s.c) r = Math.max(r, t < s.b ? s.h * smooth(s.a, s.b, t) : s.h * (1 - smooth(s.b, s.c, t)));
  return r;
}
function tunnelAt(t) {   // EFFECT tunnel timeline (generated mode): 0..1, pure function of t
  const s = timelines().tun.find(x => t >= x.a && t < x.b); return s ? smooth(s.a, s.a + ENGINE.tun.easeIn, t) * (1 - smooth(s.b - ENGINE.tun.easeOut, s.b, t)) : 0;
}
function moodAt(t, hc = hcOn(), ev = false) {
  const m = { dark: 0, blaze: 0, bw: 0, strobe: 0, rate: 8 }, { moods } = timelines(hc), sur = surList(hc, ev), f = Q.get('mood');
  const s = f ? { k: f, a: -1e9, b: 1e9, rate: 8 } : moods.find(x => t >= x.a && t < x.b);
  const rp = hc ? .4 : f || LIVE || LOC || SHOW || CTRL ? 1.5 : s && s.k === 'blaze' ? 1.5 : Math.min(EN.moodRamp[USER.energy], s ? (s.b - s.a) / 2 : 9);   // T147: generated auto eases dark / bw / strobe in and out over EN.moodRamp (calm 5 s, soft 2.5 s; never past half the stretch); blaze keeps its flash
  if (s) { m[s.k] = smooth(s.a, s.a + rp, t) * (1 - smooth(s.b - rp, s.b, t)); m.rate = s.rate; if (s.k === 'strobe') m.strobe *= ENGINE.strobe.amount; }
  const p = sur.find(c => c.h > .75 && t > c.b - 2 && t < c.b + 3);   // the top of a big swell blows out briefly
  if (p) m.blaze = Math.max(m.blaze, ENGINE.mood.surgeTop * smooth(p.b - 1.5, p.b, t) * (1 - smooth(p.b, p.b + 2.5, t)));
  return m;
}
 // zoom pulses (T110, T113, T145): the same draw rules in every source, only the clock differs. Out (4 in 5: x0.25-0.5, 2 in 5 of them down to x0.15) or in (x1.6-2.0); slow (a 30-48 s pulse, ease 10-15 s) or fast (a 5-14 s stay, ease in 0.5-1 s, back in 3 s).
 // Generated: the seeded time list (every ~30-70 s, pure function of t). Local: the same draw placed on the timeline's scene starts (pure function of t). Live: may start at a new scene, causal (state in LIVE.zp). (T71: zoom in capped at x2; 2026-10-17: more and longer far-out phases, floor .15)
 const ZLc = {};
 function zoomDraw(r, rr) {   // one pulse from ENGINE.zoom (the draw order is fixed: out?, fast?, dur, ease, [far?], f). e / e2 = ease in / out (s)
   const Z = ENGINE.zoom, out = r() < Z.pOut, fast = r() < Z.pFast, dur = fast ? rr(Z.durFast[0], Z.durFast[1]) : rr(Z.durSlow[0], Z.durSlow[1]), ez = fast ? rr(Z.easeFast[0], Z.easeFast[1]) : rr(Z.easeSlow[0], Z.easeSlow[1]);
   const f = !out ? rr(Z.fIn[0], Z.fIn[1]) : r() < Z.pFar ? rr(Z.fFar[0], Z.fFar[1]) : rr(Z.fOut[0], Z.fOut[1]);
   return { dur, f: Math.min(Z.max, Math.max(Z.min, f)), e: ez, e2: fast ? Z.easeBack : ez };
 }
 let TUNE_ZL = null;   // T117: tune mode (09-fx.js) swaps the pulse list for the one pulse of its loop
 function zoomPulseList() {
   if (TUNE_ZL) return TUNE_ZL();
   const c = ZLc; if (c && c.ph === PH && c.tot === TOTAL && c.v === ENGINE.v) return c.list;
   const Z = ENGINE.zoom, r = mulberry32(Math.floor(PH * 1e5) + 12345), rr = (a, b) => a + (b - a) * r();
   const list = [];
   let t = rr(Z.first[0], Z.first[1]);
   while (t < TOTAL) { const d = zoomDraw(r, rr); list.push({ a: t, b: t + d.dur, f: d.f, e: d.e, e2: d.e2 }); t += d.dur + rr(Z.gap[0], Z.gap[1]); }
   ZLc.ph = PH; ZLc.tot = TOTAL; ZLc.v = ENGINE.v; ZLc.list = list; return list;
 }
 function zoomPulseListLocal() {   // Local: scene starts (LOC.sceneT) that fall outside the previous pulse + its gap start a pulse; seeded by the track's own seed PH
   const c = LOC.zl; if (c && c.ph === PH && c.v === ENGINE.v) return c.list;
   const Z = ENGINE.zoom, r = mulberry32(Math.floor(PH * 1e5) + 54321), rr = (a, b) => a + (b - a) * r();
   const list = []; let ok = rr(Z.first[0], Z.first[1]);
   for (const s of LOC.sceneT) if (s >= ok) { const d = zoomDraw(r, rr); list.push({ a: s, b: s + d.dur, f: d.f, e: d.e, e2: d.e2 }); ok = s + d.dur + rr(Z.gap[0], Z.gap[1]); }
   LOC.zl = { ph: PH, v: ENGINE.v, list }; return list;
 }
 function zoomPulseLive(t) {   // Live (causal): a new scene (LIVE.scenes changed) after the gap starts a pulse now; state in LIVE.zp. Call once per frame.
   const L = LIVE, Z = ENGINE.zoom;
   if (!L.zp) { const r = mulberry32(Math.floor(PH * 1e5) + 99991); L.zp = { r, rr: (a, b) => a + (b - a) * r(), sc: L.scenes, ok: 0, cur: null }; L.zp.ok = L.zp.rr(Z.first[0], Z.first[1]); }
   const S = L.zp;
   if (L.scenes !== S.sc) { S.sc = L.scenes; if (t >= S.ok) { const d = zoomDraw(S.r, S.rr); S.cur = { a: t, b: t + d.dur, f: d.f, e: d.e, e2: d.e2 }; S.ok = t + d.dur + S.rr(Z.gap[0], Z.gap[1]); } }
   if (S.cur && t >= S.cur.b) S.cur = null;
 }
 const zoomPulseActive = t => LOC ? (zoomPulseListLocal().find(x => t >= x.a && t < x.b) || null) : LIVE ? (LIVE.zp && LIVE.zp.cur && t >= LIVE.zp.cur.a && t < LIVE.zp.cur.b ? LIVE.zp.cur : null) : zoomPulseList().find(x => t >= x.a && t < x.b) || null;   // the pulse running at t ({a, b, f}) or null
 const zoomEase = s => [Math.min(s.e, (s.b - s.a) / 2), Math.min(s.e2, (s.b - s.a) / 2)];   // ease in / out of a pulse (a long ease never passes half the length)
 const zoomPulseAt = t => {
   const s = zoomPulseActive(t);
   if (!s) return 1;
   const [e1, e2] = zoomEase(s), envRaw = smooth(s.a, s.a + e1, t) * (1 - smooth(s.b - e2, s.b, t));
   const env = envRaw * envRaw * (3 - 2 * envRaw);
   return Math.pow(s.f, env);   // geometric: a glide to x.2 moves at an even speed
 };
