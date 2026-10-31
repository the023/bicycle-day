/* ════════════════════════ CONTROL LEVELS (key M, chips on the home screen / in Settings, ?level=auto|assisted|manual, ?ctrl=1 = manual) ════════════════════════
   Any music source (generated, local, stream, mic). auto = engine only (slider-twin keys). assisted = the engine runs as usual and the effect keys (CT_KEYS) add their
   delta on top of its P; a toggled effect fades out by itself after its life (USER.hold: random 4.5-15 s by default; held keys stay while held). manual = the engine's P is replaced by a quiet base (small
   breath, heartbeat, drift) + only what the user toggled (stays on until switched off). Each FX entry runs on a scratch copy of the QUIET base and only its difference
   is added, so effects stack; every effect has an eased envelope (0.5-0.8 s in/out); strobe is a hard, momentary (held) exception and only reaches the display pass.
   Not a pure function of t (live input). */
const CT_KEYS = EFFECTS.map(e => ({ code: e.code, key: e.key, label: e.label, fx: FX.find(f => f.name === e.fx), mode: e.mode, rin: e.rin, rout: e.rout, on: false, r: 0, age: 0, life: 0, mood: /^mood/.test(e.fx) }));   // derived from EFFECTS (08z-effects.js)
const lifeDraw = () => USER.hold > 0 ? (USER.hold >= 31 ? Infinity : USER.hold) : 4.5 + Math.random() * 10.5;   // assisted level: how long a toggled effect (or the palette) stays on, drawn when it is switched on (USER.hold 0 = random 4.5-15 s, 31 = until switched off)
const LVK = Object.fromEntries(EFFECTS.filter(e => e.lv).map(e => [e.code, e.lv]));   // effect key -> its pupitre slider (kal / fb / tile live in USER, the others in USER.lv); derived from EFFECTS
const lvOf = e => { const k = LVK[e.code]; return !k ? 1 : k === 'kal' || k === 'fb' || k === 'tile' ? USER[k] : USER.lv[k]; };
const CT = { pal: 0, palK: 0, palAge: 0, palLife: 0, c: PALS[0].c.slice(), d: PALS[0].d.slice(), ha: 1, held: new Set(), wall: 0 };   // pal 0 = original colours, 1..6 = PALS[0..5]
// 2026-10-17: the manual base was halved (warp, breath, aberration, heartbeat, rotation, zoom/tilt drift): sliders at 0 were still too lively. Hue drift is unchanged.
const QUIET = Object.fromEntries(PFK.filter(k => PF[k].quiet !== undefined).map(k => [k, PF[k].quiet]));   // the manual base: PF[k].quiet (warp .06, breath .6, ab .05, the rest neutral)
function ctrlParams(P, t, dt) {   // level assisted (CL 1): add the effects' deltas to the engine's P; level manual (CL 2): replace P by the quiet base first
  const as = CL === 1, keep = { pulse: P.pulse, rot: P.rot - USER.rot, hue: P.hue, srcZ: P.srcZ, srcRot: P.srcRot };
  const MB = (!as && MAN_BASE) ? { ...MAN_BASE, t: P.t, strobe: 0, cells: 0, dark: 0, blaze: 0 } : QUIET;   // frozen look, but the shader clock keeps running; moods and strobe are never frozen (they came from the engine's frame)
  const qb = { ...P, ...MB, palC: CT.c, palD: CT.d, ha: CT.ha, tilt: [0, 0] };   // the scratch every effect runs on (the same numbers P gets in manual)
  // arrows handled per-frame below (all levels)
  if (!as) {
    Object.assign(P, MB, { palC: CT.c, palD: CT.d, ha: CT.ha }); P.pulse = keep.pulse * .3; P.hue = keep.hue; P.srcZ = keep.srcZ; P.srcRot = keep.srcRot;
    P.rot = keep.rot * .25 + USER.rot; P.zoom = USER.zoom * (1 + .0075 * Math.sin(t * .23)); P.tilt = [.02 * Math.sin(t * .11), .02 * Math.cos(t * .087)];
  }
  const S = as ? 1 : .4 + 1.2 * UE.off4;   // manual: Energy sets how strong the toggled effects are (cran 2 = 1)
  for (const e of CT_KEYS) {
    if (as && e.mode === 't' && e.on && (e.age += dt) > e.life) e.on = false;
    const strobe = e.rin === 0;   // held hard effects (strobe, strobe grid): on / off, no easing
    e.r = strobe ? (e.on ? 1 : 0) : clamp(e.r + (e.on ? dt / Math.max(.05, e.rin, USER.trans / 2) : -dt / Math.max(.05, e.rout, USER.trans / 2)));   // fade in / out: at least half the global transition time
    if (e.r <= 0) continue;
    const q = { ...qb, tilt: [0, 0] }, q0 = { ...qb, tilt: [0, 0] }; e.fx.set(q, strobe ? 1 : smooth(0, 1, e.r) * (e.mood ? 1 : S * lvOf(e)));
    if (as) e.fx.set(q0, 0);   // assisted: the delta is measured from the effect at rest, so a fading effect never leaves a quiet-base offset in the engine's values
    const z = as ? q0 : qb;
    for (const k in q) {
      if (k === 'zoom' || k === 'srcZ') P[k] *= q[k] / z[k];
      else if (k === 'tilt') P.tilt = [P.tilt[0] + q.tilt[0], P.tilt[1] + q.tilt[1]];
      else if (typeof q[k] === 'number') { if (q[k] !== z[k]) P[k] += q[k] - z[k]; }
      else if (q[k] !== z[k] && k !== 'palC' && k !== 'palD') P[k] = q[k];
    }
    if (e.fx.name === 'tiles: checker' && (!as || USER.force >= 0)) P.tileMode = USER.force >= 0 ? USER.force : 0;
  }
  // palette (C): original colours, then the 6 palettes; colours ease, the amount fades (assisted: from the engine's colours, and it lets go by itself)
  const ez = 1 - Math.exp(-dt / Math.max(.5, USER.trans / 3)), pi = CT.pal - 1;
  if (as && CT.pal && (CT.palAge += dt) > CT.palLife) CT.pal = 0;
  CT.palK += ((CT.pal ? .8 * Math.min(1.3, S) : 0) - CT.palK) * ez;
  if (CT.pal) { for (let i = 0; i < 3; i++) { CT.c[i] += (PALS[pi].c[i] - CT.c[i]) * ez; CT.d[i] += (PALS[pi].d[i] - CT.d[i]) * ez; } CT.ha += (PALS[pi].ha - CT.ha) * ez; }
  P.pal = clamp(P.pal + CT.palK);
  if (as) { const w = clamp(CT.palK * 2); if (w > 0) { P.palC = P.palC.map((v, i) => lerp(v, CT.c[i], w)); P.palD = P.palD.map((v, i) => lerp(v, CT.d[i], w)); P.ha = lerp(P.ha, CT.ha, w); } P.fbHue = (.006 + .02 * P.pal) * P.ha; }
  else { P.palC = CT.c; P.palD = CT.d; P.ha = CT.ha; P.fbHue = (.006 + .02 * P.pal) * P.ha; }
  for (const k of ['tile', 'tun', 'stretch', 'kali', 'julia', 'dark', 'blaze', 'mono', 'strobe', 'cells']) P[k] = clamp(P[k]);
  P.fb = clamp(P.fb, 0, .9);
}
function ctrlKey(e) {   // levels assisted / manual: returns true when the key belongs to the effect keys
  if (e.shiftKey && (LVK[e.code] || e.code === 'KeyC' || /^Arrow/.test(e.code))) return false;   // Shift = amount down (W E Y), previous palette, seek: handled further down
  const el = CT_KEYS.find(x => x.code === e.code);
  if (el) {
    e.preventDefault(); if (e.repeat) return true;
    if (el.mode === 't') { el.on = !el.on; el.age = 0; if (el.on) el.life = lifeDraw(); const st = el.label + (el.on ? (CL === 1 ? ' on (' + (isFinite(el.life) ? 'stays ' + el.life.toFixed(1) + ' s' : 'until off') + ')' : ' on') : ' off'); toast(st, 1200); codeKey(e.key.length === 1 ? e.key.toUpperCase() + ': ' + st : st); } else { el.on = true; codeKey(el.label + ' on (held)'); }
    return true;
  }
  if (e.code === 'KeyC') { if (CL === 1 && !CT.pal && CT.palK < .02 && lastP) { CT.c = lastP.palC.slice(); CT.d = lastP.palD.slice(); CT.ha = lastP.ha; } CT.palAge = 0; CT.palLife = lifeDraw(); CT.pal = (CT.pal + 1) % 7; toast(CT.pal ? 'Palette ' + CT.pal + '/6' : 'Original colours', 1200); }
  else if (/^Arrow(Up|Down|Left|Right)$/.test(e.code)) CT.held.add(e.code);
  else return false;
  e.preventDefault(); return true;
}
addEventListener('keyup', e => { CT.held.delete(e.code); const el = CT_KEYS.find(x => x.code === e.code && x.mode === 'h'); if (el && el.on) { el.on = false; codeKey(el.label + ' off'); } });
addEventListener('blur', () => { CT.held.clear(); CT_KEYS.forEach(x => { if (x.mode === 'h') x.on = false; }); });
function resetFx() { CT.held.clear(); CT.pal = 0; CT.palK = 0; CT.palAge = 0; CT_KEYS.forEach(x => { x.on = false; x.r = 0; x.age = 0; }); }   // Esc / stop / level change: no held key or effect survives
const LVL = ['Auto', 'Assisted', 'Manual'];
function setLevel(l, save = true, quiet = false, keep = false) {   // keep: a share link brings its own slider values, so entering assisted must not reset them (T138)
  if (SHOW || PHONE) l = 0;
  if (l === 2 && lastP) { MAN_BASE = cloneP(lastP); captureManual(lastP); }
  else if (l !== 2) { MAN_BASE = null; }
  const was = CL;
  CL = l; CTRL = l === 2; resetFx();
  if (l === 1 && was !== 1 && !keep) { USER.kal = USER.tile = USER.fb = 1; for (const k in USER.lv) USER.lv[k] = 1; for (const k in SLID) $(SLID[k]).value = USER[k]; for (const c of PCELLS) if (c.inp) c.inp.value = lvGet(c.lv); autosave(); }   // T138: entering assisted = every slider at 100 %
  document.querySelectorAll('#lvl button,#plvl button,#mplvl button').forEach(b => b.classList.toggle('on', +b.dataset.cl === l));
  for (let i = 0; i < 3; i++) document.body.classList.toggle('lv' + i, i === l);
  if (l === 0) $('mesc').before($('vol')); else $('ctl').appendChild($('vol'));   // one #vol element: auto pupitre (#mpult) or the transport (#ctl)
  markEN();
  if (!quiet) { const enHint = document.body.classList.contains('touchdev') ? 'right edge ▲ ▼' : 'Z X'; toast('Control: ' + LVL[l] + ['  ·  engine only; you set Energy (' + enHint + ') and the images', '  ·  engine + effect keys (H) that fade out by themselves', '  ·  quiet base + only what you toggle (H = keys)'][l], 3500); }}
