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
  const S = as ? 1 : .4 + 1.2 * UE.off4, pal0 = P.pal;   // manual: Energy sets how strong the toggled effects are (cran 2 = 1)
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
  if (as) { const w = clamp(CT.palK * 2); if (w > 0) { P.palC = P.palC.map((v, i) => lerp(v, CT.c[i], w)); P.palD = P.palD.map((v, i) => lerp(v, CT.d[i], w)); P.ha = lerp(P.ha, CT.ha, w); } P.fbHue = UE.hueK * (.006 + .02 * P.pal) * P.ha; }
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
// live-coding overlay (L: off / overlay / crazy): a terminal that "types" the real values of the frame's final params P. It only reads P.
// overlay = DOM box bottom-left; crazy = the same text drawn on a 2D canvas that FS_SCENE mixes into the SOURCE sampling (uCode), so warp, kaleidoscope, tiles, trails, palette all deform it.
const STILL = Q.get('t') !== null && !Q.has('u') && !Q.has('img');   // ?t= silent still (test); a share link (?u=/?img=) with &t= plays and seeks instead
const CODE = { mode: 0, user: 0, aScene: null, k: 0, q: [], L: [], last: {}, lastAt: {}, ev: {}, nextAt: 0, fillAt: 0, el: null, cv: null, tex: null, drawAt: 0, sig: '', st: 0, logT: 0, stT: -99, stTxt: '' };   // st = song time (s) of the current frame; logT = song time of the last log line queued; stT / stTxt = song time and text of the last state line (T146)   // user = the saved choice (assisted/manual); aScene = scene of the last auto decision (T39)
const CODE_FILL = ['uv = rot2(uv, a) * zoom;', 'col = mix(col, prev, uFb);', 'p = abs(p) / dot(p, p) - k;', 'float h = fract(sin(dot(p, K)) * 43758.5);', 'for (int i = 0; i < N; i++) uv += sin(uv.yx * f + t);', 'fbo.swap(); gl.drawArrays(TRIANGLES, 0, 3);', 'c = pow(c, vec3(.9)) * bright;', 'hue += spd * dt;', 'z = z * z + c;   // julia', 'beat = exp(-d * 7.) + .6 * exp(-d2 * 7.);', 'uv = abs(fract(uv * n) - .5);', 'if (len > R) discard;', 'aber = .002 + ab * .004;', 'next = lerp(a, b, smooth(t));', 'seed = hash(scene * 12.9898);', 'await pump(); // schedule audio', 'const dt = now - last;', 'tex = sampler2D(prev, uv + d);'];
const LOG_HC = new Set(['scene', 'mood', 'surge', 'cells']);   // log mode in Extreme: only these kinds
const codeTs = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };   // song seconds -> m:ss
let KEYN = 0;
function codeKey(txt) { codeAdd(null, 'a', txt, 'key' + (++KEYN)); }   // a key press: logged at the press itself (log mode, every level)
function codeAdd(txt, cls = '', log = null, kind = '') {   // txt = overlay / crazy text; log = plain sentence (log mode); kind = merge key
  if (CODE.mode === 1) {   // log: sentences only, max 3 queued (oldest dropped), one queued line per kind (the newest replaces it); each line starts with its song time
    if (!log || (hcOn() && !LOG_HC.has(kind) && !kind.startsWith('key'))) return;
    const i = CODE.q.findIndex(x => x[2] === kind); if (i >= 0) CODE.q.splice(i, 1);
    CODE.q.push([codeTs(CODE.st) + ' ' + log, '', kind]); CODE.logT = CODE.st; while (CODE.q.length > 12) CODE.q.shift(); return;
  }
  if (!txt) return;
  CODE.q.push([txt, cls]);
  while (CODE.q.length > 8) { const i = CODE.q.findIndex(x => x[1] === 'd'); CODE.q.splice(i < 0 ? 0 : i, 1); }   // a burst never queues more than ~8 lines, fillers go first
}
const codeShown = (l, now) => l.txt.slice(0, Math.floor(l.txt.length * clamp((now - l.t0) / 1000 / clamp(l.txt.length * .03, .4, .9))));   // typed-character animation: a line types in ~0.4-0.9 s
function codeFlush(now) {   // one line starts every ~0.85 s (about 1.2 lines/s), every 0.42 s while a burst is queued (scene change, mood); 24 lines kept
  if (now < CODE.nextAt || !CODE.q.length) return; CODE.nextAt = now + (CODE.mode === 1 ? (hcOn() ? 1200 : 300) : (CODE.q.length > 3 ? 420 : 850));
  const [txt, cls] = CODE.q.shift(), l = { txt, cls, t0: now, el: null }; CODE.L.push(l);
  if (CODE.mode === 1 || CODE.mode === 2) { const el = CODE.el || (CODE.el = $('code')), d = document.createElement('div'); d.className = CODE.mode === 1 ? '' : cls; if (CODE.mode === 1) d.textContent = txt; l.el = d; el.appendChild(d); }
  if (CODE.mode === 1) for (const o of CODE.L.filter(x => x.el).slice(0, -6)) { o.el.remove(); o.el = null; }   // log: 6 lines on screen
  while (CODE.L.length > 24) { const o = CODE.L.shift(); if (o.el) o.el.remove(); }
}
function codeUpdate(now, dt) {   // type the newest lines (DOM), or redraw the text canvas and upload it (crazy, at most ~15 fps and only when something changed)
  const n = CODE.L.length;
  if (CODE.mode === 2) { const el = CODE.el || (CODE.el = $('code')); for (let i = Math.max(0, n - 2); i < n; i++) { const l = CODE.L[i]; if (l.el) l.el.textContent = codeShown(l, now); } for (const c of el.querySelectorAll('.cur')) c.classList.remove('cur'); if (n && CODE.L[n - 1].el) CODE.L[n - 1].el.classList.add('cur'); }
  CODE.k += ((CODE.mode === 3 ? 1 : 0) - CODE.k) * (1 - Math.exp(-dt / .5));
  if (CODE.mode !== 3 || now < CODE.drawAt) return;
  const sig = n + ':' + (n ? codeShown(CODE.L[n - 1], now).length : 0) + ':' + (Math.floor(now / 500) & 1); if (sig === CODE.sig) return; CODE.sig = sig; CODE.drawAt = now + 66;
  const c = CODE.cv || (CODE.cv = Object.assign(document.createElement('canvas'), { width: 1024, height: 576 })), x = c.getContext('2d'), maxW = c.width * .55 - 24, rows = 19, lh = 29;
  x.clearRect(0, 0, c.width, c.height); x.font = '700 22px ui-monospace,Menlo,Consolas,monospace'; x.textBaseline = 'alphabetic';
  for (let i = 0; i < Math.min(n, rows); i++) {
    const l = CODE.L[n - 1 - i], txt = (i ? l.txt : codeShown(l, now) + (sig.endsWith('1') ? '\u2588' : '')), w = x.measureText(txt).width;
    x.save(); x.translate(24, c.height - 34 - i * lh); if (w > maxW) x.scale(maxW / w, 1);   // longer lines are squeezed to the left 55 %
    x.globalAlpha = (l.cls === 'd' ? .6 : 1) * (1 - .75 * i / rows); x.lineWidth = 6; x.lineJoin = 'round'; x.strokeStyle = '#000c'; x.strokeText(txt, 0, 0); x.fillStyle = l.cls === 'a' ? '#ffd070' : '#c8ffd8'; x.fillText(txt, 0, 0); x.restore();   // dark outline: readable on any picture
  }
  gl.bindTexture(gl.TEXTURE_2D, CODE.tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
}
let strPrev = 0, strLn = null, cellLn = null;   // T161: rising-edge launches that no source describes (held G / J, Extreme peaks): drawn at the edge from the song second, like cellGrid
function strobeVars(P, t) {   // T161: writes the strobe / checkerboard variant fields of P (rate1 sT0 sD sNeg cT0 cD cCol) from SVAR (the source's stretch) or the rising edge; showcase sets them in its FX entries
  if (SHOW) return;
  const E = ENGINE.strobe; P.sNeg = 0; P.rate1 = 0; P.sT0 = 0; P.sD = 0; P.cT0 = 0; P.cD = 0; P.cCol = 0;
  if (P.strobe > .001 && strPrev <= .001 && !SVAR.s) strLn = { v: svDraw('s', Math.floor(t) + .5), t0: t, D: E.accD };
  if (P.cells > .001 && cellPrev <= .001 && !SVAR.c) cellLn = { v: svDraw('c', Math.floor(t) + .5), t0: t, D: E.accD };
  if (P.strobe > .001) { const a = SVAR.s || strLn || { v: 0 }; if (a.v === 1) { P.rate = E.acc[0]; P.rate1 = E.acc[1]; P.sT0 = a.t0; P.sD = a.D; } else if (a.v === 2) P.sNeg = 1; }
  if (P.cells > .001) { const a = SVAR.c || cellLn || { v: 0 }; if (a.v === 1) { P.cT0 = a.t0; P.cD = a.D; } else if (a.v === 2) P.cCol = 1; }
}
function codeFeed(P, ex, dt) {   // called once per frame from render(); ex = { scene, palI, lead }; dt = the frame step (still renders step in simulated time)
  CODE.st = ex.t; if (!CODE.mode) { CODE.k *= .9; return; } const now = STILL ? ex.t * 1000 : performance.now(), f2 = v => (+v).toFixed(2), L = CODE.last, A = CODE.lastAt;
  const num = (k, name, th, txt) => { const v = P[k]; if (L[k] === undefined) { L[k] = v; return; } if (Math.abs(v - L[k]) > th && now - (A[k] || 0) > 700) { codeAdd(txt ? txt(v) : name + ' = ' + f2(v), 'a'); L[k] = v; A[k] = now; } };
  num('warp', 'warp', .25); num('kal', 'kal', .15, v => 'kal = ' + f2(v) + '; fold = ' + Math.round(P.fold)); num('fb', 'trails', .12); num('melt', 'melt', .2); num('ab', 'aberration', .35); num('zoom', 'zoom', .12, v => 'zoom *= ' + f2(v / (L.zoom || 1)));
  num('tile', 'tile', .25, v => v > .05 ? 'tile(mode=' + ['checker', 'wave', 'shatter'][P.tileMode] + ', n=' + P.tileN + ')' : 'tile(off)'); num('kali', 'kali', .15); num('julia', 'julia', .15); num('tun', 'tunnel', .3); num('stretch', 'stretch', .12);
  // the last two args of ev / codeAdd are the log-mode sentence and its merge key (overlay / crazy ignore them)
  const ev = (k, v, txt, cls = 'a', log = null, kind = '') => { if (CODE.ev[k] === undefined) { CODE.ev[k] = v; return; } if (CODE.ev[k] !== v) { CODE.ev[k] = v; codeAdd(txt, cls, log, kind); } };
  const up = (k, v, name, th = .15) => { const on = v > th, was = CODE.ev['up' + k]; CODE.ev['up' + k] = on; if (on && was === false) codeAdd(null, 'a', 'style: ' + name, 'style'); };   // style switched on (log only)
  ev('scene', ex.scene, 'scene ' + ex.scene + ' → pal ' + ex.palI + ', lead: ' + (ex.lead ? 'tiles' : 'warp'), 'a', 'scene ' + ex.scene + ' starts · palette ' + ex.palI + ' · ' + (ex.lead ? 'tiles' : 'warp') + ' lead', 'scene');
  { const zv = ex.zp ? ex.zp.a : 0; if (CODE.ev.zp === undefined) CODE.ev.zp = zv; else if (CODE.ev.zp !== zv) { CODE.ev.zp = zv; if (ex.zp && Math.abs(ex.zpF - 1) >= .03) { const F = ex.zpF, z = ex.zp, w = F < 1 ? 'out' : 'in', d = Math.round(z.b - z.a); codeAdd('zoom ' + w + ' *= ' + f2(F) + '  // ' + d + ' s', 'a', 'zoom ' + w + ' to x' + f2(F) + ' for ' + d + ' s', 'zoomp'); } } }   // T141: the factor really applied (after the slow-start ramp and UE.big); a pulse under 3 % is not logged   // T110: a zoom pulse starts (logged once)
  if (ex.ls) ev('lset', ex.ls.join(', ') || 'none', null, 'a', 'light effects now: ' + (ex.ls.join(', ') || 'none'), 'lset');   // T143: the light set changed
  ev('etr', ETR.n, 'energy -> ' + EN.names[USER.energy] + ' · ' + ETR.k, 'a', 'energy -> ' + EN.names[USER.energy] + ' · ' + ETR.k, 'etr');   // T155: an Energy change drew a transition
  ev('kind', ex.kind, null, 'a', ex.kind ? 'energetic section: faster changes' : 'calm section: slower changes', 'kind');
  ev('trn', TRN, null, 'a', 'transition ' + (TRN ? TRN + ' s' : 'instant'), 'trn');
  up('kali', P.kali, 'Kali', VIS.kali[0]); up('julia', P.julia, 'Julia', VIS.julia[0]);   // T144: the 'visible' level of each style (VIS)
  const mv = P.strobe > Math.max(.05, .5 * UE.strb) ? 'strobe' : P.blaze > Math.max(.05, .5 * UE.big) ? 'blaze' : P.dark > .5 ? 'dark' : P.mono > .5 ? 'bw' : '';
  const sv = mv === 'strobe' ? (P.sNeg > .5 ? 'negative' : P.rate1 > 0 ? 'accelerating' : '') : '';   // T161: the strobe variant
  ev('mood', mv + sv, 'mood = ' + (mv || 'none') + (sv ? '  // ' + sv : ''), 'a', sv ? 'strobe: ' + sv + ' on' : 'mood: ' + (mv ? mv + ' on' : 'off'), 'mood');
  { const gOn = P.glitch > VIS.glitch[0] ? 1 : 0; if (CODE.ev.gl === undefined) CODE.ev.gl = gOn; else if (CODE.ev.gl !== gOn) { CODE.ev.gl = gOn; if (gOn) codeAdd('glitch(' + f2(P.glitch) + ')  // burst', 'a', 'glitch burst', 'glitch'); } }   // T152: a burst starts (any source; the 'visible' level of VIS)
  { const an = ACC.name; if (CODE.ev.acc === undefined) CODE.ev.acc = an; else if (CODE.ev.acc !== an) { CODE.ev.acc = an; if (an) codeAdd('build accent: ' + an, 'a', 'build accent: ' + an, 'acc'); } }   // T157: a build accent starts (Live / Local)
  { const cv = P.cCol > .5 ? 'colour' : P.cD > 0 ? 'accelerating' : '', on = P.cells > .5; ev('cells', on ? 'on' + cv : 'off', 'cells = ' + (on ? 'on  // strobe grid' + (cv ? ', ' + cv : '') : 'off'), 'a', on && cv ? 'checkerboard: ' + cv : 'strobe grid ' + (on ? 'on' : 'off'), 'cells'); }   // T161: the checkerboard variant
  ev('tunl', P.tun > .3 ? 1 : 0, null, 'a', 'tunnel ' + (P.tun > .3 ? 'on' : 'off'), 'tun');
  ev('tileMode', P.tileMode, null, 'a', 'tile mode: ' + ['checker', 'wave', 'shatter'][P.tileMode], 'tilemode');
  ev('grid', USER.grid, null, 'a', 'grid: ' + GRID_NAMES[USER.grid] + (USER.grid && !gridNb() ? ' (no effect for this source)' : ''), 'grid');
  ev('energy', USER.energy, null, 'a', 'Energy: ' + EN.names[USER.energy], 'energy');
  ev('ustrans', CL ? USER.trans : TRN, null, 'a', 'transition time ' + (CL ? USER.trans : TRN) + ' s', 'trans');
  ev('uimg', imTo, null, 'a', 'image ' + (imTo + 1) + '/' + IM.length, 'image');
  ev('pal', CT.pal ? CT.pal : ex.palI, null, 'a', 'palette ' + (CT.pal ? CT.pal + '/6' : 'auto ' + ex.palI), 'palette');
  ev('ukal', USER.kal, null, 'a', 'kal slider ' + f2(USER.kal), 'kal');
  ev('utile', USER.force, null, 'a', 'tile mode: ' + (USER.force < 0 ? 'auto' : ['checker', 'wave', 'shatter'][USER.force]), 'tile');
  ev('ufb', USER.fb, null, 'a', 'trails slider ' + f2(USER.fb), 'fb');
  for (const kk of Object.keys(USER.lv)) ev('lv' + kk, USER.lv[kk], null, 'a', kk + ' slider ' + f2(USER.lv[kk]), 'slider');
  const sb = Math.round((P.warp + P.kal + P.melt) * 2); if (L.sb !== undefined && sb > L.sb + 2 && now - (A.sb || 0) > 1500) { codeAdd('surge += ' + f2((sb - L.sb) / 8), 'a', 'surge rising', 'surge'); A.sb = now; } L.sb = sb;
  if (CODE.mode === 1 && !hcOn() && !CODE.q.length && ex.t - CODE.logT >= 5 && (ex.t - CODE.stT >= 20 || ex.t < CODE.stT)) {   // state line: after 5 s of song time without another log line, only when its text changed, at most every 20 s (T146; not in Extreme)
    const effs = PEFF.filter(p => VIS[p[3]]).map(p => { const v = Math.abs(P[p[3]] || 0), z = VIS[p[3]]; return [p[2], v / z[2], v, z]; }).filter(e => e[2] > e[3][0]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0] + ' ' + (e[2] >= e[3][2] ? 'strong' : e[2] > e[3][1] ? 'medium' : 'light')), eff = effs.join(', ') || 'none';   // T144: visible / light / strong levels per effect (VIS, tools/calib.py); light = visible..light, medium = up to strong
    const md = P.strobe > Math.max(.05, .5 * UE.strb) ? 'strobe' : P.blaze > Math.max(.05, .5 * UE.big) ? 'blaze' : P.dark > .5 ? 'dark' : P.mono > .5 ? 'bw' : 'none';
    const stx = 'now: ' + eff + ' · mood ' + md + ' · energy ' + EN.names[USER.energy] + ' · ' + (ex.kind ? 'energetic' : 'calm') + ' section', sk = effs.slice().sort().join('|') + md + EN.names[USER.energy] + ex.kind;   // sk: the same state in another order is not a change
    if (sk !== CODE.stTxt || ex.t < CODE.stT) { CODE.stTxt = sk; CODE.stT = ex.t; codeAdd(null, '', stx, 'state'); }
  }
  if (CODE.mode !== 1 && now > CODE.fillAt && CODE.q.length < 2) { CODE.fillAt = now + 350 + Math.random() * 500; codeAdd(CODE_FILL[Math.floor(Math.random() * CODE_FILL.length)], 'd'); }
  codeFlush(now); codeUpdate(now, dt);
}
const codeLook = () => { const m = CODE.mode; document.body.classList.toggle('code', m === 1 || m === 2); document.body.classList.toggle('codec', m === 3); $('code').classList.toggle('codelog', m === 1); };   // body classes + box style per mode
function codeSet(m, quiet, auto) { const was = CODE.mode; CODE.mode = m; if (!auto) { CODE.user = m; lsSet('code', m); } codeLook(); const el = CODE.el || (CODE.el = $('code')); el.replaceChildren();
  if (was === 1 || m === 1) { CODE.L.length = 0; CODE.q.length = 0; }   // log and the matrix modes never share lines
  CODE.L.forEach(l => { l.el = null; if (m === 1 || m === 2) { l.el = document.createElement('div'); l.el.className = m === 1 ? '' : l.cls; l.el.textContent = l.txt; el.appendChild(l.el); } });
  if (!quiet) toast('Live coding: ' + ['off', 'log', 'overlay', 'crazy (part of the picture)'][m], 1400); }
const codeToggle = () => codeSet((CODE.mode + 1) % 4);
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
let EXT = { PH: NaN, list: [] };
function seedHash(n, k) { const x = Math.sin((n + PH) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
function extPhases(need) {   // builds phases until the last one ends after `need` (cached per seed)
  if (EXT.PH !== PH) EXT = { PH, list: [] };
  const L = EXT.list;
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
  const gn = ev ? gridNb() : 0, sn = gn ? x => gridLine(x, gn) : ev && !vplan().length ? evSnap : x => x, pc = paceOn(hd) ? paceClock('scene') : null, SP = 45;   // pc: T147, scene period follows the music's energy (70 s calm .. 40 s lively); else fixed 45 s
  const at = pc ? k => pc.inv(k - PH * .37) : k => (k - PH * .37) * SP, e = k => sn(gn ? at(k) : beatNear(at(k))), k = edgeIdx(t, Math.floor(pc ? pc.W(t) + PH * .37 : t / SP + PH * .37), e), s0 = e(k), len = pc ? Math.max(1, e(k + 1) - s0) : SP;
  return { wi: k, wf: clamp((t - s0) / len), since: Math.max(0, t - s0), len };
}
// T147: the music's fill / phrase events thinned to the pace: a kept event is at least keep x interval(energy at the event) after the last kept one (cached per event list, seed, length, ENGINE.v)
let MEVC = null;
function minorEvents() {
  if (MEVC && MEVC.src === EVT && MEVC.v === ENGINE.v && MEVC.tot === TOTAL) return MEVC.l;
  const all = EVT.filter(x => x.k === 'fill' || x.k === 'phrase'), l = []; let last = -1e9;
  for (const x of all) if (x.t - last >= ENGINE.pace.keep * paceIv('minor', x.t)) { l.push(x); last = x.t; }
  MEVC = { src: EVT, v: ENGINE.v, tot: TOTAL, l }; return l;
}
function minorAt(t, hd, ev = false) {   // mf = seconds since the minor edge / MP (the envelope in render() uses mf * MP); iv = the nominal interval (s) now, e = the energy it follows (generated auto)
  if (hd) { const p = extAt(t), e = k => beatNear(p.start + k * p.MP), k = Math.max(0, edgeIdx(t, Math.floor((t - p.start) / p.MP), e)), s0 = e(k); return { mi: p.firstMinor + k, mf: Math.max(0, t - s0) / p.MP, MP: p.MP, ms: 1, iv: p.MP, e: null }; }
  const gn = ev ? gridNb() : 0, po = paceOn(false), pe = po ? paceE(t) : null, ps = po ? paceS(pe) : 1, amp = lerp(ENGINE.pace.calmAmp, 1, ps), iv = po ? paceIv('minor', t) : 15;   // T51: phrase grid = minor changes on bar starts; bar grid keeps beats (the path below); both skip the music's fill / phrase events
  if (ev && !gn && evtIdx(1e9, ['fill', 'phrase']).i >= 4) {   // T103: edges on the music's fills / phrases (T147: thinned in calm stretches)
    const L = minorEvents(); let lo = 0, hi = L.length; while (lo < hi) { const m = (lo + hi) >> 1; if (L[m].t <= t) lo = m + 1; else hi = m; }   // lo = events at or before t
    const e = lo ? L[lo - 1] : null; return { mi: lo, mf: e ? (t - e.t) / 15 : 99, MP: 15, ms: !e ? 0 : (e.k === 'fill' ? 1 : .4 + .6 * e.s) * amp, iv, e: pe };
  }
  const pc = po ? paceClock('minor') : null, MP = 15, at = pc ? k => pc.inv(k - PH * .2) : k => (k - PH * .2) * MP, e = k => gn === 32 ? gridLine(at(k), 4) : beatNear(at(k)), k = edgeIdx(t, Math.floor(pc ? pc.W(t) + PH * .2 : t / MP + PH * .2), e), s0 = e(k);
  return { mi: k, mf: Math.max(0, t - s0) / MP, MP, ms: amp, iv, e: pe };
}
// ?debug=1 (T104, read only): window.__pic(t) = what the generated picture does at song time t (scene id, scene punch, minor envelope, surge, plan energy); mirrors render()'s formulas, changes nothing
if (Q.has('debug')) window.__pic = t => {
  const EV = evOK(), VP = vplan(), sc = sceneAt(t, false, EV), RI = rampIn(t, UT.rs());
  let wi = sc.wi, since = sc.since, secE = 1, i = -1; if (VP.length) { i = VP.findIndex(x => t < x.b); if (i < 0) i = VP.length - 1; wi = i; since = t - VP[i].a; const pe = VP[i - 1] ? VP[i - 1].e : VP[i].e; secE = lerp(pe, VP[i].e, smooth(0, 4, since)); }
  const kind = VP.length ? (VP[wi] && VP[wi].e < .4 ? 0 : 1) : 1, pk = a => a[Math.floor(seedHash(wi, 9) * a.length)], TR = Math.max(RI < 1 ? pk([5, 10]) : kind ? pk([0, 1, 1, 3]) : pk([3, 5, 10]), paceOn(false) ? EN.trn[USER.energy] : 0), trD = Math.max(.6, TR / 2), cz = RI;
  const mn = minorAt(t, false, EV), tm = RI * (mn.mf < .08 ? 0 : Math.exp(-mn.mf * mn.MP / 1.2) * mn.ms), tr = RI * (wi > 0 ? Math.exp(-since / trD) : 0);
  const h = EV ? evtIdx(t, ['hit']).e : null, th = h ? h.s * Math.exp(-(t - h.t) / trD) * RI : 0, trP = Math.max(tr, th), flash = h ? .5 * h.s * Math.exp(-(t - h.t) / .3) * cz : 0;
  const raw = surgeAt(t, false, EV), lwi = LOC ? upper(LOC.sceneT, t) : LIVE ? LIVE.scenes : wi;   // T150: lwi = the light-set window: the Local timeline's scene at t (a pure function), the live scene now (Live: only the current frame), else the generated window
  const gn = EV ? gridNb() : 0, gl = x => gn ? gridLine(x, gn) : beatNear(x);   // T51: the active grid and the grid line nearest to t (beat grid when 'beat')
  return { t, grid: GRID_NAMES[USER.grid], gridActive: gn ? GRID_NAMES[USER.grid] : 'beat', gridLine: gl(t), gridDist: Math.abs(t - gl(t)), sceneStart: t - since, sceneLen: VP.length ? VP[i].b - VP[i].a : sc.len, minorIv: mn.iv, minorE: mn.e, wi, tr, tm, mi: mn.mi, ms: mn.ms, surge: raw, sg: raw * cz * (VP.length ? .6 + .8 * secE * UE.big : 1), th, trP, blaze: Math.max(moodAt(t, false, EV).blaze, flash) * UE.big, strobe: moodAt(t, false, EV).strobe * UE.strb, svar: (m => m && m.k === 'strobe' ? { name: SV_NAMES[m.v], phase: m.v === 1 ? (r => r - Math.floor(r))(rampPhase(t - m.a, ENGINE.strobe.acc[0], ENGINE.strobe.acc[1], m.b - m.a)) : (r => r - Math.floor(r))(t * m.rate), t0: m.a, D: m.b - m.a } : null)(moodRun(t, false)), planE: planE(t), zoomPulse: (zp => zp ? { f: zp.f, a: zp.a, b: zp.b } : null)(!(SHOW || CTRL || hcOn()) ? zoomPulseActive(t) : null), calm: RI, cz, g15: RI, ramp: RI, ls: lsNames(lightSet(lwi)), lsKey: lsKey(lwi), lsWin: lwi, TRN: TR, engineV: ENGINE.v, acc: accInfo(t), srcGain: { src: SRC_NOW, g: srcGainText(SRC_NOW, hcOn()) } };
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
const LS_FX = ['kali', 'julia', 'kal', 'tile'], LS_NAME = ['Kali', 'Julia', 'kaleidoscope', 'tiles'], LSO = { ph: NaN, ord: [0, 1, 2, 3] };
const lsKey = wi => Math.max(0, wi - (EN.lsFirst - 1));
function lightSet(wi, E = USER.energy) {   // -> [kali, julia, kal, tile] booleans
  const k = lsKey(wi), tb = (LIVE ? EN.lsNL : EN.lsN)[E], u = seedHash(k, 41), on = [false, false, false, false];
  if (LSO.ph !== PH) { LSO.ph = PH; LSO.ord = [0, 1, 2, 3].sort((a, b) => seedHash(a, 42) - seedHash(b, 42)); }
  let n = 0, c = tb[0]; while (n < tb.length - 1 && u >= c) c += tb[++n];
  for (let j = 0; j < n; j++) on[LSO.ord[(k + j) % 4]] = true;
  if (LIVE && on[3] && seedHash(k, 60) >= EN.lsTL[E]) on[3] = false;   // T150 Live / Local: tiles are kept in only EN.lsTL of the scenes that draw them (calm .4, soft .7)
  return on;
}
const lsAmt = (i, wi, E, cal, gate) => { const v = VIS[LS_FX[i]], [lo, hi] = EN.lsLv[E]; return gate * lerp(v[0], v[1] * (lo + (hi - lo) * seedHash(lsKey(wi), 50 + i)), cal); };   // a member's strength in P units
const lsNames = on => LS_NAME.filter((_, i) => on[i]);
const softCap = (x, c, kn) => { const a = kn * c; if (x <= a) return x; const y = (x - a) / ((1 - kn) * c); return a + (1 - kn) * c * y / (1 + y); };   // knee at kn*c, then approaches c without ever reaching it (the motion stays alive)
let SRC_NOW = 'gen', SG_LOGGED = '';   // T114: the source of the current frame; last logged source-gain key
let PLOG = null;   // T108: window.__plog while a debug still runs, else null (zero cost)
function render(t, dt, bass, mid = 0, hi = 0) {
  const { u, u0 } = uAt(t, UE.off), [warp, kal0, n0, fb0, hueSpd, pal, side, breath, melt, zoomAmp, aber, bright] = score(u);
  const morphOn = (IM.length >= 2) && !SHOW && !LIVE && !LOC;
  const gi = morphOn ? ghostIndices(t) : { a: imTo, b: imTo, mix: 0 };
  easeUser(dt); const HC = hcOn(), hk = ramp(HCr, HC ? 1 : 0, dt, transT()), Hd = hk > .5, hl = (a, b) => lerp(a, b, hk), isGen = !(LIVE || LOC || SHOW || CTRL || HC);   // hk = hardcore blend 0..1 (a toggle ramps over the transition time); Hd = its discrete half (scene period, timelines, palette flips)
  // deformation gate (tiles, tilt, scene punches, tunnel, kaleidoscope, warp, pulse...): generated = calm start over the first ~15 % of the piece;
  // local file = 5 s ramp-up (fixed, not track-proportional); live = calmer for 10 s (x0.3 → 1), then the full music-driven look; controlled / showcase / extreme = always 1
  const g15 = CTRL || SHOW || Hd ? 1 : LOC ? smooth(0, 5, t) : LIVE ? lerp(.3, 1, smooth(0, 10, t)) : HC ? smooth(.13, .18, t / TOTAL) : rampIn(t);   // generated (T133): the stepped ramp on the music's sections replaces the 13-18 % gate
  const cal = isGen ? rampIn(t) : calm(t), calG = isGen && !Hd ? 1 : cal;   // cal = the slow-start factor (generated: the same ramp as g15); calG = the factor next to g15 in products (g15 already is the ramp: once, not squared)
  // scene look: which effect leads and which palette, changing on every drop (live) or every ~45 s (generated); per-state emphasis eases in
  const EV = isGen && !Hd && evOK(), sc = sceneAt(t, Hd, EV), VP = Hd ? [] : vplan();
  let wi = sc.wi, wf = sc.wf, since = sc.since, secE = 1;   // scene = the music's own section when the generator publishes a plan (electro / chiptune / chiptune2 / drone / gamelan), else a fixed ~45 s period
  if (VP.length) { let i = VP.findIndex(x => t < x.b); if (i < 0) i = VP.length - 1; const c = VP[i], pe = VP[i - 1] ? VP[i - 1].e : c.e; wi = i; since = t - c.a; wf = clamp(since / Math.max(1, c.b - c.a)); secE = lerp(pe, c.e, smooth(0, 4, since)); }
  const scene = LIVE ? LIVE.scenes : wi;
  const kindOf = n => LIVE ? (LIVE.kinds[n] ?? 1) : VP.length ? (VP[n] && VP[n].e < .4 ? 0 : 1) : 1;   // 1 = energetic section, 0 = calm one
  // auto: the ENGINE picks the transition time per scene (a pure function of seed + scene): short in energetic sections, long in calm ones; assisted / manual use USER.trans
  { const pk = a => a[Math.floor(seedHash(scene, 9) * a.length)]; TRN = CL || SHOW ? USER.trans : cal < 1 ? pk([5, 10]) : Hd ? pk([0, 0, 1]) : kindOf(scene) ? pk([0, 1, 1, 3]) : pk([3, 5, 10]); if (isGen) TRN = Math.max(TRN, EN.trn[USER.energy]); if (Hd && extKind(t) === 'pingpong') TRN = 0; }   // T41: ping-pong = hard cuts; T147: generated auto never cuts at calm / soft (EN.trn floor)
  const trD = CL || SHOW ? 1.4 : Math.max(.6, TRN / 2);   // decay of the scene-change punch
  if (LIVE && scene !== lastScene) { lastScene = scene; trT0 = t; }
  const mn = minorAt(t, Hd, EV), mi = LIVE ? LIVE.minors : mn.mi, mf = mn.mf, MP = mn.MP;
  if (LIVE && mi !== lastMinor) { lastMinor = mi; tmT0 = t; }
  const tm = g15 * (LIVE ? Math.exp(-(t - tmT0) / 1.2) : mf < .08 ? 0 : Math.exp(-mf * MP / 1.2) * calG * mn.ms);   // minor-change envelope: hue shift, small zoom nudge, tile re-roll
  if (!SHOW) autoImg(dt, scene);
  const tk = scene * 50 + mi;
  const tr = g15 * (LIVE ? Math.exp(-(t - trT0) / trD) : wi > 0 ? Math.exp(-since / trD) * calG * (Hd && extKind(t) === 'pingpong' ? .4 : 1) : 0);   // 1 at the start of a scene, fades in ~3 s: zoom punch, warp, tile burst
  const hH = EV ? evtIdx(t, ['hit']).e : null, th = hH ? hH.s * Math.exp(-(t - hH.t) / trD) * g15 * calG : 0, trP = Math.max(tr, th);   // T103: a `hit` event punches like a scene start (no scene change); closed form in t - hit.t
  // T155: Energy change (keys Z / X, chips; auto and assisted): ONE short transition drawn from the seed + a change counter among the existing punches. It follows a key press, so it is not a pure function of t: it is not in integrateTo / integrateLocal (a seek past it finds it decayed). Down = softer (no tile burst) and slower
  if (ETR.pend) { const dn = ETR.pend < 0, pool = dn ? ETR_DN : ETR_UP; ETR.pend = 0; ETR.n++; ETR.k = pool[Math.floor(seedHash(ETR.n, 41) * pool.length)]; ETR.t0 = t; ETR.D = trD * (dn ? 1.6 : 1); ETR.s = dn ? .6 : 1; ETR.sg = seedHash(ETR.n, 42) < .5 ? -1 : 1; if (ETR.k === 'hue jump') { ETR.hv = ETR.sg * (.9 + .9 * seedHash(ETR.n, 43)); ETR.tk = tk; } }   // hue jump: .9-1.8 rad on top of the minor's own hue offset (a plain re-roll can land near the old value), until the next minor change
  if (t < ETR.t0) ETR.k = '';   // a seek back past the key press drops the transition (else it would replay when the song gets there again)
  const eD = t - ETR.t0, eEnv = ETR.k && eD >= 0 ? Math.exp(-eD / ETR.D) * g15 * ETR.s : 0;   // 1 at the key press, decays like the scene punch (trD)
  const eZ = ETR.k === 'zoom punch in' ? .4 * eEnv * UE.big : ETR.k === 'zoom punch out' ? -ENGINE.zoom.punchOut * Math.pow(eEnv, ENGINE.zoom.punchTail) : 0, eTile = ETR.k === 'tile burst' ? eEnv : 0, eW = ETR.k === 'warp flash' ? eEnv : 0;
  const eRot = ETR.k === 'rotation kick' ? ETR.sg * ETR_ROT * smooth(0, .3 * ETR.D, eD) * eEnv : 0;   // a bounded angle (<= ETR_ROT rad) that rises over .3 D, then fades; added to P.rot only, never to rotA
  const palRaw = n => { const pool = kindOf(n) ? PAL_HI : PAL_LO; return pool[Math.floor(seedHash(n, 4) * pool.length)]; };
  const palIdx = n => { const a = palRaw(n); if (n > 0 && a === palRaw(n - 1)) { const pool = kindOf(n) ? PAL_HI : PAL_LO; return pool[(pool.indexOf(a) + 1) % pool.length]; } return a; };
  const pp = Hd && !LIVE && extKind(t) === 'pingpong';   // ping-pong (generated, Extreme): look A (even wi) = tiles lead, B = not; palette per A/B, not per beat
  const leadTile = pp ? (wi & 1) === 0 : seedHash(scene, 3) < .5, st = LIVE ? LIVE.state : '', sv = LIVE_LOOK[st] || [1, 1, 1, 1], base = kindOf(scene) ? [1, 1.1, 1, 1] : [.35, .8, .7, .7];
  const tg = base.map((b, i) => b * (1 + .3 * (sv[i] - 1)));   // the section sets the look; the instantaneous state only nudges it
  if (st === 'drop' && leadTile) tg[0] *= .35;
  const hcPal = Hd && !LOC && !pp, PL = PALS[Q.has('pal') ? +Q.get('pal') : hcPal ? palIdx(1000 + (LIVE ? Math.floor(t / 2) : bi >> 2)) : palIdx(scene)], ez = snapLook ? 1 : 1 - Math.exp(-dt / (CL || SHOW ? hl(1.2, .3) : Math.max(.05, TRN / 3))), ezS = snapLook ? 1 : CL || SHOW ? (USER.trans ? 1 - Math.exp(-dt / (USER.trans / 3)) : ez) : ez;   // auto: the engine's own transition time (0 = a hard cut); snapLook = first frame after a seek   // hardcore: the palette flips every 4 beats, quickly
  const LP = LIVE && !SHOW && !CTRL && !Hd, prT = LP ? lerp(1, EN.lp[USER.energy] * (kindOf(scene) ? 1 : EN.lpS[USER.energy][0]) * (st === 'breakdown' || st === 'calm' ? EN.lpS[USER.energy][1] : 1), LOC ? EN.lpL : 1) : 1;   // T151: presence of the baseline effects (EN.lp)
  LOOK.pr += (prT - LOOK.pr) * (snapLook ? 1 : 1 - Math.exp(-dt / (prT > LOOK.pr ? EN.lpT / 3 : Math.max(EN.lpT, TRN / 3))));   // up 3x faster than down: a drop is at full strength at once
  LOOK.k += (tg[0] - LOOK.k) * ez; LOOK.w += (tg[1] - LOOK.w) * ez; LOOK.f += (tg[2] - LOOK.f) * ez; LOOK.p += (tg[3] - LOOK.p) * ez; LOOK.ha += (PL.ha - LOOK.ha) * ez; LOOK.hj += (seedHash(tk, 7) * 2 + (tk === ETR.tk ? ETR.hv : 0) - LOOK.hj) * (1 - Math.exp(-dt / 1.5));   // hue offset re-rolled on every minor change
  // styles (opt-in): auto picks one per scene (20 % none); calm sections get a lighter touch
  const lsOn = (isGen || (LIVE && !SHOW && !CTRL)) && !Hd, lw = LIVE ? scene : wi;   // T143 / T150: the light set replaces the per-window Kali / Julia pick: generated auto (window = wi) and Live / Local auto (window = the live scene), any Energy but Extreme
  const sty = LIVE && lsOn ? (CL && USER.style != null ? USER.style : 3) : CL ? styleNow() : styleDefault(), sIdx = sty === 3 ? [0, 1, 2, 1, 2][Math.floor(seedHash(LIVE ? scene : wi, 8) * 5)] : sty, sAmt = sty === 3 ? (kindOf(scene) ? .55 : .3) : .5;
  const lsT = lsOn ? lightSet(lw) : null;   // a fixed style in the menu still wins
  if (lsT && sty !== 3) { lsT[0] = sty === 1; lsT[1] = sty === 2; }
  LOOK.sk += (((lsT ? lsT[0] : sIdx === 1) ? sAmt : 0) - LOOK.sk) * ezS; LOOK.sj += (((lsT ? lsT[1] : sIdx === 2) ? sAmt : 0) - LOOK.sj) * ezS;   // style switch: eases over the transition time
  for (let i = 0; i < 4; i++) LOOK.ls[i] += ((lsT && lsT[i] ? 1 : 0) - LOOK.ls[i]) * ezS;   // eased membership of the light set
  for (let i = 0; i < 3; i++) { LOOK.c[i] += (PL.c[i] - LOOK.c[i]) * ez; LOOK.d[i] += (PL.d[i] - LOOK.d[i]) * ez; }
  // camera tilt amplitude by state; tilt direction drifts slowly and re-rolls per scene
  const camT = g15 * (LIVE ? (kindOf(scene) ? .26 : .08) * (1 + .3 * (({ drop: .32, groove: .26, build: .2 }[st] ?? .1) / .26 - 1)) : .18 * smooth(.2, .5, u));
  CAM.a += (camT - CAM.a) * ez;
  const tilt = [CAM.a * Math.sin(t * .11 + seedHash(scene, 5) * 6.28), CAM.a * Math.cos(t * .087 + seedHash(scene, 6) * 6.28)];
  // band reactivity: mids spin the picture, bass speeds the tiles up, highs add sparkle (live only where it would break the pure f(t))
  BAND.hi += (hi - BAND.hi) * (1 - Math.exp(-dt * 3)); BAND.mid += (mid - BAND.mid) * (1 - Math.exp(-dt * 3)); BAND.zt += ((LIVE ? .45 * LIVE.tension : 0) - BAND.zt) * (1 - Math.exp(-dt * 2)); BAND.tt = LIVE ? BAND.tt + dt * (1 + 2.5 * bass) : t;
  USER.cx += (USER.tx - USER.cx) * (1 - Math.exp(-dt * 4)); USER.cy += (USER.ty - USER.cy) * (1 - Math.exp(-dt * 4));
  const EK = ENGINE.kal, ET = ENGINE.tile, EW = ENGINE.warp, KMAX = hl(ARC.kalMax ?? EK.max, EK.maxHc), dip = hl(1 - EK.dip * smooth(.55, .95, .5 + .5 * Math.sin(t * .11 + PH)), 1);   // kaleidoscope capped, and it regularly lets the source breathe back
  // tunnel: seeded stretches (generated), or on drops / strong builds (live, eased); stretch of the source ghost grows with intensity + surges
  if (LIVE) tunLive += ((st === 'drop' ? .85 : st === 'build' ? .5 * smooth(.25, .6, LIVE.tension) : 0) - tunLive) * (1 - Math.exp(-dt / 1.5));
  const tun = g15 * (Q.has('tunnel') ? +Q.get('tunnel') : LIVE ? tunLive : tunnelAt(t));
  const cz = calG * g15, sg = Q.has('surge') ? +Q.get('surge') : (hk <= 0 || hk >= 1 ? surgeAt(t, hk >= 1, EV) : lerp(surgeAt(t, false, EV), surgeAt(t, true), hk)) * cz * (VP.length ? .6 + .8 * secE * UE.big : 1),
    mdR = hk <= 0 || hk >= 1 ? moodAt(t, hk >= 1, EV) : (m0 => { const m1 = moodAt(t, true), o = {}; for (const k in m1) o[k] = lerp(m0[k], m1[k], hk); return o; })(moodAt(t, false, EV)),   // a hardcore toggle blends both seeded schedules
    md = Hd && extKind(t) === 'pingpong' ? { ...mdR, strobe: 0 } : mdR;   // T41: no strobe during a ping-pong (a copy: mdR may be a cached timeline object)
  // T85: when the background ghost is morphing between two images (T77), raise its
  // blend so the (slow) change is actually visible - only in that case, so the
  // one-image look stays unchanged. Blend stays a smooth fraction of the frame.
  const kal = g15 * clamp(kal0 * KMAX * dip * (1 + .2 * wob(t, 3)) * UE.kal * LOOK.k * (hl(EK.base, EK.baseHc) + EK.surge * sg)), anchor = .13 * clamp(kal0 + melt * .5 + pal * .5) * (CL ? USER.src : 1) * (1 + (1 - sg)) * (morphOn ? 2.5 : 1);
  const fold = Math.max(EK.foldMin, n0 + EK.foldWob * wob(t, 4) * kal0);
  const PR = LP ? LOOK.pr : 1, fbx = fb0 * (1 + .08 * wob(t, 2)) * UE.fb * LOOK.f * Math.pow(PR, EN.lpX[0]), fb = clamp(fbx <= .7 ? fbx : .7 + .18 * (1 - Math.exp(-(fbx - .7) / .18)), 0, .9);   // soft knee: cranking the slider still leaves the engine's variation
  hue += hueSpd * UE.hueK * UE.calm * dt; const dA = dt * UE.amp;   // T155: the master amount scales the spin SPEED (the angle is never scaled: an Energy change must not turn the picture); mirrored in integrateTo / integrateLocal
  if (LIVE) rotA += (BAND.mid * .12 + tr * .5 + tm * .2) * dA * rotDir; if (hk > 0) rotA += dA * rotDir * HCspin(t) * hk; rotA += dA * rotDir * opening(u0) * (.25 + .75 * smooth(.12, .35, u)) * (EK.spinBase + EK.spinKal * kal0 + EK.spinWob * wob(t, 5));   // poster stays upright while calm
  // tiles: a window every ~45 s (more often on drops); each window picks its own grid size and mode from the seed
  let tile = clamp((smooth(ET.win[0], ET.win[1], wf) * (1 - smooth(ET.win[2], ET.win[3], wf)) * smooth(ET.gate[0], ET.gate[1], u) * (1 - ET.kalCut * kal) * (leadTile ? 1 : ET.nonLead) * (LIVE ? 0 : 1) + (LIVE ? LIVE.boost * .9 * (leadTile ? 1 : .15) : 0) + trP * ET.punch * (leadTile ? 1 : 0) + eTile * ET.punch + tm * ET.minor * (leadTile ? 1 : .5)) * UE.tile) * g15, tileN = ET.sizes[Math.floor(seedHash(LIVE ? tk : wi, 1) * ET.sizes.length)], tileMode = Math.floor(seedHash(LIVE ? tk : wi, 2) * ET.modes);
  if (CL && USER.force >= 0) { tile = clamp(Math.max(tile, (.55 + .25 * Math.sin(t * .35 + PH)) * UE.tile)) * g15; tileMode = USER.force; }   // a chosen mode keeps the tiles on, still breathing
  // heartbeat (lub-dub) + low-frequency energy of the actual sound
  let pulse = 0;
  if (LIVE) pulse = LIVE.pulse;
  else { while (bi + 1 < BEATS.length && BEATS[bi + 1] <= t) bi++; }
  if (!LIVE && t >= BEATS[0]) { const d = t - BEATS[bi], d2 = d - .22; pulse = (Math.exp(-d * 7) + (d2 > 0 ? .6 * Math.exp(-d2 * 7) : 0)) * hbW(u0); }
  bassE += (bass - bassE) * .2; pulse = Math.min(1.3, pulse * (1 + (ARC.drive || 0) * .6) + bassE * .5 * (LIVE ? 1 : hbW(u0)));
  if (ARC.piano) pulse = .12 * noteGlow(t);   // piano: no heartbeat, only a very soft breath after each melody note
  // zoom: slow breathing in and out (below 1 the picture tiles into a tunnel), a build slowly pushes in, every new scene punches out or in
  const op = isGen && !Hd ? g15 : opening(u0) * g15; pulse *= op;   // generated (T133): the ramp itself; opening(u0) stays on the slow spin
  const zOn = !(SHOW || CTRL || HC); if (zOn && LIVE && !LOC) zoomPulseLive(t);   // T113: zoom pulses in every source (not Extreme / manual / showcase)
  const zpMap = (z, c) => z < 1 ? 1 + (z - 1) * Math.sqrt(c) : Math.pow(1 + (z - 1) * c, UE.big);   // T134: calm / soft shrink the zoom-in pulse (zp ** big); T145: a zoom-out is not a deformation: calm and soft keep it, and the slow-start ramp lets it in as its square root
  const zp = zOn ? zpMap(zoomPulseAt(t), cal) : 1;
  const EZ = ENGINE.zoom, punchZ = kindOf(scene) ? (seedHash(scene, 11) < EZ.pPunchOut ? -EZ.punchOut * Math.pow(trP, EZ.punchTail) : .55 * trP * UE.big * hl(1, 1.6)) : trP * UE.big * hl(1, 1.6) * (scene % 2 ? .55 : -.4);   // T145: a scene start on an energetic section mostly jumps OUT at once and returns slowly (trP ** tail); a calm one keeps the old alternating nudge
  const zoom = (1 + zoomAmp * op * .25 * Math.sin(t * .23 + wob(t, 6) * 2)) * Math.exp(EZ.swing * cz * Math.sin(t * .06 + PH * 1.7)) * Math.pow(EZ.rest, cz) * Math.exp(-EZ.kalOut * kal) * (1 + BAND.zt) * (1 + punchZ + eZ) * (1 + tm * UE.big * hl(.12, .3) * (mi % 2 ? 1 : -1)) * USER.zoom * (1 + bassE * .04) * zp;
  const stretch = Q.has('stretch') ? +Q.get('stretch') : clamp(LP ? (EN.st[0] * Math.max(0, u - EN.st[1]) + .5 * sg) * smooth(10, 50, t) * PR : (.15 + .6 * u + .5 * sg) * (LIVE ? smooth(10, 50, t) : cz * op) * .9);
  const wr = warp * op * (1 + EW.wob * wob(t, 1)) * (1 + EW.mid * BAND.mid) * (1 + EW.punch * (trP + eW)) * LOOK.w * (EW.base + EW.surge * sg) * hl(1, EW.hc) * UE.wp * PR, ab = (aber * op + BAND.hi * .6) * PR * (1 + .5 * sg) * hl(1, LIVE ? EN.hcAb[0] : 1.8) + hl(0, LIVE ? EN.hcAb[1] : .4);   // T153: Live / Local Extreme aberration = x hcAb[0] + hcAb[1] (generated keeps 1.8 / .4)
  const fadeT = clamp(TOTAL * .06, 8, 15), gFade = isGen ? smooth(0, fadeT, t) : 1, gZoom = isGen ? 1 + .22 * (1 - smooth(0, fadeT * 1.5, t)) : 1;   // generated start: black, the picture comes up over 8-15 s with a slow zoom-out
  // final parameters of this frame: in showcase mode they are replaced by a neutral baseline + the active FX entry
  const cellNow = hk * smooth(.8, .95, sg);
  const P = { t, warp: wr, kal, fold, fb: fb * (1 - ET.fbCut * (Q.get('tile') ? 1 : tile)), fbHue: UE.hueK * (.006 + .02 * pal) * LOOK.ha, hue: hue + LOOK.hj, pal: pal * LOOK.p, side, breath: breath * op, melt: melt * op * (.5 + sg) * UE.mt * Math.pow(PR, EN.lpX[1]), zoom: zoom * gZoom, rot: rotA + USER.rot + eRot, ab, pulse, bright: bright * gFade * (Hd && !LOC ? smooth(0, 3, t) : 1), anchor, tilt,
    srcZ: 1 + .3 * cz * Math.sin(t * .045 + PH), srcRot: .5 * cz * Math.sin(t * .031 + PH * 2), palC: LOOK.c, palD: LOOK.d, ha: LOOK.ha, stretch: stretch * UE.st, tun: clamp(tun * UE.tn), mono: Math.max(UE.monoK, md.bw), tile, tileN, tileMode,
    surge: sg, kali: Math.min(1, LOOK.sk * (.3 + sg) * cz * UE.ka), julia: Math.min(1, LOOK.sj * (.3 + sg) * cz * UE.ju), dark: md.dark, blaze: Math.max(md.blaze, hH ? ENGINE.mood.hit * hH.s * Math.exp(-(t - hH.t) / .3) * cz : 0), strobe: md.strobe, rate: md.rate, rate1: 0, sT0: 0, sD: 0, sNeg: 0, cT0: 0, cD: 0, cCol: 0, cells: cellNow, grid: cellGrid, glitch: glitchAmt(t) };
  if (UE.amp !== 1) { const f = UE.amp; for (const k of ['warp', 'kal', 'breath', 'melt', 'ab', 'pulse', 'stretch', 'tun', 'tile', 'kali', 'julia', 'pal']) P[k] *= f; P.tilt = P.tilt.map(v => v * f); P.ha *= Math.min(1, f); P.fb *= Math.min(1, f); P.srcZ = 1 + (P.srcZ - 1) * f; P.srcRot *= f; { const zr = P.zoom / USER.zoom; P.zoom = Math.pow(zr, zr < 1 ? Math.max(1, f) : f) * USER.zoom; } }   // master Effects: 0 = plain image
  if (UE.big !== 1) for (const k of ['tile', 'tun', 'glitch', 'blaze']) P[k] *= UE.big;   // T134: the big moves are smaller at calm / soft (generated, Live and Local auto; UE.big = 1 in manual / showcase); before ctrlParams, so a held G / J still works at full
  if (UE.strb !== 1) P.strobe *= UE.strb;   // strobe mood: off at calm, half at soft
  { const m = P.strobe > .001 && CL !== 2 ? moodRun(t, hk >= .5) : null; SVAR.s = m && { v: m.v, t0: m.a, D: m.b - m.a }; } SVAR.c = null;   // T161: the running mood stretch carries the strobe variant; manual (CL 2) drops the mood, so a held key draws its own; a build accent overrides it below
  if (LIVE && !SHOW && !CTRL) liveAccents(P, t, dt); else { ACC.name = ''; ACC.k = -1; }   // T157: build accents + the breakdown / calm gate on strobe and checkerboard (Live / Local); before the soft cap, so glitch and warp stay inside it at calm / soft
  if (lsOn) {   // T143: the light set. lsw 1 (calm, soft): a member is exactly its set strength and a non-member is off (the arc no longer drives Kali / Julia / kal / tiles); lsw 0 (normal): the engine value, floored at the member's strength
    const E = USER.energy, RL = (UE.rs >= .5 ? ENGINE.ramp.strong : ENGINE.ramp).lv, gate = smooth(RL[0], RL[2], cal);   // slow start: fades in from the ramp's 1st level to its 3rd
    for (let i = 0; i < 4; i++) { const f = LS_FX[i], gm = LIVE ? srcGainMul(LOC ? 'loc' : 'live', f) : 1, a = LOOK.ls[i] * lsAmt(i, lw, E, cal, gate) / gm; P[f] = lerp(Math.max(P[f], a), a, UE.lsw); }   // T150: Live / Local: srcGainApply() runs later, so the member is divided by the source gain (the set strength is what ends up in P)
  }
  if (lsOn && UE.lsw > 0) for (const f of ['warp', 'melt', 'stretch', 'fb', 'glitch']) P[f] = lerp(P[f], softCap(P[f], VIS[f][1] * UE.capK, EN.knee), UE.lsw);   // T143: calm / soft strength cap (<= light / 1.5 x light), a soft knee, surges and the arc's end included
  // arrow rotate / zoom holds (all levels, independent of control params)
  const wdt = clamp((performance.now() - CT.wall) / 1000, 0, .1); CT.wall = performance.now();   // T149: wall-clock step, because the song step dt is 0 while paused (arrows were dead then)
  CT.held.forEach(c => { if (c === 'ArrowUp') USER.zoom *= Math.exp(.7 * wdt); else if (c === 'ArrowDown') USER.zoom *= Math.exp(-.7 * wdt); else if (c === 'ArrowLeft') USER.rot -= 1.1 * wdt; else if (c === 'ArrowRight') USER.rot += 1.1 * wdt; });
  USER.zoom = clamp(USER.zoom, .25, 2.0);   // T71: zoom in capped at ×2
  // Calm master slider (T64): one final multiplier toward the neutral poster. Applied to both auto and user paths, before showcase/ctrl so their deltas sit on top of the calmed base.
  if (SHOW) showcaseParams(P, t); else if (CL) ctrlParams(P, t, dt);
  // strobe-grid launch tracking: each rising edge (0 -> on) draws a new grid size
  // the size is drawn from the song second of the launch (seeded), so a seek to the same moment gives the same grid; fades keep it
  strobeVars(P, t);   // T161 (reads cellPrev / strPrev, so before they are updated)
  if (P.cells > 0 && cellPrev <= 0) { const Ns = [3, 4, 5, 6, 7, 8, 9, 10]; cellGrid = Ns[Math.floor(seedHash(Math.floor(t), 80) * 8)]; }
  cellPrev = P.cells; strPrev = P.strobe;
  P.grid = cellGrid;
  // Calm master slider (T64): one final multiplier toward the neutral poster, after every other term (incl. user keys).
  const cf = UE.calm;
  if (cf !== 1) {    for (const k of ['warp', 'kal', 'breath', 'melt', 'ab', 'pulse', 'stretch', 'tun', 'tile', 'kali', 'julia', 'pal']) if (typeof P[k] === 'number') P[k] *= cf;
    if (typeof P.fold === 'number') P.fold = n0 + (P.fold - n0) * cf;
    if (Array.isArray(P.tilt)) P.tilt = P.tilt.map(v => v * cf);
    if (typeof P.ha === 'number') P.ha *= cf;
    if (typeof P.fb === 'number') P.fb *= cf;
    if (typeof P.fbHue === 'number') P.fbHue *= cf;
    if (typeof P.srcZ === 'number') P.srcZ = 1 + (P.srcZ - 1) * cf;
    if (typeof P.srcRot === 'number') P.srcRot *= cf;
    if (typeof P.zoom === 'number') P.zoom = USER.zoom * (1 + (P.zoom / (USER.zoom || 1) - 1) * cf);
    if (typeof P.rot === 'number') P.rot = USER.rot + (P.rot - USER.rot) * cf;
    if (typeof P.glitch === 'number') P.glitch *= cf;
  }
  P.zoom = clamp(P.zoom, .15, 2.0);   // T71: zoom in capped at ×2; zoom out down to ×.15 (the wheel / USER.zoom stays at .25)
  snapLook = false;
  lastP = P;   // for the B snapshot
  { // T114: per-source calibration of the effect amounts (SRCGAIN in 08z-effects.js); not in showcase / manual; Extreme too (T153)
    SRC_NOW = LOC ? 'loc' : LIVE ? 'live' : 'gen';
    if (!(SHOW || CTRL)) {
      srcGainApply(P, SRC_NOW);
      const sgKey = SRC_NOW + '|' + CODE.mode + '|' + HC, sgTxt = srcGainText(SRC_NOW);   // log: one line when the source starts (or the log is switched on)
      if (sgKey !== SG_LOGGED) { SG_LOGGED = sgKey; CODE.st = t; if (sgTxt) codeAdd('source gain: ' + SRC_NOW + ' ' + sgTxt, 'a', 'source gain: ' + ({ loc: 'local', live: 'live' }[SRC_NOW] || 'generated') + ' ' + sgTxt, 'srcgain'); }
    }
  }
  if (PNEUTRAL || PSETN) { if (PNEUTRAL) { pfNeutral(P); P.fbHue = (.006 + .02 * P.pal) * P.ha; P.zoom *= USER.zoom; } for (const k in PSET) P[k] = PSET[k]; }   // T144 test hook (?neutral=1&pset=): same baseline as showcaseParams, then the listed fields
  if (PLOG && t >= PLOG.nx) { PLOG.nx = t + .5; PLOG.push({ t, scene, warp: P.warp, kal: P.kal, fb: P.fb, melt: P.melt, tile: P.tile, kali: P.kali, julia: P.julia, tun: P.tun, stretch: P.stretch, zoom: P.zoom, ab: P.ab, dark: P.dark, mono: P.mono, blaze: P.blaze, strobe: P.strobe, rate: P.rate, rate1: P.rate1, sNeg: P.sNeg, cells: P.cells, cD: P.cD, cCol: P.cCol, glitch: P.glitch, st: LIVE ? LIVE.state : '', ak: ACC.name, kd: LIVE ? (LIVE.kinds[LIVE.scenes] ?? 1) : 1 }); }   // T108 (?debug=1 + silent still only): compact sample of the final P every 0.5 s of song time
  if (CL === 2 && !MAN_BASE) { MAN_BASE = cloneP(P); captureManual(P); }
  clampP(P);   // T109: the P contract (08z-effects.js), once per frame, before codeFeed and the uniforms
  const zpAct = zOn ? zoomPulseActive(t) : null;   // T141: the factor the pulse really reaches: its plateau (a + ramp) with the same ramp (rampIn / calm) and UE.big as zp above
  const zpPk = zpAct ? zpAct.a + zoomEase(zpAct)[0] : 0, zpCal = zpAct ? (isGen ? rampIn(zpPk) : calm(zpPk)) : 1;
  codeFeed(P, { zp: zpAct, zpF: zpAct ? zpMap(zpAct.f, zpCal) : 1, scene, palI: Q.has('pal') ? +Q.get('pal') : palIdx(scene), lead: leadTile, t, kind: kindOf(scene), ls: lsT ? lsNames(lsT) : null }, dt);
  // pass 1 → offscreen (with feedback from the previous frame)
  const w = cur ^ 1;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[w]); gl.viewport(0, 0, FW, FH); gl.useProgram(progS);
  if (imMix < 1) { imMix = Math.min(1, imMix + dt / 1.5); ASPECT = lerp(IM[imFrom].aspect, IM[imTo].aspect, smooth(0, 1, imMix)); if (imMix >= 1) { imFrom = imTo; ASPECT = IM[imTo].aspect; } }
  if (imMix >= 1 && IM[imTo]) ASPECT = IM[imTo].aspect;
  const imK = imMix >= 1 ? 0 : smooth(0, 1, imMix);
  // webcam source textures: upload only the current/crossfade frames when their video frame changed
  for (let _wi = 0; _wi < IM.length; _wi++) {
    const _we = IM[_wi]; if (!_we || !_we.cam) continue;
    const _v = _we.cam; if (_v.readyState < 2 || !_v.videoWidth || !_v.videoHeight) continue;
    if (_we._w === _v.videoWidth && _we._h === _v.videoHeight && _we._t === _v.currentTime) continue;
    gl.bindTexture(gl.TEXTURE_2D, _we.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, _v); } catch (e) {}
    if (!_we._init) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
      _we._init = true;
    }
    _we._w = _v.videoWidth; _we._h = _v.videoHeight; _we._t = _v.currentTime; _we.aspect = _v.videoWidth / _v.videoHeight;
  }
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, IM[imFrom].tex); gl.uniform1i(uS.uTex, 0);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, IM[imTo].tex); gl.uniform1i(uS.uTex2, 2); gl.uniform1f(uS.uImgMix, imK);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, IM[Math.min(gi.a, IM.length - 1)].tex); gl.uniform1i(uS.uGhostA, 4);
  gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, IM[Math.min(gi.b, IM.length - 1)].tex); gl.uniform1i(uS.uGhostB, 5);
  gl.uniform1f(uS.uGhostMix, gi.mix);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[cur]); gl.uniform1i(uS.uPrev, 1);
  gl.uniform2f(uS.uRes, FW, FH); gl.uniform1f(uS.uT, t); gl.uniform1f(uS.uWarp, P.warp); gl.uniform1f(uS.uKal, P.kal); gl.uniform1f(uS.uKalN, P.fold);
  // trails would smear the tiles away, so they thin out while tiles are on
  gl.uniform1f(uS.uFb, P.fb); gl.uniform1f(uS.uFbHue, P.fbHue); gl.uniform1f(uS.uHue, P.hue); gl.uniform1f(uS.uPal, P.pal);
  gl.uniform1f(uS.uSide, P.side); gl.uniform1f(uS.uBreath, P.breath); gl.uniform1f(uS.uMelt, P.melt); gl.uniform1f(uS.uZoom, P.zoom);
  gl.uniform1f(uS.uRot, P.rot); gl.uniform1f(uS.uAber, P.ab); gl.uniform1f(uS.uPulse, P.pulse); gl.uniform1f(uS.uBright, P.bright); gl.uniform1f(uS.uAspect, ASPECT); gl.uniform1f(uS.uAnchor, P.anchor);
  const rAge = (performance.now() - USER.rip.t0) / 1000; gl.uniform4f(uS.uRip, USER.rip.x, USER.rip.y, rAge, rAge < 2.2 ? 1 : 0);
  gl.uniform2f(uS.uTilt, P.tilt[0], P.tilt[1]); gl.uniform1f(uS.uTT, BAND.tt); gl.uniform1f(uS.uSrcZ, P.srcZ); gl.uniform1f(uS.uSrcRot, P.srcRot); gl.uniform3f(uS.uPalC, ...P.palC); gl.uniform3f(uS.uPalD, ...P.palD); gl.uniform1f(uS.uHueAmt, P.ha); gl.uniform1f(uS.uStretch, P.stretch); gl.uniform1f(uS.uTunnel, P.tun);
  gl.uniform2f(uS.uCenter, USER.cx, USER.cy); gl.uniform1f(uS.uMono, P.mono);
  const fT = Q.get('tile');   // test override: ?tile=<mode 0-2>,<grid N> forces the tile effect
  if (fT) { const [m, n] = fT.split(','); gl.uniform1f(uS.uTile, 1); gl.uniform1f(uS.uTileN, +n || 12); gl.uniform1f(uS.uTileMode, +m || 0); }
  else { gl.uniform1f(uS.uTile, P.tile); gl.uniform1f(uS.uTileN, P.tileN); gl.uniform1f(uS.uTileMode, P.tileMode); }
  gl.uniform1f(uS.uTileSeed, PH % 7); gl.uniform1f(uS.uTileSize, tileSizeAt(t)); gl.uniform1f(uS.uWarpN, QUAL[quality].warpN); gl.uniform1f(uS.uFx, QUAL[quality].fx);
  gl.uniform1f(uS.uKali, P.kali); gl.uniform1f(uS.uJulia, P.julia);
  { const EK = ENGINE.kali, EJ = ENGINE.julia; gl.uniform3f(uS.uKaliP, EK.zoom, EK.iter, EK.scale); gl.uniform3f(uS.uJuliaP, EJ.zoom, EJ.iter, EJ.drift); gl.uniform1f(uS.uKalZ, ENGINE.kal.zoom); }
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, CODE.tex); gl.uniform1i(uS.uCode, 3); gl.uniform1f(uS.uCodeAmt, .8 * CODE.k);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // pass 2 → screen (aberration, vignette, grain)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); gl.useProgram(progD);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[w]); gl.uniform1i(uD.uTex, 0);
  gl.uniform2f(uD.uRes, cv.width, cv.height); gl.uniform1f(uD.uT, t); gl.uniform1f(uD.uAber, P.ab); gl.uniform1f(uD.uPulse, P.pulse); gl.uniform1f(uD.uHi, BAND.hi); gl.uniform1f(uD.uFx, QUAL[quality].fx);
  gl.uniform1f(uD.uDark, P.dark); gl.uniform1f(uD.uBlaze, P.blaze); gl.uniform1f(uD.uStrobe, P.strobe); gl.uniform1f(uD.uRate, P.rate); gl.uniform1f(uD.uCells, P.cells); gl.uniform1f(uD.uGrid, P.grid || 4);
  gl.uniform1f(uD.uNeg, P.sNeg); gl.uniform1f(uD.uPh, strobePhase(P)); gl.uniform1f(uD.uCol, P.cCol); gl.uniform1f(uD.uCacc, P.cD > 0 ? 1 : 0); gl.uniform1f(uD.uCph, cellPhase(P));
  gl.uniform1f(uD.uGlitch, P.glitch); gl.uniform1f(uD.uGSeed, PH + 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  cur = w;
}

