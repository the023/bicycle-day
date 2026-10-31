/* ════════════════════════ EFFECT TABLES (pure data, no DOM; named 08z so it sorts before 09-fx.js, after 08-director.js) ════════════════════════
   PF = the P contract: every field of the per-frame params object P with its neutral value (plain image), the range clampP() enforces and two flags.
     sc: 1     the showcase baseline sets it (showcaseParams)
     quiet: v  its value in the manual-level base QUIET (only where it differs from nothing/neutral)
   min/max are deliberately loose (shader safety net, never reached in normal play); ?debug=1 warns once per field when clampP had to act.
   EFFECTS = one row per user-facing effect (pupitre cell + key). CT_KEYS and LVK are derived from it in 10-control.js; PEFF, PMOOD, PSNAP, PMAX in 12d-pult.js.
   Adding an effect = one FX entry (09-fx.js, with desc + fields) + one EFFECTS row here (+ its PF fields if it needs a new one). */
const PF = {
  t:        { neutral: 0,   min: -1e6, max: 1e8 },
  warp:     { neutral: 0,   min: -1,   max: 20, sc: 1, quiet: .06 },
  kal:      { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  fold:     { neutral: 6,   min: 1,    max: 64, sc: 1, quiet: 6 },
  fb:       { neutral: 0,   min: -1,   max: 3,  sc: 1, quiet: 0 },
  fbHue:    { neutral: 0,   min: -2,   max: 3 },
  hue:      { neutral: 0,   min: -1e7, max: 1e7, sc: 1 },
  pal:      { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  side:     { neutral: 0,   min: -2,   max: 3,  sc: 1, quiet: 0 },
  breath:   { neutral: 0,   min: -1,   max: 50, sc: 1, quiet: .6 },
  melt:     { neutral: 0,   min: -1,   max: 10, sc: 1, quiet: 0 },
  zoom:     { neutral: 1,   min: .15,  max: 2,  sc: 1 },   // the same limits render() has always applied
  rot:      { neutral: 0,   min: -1e7, max: 1e7, sc: 1 },
  ab:       { neutral: 0,   min: -1,   max: 20, sc: 1, quiet: .05 },
  pulse:    { neutral: 0,   min: -1,   max: 10, sc: 1 },
  bright:   { neutral: 1,   min: -1,   max: 10, sc: 1, quiet: 1 },
  anchor:   { neutral: 0,   min: -2,   max: 3,  sc: 1, quiet: 0 },
  tilt:     { neutral: [0, 0], min: -5, max: 5, sc: 1 },
  srcZ:     { neutral: 1,   min: .01,  max: 20, sc: 1 },
  srcRot:   { neutral: 0,   min: -100, max: 100, sc: 1 },
  palC:     { neutral: [1.3, 1.3, 1.3], min: -10, max: 10, sc: 1 },   // = PALS[0].c
  palD:     { neutral: [0, .33, .67],   min: -10, max: 10, sc: 1 },   // = PALS[0].d
  ha:       { neutral: 1,   min: -1,   max: 3,  sc: 1 },
  stretch:  { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  tun:      { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  mono:     { neutral: 0,   min: -1,   max: 3,  sc: 1, quiet: 0 },
  tile:     { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  tileN:    { neutral: 12,  min: 1,    max: 200, quiet: 12 },
  tileMode: { neutral: 0,   min: 0,    max: 8,  quiet: 0 },
  surge:    { neutral: 0,   min: -1,   max: 5 },
  kali:     { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  julia:    { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  dark:     { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  blaze:    { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  strobe:   { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  rate:     { neutral: 8,   min: 0,    max: 60, sc: 1, quiet: 8 },
  cells:    { neutral: 0,   min: -1,   max: 5,  sc: 1, quiet: 0 },
  // T161 strobe variants (display pass only). rate1 > 0 = accelerating strobe: the rate climbs from `rate` to rate1 over sD s from sT0 (closed-form phase, rampPhase); sNeg = the flash is the inverted image. cD > 0 = accelerating checkerboard (ramp over cD s from cT0, ENGINE.strobe.acc); cCol = lit cells take colours
  rate1:    { neutral: 0,   min: 0,    max: 60, sc: 1 },
  sT0:      { neutral: 0,   min: -1e6, max: 1e8, sc: 1 },
  sD:       { neutral: 0,   min: 0,    max: 1e4, sc: 1 },
  sNeg:     { neutral: 0,   min: -1,   max: 5,  sc: 1 },
  cT0:      { neutral: 0,   min: -1e6, max: 1e8, sc: 1 },
  cD:       { neutral: 0,   min: 0,    max: 1e4, sc: 1 },
  cCol:     { neutral: 0,   min: -1,   max: 5,  sc: 1 },
  grid:     { neutral: 4,   min: 1,    max: 64 },
  glitch:   { neutral: 0,   min: -1,   max: 5 },
};
// Energy (0 calm .. 4 extreme): the ONE user setting of the picture in auto. [arc offset (old Intensity x .25), global amount (old Effects), extreme blend (old Extreme / hk)]
// T134: big = the 'big moves' (tiles, tunnel, glitch, blaze, zoom pulses / punches, the section boost of surges), strobe = the strobe mood: both only calm / soft, generated auto only (the other sources and control levels use 1)
// T147 (generated auto): trn = the shortest scene transition (s) at each Energy (no hard cut at calm / soft); moodRamp = the ease-in / out time (s) of the dark / bw / blaze / strobe moods.
// T143 (generated auto, Energy 0-3): the 'light set' = which of Kali, Julia, kaleidoscope, tiles are on, drawn per scene window (lightSet() in 10b-clock.js). lsN = chance of 0 / 1 / 2 / 3 of them (max count calm 2, soft 2, normal 3; mean about 1 / 1.3 / 2);
// lsLv = strength of a picked one as a fraction range of its `light` level (VIS: calm between visible and light, soft up to light, normal around the engine); lsFirst = this many windows share the first set (slow start);
// lsw = 1 where the set decides alone (calm, soft: the arc no longer drives these four), 0 where it only adds a floor to the engine (normal, strong); capK x `light` = the soft cap (knee `knee`) on warp, melt, stretch, trails, glitch while lsw is 1
// T151 (Live / Local auto): presence pr = lp[E] x lpS[E][0] in a calm section x lpS[E][1] in a breakdown / calm state, eased (down >= lpT s, up lpT / 3); it scales warp, trails (pr ** lpX[0]), melt (pr ** lpX[1]), aberration (floor included) and stretch (no floor in Live / Local auto: st = [slope, u where it starts]), so they drop below visible in quiet parts and with a low Energy (Local: only lpL of it, its loudness already follows the file) and a drop at normal / strong stays as before
// T153 (Live / Local Extreme): hcAb = [x, +] on the aberration, the generated Extreme keeps 1.8 / .4 (the SRCGAIN gains below 1 also apply in Extreme now)
// T150 (Live / Local auto): lsNL = lsN for them (lighter: no slow start thins the set out), lsTL = share of the scenes that draw tiles which keep them (calm .4, soft .7); a member is divided by its SRCGAIN factor so the set strength is what ends up in P
// T157 (Live / Local auto): acc = chance per accent unit of [strobe, checkerboard, glitch rush, zoom push, warp rise] by Energy (the rest of the units get none); strobe / checkerboard only in builds and energetic grooves, never in breakdown / calm (ENGINE.acc, accUnit)
const EN = { off: [-.25, -.12, 0, .12, .25], offG: [-.35, -.23, 0, .12, .25], amp: [.55, .8, 1, 1.15, 1.25], big: [.35, .6, 1, 1, 1], strobe: [0, .5, 1, 1, 1], hc: [0, 0, 0, 0, 1], trn: [3, 1, 0, 0, 0], moodRamp: [5, 2.5, 1.5, 1.5, 1.5], lsN: [[.05, .6, .35], [0, .4, .6], [0, .35, .55, .1], [0, .35, .55, .1], [0, .35, .55, .1]], lsTL: [.4, .7, 1, 1, 1], lsNL: [[.55, .4, .05], [.35, .5, .15], [.3, .5, .2], [.3, .5, .2], [.3, .5, .2]], lsLv: [[.4, .85], [.6, 1], [.8, 1.2], [.8, 1.2], [.8, 1.2]], lsFirst: 2, lsw: [1, 1, 0, 0, 0], capK: [1, 1.5, 1.5, 1.5, 1.5], knee: .5, lp: [.6, .7, 1, 1, 1], lpS: [[.6, .8], [.6, .8], [.5, .75], [.65, .82], [.65, .82]], lpT: 1.5, lpL: .5, hcAb: [1.1, .2], lpX: [1.3, .5], st: [1.4, .45], acc: [[0, 0, .1, 0, .1], [0, 0, .2, .1, .15], [.08, .08, .25, .15, .15], [.2, .2, .2, .1, .1], [.15, .15, .2, .05, .05]], names: ['calm', 'soft', 'normal', 'strong', 'extreme'] };
// T110: ENGINE = the limits the generated engine plays inside (defaults = the numbers that used to be literals). Ranges are [a, b]. ENGINE.v is bumped on every change (caches keyed on PH/TOTAL also check it).
// ?engine=<json> (testing) deep-merges a partial object at load, e.g. ?engine={"zoom":{"min":0.5}}.
const ENGINE = {
  v: 0,
  zoom: { min: .15, max: 2.0,                 // limits of a pulse's factor (applied after the seeded draw, so the draw order never changes)
    gap: [14, 38], first: [30, 60],            // gap between pulses, start of the first (s)
    pOut: .85, pFar: .75, pFast: .35,            // chance of a zoom-out; chance that an out is a far one; chance that a pulse is a fast one (else a slow glide)
    durSlow: [30, 48], easeSlow: [10, 15],     // slow glide: whole pulse length, ease in / out (s; an ease is at most half the length)
    durFast: [5, 14], easeFast: [.5, 1], easeBack: 3,   // fast jump: length, the quick ease in (s), the ease back out (s)
    fIn: [1.6, 2.0], fOut: [.25, .5], fFar: [.15, .25],   // factor ranges in / out / far out (drawn, then clamped to min..max)
    rest: .92, swing: .35,                      // the slow breathing exp(swing*sin) rests around `rest` (< 1 = further out than the picture)
    punchOut: .7, pPunchOut: .75, punchTail: .5,   // scene punch on an energetic section: depth of the quick zoom-out (peak factor 1 - punchOut), share of such scenes that punch out (else in), tail exponent (< 1 = slower return)
    kalOut: .3 },                              // zoom-out while the kaleidoscope is on: factor exp(-kalOut * kal)
  kal: { max: .7, maxHc: 1, dip: .65,          // kaleidoscope cap (auto / Extreme), how far it regularly lets the source breathe back
    base: .42, baseHc: .8, surge: 1,           // amount = ... * (base + surge * surge level)
    foldMin: 3, foldWob: 1.5,                  // fold count floor; fold wobble amplitude
    spinBase: .02, spinKal: .06, spinWob: .03,   // slow auto rotation: base + kal * arc kal + wob
    zoom: .85 },                               // T163: pattern scale of the kaleidoscope (shader uKalZ): the radius is multiplied by it, 1 = the old look, smaller = closer (bigger wedges, less fine detail)
  // T163 shape of the two fractal styles (shader uKaliP / uJuliaP): zoom = input scale (smaller = closer = bigger shapes, less fine detail; old Kali 1.4, Julia .7), iter = iterations (old 4 / 6), scale = Kali fold scale (old 1.25), drift = Julia c drift (1 = old)
  kali: { zoom: .8, iter: 4, scale: 1.25 },
  julia: { zoom: .45, iter: 5, drift: 1 },
  warp: { base: .4, surge: 1.3, wob: .3, mid: .35, punch: .5, hc: 1.3 },   // wr = warp * (1 + wob) * (1 + mid) * (1 + punch * scene punch) * (base + surge * sg) * (1 -> hc in Extreme)
  tile: { win: [.15, .35, .65, .85], gate: [.22, .42], kalCut: .6, nonLead: .4, punch: .7, minor: .35, fbCut: .75, sizes: [8, 12, 16, 25], modes: 3 },   // window in/out of the scene, arc gate, strength cuts, trails thinning
  glitch: { cell: 12, chance: .35, durMin: 1, durVar: 1.5, amp: .3, ampVar: .25, pScene: .7, delay: .1, pLive: .7, pSceneX: 1, pLiveX: 1, cellX: 6 },   // T153 pSceneX / pLiveX / cellX = the same in Live / Local Extreme (cellX = cell length s there, so bursts come twice as often). T152 pScene / delay / pLive = Live + Local only (burst chance after an energetic scene start, its delay s, the cell chance there). Sparse bursts after the intro: a cell of `cell` s has a `chance` of one burst of durMin + durVar * (0..1) s with amplitude amp + ampVar * (0..1)
  // T161 variants, drawn per launch from the seed: vw = weights of [plain, accelerating, negative] for the strobe, cw = [plain, accelerating, coloured] for the checkerboard; acc = [start, end] Hz of an accelerating stretch (the checkerboard cells run at 0.8-1.2 x this); accD = ramp length (s) of a launch that does not know its own length (held key, Extreme peaks)
  strobe: { rate: [5, 11], dur: [6, 14], amount: 1, vw: [.4, .3, .3], cw: [.4, .3, .3], acc: [4, 14], accD: 8 },   // strobe mood: flashes per second, stretch length (s), strength (multiplies P.strobe)
  // T160: random mood stretches. w / wHc = draw weights of [dark, bw, strobe, blaze] (normal / Extreme; were 1,1,1,1 and 1,1,2,2); darkDur = length of a dark stretch (s, was 10-25); surgeTop / hit = blaze peak at the top of a big surge / on a hit (were .8 / .5). The blaze look itself (saturate + small white lift) is in FS_SHOW
  mood: { w: [2, 2, 1, .5], wHc: [2, 2, 2, 1], darkDur: [14, 32], surgeTop: .55, hit: .35 },
  // T157 (Live + Local): build accents. unit = longest unit (s); delay / dur = start delay and length of the accent in its unit (s); kBuild = chance factor of strobe / checkerboard / glitch rush in a unit that starts with a build; cells = checkerboard amount; glitch = amount from..to; zoom / warp / warpAdd = push and rise; fade = ease out (s); tail = Live only, decay time of glitch / zoom / warp when the unit ends (s)
  acc: { unit: 16, delay: [.5, 3], dur: [4, 8], kBuild: 1.6, cells: .9, glitch: [.1, .65], zoom: .25, warp: .8, warpAdd: .08, fade: 1.2, tail: .7 },
  // T147: picture pace follows the music (generated auto). Interval = lerp(calm, lively, smooth(e[0], e[1], energy)); energy = the plan's section energy (planE), else the arc energy(u). minor / scene = [calm, lively] seconds
  // between minor look changes / scene changes (the clock path: ambient, piano; a scene follows the plan's sections when there is one). keep x interval = the shortest gap kept between the music's own fill / phrase events (plan styles). calmAmp = minor punch strength at calm (1 at lively).
  pace: { e: [.3, .7], minor: [28, 11], scene: [70, 40], keep: .9, calmAmp: .6 },
  // T186 scene / surge / camera literals (defaults = the old numbers). scene: TRN pools (s) the engine draws a scene's transition time from (trnRamp = slow start, trnHc = Extreme, trnEnergetic / trnCalm = by section kind), decay = scene punch decay with a fixed
  // transition (CL / showcase), decayMin = its floor (else max(decayMin, TRN / 2)), minorDecay = minor-change envelope decay, period = scene period (s, no plan / pace), minor = minor-change period (s, no Extreme).
  scene: { trnRamp: [5, 10], trnHc: [0, 0, 1], trnEnergetic: [0, 1, 1, 3], trnCalm: [3, 5, 10], decay: 1.4, decayMin: .6, minorDecay: 1.2, period: 45, minor: 15 },
  // surge timeline (timelines()): rise / fall / h (peak) / gap = ranges (s; h 0..1) in normal and (hc) Extreme; firstHc = start of the first Extreme surge; evFall = fall of a surge made from a music riser; horizon = length of the surge / mood / tunnel timelines (s)
  surge: { rise: [15, 30], fall: [6, 14], h: [.5, 1], gap: [4, 25], hc: { rise: [6, 10], fall: [4, 8], h: [.6, 1], gap: [15, 30] }, firstHc: [1, 3], evFall: [6, 15], horizon: 7200 },
  // camera tilt amplitude: Live = (tilt energetic scene, tiltCalm) x (1 + stateK x (state[st] / stateRef - 1)), stateElse for any other state; generated / Local = tiltArc x smooth(.2, .5, arc position); tunDrop / tunBuild = Live tunnel on a drop / a strong build
  cam: { tilt: .26, tiltCalm: .08, tiltArc: .18, stateK: .3, state: { drop: .32, groove: .26, build: .2 }, stateElse: .1, stateRef: .26, tunDrop: .85, tunBuild: .5 },
  tun: { first: [70, 110], firstRamp: [10, 40], dur: [9, 16], gap: [70, 160], easeIn: 2.5, easeOut: 3 },   // generated tunnel stretches (s)
  // T133: generated start = a stepped ramp (rampIn): quiet until min(quiet, quietFrac * TOTAL) s, then `ease` s up to lv[0], then each next level at the start of the next energetic section (e >= .4) at least `gap` s after the previous step (times x min(1, TOTAL / 600)).
  // Without a section plan (ambient, piano) the same steps run on the clock: sec / secLv = points [seconds, level] (smooth between). floor = the plan mode never falls below the no-plan curve with times x floor. strong (Energy 3) = shorter: times x k, levels lv.
  ramp: { quiet: 78, quietFrac: .13, ease: 12, gap: 60, floor: 1.5, lv: [.15, .30, .50, 1],
    sec: [78, 90, 135, 150, 195, 210, 240, 300], secLv: [0, .15, .15, .30, .30, .50, .50, 1],
    strong: { k: .5, lv: [.3, .6, 1], sec: [78, 90, 135, 150, 195, 210], secLv: [0, .3, .3, .6, .6, 1] } },
};
// T114: SRCGAIN = per-source calibration of the effect amounts, "same amount of effect" in generated / Local / Live at the same Energy.
// Multipliers on the final P fields (warp kal fb melt tile kali julia tun), applied once at the end of render() before clampP, via srcGainApply().
// Not applied to zoom (pulses are normalised in T113), moods, stretch, ab, glitch; not in showcase or manual level. T153: Extreme (hcOn, Energy 4) takes the gains below 1 too (Local / Live warp .6, kal .67, fb .5, tun .5 were dropped there, so warp jumped x1.67 from strong to Extreme); generated has no entries, so generated Extreme is unchanged.
// Derivation (tools/measure.py): gain = (generated mean at Energy 2) / (source mean at Energy 2), clamped to [0.5, 4]; means over 3 seeds (generated, ambient, t=600) and over Local test tracks
// (a 600 s synthetic 14-25 scene track, a 600 s cut of a real DJ set, a 97 s real track). gen = 1 by definition (its picture must not change). Live has no measurement: it uses Local's gains.
const SRCGAIN = {
  gen:  {},
  loc:  { warp: .6, kal: .67, fb: .5, melt: .87, tile: 3.7, tun: .5 },   // measured Energy 2, mean of 3 tracks: warp .52 kal .06 fb .41 melt .17 tile .09 tun .17 vs generated .31 / .04 / .21 / .15 / .32 / .06 (tun wants ×.35, held by the floor)
                                                                      // kali / julia: no gain on purpose: styleDefault() turns the styles off for Local / Live (the mean is 0, a multiplier cannot create it)
  live: null,   // null = same as loc
};
const SRCGAIN_MIN = .5, SRCGAIN_MAX = 4;
function srcGainTable(src) { const g = src === 'live' ? (SRCGAIN.live || SRCGAIN.loc) : SRCGAIN[src] || {}; return g; }
function srcGainApply(P, src) {   // P fields *= gain (clamped to [SRCGAIN_MIN, SRCGAIN_MAX]); gen has no entries, so nothing changes
  const g = srcGainTable(src);
  for (const k in g) { const m = Math.min(SRCGAIN_MAX, Math.max(SRCGAIN_MIN, g[k])); if (m !== 1 && typeof P[k] === 'number') P[k] *= m; }
}
function srcGainMul(src, k) { const m = srcGainTable(src)[k]; if (m === undefined) return 1; const c = Math.min(SRCGAIN_MAX, Math.max(SRCGAIN_MIN, m)); return c; }   // T150: the factor srcGainApply() will put on field k
function srcGainText(src) { const g = srcGainTable(src), o = []; for (const k in g) { const m = Math.min(SRCGAIN_MAX, Math.max(SRCGAIN_MIN, g[k])); if (m !== 1) o.push(k + ' \u00d7' + +m.toFixed(2)); } return o.join(' '); }
const ENGINE_DEF = JSON.parse(JSON.stringify(ENGINE));   // T111: the code defaults (the tuning panel exports the diff against these)
const engMerge = (d, s) => { for (const k in s) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && d[k] && typeof d[k] === 'object') engMerge(d[k], s[k]); else d[k] = s[k]; } };
if (Q.get('tune') || Q.get('showcase')) { try { const m = lsGet('engine'); if (m) { engMerge(ENGINE, m); ENGINE.v++; } } catch (e) {} }   // T111: only with ?tune=1 (the normal app keeps the code defaults); ?engine= below wins
{ const m = Q.get('engine'); if (m) { try { engMerge(ENGINE, JSON.parse(m)); ENGINE.v++; } catch (e) { console.warn('?engine: bad JSON', e); } } }
const PFK = Object.keys(PF), PFWARNED = {};
function pfNeutral(p) { for (const q of PFK) if (q !== 't' && q !== 'grid') { const d = PF[q].neutral; p[q] = Array.isArray(d) ? d.slice() : d; } }   // the PF neutral baseline (plain image): showcaseParams and the ?neutral=1 test hook
// T144 test hook (tools/calib.py): ?neutral=1 replaces the engine's P by the neutral baseline, ?pset=<field>:<v>,<field>:<v> then sets fields (applied in render() before clampP). No effect without them.
const PNEUTRAL = Q.get('neutral') === '1', PSET = (() => { const o = {}, s = Q.get('pset'); if (s) for (const kv of s.split(',')) { const [k, v] = kv.split(':'); if (k in PF && v !== undefined && isFinite(+v)) o[k] = +v; } return o; })(), PSETN = Object.keys(PSET).length;
function pfWarn(k, v) { if (PFWARNED[k]) return; PFWARNED[k] = 1; console.warn('P.' + k + ' out of range or NaN:', v, '(allowed ' + PF[k].min + '..' + PF[k].max + ')'); }
function clampP(P) {   // once per frame at the end of render(); no allocation
  const dbg = TQ.debug;
  for (let i = 0; i < PFK.length; i++) {
    const k = PFK[i], d = PF[k], v = P[k];
    if (typeof d.neutral === 'number') {
      if (!(v >= d.min && v <= d.max)) { P[k] = typeof v !== 'number' || v !== v ? d.neutral : v < d.min ? d.min : d.max; if (dbg) pfWarn(k, v); }
    } else if (Array.isArray(v)) {
      for (let j = 0; j < v.length; j++) { const x = v[j]; if (!(x >= d.min && x <= d.max)) { v[j] = typeof x !== 'number' || x !== x ? d.neutral[j] : x < d.min ? d.min : d.max; if (dbg) pfWarn(k, x); } }
    } else { P[k] = d.neutral.slice(); if (dbg) pfWarn(k, v); }
  }
}

// one row per user-facing effect, in key order (pupitre order too). code/key = keyboard; cap = pupitre key label; label = log/toast name; name = pupitre cell name;
// fx = FX name it runs; mode t toggle / h held; rin/rout = ease in/out s; field + ref = gauge (P[field] / ref); lv = pupitre slider key (null = none);
// vis = [visible, light, strong] in P units (T144: light = the owner's eye on the tools/calib.py contact sheets, 2026-10-21; visible = light / 3 and strong = light x 2 are derived, provisional); amt = has Shift/Alt amount; mood = shown in the mood row (no slider); snap = snapUser() key of its slider; max = slider max (default 1.5); desc = one plain sentence.
const EFFECTS = [
  { code: 'KeyQ', key: 'Q', cap: 'Q', label: 'warp', name: 'warp', fx: 'warp', mode: 't', rin: .6, rout: .6, field: 'warp', ref: 2, vis: [.1, .3, 0.6], lv: 'warp', amt: 1, mood: false, snap: 'wp', desc: 'The picture bends and ripples as if seen through moving water.' },
  { code: 'KeyW', key: 'W', cap: 'W', label: 'kaleidoscope', name: 'kaleido', fx: 'kaleidoscope: 6 folds', mode: 't', rin: .7, rout: .7, field: 'kal', ref: 1, vis: [.1, .3, 0.6], lv: 'kal', amt: 1, mood: false, snap: 'kal', max: 1.5, desc: 'The picture is mirrored into a rotating star of identical wedges.' },
  { code: 'KeyE', key: 'E', cap: 'E', label: 'trails', name: 'trails', fx: 'feedback trails', mode: 't', rin: .8, rout: .8, field: 'fb', ref: .9, vis: [.09, .27, 0.54], lv: 'fb', amt: 1, mood: false, snap: 'fb', max: 1.1, desc: 'Moving parts leave glowing, slowly fading trails behind them.' },
  { code: 'KeyR', key: 'R', cap: 'R', label: 'melt', name: 'melt', fx: 'melt', mode: 't', rin: .8, rout: .8, field: 'melt', ref: 1.3, vis: [.167, .5, 1], lv: 'melt', amt: 1, mood: false, snap: 'mt', desc: 'The picture drips and flows downward like warm wax.' },
  { code: 'KeyY', key: 'Y', cap: 'Y', label: 'tiles', name: 'tiles', fx: 'tiles: checker', mode: 't', rin: .5, rout: .5, field: 'tile', ref: 1, vis: [.083, .25, 0.5], lv: 'tile', amt: 1, mood: false, snap: 'tile', max: 2, desc: 'The picture breaks into a grid of tiles that shift, wave or shatter.' },
  { code: 'KeyU', key: 'U', cap: 'U', label: 'Kali', name: 'Kali', fx: 'style: Kali', mode: 't', rin: .7, rout: .7, field: 'kali', ref: 1, vis: [.083, .25, 0.5], lv: 'kali', amt: 1, mood: false, snap: 'ka', desc: 'The picture is folded again and again into a sharp fractal lattice.' },
  { code: 'KeyI', key: 'I', cap: 'I', label: 'Julia', name: 'Julia', fx: 'style: Julia', mode: 't', rin: .7, rout: .7, field: 'julia', ref: 1, vis: [.067, .2, 0.4], lv: 'julia', amt: 1, mood: false, snap: 'ju', desc: 'The picture is pulled into soft swirling spirals like a Julia fractal.' },
  { code: 'KeyO', key: 'O', cap: 'O', label: 'tunnel', name: 'tunnel', fx: 'tunnel', mode: 't', rin: .8, rout: .8, field: 'tun', ref: 1, vis: [.067, .2, 0.4], lv: 'tun', amt: 1, mood: false, snap: 'tn', desc: 'The picture repeats inwards forever, as if you fly down a tunnel.' },
  { code: 'KeyP', key: 'P', cap: 'P', label: 'stretch', name: 'stretch', fx: 'source stretch', mode: 't', rin: .8, rout: .8, field: 'stretch', ref: 1, vis: [.067, .2, 0.4], lv: 'stretch', amt: 1, mood: false, snap: 'st', desc: 'The picture is smeared outward from one point into long streaks.' },
  { code: 'KeyA', key: 'A', cap: 'A', label: 'dark', name: 'dark', fx: 'mood: dark', mode: 't', rin: .6, rout: .6, field: 'dark', ref: 1, lv: null, amt: 0, mood: true, desc: 'The screen fades toward black while the picture glows faintly.' },
  { code: 'KeyS', key: 'S', cap: 'S', label: 'black and white', name: 'b&w', fx: 'mood: black and white', mode: 't', rin: .6, rout: .6, field: 'mono', ref: 1, lv: null, amt: 0, mood: true, desc: 'All colour drains out and the picture turns black and white.' },
  { code: 'KeyD', key: 'D', cap: 'D', label: 'blaze', name: 'blaze', fx: 'mood: blaze', mode: 't', rin: .5, rout: .8, field: 'blaze', ref: 1, lv: null, amt: 0, mood: true, desc: 'The picture flares bright and saturated, with a little white.' },
  { code: 'KeyG', key: 'G', cap: 'G', label: 'strobe (hold)', name: 'strobe', fx: 'mood: strobe', mode: 'h', rin: 0, rout: 0, field: 'strobe', ref: 1, lv: null, amt: 0, mood: true, desc: 'The whole screen flashes white and dark several times a second while held.' },
  { code: 'KeyJ', key: 'J', cap: 'J', label: 'strobe grid (hold)', name: 'grid', fx: 'strobe grid', mode: 'h', rin: 0, rout: 0, field: 'cells', ref: 1, lv: null, amt: 0, mood: true, desc: 'A grid of cells flashes one after another while held.' },
  { code: 'Enter', key: 'Enter', cap: 'Ent', label: 'surge (hold)', name: 'surge', fx: 'surge (swell)', mode: 'h', rin: .5, rout: 1.2, field: 'surge', ref: 1, lv: null, amt: 0, mood: true, desc: 'Warp, kaleidoscope, melt and colour swell together while held.' },
];
// T144: [visible, light, strong] for P fields without an EFFECTS row (tools/calib.py, 2026-10-21). ab: levels from 1-SSIM .02 / .05 / .1 (a colour fringe on edges scores low), provisional; glitch: owner's eye (light .6 or more is fine), kept at the engine amplitude range (ENGINE.glitch .3 .. .55).
const VIS_EXTRA = { ab: [.2, .36, .75], glitch: [.3, .45, .6] };
const VIS = Object.assign({}, VIS_EXTRA); for (const e of EFFECTS) if (e.vis) VIS[e.field] = e.vis;   // field -> [visible, light, strong]: measure.py "active", the codeFeed state line and style lines read it
