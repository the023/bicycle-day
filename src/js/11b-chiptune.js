// [[STYLE chiptune]]: 8-bit game music. 2 pulse channels (duty via saw - delayed saw), triangle bass, noise/sine drums, all on PERSISTENT oscillators
// (parameters are scheduled with setValueAtTime, no node per note). Everything is a pure function of (seed, bar), so seek just resumes at a bar.
STYLE_FN.chiptune = function (ctx) {
  const { t0, a, master, ts, nb, send, off, mtof, note } = ctx;
  const SP = mulberry32(Math.floor(seedUsed * 1000) * 7 + 12345);   // plan rng: independent of `rng`, which is reseeded on every seek
  const cc = (x, lo, hi) => Math.min(hi, Math.max(lo, x)), spick = arr => arr[Math.floor(SP() * arr.length)];
  // beat grid: the picture's BEATS (drums sit exactly on them), extended backwards to 0 and forwards past TOTAL with the nearest period
  const B = BEATS.length > 8 ? BEATS.slice() : (() => { const r = []; for (let s = 0; s < TOTAL; s += 60 / bpmAt(s / TOTAL)) r.push(s); return r; })();
  const p0 = B[1] - B[0], pl = B[B.length - 1] - B[B.length - 2];
  while (B[0] >= p0) B.unshift(B[0] - p0);
  while (B[B.length - 1] < TOTAL + 6) B.push(B[B.length - 1] + pl);
  const nBars = Math.floor((B.length - 1) / 4) - 1;
  const stT = (k, s) => { const bi = 4 * k + (s >> 2); return B[bi] + (s & 3) * (B[bi + 1] - B[bi]) / 4; };
  // — section plan (seeded): ~1 per 30-45 s, snapped to 4-bar boundaries
  const PROGS = [[0, 5, 2, 6], [0, 2, 3, 4], [0, 3, 6, 2], [0, 6, 5, 4], [5, 6, 0, 0], [0, 4, 5, 3], [0, 5, 3, 4]], SHIFTS = [5, 7, 2, -2, -5, 0];
  const BP = [   // bass patterns [step, 0 root / 1 octave / 2 fifth, length]
    [[0, 0, 2], [2, 0, 2], [4, 0, 2], [6, 1, 2], [8, 0, 2], [10, 0, 2], [12, 0, 2], [14, 1, 2]],
    [[0, 0, 3], [3, 0, 3], [6, 1, 2], [8, 0, 3], [11, 2, 3], [14, 1, 2]],
    [[0, 0, 4], [4, 2, 4], [8, 1, 4], [12, 2, 4]],
    Array.from({ length: 16 }, (_, s) => [s, [0, 0, 1, 0][s % 4], 1]),
    [[0, 0, 8], [8, 0, 8]]];
  const DR = [{ K: [0, 4, 8, 12], S: [4, 12], H: [2, 6, 10, 14] }, { K: [0, 8, 10], S: [4, 12], H: [0, 2, 4, 6, 8, 10, 12, 14] },
    { K: [0, 3, 8, 11], S: [4, 12], H: [0, 2, 4, 6, 8, 10, 12, 14] }, { K: [0, 10], S: [8], H: [0, 4, 8, 12] }];
  const RH = [[0, 3, 6, 8, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14], [0, 4, 6, 8, 12], [0, 3, 6, 10, 12, 14], [0, 2, 3, 6, 8, 11], [0, 6, 8, 12, 14], [0, 4, 8, 10, 12, 14], [0, 3, 4, 8, 11, 12]];
  const CTN = [0, 2, 4, 7], nearCT = o => CTN.reduce((b, c) => Math.abs(c - o) < Math.abs(b - o) ? c : b, 0);
  const genPhrase = r => {   // 4 bars of {s step, o degrees above the chord root, l steps}: A, A' (changed tail), B, cadence
    let o = [0, 2, 4][Math.floor(r() * 3)];
    const mk = (tm, cad) => tm.map((s, j) => { o = cc(o + [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)], 0, 7); if (s % 4 === 0 || j === 0) o = nearCT(o); const l = Math.min(6, (tm[j + 1] ?? 16) - s); return { s, o, l: cad && j === tm.length - 1 ? 4 : l }; });
    const tA = RH[Math.floor(r() * RH.length)], tB = RH[Math.floor(r() * RH.length)], tC = [[0, 4, 8, 12], [0, 2, 4, 8, 12], [0, 4, 6, 8, 12]][Math.floor(r() * 3)];
    const b1 = mk(tA), b2 = b1.map((e, j) => j >= b1.length - 2 ? { ...e, o: cc(e.o + (r() < .5 ? -2 : 2), 0, 7) } : { ...e }), b3 = mk(tB), b4 = mk(tC, true);
    b4[b4.length - 1].o = [0, 0, 4][Math.floor(r() * 3)];
    return [b1, b2, b3, b4];
  };
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
  window.CHIPPLAN = SEC.map(x => ({ kind: x.role, from: +x.tA.toFixed(1), to: +x.tB.toFixed(1) }));   // read by vplan(): the picture changes scene with the music's sections
  // T101 events: a section per entry; a fill on the last bar of every section but the last (the isFill bar of schedBar)
  evtSet(SEC.map((x, i) => evtSec(x.tA, x.role, planEnergy(window.CHIPPLAN[i]))).concat(SEC.slice(0, -1).map(x => ({ t: B[4 * (x.k1 - 1)], k: 'fill', s: .5, d: 0 }))));
  let prevSh = 0;
  for (const S of SEC) {
    const R = S.role, OFF = { intro: [-.35, .3], build: [-.15, .3], drop: [.15, 0], break: [-.4, .1], outro: [-.05, -.4] }[R];
    S.eOff = OFF[0]; S.eRamp = OFF[1]; S.seed = Math.floor(SP() * 1e6);
    let sh = S.i === 0 ? 0 : spick(SHIFTS.filter(x => x !== prevSh)); if (R === 'outro' && SP() < .6) sh = 0; S.shift = prevSh = sh;
    S.prog = spick(PROGS); S.half = R === 'drop' && SP() < .4;
    S.phrase = genPhrase(mulberry32(S.seed));
    S.arp = spick([[0, 1, 2, 1], [0, 1, 2, 3], [0, 2, 1, 2], [2, 1, 0, 1], [0, 1, 2]]);
    S.mask = spick([null, null, [1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0], [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1]]);
    S.bass = (R === 'intro' || R === 'break' || R === 'outro') ? spick([4, 4, 2]) : R === 'build' ? spick([0, 1, 2]) : spick([0, 1, 3]);
    S.drum = Math.floor(SP() * DR.length); S.dutyL = spick([.125, .25, .25, .5]); S.dutyA = spick([.125, .25, .25]);
  }
  window.__chipPlan = SEC.map(s => ({ i: s.i, role: s.role, bars: [s.k0, s.k1], t: [+s.tA.toFixed(1), +s.tB.toFixed(1)], shift: s.shift, prog: s.prog.join(''), half: s.half, bass: s.bass, drum: s.drum, arp: s.arp.join(''), dutyL: s.dutyL, dutyA: s.dutyA }));
  if (Q.has('debug')) console.log('CHIP plan', JSON.stringify(window.__chipPlan));
  // — persistent voices
  const END = t0 + TOTAL + 1, mkPulse = () => {   // pulse = saw - delayed saw (delay = duty / f); gain = envelope
    const o = a.createOscillator(), dl = a.createDelay(.03), ng = a.createGain(), g = a.createGain(); o.type = 'sawtooth'; ng.gain.value = -1; g.gain.value = 0;
    o.connect(g); o.connect(dl); dl.connect(ng); ng.connect(g); g.connect(master); o.start(ts); o.stop(END); return { o, dl, g: g.gain, node: g };
  };
  const lead = mkPulse(), arpC = mkPulse(), tri = a.createOscillator(), triG = a.createGain(), kO = a.createOscillator(), kG = a.createGain(), lfo = a.createOscillator(), vib = a.createGain();
  tri.type = 'triangle'; triG.gain.value = 0; tri.connect(triG); triG.connect(master); tri.start(ts); tri.stop(END);
  kO.type = 'sine'; kG.gain.value = 0; kO.connect(kG); kG.connect(master); kO.start(ts); kO.stop(END);
  lfo.frequency.value = 5.8; vib.gain.value = 0; lfo.connect(vib); vib.connect(lead.o.detune); lfo.start(ts); lfo.stop(END);
  const nsrc = a.createBufferSource(); nsrc.buffer = nb; nsrc.loop = true; nsrc.start(ts, 0); nsrc.stop(END);
  const hpH = a.createBiquadFilter(), hpC = a.createBiquadFilter(), bpS = a.createBiquadFilter(), hatG = a.createGain(), crG = a.createGain(), snG = a.createGain();
  hpH.type = hpC.type = 'highpass'; hpH.frequency.value = 7500; hpC.frequency.value = 4500; bpS.type = 'bandpass'; bpS.frequency.value = 1800; bpS.Q.value = .8;
  hatG.gain.value = crG.gain.value = snG.gain.value = 0;
  nsrc.connect(hpH); hpH.connect(hatG); nsrc.connect(hpC); hpC.connect(crG); nsrc.connect(bpS); bpS.connect(snG); hatG.connect(master); crG.connect(master); snG.connect(master);
  if (!MOBILE) send(lead.node, .05);
  // — note helpers (all events are scheduled in time order per parameter)
  const pnote = (ch, t, m, len, vol, duty, sus = .75, gate = .85) => {
    const f = mtof(m); ch.o.frequency.setValueAtTime(f, t); ch.dl.delayTime.setValueAtTime(Math.min(.029, duty / f), t);
    ch.g.setValueAtTime(vol, t); ch.g.setTargetAtTime(vol * sus, t + .01, .2); ch.g.setTargetAtTime(0, t + len * gate, .012);
  };
  const bnote = (t, m, len, vol) => { tri.frequency.setValueAtTime(mtof(m), t); triG.gain.setValueAtTime(vol, t); triG.gain.setTargetAtTime(0, t + len * .9, .012); };
  const kick = (t, v) => { kO.frequency.setValueAtTime(165, t); kO.frequency.setTargetAtTime(42, t + .002, .028); kG.gain.setValueAtTime(v, t); kG.gain.setTargetAtTime(0, t + .03, .045); };
  const snare = (t, v) => { bpS.frequency.setValueAtTime(3500, t); bpS.frequency.setTargetAtTime(1500, t, .04); snG.gain.setValueAtTime(v, t); snG.gain.setTargetAtTime(0, t + .01, .05); };
  const hat = (t, v) => { hatG.gain.setValueAtTime(v, t); hatG.gain.setTargetAtTime(0, t + .004, .018); };
  const crash = (t, v) => { crG.gain.setValueAtTime(v, t); crG.gain.setTargetAtTime(0, t + .01, .3); };
  const secAt = k => SEC.find(s => k >= s.k0 && k < s.k1) || SEC[SEC.length - 1];
  const fold = (i, top) => { while (i > top) i -= 7; return i; };
  // d = the bar's density (what switches the layers on, see schedBar); T146: also the chart's level (CHLV, data only)
  const dBar = (S, tbar) => cc(Math.max(.14, energy(tbar / TOTAL) * .7 + .2 + S.eOff + S.eRamp * cc((tbar - S.tA) / Math.max(1, S.tB - S.tA), 0, 1)), 0, 1);
  lvlSet(Array.from({ length: nBars }, (_, k) => [B[4 * k], dBar(secAt(k), B[4 * k])]).concat([[TOTAL, dBar(SEC[SEC.length - 1], TOTAL)]]));
  const schedBar = k => {
    const S = secAt(k), lb = k - S.k0, nb = S.k1 - S.k0, br = mulberry32(S.seed * 131 + lb * 17 + 5), tbar = B[4 * k];
    const d = dBar(S, tbar), vs = .4 + .75 * d, role = S.role, brk = role === 'break';
    const isFill = lb === nb - 1 && S !== SEC[SEC.length - 1], minorFill = !isFill && lb % 4 === 3 && d > .5;
    const rep = Math.floor(lb / 4), bi = lb % 4, dr = DR[S.drum], bp = BP[S.bass];
    const chordAt = s => S.prog[(S.half ? lb * 2 + (s >> 3) : lb) % 4];
    let ev = S.phrase[bi].map(e => ({ ...e }));
    for (const e of ev) { if (rep >= 2 && br() < .3) e.o = cc(e.o + (br() < .5 ? -1 : 1), 0, 7); if (rep % 2 === 1 && bi === 2) e.o = cc(e.o + (br() < .5 ? -2 : 2), 0, 7); if (rep % 4 === 3 && bi >= 2) e.o += 7; }
    const leadOn = d > (brk ? .2 : .3) && !(rep % 4 === 3 && bi >= 2 && br() < .5);
    if (brk) ev = ev.filter(e => e.s % 4 === 0).map(e => ({ ...e, l: Math.min(8, e.l * 1.5) }));
    const sub = !MOBILE && d > .75 && role === 'drop' ? 2 : 1;
    for (let s = 0; s < 16; s++) {
      const t = t0 + stT(k, s), tn = t0 + stT(k, s + 1), sl = tn - t, cr = chordAt(s), fill = isFill && s >= 8;
      if (t < Math.max(ts, a.currentTime) - .01) continue;
      // drums
      if (lb === 0 && S.i > 0 && s === 0) { crash(t, .13); snare(t, .2); }
      if (d > .38 && !brk && !fill && (d > .7 ? dr.K : dr.K.filter(x => x % 8 === 0)).includes(s)) kick(t, .5 * (.8 + .2 * d));
      if (d > .45 && !brk && !fill && dr.S.includes(s)) snare(t, .2 * vs);
      if (fill) { if (s === 8 || s === 10 || s >= 12) snare(t, .12 + .16 * (s - 8) / 7); if (s === 8 || s === 12) kick(t, .4); }
      else if (minorFill && s >= 14) snare(t, .14);
      if (d > .3 && !fill) { if (d > .7 && !brk) hat(t, s % 2 ? .035 : .06); else if (dr.H.includes(s) && (!brk || s % 4 === 0)) hat(t, brk ? .035 : .055); }
      else if (brk && s % 4 === 0) hat(t, .03);
      // bass
      if (d > .12) { const b = bp.find(x => x[0] === s); if (b && !(isFill && s >= 14)) bnote(t, note(b[1] === 1 ? cr : cr - 7 + (b[1] === 2 ? 4 : 0)) + S.shift, b[2] * sl, .3 * vs); }
      // arpeggio (or the riser before a section change)
      if (fill) { for (let j = 0; j < sub; j++) { const m = note(7 + cr) + S.shift + 12 + (s - 8) * 2 + j; pnote(arpC, t + j * sl / sub, m, sl / sub, .05 + .09 * (s - 8) / 7, .25, 1, .9); } }
      else if (d > .08 && (!S.mask || S.mask[s])) {
        if (!(brk && s % 2)) for (let j = 0; j < sub; j++) {   // slower arp in breaks
          const tone = S.arp[(s * sub + j) % S.arp.length], idx = fold(7 + cr + CTN[tone], 14);
          pnote(arpC, t + j * sl / sub, note(idx) + S.shift, (brk ? 2 : 1) * sl / sub, .075 * vs, cc(S.dutyA + .06 * Math.sin(t * 1.7), .08, .5), .8, .8);
        }
      }
      // lead
      if (leadOn && !fill) for (const e of ev) if (e.s === s) {
        const len = stT(k, Math.min(16, e.s + e.l)) - stT(k, e.s), idx = fold(9 + cr + e.o, 18);
        pnote(lead, t, note(idx) + S.shift, len, .13 * vs, cc(S.dutyL + .1 * Math.sin(t * .9), .1, .5), .8, .88);
        vib.gain.setValueAtTime(0, t); if (len > .15) vib.gain.setValueAtTime(brk ? 22 : 13, t + .1);
      }
    }
  };
  let nk = 0; while (nk < nBars - 1 && B[4 * (nk + 1)] <= off) nk++;
  return function pump() {
    const hz = a.currentTime + (MOBILE ? 8 : 30);
    while (nk < nBars && t0 + B[4 * nk] < hz && B[4 * nk] < TOTAL) schedBar(nk++);
  };
};
