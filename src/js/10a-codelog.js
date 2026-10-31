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
