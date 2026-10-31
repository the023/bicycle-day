// [[STYLE chiptune2]] (T96): a richer 8-bit style next to `chiptune` (which stays as it was). Same rules: PERSISTENT oscillators, pure function of (seed, bar), window.CHIPPLAN.
// Melody = MT.period (motif + variations, leaps, passing notes, syncopation, rests); mode (dorian / aeolian / harmonic minor) and key per section, 7th chords;
// 3 pulse channels (lead with delayed vibrato, counter-melody or echo, fast tracker arps), triangle bass with small slides, drum pool + fills before section changes.
STYLE_FN.chiptune2 = function (ctx) {
  const { t0, a, master, ts, nb, off, send, mtof } = ctx;
  const SP = mulberry32(Math.floor(seedUsed * 1000) * 7 + 54321);   // plan rng (independent of `rng`, which is reseeded on every seek)
  const cc = (x, lo, hi) => Math.min(hi, Math.max(lo, x)), spick = arr => arr[Math.floor(SP() * arr.length)], into = (m, lo, hi) => { while (m > hi) m -= 12; while (m < lo) m += 12; return m; };
  const B = BEATS.length > 8 ? BEATS.slice() : (() => { const r = []; for (let s = 0; s < TOTAL; s += 60 / bpmAt(s / TOTAL)) r.push(s); return r; })();
  const p0 = B[1] - B[0], pl = B[B.length - 1] - B[B.length - 2];
  while (B[0] >= p0) B.unshift(B[0] - p0);
  while (B[B.length - 1] < TOTAL + 6) B.push(B[B.length - 1] + pl);
  const nBars = Math.floor((B.length - 1) / 4) - 1;
  const stT = (k, s) => { const bi = 4 * k + (s >> 2); return B[bi] + (s & 3) * (B[bi + 1] - B[bi]) / 4; };
  // — section plan (same timing rules as chiptune): ~1 per 30-45 s, on 4-bar boundaries
  const nSecT = cc(Math.round(TOTAL / (30 + SP() * 15)), 3, 12), kB = [0];
  for (let i = 1; i < nSecT; i++) {
    const tt = TOTAL * (i + (SP() - .5) * .3) / nSecT; let j = 0; while (j < B.length - 1 && B[j] < tt) j++;
    const k = Math.max(Math.round(j / 16) * 4, kB[kB.length - 1] + 8); if (k > nBars - 4 || B[4 * k] > TOTAL - 8) break; kB.push(k);
  }
  kB.push(nBars);
  const SEC = [], eAt = t => energy(cc(t / TOTAL, 0, 1)), n0 = kB.length - 1;
  for (let i = 0; i < n0; i++) {
    const tA = B[4 * kB[i]], tB = i === n0 - 1 ? TOTAL : B[4 * kB[i + 1]], e = eAt((tA + tB) / 2);
    let role = i === 0 ? 'intro' : i === n0 - 1 ? 'outro' : e > .62 ? 'drop' : e < .3 ? 'break' : 'build';
    if (i > 0 && i < n0 - 1) { const pv = SEC[i - 1].role; if (pv === 'intro' && role === 'break') role = 'build'; if (pv === 'break' && role === 'break') role = 'build'; if (pv === 'build' && e >= .45) role = 'drop'; }
    SEC.push({ i, k0: kB[i], k1: kB[i + 1], tA, tB, e, role });
  }
  if (n0 >= 3 && !SEC.some(s => s.role === 'drop')) { let b = 1; for (let i = 1; i < n0 - 1; i++) if (SEC[i].e > SEC[b].e) b = i; SEC[b].role = 'drop'; }
  window.CHIPPLAN = SEC.map(x => ({ kind: x.role, from: +x.tA.toFixed(1), to: +x.tB.toFixed(1) }));   // read by vplan()
  // T101 events: a section per entry; a fill on the last bar of every section but the last (the isFill bar of schedBar, fill type in S.fill)
  evtSet(SEC.map((x, i) => evtSec(x.tA, x.role, planEnergy(window.CHIPPLAN[i]))).concat(SEC.slice(0, -1).map(x => ({ t: B[4 * (x.k1 - 1)], k: 'fill', s: .5, d: 0 }))));
  // bass patterns [step, 0 root / 1 octave / 2 fifth, length, slide in from 2 semitones below]
  const BP = [[[0, 0, 2], [2, 0, 2], [4, 1, 2, 1], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 1, 2, 1], [14, 2, 2]], [[0, 0, 3], [3, 0, 3], [6, 1, 2, 1], [8, 0, 3], [11, 2, 3], [14, 1, 2]],
    [[0, 0, 4], [4, 2, 4], [8, 1, 4, 1], [12, 2, 2], [14, 1, 2]], [[0, 0, 6], [6, 0, 2], [8, 2, 6, 1], [14, 1, 2]], [[0, 0, 8], [8, 0, 8]],
    [[0, 0, 1], [1, 0, 1], [2, 1, 2], [4, 0, 1], [5, 0, 1], [6, 1, 2], [8, 0, 1], [9, 0, 1], [10, 1, 2], [12, 2, 2], [14, 1, 2, 1]]];
  const homeMode = spick(['dorian', 'aeolian']);
  let prevKey = 0;
  for (const S of SEC) {
    const R = S.role, OFF = { intro: [-.35, .3], build: [-.15, .3], drop: [.15, 0], break: [-.4, .1], outro: [-.05, -.4] }[R];
    S.eOff = OFF[0]; S.eRamp = OFF[1]; S.seed = Math.floor(SP() * 1e6);
    S.mode = S.i === 0 || R === 'outro' ? homeMode : R === 'drop' ? spick(['harmonic', 'aeolian', 'harmonic', 'dorian']) : spick(['dorian', 'aeolian', 'dorian']);
    let key = S.i === 0 ? 0 : spick([5, -2, 3, 7, -5, 2, -3].filter(x => x !== prevKey));
    if (R === 'drop' && S.i > 1 && SP() < .35) key = cc(prevKey + spick([1, 2]), -5, 7);   // the 'lift': same kind of tune one step higher
    if (R === 'outro') key = 0;   // home key at the end
    S.key = prevKey = key;
    S.prog = MT.prog(SP, S.mode); S.sev = SP() < (R === 'drop' ? .45 : .7); S.half = R === 'drop' && S.prog.length === 4 && SP() < .35;
    S.phrase = MT.period(mulberry32(S.seed));
    S.dutyL = spick([.125, .25, .5, .33]); S.dutyB = spick([.125, .25, .5, .33].filter(x => x !== S.dutyL)); S.dutyC = spick([.5, .25, .4]); S.dutyA = spick([.125, .25, .18]);
    S.arpM = R === 'drop' ? spick(['fast', 'fast', 'up']) : R === 'break' ? spick(['broken', 'fast']) : R === 'build' ? spick(['up', 'fast', 'broken']) : 'broken';
    S.arp = spick([[0, 1, 2, 3], [0, 2, 1, 3], [3, 2, 1, 0], [0, 1, 2, 1], [0, 2, 3, 1]]);
    S.mask = spick([null, null, [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0], [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0]]);
    S.ctr = R === 'intro' ? 'off' : R === 'break' ? spick(['echo', 'guide']) : spick(['guide', 'guide', 'echo']);
    S.bass = R === 'intro' || R === 'break' || R === 'outro' ? spick([4, 3, 2]) : R === 'build' ? spick([0, 1, 2]) : spick([0, 1, 5]);
    S.drum = R === 'break' ? spick([0, 4]) : Math.floor(SP() * MT.DRUMS.length); S.vib = spick([10, 16, 24]);
  }
  for (const S of SEC) S.fill = MT.fill(SP, SEC[S.i + 1] ? SEC[S.i + 1].role : 'outro');
  window.__chipPlan = SEC.map(s => ({ i: s.i, role: s.role, t: [+s.tA.toFixed(1), +s.tB.toFixed(1)], key: s.key, mode: s.mode, prog: s.prog.join(''), sev: s.sev, half: s.half, bass: s.bass, drum: s.drum, arp: s.arpM, ctr: s.ctr, fill: s.fill, duty: [s.dutyL, s.dutyB, s.dutyC, s.dutyA] }));
  if (Q.has('debug')) console.log('CHIP2 plan', JSON.stringify(window.__chipPlan));
  // — persistent voices (7 sources: 3 pulses, triangle, kick/tom sine, vibrato LFO, noise)
  const END = t0 + TOTAL + 1, mkPulse = () => {   // pulse = saw - delayed saw (delay = duty / f); gain = envelope
    const o = a.createOscillator(), dl = a.createDelay(.03), ng = a.createGain(), g = a.createGain(); o.type = 'sawtooth'; ng.gain.value = -1; g.gain.value = 0;
    o.connect(g); o.connect(dl); dl.connect(ng); ng.connect(g); g.connect(master); o.start(ts); o.stop(END); return { o, dl, g: g.gain, node: g };
  };
  const lead = mkPulse(), ctr = mkPulse(), arpC = mkPulse(), tri = a.createOscillator(), triG = a.createGain(), kO = a.createOscillator(), kG = a.createGain();
  const lfo = a.createOscillator(), vibL = a.createGain(), vibC = a.createGain();
  tri.type = 'triangle'; triG.gain.value = 0; tri.connect(triG); triG.connect(master); tri.start(ts); tri.stop(END);
  kO.type = 'sine'; kG.gain.value = 0; kO.connect(kG); kG.connect(master); kO.start(ts); kO.stop(END);
  lfo.frequency.value = 5.6; vibL.gain.value = 0; vibC.gain.value = 7; lfo.connect(vibL); vibL.connect(lead.o.detune); lfo.connect(vibC); vibC.connect(ctr.o.detune); lfo.start(ts); lfo.stop(END);
  const nsrc = a.createBufferSource(); nsrc.buffer = nb; nsrc.loop = true; nsrc.start(ts, 0); nsrc.stop(END);
  const hpH = a.createBiquadFilter(), hpC = a.createBiquadFilter(), bpS = a.createBiquadFilter(), hatG = a.createGain(), crG = a.createGain(), snG = a.createGain();
  hpH.type = hpC.type = 'highpass'; hpH.frequency.value = 7500; hpC.frequency.value = 4500; bpS.type = 'bandpass'; bpS.frequency.value = 1800; bpS.Q.value = .8;
  hatG.gain.value = crG.gain.value = snG.gain.value = 0;
  nsrc.connect(hpH); hpH.connect(hatG); nsrc.connect(hpC); hpC.connect(crG); nsrc.connect(bpS); bpS.connect(snG); hatG.connect(master); crG.connect(master); snG.connect(master);
  if (!MOBILE) { send(lead.node, .05); send(ctr.node, .09); }
  // — note helpers (events per parameter are scheduled in time order)
  const pnote = (ch, t, m, len, vol, duty, sus = .75, gate = .85) => {
    const f = mtof(m); ch.o.frequency.setValueAtTime(f, t); ch.dl.delayTime.setValueAtTime(Math.min(.029, duty / f), t);
    ch.g.setValueAtTime(vol, t); ch.g.setTargetAtTime(vol * sus, t + .01, .2); ch.g.setTargetAtTime(0, t + len * gate, .012);
  };
  const bnote = (t, m, len, vol, slide) => {
    const sl = slide && len > .12; tri.frequency.setValueAtTime(mtof(sl ? m - 2 : m), t); if (sl) tri.frequency.exponentialRampToValueAtTime(mtof(m), t + .05);
    triG.gain.setValueAtTime(vol, t); triG.gain.setTargetAtTime(0, t + len * .9, .012);
  };
  const kick = (t, v) => { kO.frequency.setValueAtTime(165, t); kO.frequency.setTargetAtTime(42, t + .002, .028); kG.gain.setValueAtTime(v, t); kG.gain.setTargetAtTime(0, t + .03, .045); };
  const tom = (t, v, pf) => { kO.frequency.setValueAtTime(200 * pf, t); kO.frequency.setTargetAtTime(130 * pf, t + .002, .05); kG.gain.setValueAtTime(v, t); kG.gain.setTargetAtTime(0, t + .04, .07); };
  const snare = (t, v) => { bpS.frequency.setValueAtTime(3500, t); bpS.frequency.setTargetAtTime(1500, t, .04); snG.gain.setValueAtTime(v, t); snG.gain.setTargetAtTime(0, t + .01, .05); };
  const hat = (t, v) => { hatG.gain.setValueAtTime(v, t); hatG.gain.setTargetAtTime(0, t + .004, .018); };
  const ohat = (t, v) => { crG.gain.setValueAtTime(v, t); crG.gain.setTargetAtTime(0, t + .01, .07); };
  const crash = (t, v) => { crG.gain.setValueAtTime(v, t); crG.gain.setTargetAtTime(0, t + .01, .3); };
  const secAt = k => SEC.find(s => k >= s.k0 && k < s.k1) || SEC[SEC.length - 1];
  // d = the bar's density (what switches the layers on, see schedBar); T146: also the chart's level (CHLV, data only)
  const dBar = (S, tbar) => cc(Math.max(.14, energy(tbar / TOTAL) * .7 + .2 + S.eOff + S.eRamp * cc((tbar - S.tA) / Math.max(1, S.tB - S.tA), 0, 1)), 0, 1);
  lvlSet(Array.from({ length: nBars }, (_, k) => [B[4 * k], dBar(secAt(k), B[4 * k])]).concat([[TOTAL, dBar(SEC[SEC.length - 1], TOTAL)]]));
  const schedBar = k => {
    const S = secAt(k), lb = k - S.k0, nb = S.k1 - S.k0, br = mulberry32(S.seed * 131 + lb * 17 + 5), tbar = B[4 * k], NX = SEC[S.i + 1];
    const d = dBar(S, tbar), vs = .4 + .75 * d, role = S.role, brk = role === 'break';
    const isFill = lb === nb - 1 && !!NX, FL = isFill ? MT.FILLS[S.fill] : null, stop = isFill && S.fill === 'stop', minorFill = !isFill && lb % 4 === 3 && d > .5, mf = Math.floor(br() * 3);
    const pb = lb % 8, rep = Math.floor(lb / 8), dr = MT.DRUMS[S.drum], bp = BP[S.bass], T = ROOT + S.key, P = dd => T + MT.st(S.mode, dd);
    const chordAt = s => S.prog[(S.half ? lb * 2 + (s >> 3) : lb) % S.prog.length];
    const tones = cr => (S.sev ? [0, 2, 4, 6] : [0, 2, 4, 7]).map(x => cr + x);
    // lead line for this bar: the period's bar, varied on the way back round; breaks keep only the long / on-beat notes
    let ev = S.phrase[pb];
    if (rep % 2 === 1) ev = MT.vary(br, ev, MT.rp(br, ['orn', 'tail', 'same', 'thin']));
    if (role === 'drop' && rep >= 1 && pb >= 4 && pb < 7 && br() < .4) ev = MT.vary(br, ev, 'oct');
    if (brk) ev = ev.filter(e => e.s % 4 === 0 || e.l >= 4).map(e => ({ ...e, l: Math.min(8, e.l * 1.5) }));
    const leadOn = d > (brk ? .2 : .3), dutyL = pb === 2 || pb === 3 || pb === 6 ? S.dutyB : S.dutyL;
    const LN = ev.map(e => {
      const cr = chordAt(e.s), dg = e.s % 8 === 0 || e.l >= 6 || e.cad ? MT.fit(e.d, cr, S.sev) : e.d;
      return { s: e.s, m: T + 12 + MT.st(S.mode, dg), len: stT(k, Math.min(16, e.s + e.l)) - stT(k, e.s), l: e.l, acc: e.s % 4 === 0 };
    }).filter(n => !(isFill && n.s >= 8));
    if (LN.length) { const hi = Math.max(...LN.map(n => n.m)), lo = Math.min(...LN.map(n => n.m)), o = hi > 86 ? -12 : lo < 52 && hi < 76 ? 12 : 0; LN.forEach(n => n.m += o); }   // whole bar moves by an octave, so the contour stays
    // counter-melody: guide tones (3rd / 5th / 7th of the chord, closest to the last one) on half bars, or an echo of the lead 3 steps later, an octave down
    const CN = [];
    if (S.ctr === 'guide' && d > .3) { let pv = T + 8; for (const s of [0, 8]) { if (isFill && s >= 8) break; let b = 0, bd = 1e9; for (const x of [2, 4, S.sev ? 6 : 0]) { const m = into(P(chordAt(s) + x), T + 2, T + 14); if (Math.abs(m - pv) < bd) { bd = Math.abs(m - pv); b = m; } } pv = b; CN.push({ s, m: b, len: stT(k, s + 8) - stT(k, s), v: .05 }); } }
    else if (S.ctr === 'echo' && d > .25 && leadOn) for (const n of LN) if (n.s + 3 < 16 && !(isFill && n.s + 3 >= 8)) CN.push({ s: n.s + 3, m: into(n.m - 12, 50, 76), len: stT(k, Math.min(16, n.s + 3 + Math.min(3, n.l))) - stT(k, n.s + 3), v: .045 });
    CN.sort((x, y) => x.s - y.s);
    const sub = MOBILE ? 1 : 3;
    for (let s = 0; s < 16; s++) {
      const t = t0 + stT(k, s), tn = t0 + stT(k, s + 1), sl = tn - t, cr = chordAt(s), fill = isFill && s >= 8, top = lb === 0 && S.i > 0 && s === 0;
      if (t < Math.max(ts, a.currentTime) - .01) continue;
      // drums
      if (top) { crash(t, .13); snare(t, .2); kick(t, .45); }
      else if (!fill && d > .38 && !brk && (d > .7 ? dr.K : dr.K.filter(x => x % 8 === 0)).includes(s)) kick(t, .5 * (.8 + .2 * d));
      if (!fill && d > .45 && !brk && dr.S.includes(s)) snare(t, .2 * vs);
      if (!fill && role === 'drop' && d > .75 && (s === 7 || s === 13)) snare(t, .05);   // ghost notes
      if (!fill && NX && NX.role === 'drop' && lb === nb - 2 && s % 2 === 0 && s >= 8) snare(t, .05 + .012 * s);   // the snare starts to build one bar before the fill
      if (fill) { for (const h of FL) if (h[0] === s) { if (h[1] === 'k') kick(t, .5 * h[2]); else if (h[1] === 's') snare(t, .24 * h[2]); else if (h[1] === 't') tom(t, .42 * h[2], h[3]); else ohat(t, .06 * h[2]); } }
      else if (minorFill && s >= 14) { if (mf === 0) snare(t, .14); else if (mf === 1 && s === 15) snare(t, .16); else if (mf === 2 && s === 14) ohat(t, .05); }
      if (!fill && !top) {
        if (d > .55 && !brk && dr.O && dr.O.includes(s)) ohat(t, .045);
        else if (d > .3) { if (d > .7 && !brk) hat(t, s % 4 === 2 ? .065 : s % 2 ? .03 : .05); else if (dr.H.includes(s) && (!brk || s % 4 === 0)) hat(t, brk ? .035 : .055); }
        else if (brk && s % 4 === 0) hat(t, .03);
      }
      // bass (fill bar: the next section's dominant on step 8 = a pivot into the new key; a 'stop' fill leaves a hole)
      if (d > .12 && !(stop && s >= 8)) {
        if (fill) { const dm = into(ROOT + NX.key - 12 + 7, 31, 50); if (s === 8) bnote(t, dm, 6 * sl, .3 * vs, 1); else if (s === 14) bnote(t, dm + 12, 2 * sl, .26 * vs); }
        else { const b = bp.find(x => x[0] === s); if (b) { const r0 = into(P(cr) - 12, 31, 50); bnote(t, b[1] === 1 ? r0 + 12 : b[1] === 2 ? r0 + MT.st(S.mode, cr + 4) - MT.st(S.mode, cr) : r0, b[2] * sl, .3 * vs, b[3] && d > .35); } }
      }
      // arpeggio channel (fill bar: a riser up the next key's dominant 7th)
      if (fill) { if (!stop) pnote(arpC, t, into(ROOT + NX.key + 12 + [7, 11, 14, 17, 19, 23, 26, 29][s - 8], 55, 96), sl, .05 + .08 * (s - 8) / 7, .25, 1, .9); }
      else if (d > .08 && (!S.mask || S.mask[s])) {
        const TT = tones(cr), dutyA = cc(S.dutyA + (brk ? .08 : .04) * Math.sin(t * 1.3), .08, .5);
        if (S.arpM === 'fast' && d > .3) {   // tracker chord: the chord tones cycle inside one step (~30 ms each)
          arpC.g.setValueAtTime(.06 * vs, t); arpC.g.setTargetAtTime(.035 * vs, t + .01, .08); arpC.g.setTargetAtTime(0, t + sl * .92, .01);
          for (let j = 0; j < sub; j++) { const f = mtof(into(P(TT[(j + (s >> 2)) % TT.length]) + 12, T + 7, T + 26)), tj = t + j * sl / sub; arpC.o.frequency.setValueAtTime(f, tj); arpC.dl.delayTime.setValueAtTime(Math.min(.029, dutyA / f), tj); }
        } else if (S.arpM !== 'broken') pnote(arpC, t, into(P(TT[S.arp[s % S.arp.length]]) + 12, T + 7, T + 26), sl, .07 * vs, dutyA, .8, .8);
        else if (s % 2 === 0) pnote(arpC, t, into(P(TT[S.arp[(s >> 1) % S.arp.length]]) + 12, T + 7, T + 26), 2 * sl, .065 * vs, dutyA, .7, .85);
      }
      // counter-melody
      for (const n of CN) if (n.s === s) pnote(ctr, t, n.m, n.len, n.v * vs, S.dutyC, .6, .9);
      // lead (vibrato fades in on held notes)
      if (leadOn) for (const n of LN) if (n.s === s) {
        pnote(lead, t, n.m, n.len, .12 * vs * (n.acc ? 1 : .85), cc(dutyL + .04 * Math.sin(t * .9), .1, .5), .8, .9);
        vibL.gain.setValueAtTime(0, t); if (n.len > .2) { vibL.gain.setValueAtTime(0, t + .12); vibL.gain.linearRampToValueAtTime(S.vib * (brk ? 1.5 : 1), t + Math.min(n.len * .8, .45)); }
      }
    }
  };
  let nk = 0; while (nk < nBars - 1 && B[4 * (nk + 1)] <= off) nk++;
  return function pump() {
    const hz = a.currentTime + (MOBILE ? 8 : 30);
    while (nk < nBars && t0 + B[4 * nk] < hz && B[4 * nk] < TOTAL) schedBar(nk++);
  };
};
