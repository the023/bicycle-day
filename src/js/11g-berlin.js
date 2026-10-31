// [[STYLE berlin]] (T119): Berlin School (Tangerine Dream / Schulze, 1970s). No drums: the rhythm IS the sequencer. One constant tempo per piece (112-128 BPM, seeded; BEATS is re-laid on it).
// Voices, all PERSISTENT oscillators driven by automation: sequencer bass (saw + square + sine through a resonant lowpass; per-step gate on a VCA, per-step filter accent on filter.detune,
// slow cutoff / resonance / level curves on the other params), a second sequence (soft square, 16ths, another length = phasing), 3 detuned-saw pad voices with voice leading, a portamento lead (calm sections).
// Same material everywhere: one mode, one chord progression per section, the sequence pattern follows the chord root diatonically, the 2nd sequence = the pattern's own tones an octave+ up,
// the lead = MT.period fitted to the chords. Plan (sections, chords, patterns, lead notes) drawn up front from the seed, so a seek just resumes it.
STYLE_FN.berlin = function (ctx) {
  const { off, t0, dly, fb, master, a, send, ts, mtof } = ctx;
  const sr = mulberry32((seedUsed * 2654435761 + 1971) | 0), r = (() => { for (let i = 0; i < 5; i++) sr(); return () => sr(); })(),   // warm-up: the first draws of nearby seeds are correlated (all phrygian)
    pk = arr => arr[Math.floor(r() * arr.length)], rr = (x, y) => x + (y - x) * r(), cc = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const into = (m, lo, hi) => { while (m > hi) m -= 12; while (m < lo) m += 12; return m; };
  // — tempo and grid (16th = 1 tick)
  const bpm = Math.round(rr(112, 128)), bt = 60 / bpm, s16 = bt / 4, BARD = 4 * bt, rate = r() < .62 ? 1 : 2, sd = s16 * rate;   // rate 1 = 16th-note sequence (classic TD), 2 = 8ths (Sweet Dreams drive)
  BEATS = []; for (let k = Math.ceil(TOTAL * .06 / bt); k * bt < TOTAL * .97; k++) BEATS.push(k * bt);   // the picture's beat grid = the music's (pure function of the seed)
  const NBAR = Math.max(12, Math.floor((TOTAL - 1.5) / BARD));
  const mode = pk(['aeolian', 'aeolian', 'dorian', 'phrygian']), KEY = 33 + (pk([0, 7, 5, 10, 3]) % 12);   // tonic A / E / D / G / C in octave 1-2
  const ok5 = cr => MT.st(mode, cr + 4) - MT.st(mode, cr) === 7;   // chords with a perfect fifth only (no diminished triad)
  const PROGS = [[0, 5, 6, 0], [0, 5, 3, 4], [0, 3, 0, 5], [0, 6, 5, 6], [0, 0, 5, 5], [0, 3, 5, 4], [0, 3, 0, 3], [0, 6, 0, 3], [0, 1, 0, 1], [0, 1, 6, 0], [0, 5, 0, 6], [0, 3, 6, 0], [0, 0, 3, 3], [0, 6, 3, 0], [0, 5, 1, 0]].filter(p => p.every(ok5));
  // — sections (in 8-bar units): intro / build / drop (= peak) / break / outro; kinds from the arc's energy, lengths weighted by kind
  const U = Math.max(4, Math.floor(NBAR / 8)); let NS = cc(Math.round(TOTAL / 40), 4, Math.min(14, U)), KIND = ['intro'];
  for (let i = 1; i < NS - 1; i++) {
    const e = energy(cc((i + .5) / NS, 0, 1)), pv = KIND[i - 1];
    let k = e > .62 ? 'drop' : e < .32 ? 'break' : 'build';
    if (pv === 'intro' && k !== 'build') k = 'build'; if (pv === 'break' && k === 'break') k = 'build'; if (pv === 'build' && k === 'build' && e >= .48) k = 'drop';
    KIND.push(k);
  }
  KIND.push('outro');
  if (!KIND.includes('drop')) { let b = Math.min(2, NS - 2); for (let i = 2; i < NS - 1; i++) if (energy((i + .5) / NS) > energy((b + .5) / NS)) b = i; KIND[b] = 'drop'; }
  for (let i = 2; i < NS - 1; i++) if (KIND[i] === 'drop' && KIND[i - 1] === 'drop' && KIND[i - 2] === 'drop') KIND[i - 1] = 'break';   // never three peaks in a row
  if (NS >= 6 && !KIND.includes('break')) { let b = -1; for (let i = 2; i < NS - 1; i++) if (KIND[i - 1] === 'drop') { b = i; break; } if (b < 0) b = NS - 2; if (KIND[b] !== 'drop' || KIND.filter(k => k === 'drop').length > 1) KIND[b] = 'break'; }
  for (let i = 1; i < NS - 1; i++) if (KIND[i] === 'break' && !KIND.slice(0, i).includes('drop')) KIND[i] = 'build';   // the first break comes after a peak
  for (let i = NS - 2; i > 1; i--) if (KIND[i] === 'build' && KIND[i - 1] === 'build') KIND.splice(i, 1);   // two builds in a row = one longer build
  NS = KIND.length;
  const KW = { intro: 2.6, build: 2, drop: 2.6, break: 1.6, outro: 2 }, wts = KIND.map(k => KW[k] * rr(.85, 1.2)), wsum = wts.reduce((x, y) => x + y, 0);
  const un = wts.map(w => Math.max(1, Math.floor(U * w / wsum)));
  if (U >= 8) un[0] = Math.max(2, un[0]);
  { const ex = [...KIND.map((k, j) => k === 'drop' ? j : -1).filter(j => j >= 0), 0, NS - 1]; for (let left = U - un.reduce((x, y) => x + y, 0), i = 0; left > 0; left--, i++) un[ex[i % ex.length]]++; }
  while (un.reduce((x, y) => x + y, 0) > U) { const j = un.indexOf(Math.max(...un)); un[j]--; }
  const SEC = []; let b0 = 0, keyOff = 0;
  for (let i = 0; i < NS; i++) {
    const kind = KIND[i], b1 = i === NS - 1 ? NBAR : b0 + 8 * un[i];
    if (i && kind !== 'outro' && kind !== 'break' && r() < .4) keyOff = pk([5, -2, 3, -5, 2].filter(x => x !== keyOff));   // related root (4th, whole step down, minor third, 5th, step up)
    if (kind === 'outro') keyOff = 0;
    let prog = pk(PROGS); if (kind === 'outro' || kind === 'intro') prog = pk(PROGS.filter(p => p[3] === 0 || p[2] === 0)) || prog;
    SEC.push({ i, kind, b0, b1, key: keyOff, prog, cb: kind === 'break' || kind === 'intro' ? 8 : 4, sev: r() < .4, gate: rr(.5, .82), dec: rr(.05, .12), env: rr(1300, 2300), sw: { intro: .4, build: .9, drop: .6, break: .3, outro: .3 }[kind] });
    b0 = b1;
  }
  const tB = b => b * BARD, secOfBar = b => { for (const s of SEC) if (b < s.b1) return s; return SEC[NS - 1]; };
  // — sequencer patterns: degrees above the chord root (0 root, 7 octave), per-step accent, density priority. One base pattern per piece, mutated per 8-bar phrase
  const L0 = rate === 1 ? 16 : 8, POOL = [2, 4, 4, 7, 6, 2, 9, 3, 5];
  const mkPat = L => {
    const sty = pk(['pedal', 'pedal', 'bounce', 'arp']), n = []; let tn = pk([2, 4, 7]);
    for (let i = 0; i < L; i++) {
      const mv = () => { const c = POOL.filter(x => Math.abs(x - tn) <= 3 && x !== tn && (x !== 3 && x !== 5 || i % 2)); tn = c.length ? pk(c) : pk([2, 4, 7]); return tn; };
      let d;
      if (sty === 'pedal') d = i % 2 === 0 ? (i % 8 === 4 && r() < .4 ? 7 : 0) : mv();
      else if (sty === 'bounce') d = i % 4 === 0 ? 0 : i % 4 === 2 ? 7 : mv();
      else d = i % 4 === 0 ? 0 : mv();
      n.push({ d, on: true, acc: i === 0 ? 1 : i % 4 === 0 ? .6 : r() < .2 ? .5 : .15, pr: i === 0 ? 0 : d === 0 || d === 7 ? rr(.05, .3) : rr(.3, 1) });
    }
    return n;
  };
  const mutate = (P, big) => {   // one note changed, sometimes a step muted / brought back; big (section change): sometimes another length (polymeter against the bar)
    let n = P.n.map(x => ({ ...x }));
    if (big && r() < .3) { const L = pk(rate === 1 ? [12, 14, 16, 16, 10] : [6, 7, 8, 8]); if (L !== n.length) { const ext = mkPat(L); n = ext.map((x, i) => i < n.length ? { ...n[i] } : x); } }
    if (r() < .6) { const i = 1 + Math.floor(r() * (n.length - 1)); if (n[i].d !== 0) n[i].d = pk(POOL.filter(x => Math.abs(x - n[i].d) <= 3 && x !== n[i].d)); }
    if (r() < .25) { const i = 1 + Math.floor(r() * (n.length - 1)); if (n[i].acc < .5) n[i].on = !n[i].on; }
    if (n.filter(x => !x.on).length > 2) n.forEach(x => x.on = true);
    return { n };
  };
  const NPH = Math.ceil(NBAR / 8) + 1, PATS = [{ n: mkPat(L0) }];
  for (let ph = 1; ph < NPH; ph++) PATS.push(mutate(PATS[ph - 1], SEC.some(s => s.b0 === 8 * ph)));
  // 2nd sequence: the base pattern's own tones (an octave+ up) on another loop length -> phasing against the main one
  const L2 = pk([6, 7, 10, 12]), SQ2 = Array.from({ length: L2 }, (_, i) => { const x = PATS[0].n[(i * 3 + 1) % L0].d; return { d: (x === 0 ? pk([4, 7]) : x) + (i % 3 === 0 ? 7 : 0), acc: i === 0 ? 1 : i % 2 ? .45 : .7 }; });
  // — chords: [time, midi notes of the 3 pad voices], voice leading inside C3-E4
  const CH = []; let pv = null;
  for (const S of SEC) for (let b = S.b0; b < S.b1; b += S.cb) {
    const ci = Math.floor((b - S.b0) / S.cb), cr = S.kind === 'outro' && b + S.cb >= S.b1 ? 0 : S.prog[ci % 4], tn = KEY + S.key, ds = [cr, cr + 2, S.sev ? cr + 6 : cr + 4];
    const pcs = ds.map(d => (tn + MT.st(mode, d)) % 12);
    let best = null, bc = 1e9;
    for (const perm of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      const ref = pv || [50, 55, 59], v = perm.map((p, k) => { let m = pcs[p] + 12 * Math.round((ref[k] - pcs[p]) / 12); return into(m, 48, 64); });
      const cost = v.reduce((q, m, k) => q + Math.abs(m - ref[k]), 0) + (new Set(v).size < 3 ? 50 : 0);
      if (cost < bc) { bc = cost; best = v; }
    }
    CH.push({ t: tB(b), b, cr, S, v: best }); pv = best;
  }
  const chordAtBar = b => { let c = CH[0]; for (const x of CH) { if (x.b > b) break; c = x; } return c; };
  // — lead: one MT.period per piece (the theme), fitted to the chords, played in breaks (whole period, 8ths) and as a reprise in the outro (second half, ends home)
  const PER = MT.period(mulberry32((seedUsed * 7919 + 333) | 0)), LEAD = [];
  for (const S of SEC) {
    if (S.kind !== 'break' && S.kind !== 'outro') continue;
    const bars = S.kind === 'break' ? [0, 1, 2, 3, 4, 5, 6, 7] : [4, 5, 6, 7], st0 = S.b0 + (S.kind === 'break' ? 2 : 0), tn = into(KEY + S.key + 24, 55, 61);
    bars.forEach((pb, j) => {
      let bar = PER[pb]; if (SEC.filter(x => x.kind === 'break' && x.i < S.i).length % 2) bar = MT.vary(r, bar, pk(['orn', 'tail', 'same']));
      for (const e of bar) {
        const b = st0 + 2 * j + Math.floor(e.s / 8); if (b >= S.b1 - 1) continue;
        const t = tB(st0 + 2 * j) + e.s * 2 * s16, c = chordAtBar(b), dg = e.s % 8 === 0 || e.l >= 6 || e.cad ? MT.fit(e.d, c.cr, c.S.sev) : e.d;
        let m = tn + MT.st(mode, dg); if (m > 77) m -= 12; if (m < 55) m += 12;
        LEAD.push({ t, len: e.l * 2 * s16, m, v: e.s % 8 === 0 ? 1 : .85 });
      }
    });
  }
  LEAD.sort((x, y) => x.t - y.t);
  window.BERLINPLAN = SEC.map(s => ({ kind: s.kind, from: +tB(s.b0).toFixed(1) * (s.i ? 1 : 0), to: +(s.i < NS - 1 ? tB(s.b1) : TOTAL).toFixed(1), bpm, rate: rate === 1 ? '16th' : '8th', mode, key: s.key, prog: s.prog.join(''), L: PATS[Math.floor(s.b0 / 8)].n.length, L2 }));   // read by vplan() (via the events) and tools
  if (Q.has('debug') && !off) console.log('BERLIN plan', JSON.stringify(window.BERLINPLAN));
  // T101 events: sections; a hit where the sequence comes back after a break; a phrase every 8 bars that is not a section start
  evtSet([...SEC.map((s, i) => evtSec(window.BERLINPLAN[i].from, s.kind, planEnergy(window.BERLINPLAN[i]))),
    ...SEC.filter(s => s.i && SEC[s.i - 1].kind === 'break' && s.kind !== 'outro').map(s => ({ t: tB(s.b0), k: 'hit', s: .9, d: 0 })),
    ...Array.from({ length: Math.floor(NBAR / 8) }, (_, k) => 8 * k).filter(b => b && !SEC.some(s => s.b0 === b)).map(b => ({ t: tB(b), k: 'phrase', s: .3, d: 0 }))]);
  // — time curves (pure functions of t): section intensity, sequence level / density, 2nd sequence level, pad level
  const SW = [rr(22, 36), rr(53, 80), r() * 6.28, r() * 6.28];
  const secAt = t => secOfBar(Math.floor(t / BARD)), prog = (S, t) => cc((t - tB(S.b0)) / Math.max(1, (S.i < NS - 1 ? tB(S.b1) : TOTAL) - tB(S.b0)), 0, 1);
  const prevK = S => S.i ? SEC[S.i - 1].kind : '';
  const secI = t => { const S = secAt(t), p = prog(S, t);
    return S.kind === 'intro' ? lerp(.06, .32, p) : S.kind === 'build' ? lerp(prevK(S) === 'drop' ? .5 : .32, .74, p) : S.kind === 'drop' ? .84 + .1 * smooth(0, .3, p) - .06 * smooth(.85, 1, p) : S.kind === 'break' ? .3 : lerp(.5, .04, smooth(0, .95, p)); };
  const sweep = t => .55 * Math.sin(6.283 * t / SW[0] + SW[2]) + .3 * Math.sin(6.283 * t / SW[1] + SW[3]);
  const Iat = t => { let v = 0; for (let k = -2; k <= 2; k++) v += secI(cc(t + k * .5, 0, TOTAL)); return cc(.62 * v / 5 + .38 * energy(cc(t / TOTAL, 0, 1)), 0, 1); };   // 2 s moving average: no step at a section start
  const seqLv = t => { const S = secAt(t), p = prog(S, t), dt = t - tB(S.b0);
    return S.kind === 'intro' ? smooth(.42, .9, p) : S.kind === 'break' ? 1 - smooth(0, 2 * BARD, dt) : S.kind === 'outro' ? 1 - smooth(.6, .93, p) : prevK(S) === 'break' && S.kind === 'build' ? smooth(0, 2 * BARD, dt) : 1; };
  const dens = t => { const S = secAt(t), p = prog(S, t); return S.kind === 'intro' ? lerp(.25, 1.01, smooth(.45, 1, p)) : S.kind === 'outro' ? lerp(1.01, .2, smooth(.15, .8, p)) : 1.01; };
  const sq2Lv = t => { const S = secAt(t), p = prog(S, t), dt = t - tB(S.b0);
    return S.kind === 'build' ? smooth(.45, .75, p) : S.kind === 'drop' ? (prevK(S) === 'build' ? 1 : smooth(0, 2 * BARD, dt)) : S.kind === 'break' ? 1 - smooth(0, BARD, dt) : 0; };
  const padLv = t => { const S = secAt(t), p = prog(S, t); return S.kind === 'intro' ? smooth(0, .22, p) * (1 - .25 * smooth(.6, 1, p)) : S.kind === 'break' ? 1 : S.kind === 'outro' ? .8 + .2 * smooth(.3, .7, p) : S.kind === 'drop' ? .62 : .72; };
  lvlSet(Array.from({ length: Math.ceil(TOTAL / 2) + 1 }, (_, i) => { const t = Math.min(TOTAL, 2 * i); return [t, Iat(t)]; }));   // T146 chart level (data only): the music's own intensity Iat(t) (intro rise, build, peak, break, outro fade), the curve that drives cutoff and levels
  // — graph
  const END = t0 + TOTAL + 1, MOB = MOBILE;
  const O = (type, f, det = 0) => { const o = a.createOscillator(); if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type); o.frequency.value = f; o.detune.value = det; o.start(ts); o.stop(END); return o; };
  const G = (v, dest) => { const g = a.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
  const F = (type, f, q, dest) => { const x = a.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; if (dest) x.connect(dest); return x; };
  const PN = (pan, dest) => { const p = a.createStereoPanner(); p.pan.value = pan; p.connect(dest); return p; };
  const N = Math.max(16, Math.ceil((TOTAL - off) / .25) + 1), cdur = Math.max(.5, TOTAL - off), TT = Array.from({ length: N }, (_, i) => off + cdur * i / (N - 1)), IT = TT.map(Iat);
  const KR = (...ps) => ps.forEach(p => { try { p.automationRate = 'k-rate'; } catch (e) {} });   // slow params: one value per 128-sample block (render cost), the gates stay a-rate
  const cv = (param, fn) => { const arr = new Float32Array(N); for (let i = 0; i < N; i++) { const v = fn(TT[i], IT[i]); arr[i] = isFinite(v) ? v : 0; } param.setValueCurveAtTime(arr, ts, cdur); };
  dly.delayTime.value = 3 * s16; fb.gain.value = .36;   // echo synced to the tempo (dotted 8th)
  const hollow = (() => { const n = 10, re = new Float32Array(n + 1), im = new Float32Array(n + 1); for (let k = 1; k <= n; k += 2) im[k] = 1 / Math.pow(k, 1.25); return a.createPeriodicWave(re, im); })();
  // sequencer bass: saw + square -> resonant lowpass (cutoff curve + per-step accent on detune) -> VCA (per-step gate) -> soft clip -> level (curve); sine (fundamental) bypasses the filter
  const sOut = G(0, master), sPan = PN(0, sOut), sClip = a.createWaveShaper(), sV = G(0), sLp = F('lowpass', 200, 4), oS = O('sawtooth', 55), oQ = MOB ? null : O('square', 55, 7), oSub = O('sine', 55), subG = G(.55, sV);
  { const c = new Float32Array(1025); for (let i = 0; i < 1025; i++) c[i] = Math.tanh(1.6 * (i / 512 - 1)) / Math.tanh(1.6); sClip.curve = c; }
  G(.8, sLp); oS.connect(sLp); if (oQ) { const qg = G(.45, sLp); oQ.connect(qg); } oSub.connect(subG); sLp.connect(sV); sV.connect(sClip); sClip.connect(sPan);
  { const hp = F('highpass', 320, .7), sg = G(.16); sOut.connect(hp); hp.connect(sg); sg.connect(dly); send(sOut, .12); }
  KR(sLp.frequency, sLp.Q, sLp.detune, sOut.gain, oS.frequency, oSub.frequency, ...(oQ ? [oQ.frequency] : []));
  cv(sLp.frequency, (t, I) => cc(110 * Math.pow(2, 4.3 * I + .8 * secAt(t).sw * sweep(t)), 70, 3600));
  cv(sLp.Q, (t, I) => 3 + 6 * smooth(.15, .7, I) + 1.5 * (.5 + .5 * Math.sin(6.283 * t / (SW[0] * 1.7) + SW[3])));
  cv(sOut.gain, (t, I) => .26 * seqLv(t) * (1 + .55 * (1 - smooth(.1, .6, I))));   // a closed filter is quieter: makeup
  // 2nd sequence: soft square, short plucks, slow auto-pan, into the echo
  const qOut = G(0), qPan = a.createStereoPanner(), qV = G(0), qLp = F('lowpass', 1500, 2.5), oQ2 = O(hollow, 440);
  oQ2.connect(qLp); qLp.connect(qV); qV.connect(qOut); qOut.connect(qPan); qPan.connect(master); send(qPan, .3, .55);
  { const pl = O('sine', .045 + r() * .04), pg = G(.45); pl.connect(pg); pg.connect(qPan.pan); }
  KR(qLp.frequency, qLp.detune, qOut.gain, qPan.pan, oQ2.frequency);
  cv(qLp.frequency, (t, I) => cc(700 * Math.pow(2, 1.9 * I + .5 * sweep(t + 7)), 400, 4200));
  cv(qOut.gain, (t, I) => .075 * sq2Lv(t) * (.75 + .25 * I));
  // pads: 3 voices x 2 detuned saws (1 on phones), shared lowpass, slow ensemble chorus
  const pOut = G(0, master), pLp = F('lowpass', 900, .7), padO = [];
  send(pOut, .45); pLp.connect(pOut);
  if (!MOB) { const ch = a.createDelay(.05), l = O('sine', .37), lg = G(.0035), cg = G(.6, pOut); ch.delayTime.value = .016; KR(ch.delayTime); l.connect(lg); lg.connect(ch.delayTime); pLp.connect(ch); ch.connect(cg); }
  const plfo = O('sine', .21), plg = G(5); plfo.connect(plg);
  for (let k = 0; k < 3; k++) { const pp = PN([-.35, .05, .35][k], pLp); for (let j = 0; j < (MOB ? 1 : 2); j++) { const o = O(j ? 'sawtooth' : (k === 0 ? 'triangle' : 'sawtooth'), 220, MOB ? 0 : (j ? 8 : -8) + k * 1.5); if (j) plg.connect(o.detune); o.connect(pp); padO.push([k, o]); } }
  KR(pLp.frequency, pOut.gain, ...padO.flatMap(([, o]) => [o.frequency, o.detune]));
  cv(pLp.frequency, (t, I) => cc(520 * Math.pow(2, 1.9 * I + .35 * sweep(t + 13)), 300, 2600));
  cv(pOut.gain, t => .07 * padLv(t) * (MOB ? 1.6 : 1));
  // lead: triangle + sine, portamento, delayed vibrato; level = note gate
  const lOut = G(.11, master), lV = G(0), lLp = F('lowpass', 2100, .5), oL1 = O('triangle', 440), oL2 = O('sine', 440), vib = O('sine', 4.9), vibG = G(0);
  { const g2 = G(.7, lLp); oL1.connect(lLp); oL2.connect(g2); } KR(oL1.frequency, oL2.frequency, oL1.detune, oL2.detune); vib.connect(vibG); vibG.connect(oL1.detune); vibG.connect(oL2.detune); lLp.connect(lV); lV.connect(lOut); send(lOut, .5, .35);
  // — scheduling: chords and lead notes up front (few events), sequencer steps in the rolling pump
  { let i0 = 0; while (i0 + 1 < CH.length && CH[i0 + 1].t <= off) i0++;
    for (let i = i0; i < CH.length; i++) { const c = CH[i], tt = i === i0 ? ts : t0 + c.t; for (const [k, o] of padO) { const f = mtof(c.v[k]); if (i === i0) o.frequency.setValueAtTime(f, tt); else o.frequency.setTargetAtTime(f, tt, .09); } } }
  { let prevEnd = -9, first = true;
    for (const n of LEAD) {
      const leg = !first && Math.abs(n.t - prevEnd) < .02, tt = t0 + n.t, te = tt + n.len * .96;
      if (n.t >= off + .05) {
        first = false;
        for (const o of [oL1, oL2]) { if (leg) o.frequency.setTargetAtTime(mtof(n.m), tt, .045); else o.frequency.setValueAtTime(mtof(n.m), tt); }
        if (!leg) lV.gain.setTargetAtTime(n.v, tt, .035);
        vibG.gain.setTargetAtTime(0, tt, .03); if (n.len > .45) vibG.gain.setTargetAtTime(14, tt + .3, .25);
        const nx = LEAD[LEAD.indexOf(n) + 1]; if (!nx || Math.abs(nx.t - (n.t + n.len)) >= .02) lV.gain.setTargetAtTime(0, te, .16);
      }
      prevEnd = n.t + n.len;
    } }
  const LOG = Q.has('debug') ? (window.__berlinLog = []) : null;
  const step = j => {   // one 16th tick j (song time j * s16)
    const t = j * s16, tt = Math.max(t0 + t, a.currentTime); if (t > TOTAL - .4 || t0 + t < a.currentTime - .01) return;
    const bar = Math.floor(j / 16), S = secOfBar(bar), c = chordAtBar(bar), cs = c.b * 16, tn = KEY + S.key, I = Iat(t);
    if (j % rate === 0 && seqLv(t) > .002) {   // main sequence
      const P = PATS[Math.floor(bar / 8)].n, x = P[((j - cs) / rate) % P.length];
      if (x.on && x.pr <= dens(t)) {
        const root = into(tn + MT.st(mode, c.cr), 31, 42); let m = root + MT.st(mode, c.cr + x.d) - MT.st(mode, c.cr); if (m > 54) m -= 12;
        const f = mtof(m), v = .62 + .38 * x.acc, g = S.gate * sd;
        const tf = Math.max(a.currentTime, tt - .003); oS.frequency.setValueAtTime(f, tf); if (oQ) oQ.frequency.setValueAtTime(f, tf); oSub.frequency.setValueAtTime(f, tf);   // k-rate pitch: set 3 ms early, inside the previous note's release
        sV.gain.setTargetAtTime(v, tt, .0025); sV.gain.setTargetAtTime(v * .7, tt + .012, .14); sV.gain.setTargetAtTime(0, tt + g, .011);
        sLp.detune.setTargetAtTime(S.env * (.35 + .65 * x.acc) * (.6 + .4 * I), tt, .003); sLp.detune.setTargetAtTime(0, tt + .008, S.dec * (rate === 2 ? 1.5 : 1));
        if (LOG) LOG.push([+t.toFixed(4), 's', m]);
      }
    }
    if (sq2Lv(t) > .002) {   // 2nd sequence (always 16ths)
      const x = SQ2[(j - cs) % L2], root = into(tn + MT.st(mode, c.cr), 55, 62); let m = root + MT.st(mode, c.cr + x.d) - MT.st(mode, c.cr); if (m > 79) m -= 12;
      oQ2.frequency.setValueAtTime(mtof(m), Math.max(a.currentTime, tt - .003)); qV.gain.setTargetAtTime(.5 + .5 * x.acc, tt, .002); qV.gain.setTargetAtTime(0, tt + .012, .055 + .04 * (1 - I));
      qLp.detune.setTargetAtTime(900 * x.acc, tt, .003); qLp.detune.setTargetAtTime(0, tt + .006, .06);
      if (LOG) LOG.push([+t.toFixed(4), 'q', m]);
    }
  };
  let jn = Math.ceil(off / s16 - 1e-6);
  return function pump() {
    const hz = a.currentTime + (MOB ? 8 : 30);
    while (t0 + jn * s16 < hz && jn * s16 < TOTAL) step(jn++);
  };
};
