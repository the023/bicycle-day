// [[STYLE electro]]: dark melodic techno / synthwave. Beat grid = BEATS (same as the picture's pulse). Section plan from the seed (kinds intro/drop/break/outro), per-section key shift, chords, drums, bass, arp, lead, cutoff.
STYLE_FN.electro = function (ctx) {
  const { off, a, master, send, makeKit, ts, t0, PRp, EPALS, FPAL, mkPal, noise, env, note, mtof } = ctx;
  const NB = BEATS.length, SEED = (seedUsed % 1000) + 1, PR = mulberry32(((seedUsed | 0) * 2654435761 + 777) >>> 0), pr = (x, y) => x + (y - x) * PR(), pp = arr => arr[Math.floor(PR() * arr.length)];
  const hs = n => { const x = Math.sin(n * 127.1 + SEED * 311.7) * 43758.5453; return x - Math.floor(x); };   // deterministic per-step dice (a seek gives the same notes)
  const KB = clamp(Math.round(NB * .04 / 4) * 4, 4, 16);   // KB: beats into the intro before the kick enters
  // — section plan
  const nSec = NB < 32 ? 1 : clamp(Math.round(TOTAL / 50), 2, 16), wts = []; for (let i = 0; i < nSec; i++) wts.push(pr(.8, 1.25) * (i === 0 ? .65 : 1));
  const wsum = wts.reduce((p, c) => p + c, 0), KINDS = [], PROGS = [[0, 5, 3, 4], [0, 6, 5, 6], [0, 2, 3, 4], [0, 3, 0, 4], [0, 4, 5, 3], [0, 5, 2, 6], [0, 3, 5, 4]];
  for (let i = 0; i < nSec; i++) KINDS.push(nSec === 1 ? 'drop' : i === 0 ? 'intro' : i === nSec - 1 ? (nSec === 2 ? 'drop' : 'outro') : (i % 2 ? 'drop' : 'break'));
  const SECS = []; let cum = 0, pb = 0;
  for (let i = 0; i < nSec; i++) {
    cum += wts[i]; const b1 = i === nSec - 1 ? NB + 8 : Math.round(cum / wsum * NB / 8) * 8;
    if (b1 > pb) { const kind = KINDS[i];
      SECS.push({ b0: pb, b1, kind, ks: SECS.length ? pp([0, 0, 2, 3, 4, -1, 5]) : 0, prog: pp(PROGS), eo: { intro: -.08, drop: .2, break: -.3, outro: -.12 }[kind] + pr(-.06, .06), dens: pr(.5, 1), dv: Math.floor(PR() * 4), bp: Math.floor(PR() * 4),
        arpT: pp(['square', 'sawtooth', 'triangle']), arpD: pr(.09, .22), arpP: Math.floor(PR() * 3), arpR: PR() < .6 ? 1 : 2, leadT: pp(['sawtooth', 'square']), leadDet: pr(4, 14), cut: pr(1100, 3200), padT: pp(['sawtooth', 'sawtooth', 'square']), padC: pr(700, 1800),
        motif: (() => { const m = []; let d = 4 + Math.floor(PR() * 4); for (const s of [0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27, 30]) if (PR() < .6) { d = clamp(d + pp([-2, -1, 1, 2, 3, -3]), 1, 11); m.push([s, d, 1 + Math.floor(PR() * 3)]); } return m; })() }); pb = b1; }
  }
  SECS.forEach((s, i) => s.next = SECS[i + 1] ? SECS[i + 1].kind : '');
  { let pi = Math.floor(PRp() * EPALS.length); SECS.forEach((s, i) => { const sw = PRp() < .35, nx = 1 + Math.floor(PRp() * (EPALS.length - 1)); if (FPAL !== null) pi = (+FPAL) % EPALS.length; else if (i && sw) pi = (pi + nx) % EPALS.length; s.P = mkPal(EPALS[pi]); }); }   // sound palette: one per play, a section may switch
  if (!off) console.log('[sound] electro palettes per section: ' + SECS.map(s => s.P.n).join(' > '));
  window.ELECTRO_PLAN = SECS.map(s => ({ kind: s.kind, from: +(BEATS[Math.min(s.b0, NB - 1)]).toFixed(1), to: +(BEATS[Math.min(s.b1, NB - 1)]).toFixed(1), key: s.ks, prog: s.prog.join(''), eo: +s.eo.toFixed(2), dens: +s.dens.toFixed(2), drums: s.dv, bass: s.bp, arp: s.arpT + '/' + s.arpR, lead: s.leadT, cut: Math.round(s.cut), pal: s.P.n }));
  // T100 events: sections, hit on a drop's first beat (the crash/kick of `beat`), riser = the 8-beat pre-drop window (the rising sweep), phrase every 8 bars. Same BEATS entries `beat` uses.
  evtSet([...SECS.map((s, i) => evtSec(BEATS[Math.min(s.b0, NB - 1)], s.kind, planEnergy(window.ELECTRO_PLAN[i]))),
    ...SECS.filter(s => s.kind === 'drop' && s.b0 > 0 && s.b0 < NB).map(s => ({ t: BEATS[s.b0], k: 'hit', s: .9, d: 0 })),
    ...SECS.filter(s => s.next === 'drop' && s.b1 - 8 >= s.b0 && s.b1 - 8 < NB - 1).map(s => ({ t: BEATS[s.b1 - 8], k: 'riser', s: .8, d: BEATS[Math.min(s.b1, NB - 1)] - BEATS[s.b1 - 8] })),
    ...evtPhr(BEATS, SECS.map(s => s.b0 / 4), TOTAL)]);
  {   // T146 chart level (CHLV, data only): the intro is not flat: pad alone, then shaker + hats (KB/2 beats in), kick + snare (KB), bass (KB+8); the riser lifts the 8 beats before a drop
    const T = b => BEATS[Math.min(Math.max(b, 0), NB - 1)];
    lvlSet(lvlSecs(SECS.map((s, i) => {
      const e = planEnergy(window.ELECTRO_PLAN[i]), a = i ? T(s.b0) : 0, b = i < SECS.length - 1 ? T(s.b1) : TOTAL, rs = s.next === 'drop' ? Math.max(e, .72) : e, mid = [];
      if (s.kind === 'intro') mid.push([T(s.b0), .1], [T(s.b0 + KB / 2), .17], [T(s.b0 + KB / 2 + 4), .22], [T(s.b0 + KB), .38], [T(s.b0 + KB + 8), .5]);
      if (s.next === 'drop' && s.b1 - 8 > s.b0) mid.push([T(s.b1 - 8), s.kind === 'intro' ? .5 : e]);
      return { a, b, e0: s.kind === 'intro' ? .05 : e, e1: s.kind === 'intro' && s.next !== 'drop' ? .5 : rs, mid };
    })));
  }
  // — graph: tonal bus (ducked by the kick, filtered) + drum buses
  const tb = a.createGain(), duck = a.createGain(), mf = a.createBiquadFilter(); tb.gain.value = .8; mf.type = 'lowpass'; mf.Q.value = 1.4; mf.frequency.value = 1500;
  tb.connect(duck); duck.connect(mf); mf.connect(master); send(mf, .2, .1);
  const K = makeKit(tb, 0), vo = K.vo;   // the voices below come from the shared kit; palettes: sc.P
  const sweep = (t, d, f0, f1, v, up) => { if (!vo(t, d + .1, 1, 1)) return; const n = noise(t, d + .1), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'bandpass'; f.Q.value = 1.6; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + d);
    if (up) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + d); g.gain.linearRampToValueAtTime(.0001, t + d + .05); } else { g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); }
    n.connect(f); f.connect(g); g.connect(master); send(g, .35); };
  const crash = (t, v) => { sweep(t, 1.6, 6000, 3000, v, false); vo(t, 1, 1, 1); const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(30, t + .9); o.connect(env(t, .004, v * 1.6, .9, master)); o.start(t); o.stop(t + 1); };
  const elPad = (t, d, deg, sc, v) => { const at = Math.min(.9, d / 3); K.pad(t, Math.max(at, d - .6), at, 1.2, [0, 2, 4].map(q => note(deg + q)), v, sc.P, sc.padC); };   // 3-note chord, sc.padC = base cutoff
  const BASSP = [[2, 6, 10, 14], [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], [0, 3, 6, 10, 12, 14], [2, 3, 6, 7, 10, 11, 14]], ARPP = [[0, 1, 2, 3, 2, 1, 0, 1], [0, 2, 1, 3, 0, 2, 1, 3], [0, 0, 2, 1, 3, 2, 1, 2]], TONES = [0, 2, 4, 7];
  const secOf = b => { for (const s of SECS) if (b < s.b1) return s; return SECS[SECS.length - 1]; };
  const cutOf = (s, L, brk, pre, rem) => clamp(s.cut * Math.pow(2, 2.2 * L) * (brk ? .4 : 1) * (pre ? Math.pow(2, 2.5 * (1 - rem / 8)) : 1), 350, 16000);
  const beat = (b, first) => {
    const sc = secOf(b), bs = b - sc.b0, rem = sc.b1 - b, bb = bs % 4, bar = Math.floor(bs / 4), tb0 = t0 + BEATS[b], bd = BEATS[Math.min(b + 1, NB - 1)] - BEATS[b] || .45, sd = bd / 4;
    const kind = sc.kind, L = Math.max(clamp(energy(BEATS[b] / TOTAL) * .75 + sc.eo), kind === 'intro' ? lerp(.12, .62, bs / (sc.b1 - sc.b0)) : 0), brk = kind === 'break', nx = sc.next, pre = nx === 'drop' && rem <= 8, ig = kind === 'intro' ? bs : 999, deg = sc.prog[bar % 4] + sc.ks;
    const hatOn = !brk && L > .1 && ig >= KB / 2, kickOn = !brk && (L > .2 || kind === 'drop' || kind === 'intro') && ig >= KB && !(nx && rem <= 1) && !(nx === 'break' && rem <= 4) && !(kind === 'drop' && bar % 16 === 15 && bb === 3), bassOn = !brk && L > .3 && ig >= KB + 8 && !(nx && rem <= 1);
    const arpOn = (brk ? L > .05 : L > .25) && ig >= KB / 2 + 4 && !(nx && rem <= 1), leadOn = (kind === 'drop' || (kind === 'outro' && L > .6)) && L > .45 && Math.floor(bs / 8) % 2 === 1, snOn = !brk && L > .35 && ig >= KB;
    const P = kind === 'drop' ? (sc.PR = sc.PR || Object.assign({}, sc.P, { sat: Math.min(.9, sc.P.sat + .3), ksat: Math.min(.9, sc.P.ksat + .3), click: Math.min(.6, sc.P.click + .15) })) : sc.P;   // drops are rougher: more drive on the tonal bus and the kick
    if (bs === 0 || first) K.setPal(P, Math.max(tb0, a.currentTime));
    const rollBar = kind === 'drop' && L > .5 && bar % 8 === 7 && bb >= 2;   // rollBar: a snare roll in the last half bar of every 8 (the kick also leaves for one beat every 16 bars, see kickOn)
    if (bb === 0 || first) { const left = first && bb ? 4 - bb : 4; elPad(tb0, left * bd + .3, deg, sc, (brk ? .1 : .075) * (.5 + L)); }
    if (bb === 0) mf.frequency.setTargetAtTime(cutOf(sc, L, brk, pre, rem), tb0, bd * 1.5);
    if (bs === 0 && b > 0 && kind !== 'intro') { if (kind === 'drop') crash(tb0, .3); else sweep(tb0, 1.5, 3000, 300, .15, false); }
    if (rem === 8 && nx === 'drop') sweep(tb0, 8 * bd, 250, 9000, .26, true); else if (rem === 4 && nx && nx !== 'drop') sweep(tb0, 4 * bd, 5000, 200, .14, false);
    for (let k = 0; k < 4; k++) {
      const t = tb0 + k * sd, s16 = bb * 4 + k, idx = bs * 4 + k, h = hs(b * 4 + k);
      if (t < a.currentTime - .05) continue;
      if (k === 0 && kickOn) { K.kick(t, .9, P); duck.gain.setValueAtTime(.4, t); duck.gain.linearRampToValueAtTime(1, t + bd * .75); }
      else if (k === 0 && bs === 0 && b > 0 && kind === 'drop') K.kick(t, .9, P);
      if (kickOn && sc.dv === 3 && s16 === 10 && L > .55) K.kick(t, .5, P);
      if (kickOn && kind === 'drop' && L > .6 && sc.dv !== 3 && (s16 === 7 || s16 === 15) && h < .45) K.kick(t, .38, P);   // ghost kick: pushes the groove
      if (kind === 'intro' && !hatOn) { if (s16 % 4 === 2) K.hat(t, .045 + .03 * Math.min(1, bs / KB)); if (s16 === 0 && bar % 2 === 0) K.hat(t, .07, true); }   // light shaker + a soft open-hat cymbal from the very first bar, so the start is not a bare drone
      if (rollBar) K.snare(t, .1 + .14 * ((bb - 2) * 4 + k) / 8, 0, P);   // 16th snare roll
      if (hatOn) {
        const dv = sc.dv, off8 = s16 % 4 === 2;
        if (off8) K.hat(t, .13 + .07 * L, dv === 2 || (dv === 0 && L > .6));
        else if (!MOBILE && L > .5 && ((dv === 1 && s16 % 2 === 1) || (dv === 2 && s16 % 4 !== 0) || (dv === 3 && (s16 === 7 || s16 === 15)))) K.hat(t, .045 + .04 * h * L);
        else if (dv === 2 && !pre && s16 % 4 === 0 && L > .4) K.hat(t, .03);
      }
      if (pre && snOn) { const n = rem > 4 ? (k === 0 ? 1 : 0) : rem > 2 ? (k % 2 === 0 ? 1 : 0) : 1, v = .08 + .35 * (1 - rem / 8); if (n) { K.snare(t, v, 0, P); if (rem <= 1) K.snare(t + sd / 2, v * 1.1, 0, P); } }
      else if (snOn && (s16 === 4 || s16 === 12) && kind !== 'intro') K.snare(t, .22 + .1 * L, sc.dv % 2 || P.snr === 'both', P);
      if (bassOn && BASSP[sc.bp].includes(s16)) {
        const hi = (idx % 7 === 3 && L > .6) ? 12 : 0, five = s16 === 14 && h < .3 ? 4 : 0;
        K.bass(t, mtof(note(deg - 7 + five) + hi), sc.bp === 1 ? sd * .9 : sd * 2.2, .26 + .1 * L, 500 + 1800 * L, P);
      }
      if (arpOn && (idx % (MOBILE ? Math.max(2, sc.arpR) : sc.arpR * (brk ? 2 : 1))) === 0 && hs(b * 4 + k + 7) < Math.min(1, .45 + sc.dens * .5 + L * .3)) {
        const q = ARPP[sc.arpP][(idx >> (sc.arpR - 1 + (brk ? 1 : 0))) % 8], oct = (L > .7 && (idx >> 4) % 2) ? 7 : 0;
        K.pluck(t, mtof(note(deg + 7 + TONES[q % 4] + oct)), (.035 + .04 * L) * (brk ? .8 : 1), sc.arpD * (brk ? 1.8 : 1), P);
      }
      if (leadOn) { const sx = idx % 32; for (const [ms, md, ml] of sc.motif) if (ms === sx) K.lead(t, mtof(note(deg + 7 + md)), .05, ml * sd * .9, P, sc.leadDet); }
    }
  };
  let b = (() => { const i = BEATS.findIndex(x => x >= off); return i < 0 ? NB : i; })(), first = true;
  K.setPal(SECS[0].P, ts);
  if (off < BEATS[0] - .5 && NB) elPad(ts, t0 + BEATS[0] - ts + .3, SECS[0].prog[0] + SECS[0].ks, SECS[0], .06);
  return function pump() {
    const hz = a.currentTime + (MOBILE ? 8 : 30);
    while (b < NB - 1 && t0 + BEATS[b] < hz) { beat(b, first); first = false; b++; }
  };
};
