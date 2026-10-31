let snapLook = false, tunLive = 0, hue = 0, rotA = 0, rotDir = 1, bi = 0, lastT = 0, bassE = 0, cur = 0;
function uAt(t, off) {   // arc position of the picture at song time t (pure; `off` = the eased Energy offset): shared by render, integrateTo and integrateLocal
  const pE = LIVE || CTRL || SHOW || hcOn() ? null : planE(t), u0 = LIVE ? LIVE.u : CTRL ? .3 : clamp(t / TOTAL), us = clamp((pE != null ? uForE(pE) : u0) + off, .05, 1);   // .05: the arc's first keys are black (Energy offset < 0 used to push u to 0)
  return { u: lerp(Math.min(us, .88), u0, smooth(.85, 1, u0)), u0 };
}
// T77: slow morph for the background ghost (source anchor). Two images among the loaded
// set, chosen seeded; ease in/out over 20-40 s, then ghostA <- ghostB and a new ghostB.
function ghostIndices(t) {
  if (!IM || IM.length <= 1) return { a: imTo, b: imTo, mix: 0 };
  const cand = ex => { const r = []; for (let k = 0; k < IM.length; k++) if (k !== ex) r.push(k); return r.length ? r : [0]; };
  const tt = Math.max(0, t || 0);
  let cursor = 0, ci = 0;
  let a = imTo;
  const c0 = cand(imTo);
  let b = c0[Math.floor(seedHash(0, 13) * c0.length)] ?? imTo;
  while (true) {
    const len = 20 + seedHash(ci, 12) * 20;
    if (tt < cursor + len || ci > 100000) {
      const phase = tt - cursor;
      return { a: ((a % IM.length) + IM.length) % IM.length, b: ((b % IM.length) + IM.length) % IM.length, mix: smooth(0, len, phase) };
    }
    cursor += len;
    a = b;
    const ex = IM.length > 2 ? imTo : a;
    const c = cand(ex);
    b = c[Math.floor(seedHash(ci + 1, 14) * c.length)] ?? a;
    ci++;
  }
}
// scene / minor-change timing (pure functions of t; the generated section plan `VP` overrides the scene part inside render())
// Extreme: seeded phase timeline. 'run' = 40-90 s of scenes of 10/15/20/30 s (one length per run), minor 10 s;
// 'hold' = one scene 20-30 s, minor 15 s. After a run: hold with p .6, else run; never two holds in a row. Pure function of PH.
const EXT = {};
function seedHash(n, k) { const x = Math.sin((n + PH) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
function extPhases(need) {   // builds phases until the last one ends after `need` (cached per seed)
  const L = memo(EXT, [PH], () => []);
  while (!L.length || L[L.length - 1].end < need) {
    const n = L.length, p = n ? L[n - 1] : null, start = p ? p.end : 0;
    const hold = p !== null && p.kind === 'run' && seedHash(n, 0) < .6;
    let q;
    if (p !== null && p.kind !== 'pingpong' && seedHash(n, 3) < .2) {   // T41: ping-pong (after a run or hold only): A,B,A,B... every 1.5-2.5 s, 8-20 s
      const dur = 8 + 12 * seedHash(n, 5); q = { kind: 'pingpong', dur, len: 1.5 + seedHash(n, 4), MP: 2, scenes: 2, minors: Math.ceil(dur / 2) };
    }
    else if (hold) { const dur = 20 + 10 * seedHash(n, 1); q = { kind: 'hold', dur, len: dur, MP: 15, scenes: 1, minors: Math.ceil(dur / 15) }; }
    else {
      const len = [10, 15, 20, 30][Math.floor(seedHash(n, 2) * 4)], a = Math.ceil(40 / len), b = a + 2;
      const N = a + Math.floor(seedHash(n, 1) * (b - a + 1));   // whole scenes: no short cut-off scene at the phase end
      q = { kind: 'run', dur: N * len, len, MP: 10, scenes: N, minors: Math.ceil(N * len / 10) };
    }
    q.start = start; q.end = start + q.dur; q.first = p ? p.first + p.scenes : 0; q.firstMinor = p ? p.firstMinor + p.minors : 0;
    L.push(q);
  }
  return L;
}
function extAt(t) { const L = extPhases(t + 60); for (const q of L) if (t < q.end) return q; return L[L.length - 1]; }
function extKind(t) { return extAt(t).kind; }   // 'run' | 'hold' | 'pingpong' (Extreme only)
// Generated pieces (not LIVE / LOC): scene and minor edges land on BEATS. beatNear(x) = nearest beat if within one beat period, else x.
// edgeIdx(t, k, edge) = the index whose [edge(k), edge(k+1)) holds t (k = raw guess from the old grid). Pure functions of t.
function beatNear(x) {
  const B = BEATS; if (LIVE || LOC || B.length < 8) return x;
  let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m] < x) lo = m + 1; else hi = m; }
  const a = B[lo - 1], b = B[lo], best = a === undefined ? b : b === undefined ? a : (x - a <= b - x ? a : b);
  return best !== undefined && Math.abs(best - x) <= 60 / bpmAt(x / TOTAL) ? best : x;
}
// T51 grid switch (USER.grid 0 beat / 1 bar / 2 phrase): bar = every 4 BEATS, phrase = every 8 bars (BEATS[0] = bar 1). Generated styles whose pulse IS BEATS only (the others have their own grid: no effect).
const GRID_MUSIC = ['ambient', 'electro', 'chiptune', 'chiptune2'], GRID_NAMES = ['beat', 'bar', 'phrase'];
const gridNb = () => USER.grid && !LIVE && !LOC && GRID_MUSIC.includes(MUSIC) ? [0, 4, 32][USER.grid] : 0;   // beats per grid line, 0 = off
function gridLine(x, nb) {   // nearest line BEATS[k * nb] (pure function of x and the beat list)
  const B = BEATS; if (!nb || B.length < 8 || x <= B[0] || x >= B[B.length - 1]) return x;   // outside the beat list the raw time stays (keeps edgeIdx finite)
  let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m] < x) lo = m + 1; else hi = m; }
  const i = Math.min(B.length - 1, lo > 0 && (lo === B.length || x - B[lo - 1] <= B[lo] - x) ? lo - 1 : lo), c1 = Math.floor(i / nb) * nb, c2 = c1 + nb;
  return c2 < B.length && Math.abs(B[c2] - x) < Math.abs(B[c1] - x) ? B[c2] : B[c1];
}
function edgeIdx(t, k, edge) { while (t < edge(k)) k--; while (t >= edge(k + 1)) k++; return k; }
// T103: calm piano (events on, no section plan): the 45 s scene edge snaps to the nearest phrase start within 6 s
function evSnap(x) {
  const { i, e } = evtIdx(x, ['phrase']), n = EVC.phrase.a[i];
  let b = e, d = e ? Math.abs(e.t - x) : 1e9; if (n && Math.abs(n.t - x) < d) { b = n; d = Math.abs(n.t - x); }
  return b && d <= 6 ? b.t : x;
}
// T147 pace: the clock path (ambient / piano scenes, minor changes without events) runs on a WARPED clock W(t) = integral of 1 / interval(t): the interval follows the music's energy (ENGINE.pace),
// edge k sits where W = k - phase. Pure function of t, PH, the arc / plan (the table is cached per seed, length, ENGINE.v, arc, plan). paceOn = generated auto (not Extreme / Live / Local / manual / showcase).
const PACE = {}, paceOn = hd => !hd && !(LIVE || LOC || SHOW || CTRL);
const paceE = t => planE(t) ?? energy(clamp(t / TOTAL)), paceS = e => { const P = ENGINE.pace; return smooth(P.e[0], P.e[1], e); };   // energy at t (section energy, else arc); 0 calm .. 1 lively
const paceIv = (kind, t) => { const r = ENGINE.pace[kind]; return lerp(r[0], r[1], paceS(paceE(t))); };   // the interval (s) at t
function paceClock(kind) {   // -> { W(t), inv(x) }
  const VP = vplan(), sig = [PH, TOTAL, ENGINE.v, ARC, VP.length ? VP : 0]; let c = PACE[kind];
  if (!c || c.sig.some((x, i) => x !== sig[i])) {
    const h = 1, n = Math.ceil(Math.max(TOTAL, 60) / h) + 2, W = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) W[i + 1] = W[i] + h / paceIv(kind, (i + .5) * h);
    const iv0 = paceIv(kind, 0), ivN = paceIv(kind, n * h);
    c = PACE[kind] = { sig, W, h, n, iv0, ivN };
  }
  const { W, h, n, iv0, ivN } = c;
  return {
    W: t => t <= 0 ? t / iv0 : t >= n * h ? W[n] + (t - n * h) / ivN : (i => W[i] + (W[i + 1] - W[i]) * (t / h - i))(Math.floor(t / h)),
    inv: x => { if (x <= 0) return x * iv0; if (x >= W[n]) return n * h + (x - W[n]) * ivN; let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (W[m] <= x) lo = m; else hi = m; } return (lo + (x - W[lo]) / (W[lo + 1] - W[lo])) * h; }
  };
}
function sceneAt(t, hd, ev = false) {
  if (hd) {   // Extreme phases: run/hold = scenes of p.len, ping-pong = A/B alternating (ids p.first, p.first+1)
    const p = extAt(t), e = k => beatNear(p.start + k * p.len), raw = Math.max(0, edgeIdx(t, Math.floor((t - p.start) / p.len), e));
    const pp = p.kind === 'pingpong', k = pp ? raw : Math.min(p.scenes - 1, raw), s0 = e(k);
    return { wi: pp ? p.first + (k & 1) : p.first + k, wf: clamp((t - s0) / p.len), since: Math.max(0, t - s0), len: p.len };
  }
  // fixed ~45 s period (+ seed offset PH), edges on beats
  const gn = ev ? gridNb() : 0, sn = gn ? x => gridLine(x, gn) : ev && !vplan().length ? evSnap : x => x, pc = paceOn(hd) ? paceClock('scene') : null, SP = ENGINE.scene.period;   // pc: T147, scene period follows the music's energy (70 s calm .. 40 s lively); else fixed 45 s
  const at = pc ? k => pc.inv(k - PH * .37) : k => (k - PH * .37) * SP, e = k => sn(gn ? at(k) : beatNear(at(k))), k = edgeIdx(t, Math.floor(pc ? pc.W(t) + PH * .37 : t / SP + PH * .37), e), s0 = e(k), len = pc ? Math.max(1, e(k + 1) - s0) : SP;
  return { wi: k, wf: clamp((t - s0) / len), since: Math.max(0, t - s0), len };
}
// T147: the music's fill / phrase events thinned to the pace: a kept event is at least keep x interval(energy at the event) after the last kept one (cached per event list, seed, length, ENGINE.v)
const MEVC = {};
function minorEvents() {
  return memo(MEVC, [EVT, ENGINE.v, TOTAL], () => {
  const all = EVT.filter(x => x.k === 'fill' || x.k === 'phrase'), l = []; let last = -1e9;
  for (const x of all) if (x.t - last >= ENGINE.pace.keep * paceIv('minor', x.t)) { l.push(x); last = x.t; }
  return l;
  });
}
function minorAt(t, hd, ev = false) {   // mf = seconds since the minor edge / MP (the envelope in render() uses mf * MP); iv = the nominal interval (s) now, e = the energy it follows (generated auto)
  if (hd) { const p = extAt(t), e = k => beatNear(p.start + k * p.MP), k = Math.max(0, edgeIdx(t, Math.floor((t - p.start) / p.MP), e)), s0 = e(k); return { mi: p.firstMinor + k, mf: Math.max(0, t - s0) / p.MP, MP: p.MP, ms: 1, iv: p.MP, e: null }; }
  const gn = ev ? gridNb() : 0, po = paceOn(false), pe = po ? paceE(t) : null, ps = po ? paceS(pe) : 1, amp = lerp(ENGINE.pace.calmAmp, 1, ps), iv = po ? paceIv('minor', t) : ENGINE.scene.minor;   // T51: phrase grid = minor changes on bar starts; bar grid keeps beats (the path below); both skip the music's fill / phrase events
  if (ev && !gn && evtIdx(1e9, ['fill', 'phrase']).i >= 4) {   // T103: edges on the music's fills / phrases (T147: thinned in calm stretches)
    const L = minorEvents(); let lo = 0, hi = L.length; while (lo < hi) { const m = (lo + hi) >> 1; if (L[m].t <= t) lo = m + 1; else hi = m; }   // lo = events at or before t
    const e = lo ? L[lo - 1] : null; return { mi: lo, mf: e ? (t - e.t) / ENGINE.scene.minor : 99, MP: ENGINE.scene.minor, ms: !e ? 0 : (e.k === 'fill' ? 1 : .4 + .6 * e.s) * amp, iv, e: pe };
  }
  const pc = po ? paceClock('minor') : null, MP = ENGINE.scene.minor, at = pc ? k => pc.inv(k - PH * .2) : k => (k - PH * .2) * MP, e = k => gn === 32 ? gridLine(at(k), 4) : beatNear(at(k)), k = edgeIdx(t, Math.floor(pc ? pc.W(t) + PH * .2 : t / MP + PH * .2), e), s0 = e(k);
  return { mi: k, mf: Math.max(0, t - s0) / MP, MP, ms: amp, iv, e: pe };
}
// T184: the scene-change punch, one pure function for render() and __pic. TRN = the transition time (s) the engine picks per scene (seed + scene; CL / SHOW use USER.trans), trD = the punch decay,
// tr = scene-start envelope, tm = minor-change envelope, th = `hit` event punch, trP = max(tr, th), hH = the `hit` event running (or null). c = the caller's state: CL SHOW LIVE Hd isGen (flags), cal calG g15 (slow-start factors), scene wi since (the scene and the time in it),
// kind (kindOf(scene)), EV, mn (minorAt), trT0 tmT0 (Live: when the scene / minor change began). render() writes the global TRN from the result (transT() reads it).
function scenePunch(t, c) {
  const { CL, SHOW, LIVE, Hd, isGen, cal, calG, g15, scene, wi, since, kind, EV, mn } = c, pp = Hd && extKind(t) === 'pingpong';
  const pk = a => a[Math.floor(seedHash(scene, 9) * a.length)];
  const ES = ENGINE.scene; let TRN = CL || SHOW ? USER.trans : cal < 1 ? pk(ES.trnRamp) : Hd ? pk(ES.trnHc) : kind ? pk(ES.trnEnergetic) : pk(ES.trnCalm); if (isGen) TRN = Math.max(TRN, EN.trn[USER.energy]); if (pp) TRN = 0;   // T41: ping-pong = hard cuts; T147: generated auto never cuts at calm / soft (EN.trn floor)
  const trD = CL || SHOW ? ES.decay : Math.max(ES.decayMin, TRN / 2);   // decay of the scene-change punch
  const tm = g15 * (LIVE ? Math.exp(-(t - c.tmT0) / ES.minorDecay) : mn.mf < .08 ? 0 : Math.exp(-mn.mf * mn.MP / ES.minorDecay) * calG * mn.ms);   // minor-change envelope: hue shift, small zoom nudge, tile re-roll
  const tr = g15 * (LIVE ? Math.exp(-(t - c.trT0) / trD) : wi > 0 ? Math.exp(-since / trD) * calG * (pp ? .4 : 1) : 0);   // 1 at the start of a scene, fades in ~3 s: zoom punch, warp, tile burst
  const hH = EV ? evtIdx(t, ['hit']).e : null, th = hH ? hH.s * Math.exp(-(t - hH.t) / trD) * g15 * calG : 0, trP = Math.max(tr, th);   // T103: a `hit` event punches like a scene start (no scene change); closed form in t - hit.t
  return { TRN, trD, tr, tm, th, trP, hH };
}
// ?debug=1 (T104, read only): window.__pic(t) = what the generated picture does at song time t (scene id, scene punch, minor envelope, surge, plan energy); mirrors render()'s formulas, changes nothing
if (Q.has('debug')) window.__pic = t => {
  const EV = evOK(), VP = vplan(), sc = sceneAt(t, false, EV), RI = rampIn(t, UT.rs());
  let wi = sc.wi, since = sc.since, secE = 1, i = -1; if (VP.length) { i = VP.findIndex(x => t < x.b); if (i < 0) i = VP.length - 1; wi = i; since = t - VP[i].a; const pe = VP[i - 1] ? VP[i - 1].e : VP[i].e; secE = lerp(pe, VP[i].e, smooth(0, 4, since)); }
  const kind = VP.length ? (VP[wi] && VP[wi].e < .4 ? 0 : 1) : 1, cz = RI, mn = minorAt(t, false, EV);
  const { TRN: TR, tr, tm, th, trP, hH: h } = scenePunch(t, { CL: 0, SHOW: false, LIVE: null, Hd: false, isGen: paceOn(false), cal: RI, calG: 1, g15: RI, scene: wi, wi, since, kind, EV, mn });   // generated auto only (the flags are fixed); RI uses the target Energy blend (render: the eased UE.rs)
  const flash = h ? .5 * h.s * Math.exp(-(t - h.t) / .3) * cz : 0;
  const raw = surgeAt(t, false, EV), lwi = LOC ? upper(LOC.sceneT, t) : LIVE ? LIVE.scenes : wi;   // T150: lwi = the light-set window: the Local timeline's scene at t (a pure function), the live scene now (Live: only the current frame), else the generated window
  const gn = EV ? gridNb() : 0, gl = x => gn ? gridLine(x, gn) : beatNear(x);   // T51: the active grid and the grid line nearest to t (beat grid when 'beat')
  return { t, grid: GRID_NAMES[USER.grid], gridActive: gn ? GRID_NAMES[USER.grid] : 'beat', gridLine: gl(t), gridDist: Math.abs(t - gl(t)), sceneStart: t - since, sceneLen: VP.length ? VP[i].b - VP[i].a : sc.len, minorIv: mn.iv, minorE: mn.e, wi, tr, tm, mi: mn.mi, ms: mn.ms, surge: raw, sg: raw * cz * (VP.length ? .6 + .8 * secE * UE.big : 1), th, trP, blaze: Math.max(moodAt(t, false, EV).blaze, flash) * UE.big, strobe: moodAt(t, false, EV).strobe * UE.strb, svar: (m => m && m.k === 'strobe' ? { name: SV_NAMES[m.v], phase: m.v === 1 ? (r => r - Math.floor(r))(rampPhase(t - m.a, ENGINE.strobe.acc[0], ENGINE.strobe.acc[1], m.b - m.a)) : (r => r - Math.floor(r))(t * m.rate), t0: m.a, D: m.b - m.a } : null)(moodRun(t, false)), planE: planE(t), zoomPulse: (zp => zp ? { f: zp.f, a: zp.a, b: zp.b } : null)(!(SHOW || CTRL || hcOn()) ? zoomPulseActive(t) : null), calm: RI, cz, g15: RI, ramp: RI, ls: lsNames(lightSet(lwi)), lsKey: lsKey(lwi), lsWin: lwi, TRN: TR, engineV: ENGINE.v, acc: accInfo(t), srcGain: { src: SRC_NOW, g: srcGainText(SRC_NOW, hcOn()) }, video: [imFrom, imTo].filter((k, i, a) => a.indexOf(k) === i && IM[k] && IM[k].vid).map(k => k + 1), morph: imMix < 1 ? { on: !!USER.morph, style: MSTY[MORPH.st], m: MORPH.m, dur: MORPH.dur, from: imFrom, to: imTo } : null };
};
function tileSizeAt(t) {   // T55 tile effect: cell-size factor, seeded pure function of t, easing smoothly between 2.0 and 5.0 (doubled from 1.0-2.5); each target held for a seeded random 2-20 s
  if (!isFinite(t) || t <= 0) return 2;
  const sr = mulberry32((((PH * 1e6) | 0) * 48271 + 101) | 0);
  let time = 0, prev = 2, dur = 2 + sr() * 18, val = 2 + sr() * 3;
  while (time + dur <= t) { time += dur; prev = val; dur = 2 + sr() * 18; val = 2 + sr() * 3; }
  const f = Math.min(1, Math.max(0, (t - time) / dur)), k = f * f * (3 - 2 * f);
  return prev + (val - prev) * k;
}
// T143 light set (generated auto): per scene window a seeded pick of {Kali, Julia, kaleidoscope, tiles} (0-3 of them, EN.lsN), rotating through a seeded order so all four show over a piece; windows 0..lsFirst-1 share one set (slow start).
// Pure function of (window, seed, Energy). A member sits at a strength in the eye's units (VIS: visible / light) x EN.lsLv, the slow-start ramp scales it; render() eases it with ezS (the scene's transition time).
const LS_FX = ['kali', 'julia', 'kal', 'tile'], LS_NAME = ['Kali', 'Julia', 'kaleidoscope', 'tiles'], LSO = {};
const lsKey = wi => Math.max(0, wi - (EN.lsFirst - 1));
function lightSet(wi, E = USER.energy) {   // -> [kali, julia, kal, tile] booleans
  const k = lsKey(wi), tb = (LIVE ? EN.lsNL : EN.lsN)[E], u = seedHash(k, 41), on = [false, false, false, false];
  const ord = memo(LSO, [PH], () => [0, 1, 2, 3].sort((a, b) => seedHash(a, 42) - seedHash(b, 42)));
  let n = 0, c = tb[0]; while (n < tb.length - 1 && u >= c) c += tb[++n];
  for (let j = 0; j < n; j++) on[ord[(k + j) % 4]] = true;
  if (LIVE && on[3] && seedHash(k, 60) >= EN.lsTL[E]) on[3] = false;   // T150 Live / Local: tiles are kept in only EN.lsTL of the scenes that draw them (calm .4, soft .7)
  return on;
}
const lsAmt = (i, wi, E, cal, gate) => { const v = VIS[LS_FX[i]], [lo, hi] = EN.lsLv[E]; return gate * lerp(v[0], v[1] * (lo + (hi - lo) * seedHash(lsKey(wi), 50 + i)), cal); };   // a member's strength in P units
const lsNames = on => LS_NAME.filter((_, i) => on[i]);
const softCap = (x, c, kn) => { const a = kn * c; if (x <= a) return x; const y = (x - a) / ((1 - kn) * c); return a + (1 - kn) * c * y / (1 + y); };   // knee at kn*c, then approaches c without ever reaching it (the motion stays alive)
let SRC_NOW = 'gen', SG_LOGGED = '';   // T114: the source of the current frame; last logged source-gain key
let PLOG = null;   // T108: window.__plog while a debug still runs, else null (zero cost)
// T167: the morph uniforms (style, seed, softness, colour shift, iris centres + norm, A / B colour statistics); style 0 (crossfade, off, idle) = k is just uImgMix
function morphUniforms() {
  const st = imMix < 1 && USER.morph ? MORPH.st : 0, m = MORPH.m, M = MORPH;
  gl.uniform4f(uS.uMo, st, M.seed, st === 2 ? .12 : .15, st === 3 ? clamp(m / .4) : 0);
  if (!st) return;
  let dn = 0; for (const cx of [0, ASPECT]) for (const cy of [0, 1]) { let d = 9; for (let i = 0; i < M.ni; i++) d = Math.min(d, Math.hypot(cx - M.c[i][0] * ASPECT, cy - M.c[i][1])); dn = Math.max(dn, d); }
  gl.uniform4f(uS.uMi, M.c[0][0], M.c[0][1], M.c[1][0], M.c[1][1]); gl.uniform4f(uS.uMj, M.c[2][0], M.c[2][1], M.ni, dn * 1.15);
  const sa = IM[imFrom].st || MSTAT0, sb = IM[imTo].st || MSTAT0;
  gl.uniform3f(uS.uMuA, ...sa.mu); gl.uniform3f(uS.uMuB, ...sb.mu); gl.uniform3f(uS.uMr, ...sb.sd.map((v, i) => clamp(v / Math.max(sa.sd[i], .02), .5, 1.6)));
}
