/* ════════════════════════ director: turns the score into per-frame parameters ════════════════════════ */
// microphone input: software gain (dB), level meter state
const METER = { db: -90 };
let micGain = null, TD = null, MICDB = 0, clipT = 0, MICAUTO = true;
// user tweaks (sliders, buttons, mouse): persistent state on top of the score, independent of seek
// Energy (0 calm .. 4 extreme): the ONE user setting of the picture in auto. [arc offset (old Intensity x .25), global amount (old Effects), extreme blend (old Extreme / hk)]
const EN = { off: [-.25, -.12, 0, .12, .25], amp: [.55, .8, 1, 1.15, 1.25], hc: [0, 0, 0, 0, 1], names: ['calm', 'soft', 'normal', 'strong', 'extreme'], last: 2 };
// col / src / style only apply in assisted and manual (no UI now); kept so old presets still load.
const USER = { grid: 0, auto: -1, trans: 3, hold: 0, calm: 100, style: null, energy: 2, lv: { warp: 1, melt: 1, kali: 1, julia: 1, tun: 1, stretch: 1 },   // auto -1 = change on some scene changes (seeded, ~2 in 5), only with 2+ images; style null = default: auto (Kali/Julia) for generated pieces, off for live/local
   kal: 1, tile: 1, fb: 1, col: 0, src: 1, force: -1, zoom: 1, rot: 0, cx: 0, cy: 0, tx: 0, ty: 0, rip: { x: 0, y: 0, t0: -1e9 } };
// transition time (USER.trans seconds, 0 = instant): key presses / buttons set the TARGET (USER.*, what the sliders show); render() reads these eased copies (UE) that follow it along a smoothstep of that length.
// Slider drags snap (a dragged slider already moves smoothly). Persistent state like USER: seek never touches it.
const UE = { off4: .5, off: 0, amp: 1, kal: 1, tile: 1, fb: 1, wp: 1, mt: 1, ka: 1, ju: 1, tn: 1, st: 1, monoK: 0, hueK: 1, calm: 1 }, UR = {}, HCr = {};let TRN = 3;   // auto: the transition time (s) the ENGINE picked for the current scene (render() sets it, trPick); assisted / manual / showcase use USER.trans
const transT = () => CL || SHOW ? USER.trans : TRN;
// auto: only Energy counts; the sliders (kal, tile, fb + the per-effect lv) and Colour apply in assisted / manual (USER values stay intact, switching level gets them back)
const UT = { off4: () => USER.energy / 4, off: () => EN.off[USER.energy], amp: () => EN.amp[USER.energy], kal: () => CL ? USER.kal : 1, tile: () => CL ? USER.tile : 1, fb: () => CL ? USER.fb : 1,
  wp: () => CL === 1 ? USER.lv.warp : 1, mt: () => CL === 1 ? USER.lv.melt : 1, ka: () => CL === 1 ? USER.lv.kali : 1, ju: () => CL === 1 ? USER.lv.julia : 1, tn: () => CL === 1 ? USER.lv.tun : 1, st: () => CL === 1 ? USER.lv.stretch : 1,
  monoK: () => CL && USER.col === 2 ? 1 : 0, hueK: () => CL && USER.col === 1 ? 0 : 1, calm: () => USER.calm / 100 };   // colour: frozen hue / b&w fade too
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
const LOOK = { sk: 0, sj: 0, hj: 0, k: 1, w: 1, f: 1, p: 1, c: [1.3, 1.3, 1.3], d: [0, .33, .67], ha: 1 };
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
const rampT = (hc = hcOn()) => hc ? 3 : LOC ? clamp(TOTAL * .25, 20, 180) : clamp(TOTAL * .5, 20, 300);   // generated: 50 % of the piece (5 min = 2.5 min); local file keeps its old ramp
const calm = t => LIVE || hcOn() ? 1 : LOC ? smooth(6, rampT(), t) : Math.pow(clamp((t - 5) / (rampT() - 5)), 1.5);   // generated: from 5 s, almost linear (a smoothstep was flat then jumped at ~45 s)
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
// T100: a `phrase` every 8 bars of the beat grid B (bar k starts at B[4k]); `skip` = bar numbers that already start a section (no double event)
const evtPhr = (B, skip, tot) => { const r = []; for (let k = 8; 4 * k < B.length && B[4 * k] < tot; k += 8) if (!skip.includes(k)) r.push({ t: B[4 * k], k: 'phrase', s: .3, d: 0 }); return r; };
const PLAN_K = { intro: .25, build: .55, drop: .9, break: .3, outro: .2 };
// energy of one window.*PLAN entry, exactly as vplan() has always computed it
const planEnergy = x => x.e ?? (x.kind ? PLAN_K[x.kind] ?? .5 : clamp(energy(clamp((x.from + x.to) / 2 / TOTAL)) + (x.eo || 0)));
let VPC = null;
function vplan() {
  if (LIVE || LOC || SHOW || CTRL || EVTM !== MUSIC) return [];
  const gn = gridNb();   // T51: section starts snap to the nearest bar / phrase start
  if (VPC && VPC.src === EVT && VPC.tot === TOTAL && VPC.gn === gn) return VPC.p;
  const S = EVT.filter(x => x.k === 'section'), st = S.map((x, i) => i ? Math.max(gridLine(x.t, gn), 0) : 0);
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
const glitchBurst = (t, every = false) => {   // every: tune mode (09-fx.js) fires a burst in every cell
  const G = ENGINE.glitch, cell = Math.floor(t / G.cell);
  if (!every && gHash(cell, PH) > G.chance) return 0;
  const dur = G.durMin + G.durVar * gHash(cell, PH + 1), t0 = cell * G.cell + gHash(cell, PH + 2) * Math.max(0, G.cell - dur);
  return t >= t0 && t < t0 + dur ? G.amp + G.ampVar * gHash(cell, PH + 3) : 0;
};
// intro glitch amount 0..1 (display pass only): generated mode, from gs = min(10 s, 8 % of the piece) to 22 %, rising slowly; the last third of that window fades it out; after that, glitchBurst(). Pure function of t.
const glitchAmt = t => {
  if (Q.has('glitch')) return clamp(+Q.get('glitch') || 0);   // test override ?glitch=0..1
  if (LIVE || LOC || CTRL) return 0;
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
    const k = (hc ? ['strobe', 'blaze', 'dark', 'bw', 'strobe', 'blaze'] : ['dark', 'bw', 'strobe', 'blaze'])[Math.floor(r() * (hc ? 6 : 4))], d = hc ? (k === 'blaze' ? rr(3, 5) : rr(4, 8)) : k === 'blaze' ? rr(3, 6) : k === 'strobe' ? rr(ENGINE.strobe.dur[0], ENGINE.strobe.dur[1]) : rr(10, 25);
    moods.push({ k, a: t, b: t + d, rate: hc ? rr(8, 14) : rr(ENGINE.strobe.rate[0], ENGINE.strobe.rate[1]) }); t += d + (hc ? rr(25, 50) : rr(20, 50));
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
  const rp = hc ? .4 : 1.5;
  if (s) { m[s.k] = smooth(s.a, s.a + rp, t) * (1 - smooth(s.b - rp, s.b, t)); m.rate = s.rate; if (s.k === 'strobe') m.strobe *= ENGINE.strobe.amount; }
  const p = sur.find(c => c.h > .75 && t > c.b - 2 && t < c.b + 3);   // the top of a big swell blows out briefly
  if (p) m.blaze = Math.max(m.blaze, .8 * smooth(p.b - 1.5, p.b, t) * (1 - smooth(p.b, p.b + 2.5, t)));
  return m;
}
 // zoom pulses (T110, T113): the same draw rules in every source, only the clock differs. Out (4-20 s, 2 in 3: mostly x0.25-0.5, 1 in 4 down to x0.15) or in (x1.6-2.0, 1-10 s, 1 in 3), ease in/out with a plateau.
 // Generated: the seeded time list (every ~30-70 s, pure function of t). Local: the same draw placed on the timeline's scene starts (pure function of t). Live: may start at a new scene, causal (state in LIVE.zp). (T71: zoom in capped at x2; 2026-10-17: more and longer far-out phases, floor .15)
 const ZLc = {};
 function zoomDraw(r, rr) {   // one pulse's duration and factor from ENGINE.zoom (the draw order is fixed: out?, dur, [far?], f)
   const Z = ENGINE.zoom, out = r() < Z.pOut, dur = out ? rr(Z.durOut[0], Z.durOut[1]) : rr(Z.durIn[0], Z.durIn[1]), f = !out ? rr(Z.fIn[0], Z.fIn[1]) : r() < Z.pFar ? rr(Z.fFar[0], Z.fFar[1]) : rr(Z.fOut[0], Z.fOut[1]);
   return { dur, f: Math.min(Z.max, Math.max(Z.min, f)) };
 }
 let TUNE_ZL = null;   // T117: tune mode (09-fx.js) swaps the pulse list for the one pulse of its loop
 function zoomPulseList() {
   if (TUNE_ZL) return TUNE_ZL();
   const c = ZLc; if (c && c.ph === PH && c.tot === TOTAL && c.v === ENGINE.v) return c.list;
   const Z = ENGINE.zoom, r = mulberry32(Math.floor(PH * 1e5) + 12345), rr = (a, b) => a + (b - a) * r();
   const list = [];
   let t = rr(Z.first[0], Z.first[1]);
   while (t < TOTAL) { const d = zoomDraw(r, rr); list.push({ a: t, b: t + d.dur, f: d.f }); t += d.dur + rr(Z.gap[0], Z.gap[1]); }
   ZLc.ph = PH; ZLc.tot = TOTAL; ZLc.v = ENGINE.v; ZLc.list = list; return list;
 }
 function zoomPulseListLocal() {   // Local: scene starts (LOC.sceneT) that fall outside the previous pulse + its gap start a pulse; seeded by the track's own seed PH
   const c = LOC.zl; if (c && c.ph === PH && c.v === ENGINE.v) return c.list;
   const Z = ENGINE.zoom, r = mulberry32(Math.floor(PH * 1e5) + 54321), rr = (a, b) => a + (b - a) * r();
   const list = []; let ok = rr(Z.first[0], Z.first[1]);
   for (const s of LOC.sceneT) if (s >= ok) { const d = zoomDraw(r, rr); list.push({ a: s, b: s + d.dur, f: d.f }); ok = s + d.dur + rr(Z.gap[0], Z.gap[1]); }
   LOC.zl = { ph: PH, v: ENGINE.v, list }; return list;
 }
 function zoomPulseLive(t) {   // Live (causal): a new scene (LIVE.scenes changed) after the gap starts a pulse now; state in LIVE.zp. Call once per frame.
   const L = LIVE, Z = ENGINE.zoom;
   if (!L.zp) { const r = mulberry32(Math.floor(PH * 1e5) + 99991); L.zp = { r, rr: (a, b) => a + (b - a) * r(), sc: L.scenes, ok: 0, cur: null }; L.zp.ok = L.zp.rr(Z.first[0], Z.first[1]); }
   const S = L.zp;
   if (L.scenes !== S.sc) { S.sc = L.scenes; if (t >= S.ok) { const d = zoomDraw(S.r, S.rr); S.cur = { a: t, b: t + d.dur, f: d.f }; S.ok = t + d.dur + S.rr(Z.gap[0], Z.gap[1]); } }
   if (S.cur && t >= S.cur.b) S.cur = null;
 }
 const zoomPulseActive = t => LOC ? (zoomPulseListLocal().find(x => t >= x.a && t < x.b) || null) : LIVE ? (LIVE.zp && LIVE.zp.cur && t >= LIVE.zp.cur.a && t < LIVE.zp.cur.b ? LIVE.zp.cur : null) : zoomPulseList().find(x => t >= x.a && t < x.b) || null;   // the pulse running at t ({a, b, f}) or null
 const zoomPulseAt = t => {
   const s = zoomPulseActive(t);
   if (!s) return 1;
   const rp = Math.min(ENGINE.zoom.ramp, (s.b - s.a) / 2);   // ramp length: a long pulse holds its level between the two ramps
   const envRaw = smooth(s.a, s.a + rp, t) * (1 - smooth(s.b - rp, s.b, t));
   const env = envRaw * envRaw * (3 - 2 * envRaw);
   return 1 + (s.f - 1) * env;
 };
