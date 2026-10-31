// [[STYLE lofi]] (T23): lo-fi / trip-hop, kept small. 70-90 BPM, swung 16ths. Sections intro (chords + crackle) / groove (drums in) / break (drums out) / outro; energy = drums on/off + filter brightness.
// Rhodes-like 7th / rootless 9th chords (4-bar loop per section from MT.prog, voice-led in C3-E4) and a round bass on the roots, both on PERSISTENT oscillators re-articulated by automation;
// tape wobble = two slow LFOs on the chord/motif detune; dusty drums = short per-note nodes under a voice budget; vinyl crackle + hiss = one looped buffer. The whole plan is drawn from the seed (seek just resumes it).
STYLE_FN.lofi = function (ctx) {
  const { a, master, send, ts, off, t0, mtof, noise } = ctx;
  const sr = mulberry32((seedUsed * 2654435761 + 7331) | 0), r = () => sr(), pk2 = arr => arr[Math.floor(r() * arr.length)], rr = (x, y) => x + (y - x) * r();
  const mode = pk2(['dorian', 'dorian', 'aeolian', 'mixolydian']), tonic = 50 + Math.floor(r() * 6);   // D3..G3
  const bpm = rr(70, 90), SP = 60 / bpm / 4, BAR = 16 * SP, swing = rr(.56, .63), T0 = .4;   // swing: where the off 16th falls inside a pair of 16ths (.5 = straight)
  const stT = (b, s) => T0 + b * BAR + (Math.floor(s / 2) * 2 + (s % 2 ? 2 * swing : 0)) * SP;
  // — sections (bars): intro, then groove / break alternating (always ending on a groove), outro
  const NB = Math.max(12, Math.floor((TOTAL - 4) / BAR)), short = NB < 40, oL = short ? 4 : 8, SEC = []; let b = 0;
  const add = (kind, n) => { SEC.push({ kind, b0: b, b1: b + n }); b += n; };
  add('intro', short ? 4 : 8);
  for (let k = 0; NB - oL - b >= 4; k++) {
    const left = NB - oL - b, gr = !(k % 2); let n = gr ? pk2([12, 16, 16]) : pk2([4, 8, 8]);
    if (gr && left - n < 12) n = left; else if (!gr && left - n < 8) { SEC[SEC.length - 1].b1 += left; b += left; break; }   // the last middle section is a groove that takes the rest
    add(gr ? 'groove' : 'break', n);
  }
  add('outro', NB - b);
  const E = { intro: .25, groove: .7, break: .35, outro: .2 };
  let gi = 0;
  SEC.forEach((s, i) => {
    s.prog = s.kind === 'outro' ? SEC[0].prog : MT.prog(r, mode).slice(0, 4); s.ext = r() < .65;   // ext = rootless 3-5-7-9 voicing, else 1-3-5-7
    s.e = E[s.kind] + (s.kind === 'groove' ? .06 * Math.min(gi++, 2) : 0); s.cut = s.kind === 'groove' ? rr(1700, 2300) : s.kind === 'break' ? rr(1000, 1300) : rr(750, 950);
    s.comp = s.kind === 'groove' ? pk2([[[0, 1]], [[0, 1], [10, .5]], [[0, .9], [7, .45]], [[0, .9], [14, .75, 1]]]) : s.kind === 'break' ? pk2([[[0, 1]], [[0, .9], [10, .45]]]) : [[0, .85]];
    s.dr = { K: pk2([[0, 10], [0, 7, 10], [0, 3, 10], [0, 10, 11]]), rim: r() < .4, gh: r() < .6, x16: rr(.1, .35) };
    s.motif = s.kind === 'groove' && (gi > 1 || r() < .4) ? MT.motif(r, -2, 6) : null;
    s.t0 = i ? stT(s.b0, 0) : 0; s.t1 = i < SEC.length - 1 ? stT(s.b1, 0) : TOTAL;
  });
  const secOf = bar => SEC.find(s => bar < s.b1) || SEC[SEC.length - 1], rootDeg = bar => { const s = secOf(bar); return s.prog[(bar - s.b0) % 4]; };
  window.LOFIPLAN = SEC.map(s => ({ kind: s.kind, from: +s.t0.toFixed(1), to: +s.t1.toFixed(1), e: +s.e.toFixed(2), bars: s.b1 - s.b0, prog: s.prog.join(''), bpm: Math.round(bpm), mode, tonic }));   // read by vplan()
  {   // T101 events: a section per plan entry, a phrase every 8 bars inside a section
    const L = SEC.map(s => evtSec(s.t0, s.kind, s.e));
    SEC.forEach(s => { for (let q = s.b0 + 8; q < s.b1; q += 8) L.push({ t: stT(q, 0), k: 'phrase', s: .3, d: 0 }); });
    evtSet(L);
  }
  // — chords: voice-led 4-note voicings in MIDI 48..64 (every combination of octave choices, least total movement, no semitone clash below E3)
  const VO = []; let prev = [52, 55, 59, 62];
  for (let q = 0; q < NB; q++) {
    const s = secOf(q), cr = rootDeg(q), pcs = (s.ext ? [2, 4, 6, 8] : [0, 2, 4, 6]).map(d => (tonic + MT.st(mode, cr + d)) % 12);
    let best = null, bc = 1e9;
    for (let m = 0; m < 16; m++) {
      const v = pcs.map((pc, j) => { let n = 48 + ((pc - 48) % 12 + 12) % 12; if (m >> j & 1 && n + 12 <= 64) n += 12; return n; }).sort((x, y) => x - y);
      let c = v.reduce((z, n, j) => z + Math.abs(n - prev[j]), 0); for (let j = 1; j < 4; j++) if (v[j] - v[j - 1] < 2 && v[j] < 52) c += 6;
      if (new Set(v).size < 4) c += 20; if (c < bc) { bc = c; best = v; }
    }
    VO.push(best); prev = best;
  }
  const bassN = deg => { let n = tonic + MT.st(mode, deg); while (n > 44) n -= 12; while (n < 33) n += 12; return n; };   // G1..F#3 incl. the fifth and approach notes
  // — event lists (song time): CH chord hits, BS bass notes, MO motif notes, DR drum hits; all random draws happen here, in a fixed order
  const CH = [], BS = [], MO = [], DR = [], jt = () => (r() + r() - 1) * .004; let pushed = false;
  for (let q = 0; q < NB; q++) {
    const s = secOf(q), qi = q - s.b0, last = q === s.b1 - 1, K = s.kind, nextS = secOf(q + 1);
    for (const [st, v, nx] of s.comp) {
      if (st === 0 && pushed) { pushed = false; continue; }
      if (nx && (q + 1 >= NB || nextS !== s && nextS.kind === 'outro')) continue;
      CH.push({ t: stT(q, st) + jt(), n: VO[nx ? q + 1 : q], v: v * rr(.85, 1) * (K === 'intro' ? .8 + .2 * qi / (s.b1 - s.b0) : 1), tau: q === NB - 1 ? 5 : 1.7 });
      if (nx) pushed = true;
    }
    const rn = bassN(rootDeg(q)), nn = bassN(rootDeg(Math.min(q + 1, NB - 1)));
    if (K === 'groove') {
      BS.push({ t: stT(q, 0), n: rn, v: 1, l: 9 * SP });
      if (r() < .7) BS.push({ t: stT(q, 10), n: r() < .5 ? rn : rn + 7, v: .75, l: 3 * SP });
      if (r() < .5 && nn !== rn) BS.push({ t: stT(q, 14), n: nn + pk2([-1, 1, 2]), v: .6, l: 1.6 * SP });
    } else if (K === 'break' || K === 'outro' && qi < 2) BS.push({ t: stT(q, 0), n: rn, v: .8, l: 14 * SP });
    if (K === 'groove') {
      const D = s.dr, fill = last && nextS !== s;
      for (const st of D.K) if (!(fill && st >= 8)) DR.push({ t: stT(q, st) + jt(), k: 'k', v: (st ? .8 : 1) * rr(.88, 1) });
      for (const st of [4, 12]) DR.push({ t: stT(q, st) + jt(), k: D.rim ? 'r' : 's', v: rr(.85, 1) });
      if (D.gh && r() < .5) DR.push({ t: stT(q, pk2([7, 15, 9])) + jt(), k: 's', v: .22 });
      if (fill) [14, 15].forEach(st => DR.push({ t: stT(q, st) + jt(), k: 's', v: st === 15 ? .7 : .45 }));
      for (let st = 0; st < 16; st++) {
        if (st % 2 === 0) DR.push({ t: stT(q, st) + jt(), k: st === 14 && qi % 4 === 3 ? 'o' : 'h', v: (st % 4 ? .5 : .7) * rr(.7, 1) });
        else if (r() < D.x16) DR.push({ t: stT(q, st) + jt(), k: 'h', v: .3 * rr(.7, 1) });
      }
      if (s.motif && qi >= (s.b1 - s.b0) / 2 && qi % 2) {   // second half of the groove: a one-bar answer in bars 2 and 4 of the loop (varied the second time), notes fitted to the chord on strong steps
        const m = qi % 4 === 3 ? MT.vary(r, s.motif, 'tail') : s.motif, cr = rootDeg(q);
        for (const e of m) MO.push({ t: stT(q, e.s) + jt(), n: tonic + 12 + MT.st(mode, e.s % 4 ? e.d : MT.fit(e.d, cr, 1)), l: Math.min(e.l, 4) * SP, v: rr(.75, 1) });
      }
    } else if (K === 'break' && last && nextS.kind === 'groove') DR.push({ t: stT(q, 15) + jt(), k: 's', v: .35 });   // pickup into the drums
  }
  const after = L => L.filter(e => e.t >= off && e.t < TOTAL - .3);
  // — buses: chords -> lowpass (section brightness) -> slow stereo tremolo; bass -> lowpass; drums -> soft clip -> dusty lowpass; hats -> highpass
  const G = (v, dest) => { const g = a.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
  const OS = (type, f) => { const o = a.createOscillator(); o.type = type; o.frequency.value = f; o.start(ts); o.stop(t0 + TOTAL + .5); return o; };
  const secAt = t => SEC.find(s => t < s.t1) || SEC[SEC.length - 1];
  const sched = (param, fn, tc) => { param.setValueAtTime(fn(secAt(off)), ts); SEC.forEach(s => { if (s.t0 > off) param.setTargetAtTime(fn(s), t0 + s.t0, tc); }); };
  const pan = a.createStereoPanner(), chLp = a.createBiquadFilter(), chOut = G(1); chLp.type = 'lowpass'; chLp.Q.value = .5; chLp.connect(chOut); chOut.connect(pan); pan.connect(master); send(pan, .38, .06);
  sched(chLp.frequency, s => s.cut, 1.5);
  const trem = OS('sine', bpm / 60 / 4), trg = G(.3, pan.pan); trem.connect(trg);   // one pan swing per bar
  const wob1 = OS('sine', rr(.35, .55)), wob2 = OS('sine', rr(.07, .12)), wg1 = G(5), wg2 = G(9); wob1.connect(wg1); wob2.connect(wg2);   // tape wobble (cents)
  const wob = o => { wg1.connect(o.detune); wg2.connect(o.detune); };
  const mtf = n => mtof(n);
  const VOX = [0, 1, 2, 3].map(() => {   // one Rhodes-like voice: fundamental + soft octave + a short 'tine' partial
    const o1 = OS('sine', 220), o2 = OS('sine', 440), o3 = OS('sine', 660), g = G(0, chLp), gb = G(0, chLp), g2 = G(.16, gb), g3 = G(.22, gb);
    o1.connect(g); o2.connect(g2); o3.connect(g3); [o1, o2, o3].forEach(wob); return { o1, o2, o3, g, gb };
  });
  for (const h of after(CH)) {
    const tt = t0 + h.t;
    VOX.forEach((x, j) => {
      const f = mtf(h.n[j]), A = .055 * h.v * (j ? 1 : 1.15);
      x.g.gain.setTargetAtTime(0, tt - .03, .008); x.gb.gain.setTargetAtTime(0, tt - .03, .008);
      x.o1.frequency.setValueAtTime(f, tt); x.o2.frequency.setValueAtTime(2 * f, tt); x.o3.frequency.setValueAtTime(3 * f, tt);
      x.g.gain.setValueAtTime(0, tt); x.g.gain.linearRampToValueAtTime(A, tt + .012); x.g.gain.setTargetAtTime(0, tt + .012, h.tau);
      x.gb.gain.setValueAtTime(0, tt); x.gb.gain.linearRampToValueAtTime(A * 1.6, tt + .006); x.gb.gain.setTargetAtTime(0, tt + .006, .22);
    });
  }
  const bLp = a.createBiquadFilter(), bOut = G(1, master); bLp.type = 'lowpass'; bLp.frequency.value = 420; bLp.Q.value = .7; bLp.connect(bOut);
  const b1 = OS('sine', 55), b2 = OS('triangle', 55), bg = G(0, bLp), b2g = G(.18, bg); b1.connect(bg); b2.connect(b2g);
  for (const n of after(BS)) {
    const tt = t0 + n.t, f = mtf(n.n);
    b1.frequency.setTargetAtTime(f, tt, .01); b2.frequency.setTargetAtTime(f, tt, .01);
    bg.gain.setTargetAtTime(.32 * n.v, tt, .006); bg.gain.setTargetAtTime(.2 * n.v, tt + .06, .35); bg.gain.setTargetAtTime(0, tt + n.l, .05);
  }
  const mLp = a.createBiquadFilter(), mOut = G(1, master); mLp.type = 'lowpass'; mLp.frequency.value = 1500; mLp.connect(mOut); send(mOut, .3, .22);
  const mo = OS('triangle', 440), mg = G(0, mLp); mo.connect(mg); wob(mo);
  for (const n of after(MO)) {
    const tt = t0 + n.t;
    mg.gain.setTargetAtTime(0, tt - .02, .006); mo.frequency.setValueAtTime(mtf(n.n), tt);
    mg.gain.setValueAtTime(0, tt); mg.gain.linearRampToValueAtTime(.06 * n.v, tt + .01); mg.gain.setTargetAtTime(.025 * n.v, tt + .01, .2); mg.gain.setTargetAtTime(0, tt + n.l, .06);
  }
  // vinyl: sparse clicks (power-law sizes) + faint hiss, one 7 s looped buffer through a highpass
  const vb = a.createBuffer(1, Math.round(a.sampleRate * 7), a.sampleRate), vd = vb.getChannelData(0);
  for (let i = 0; i < vd.length; i++) vd[i] = (r() * 2 - 1) * .012;
  for (let c = 0, n = Math.round(7 * rr(10, 16)); c < n; c++) { const p = Math.floor(r() * (vd.length - 40)), A = Math.pow(r(), 3) * .9 + .05, sg = r() < .5 ? -1 : 1; for (let k = 0; k < 30; k++) vd[p + k] += sg * A * Math.exp(-k / 4) * (k % 2 ? -.6 : 1); }
  const vs = a.createBufferSource(), vhp = a.createBiquadFilter(), vg = G(0, master); vs.buffer = vb; vs.loop = true; vhp.type = 'highpass'; vhp.frequency.value = 1100; vs.connect(vhp); vhp.connect(vg);
  vs.start(ts, off % 7); vs.stop(t0 + TOTAL + .5); sched(vg.gain, s => s.kind === 'groove' ? .11 : .17, 1);
  // drums: per-note nodes; budget = live sources counted by end time (hats are dropped first)
  const ws = a.createWaveShaper(), dcv = new Float32Array(512); for (let i = 0; i < 512; i++) dcv[i] = Math.tanh((i / 256 - 1) * 1.8) / Math.tanh(1.8);
  const dIn = G(1), dLp = a.createBiquadFilter(), dOut = G(1, master); ws.curve = dcv; dLp.type = 'lowpass'; dLp.frequency.value = 4200; dIn.connect(ws); ws.connect(dLp); dLp.connect(dOut); send(dOut, .1, 0);
  const hHp = a.createBiquadFilter(), hPan = a.createStereoPanner(), hOut = G(.5); hHp.type = 'highpass'; hHp.frequency.value = 6500; hPan.pan.value = .22; hHp.connect(hOut); hOut.connect(hPan); hPan.connect(master); send(hPan, .08, 0);
  const CAP = MOBILE ? 8 : 16, live = [], room = (tt, n, pri) => { for (let i = live.length; i--;) if (live[i] < tt) live.splice(i, 1); if (live.length + n > CAP - (pri ? 0 : 4)) return false; return true; };
  const dHit = (tt, k, v) => {
    if (k === 'k') {
      if (!room(tt, 1, 1)) return; const o = a.createOscillator(), g = G(0, dIn); o.frequency.setValueAtTime(115, tt); o.frequency.exponentialRampToValueAtTime(46, tt + .08);
      g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime(.75 * v, tt + .004); g.gain.exponentialRampToValueAtTime(.0001, tt + .42); o.connect(g); o.start(tt); o.stop(tt + .45); live.push(tt + .45);
    } else if (k === 's' || k === 'r') {
      if (!room(tt, 2, 1)) return; const rim = k === 'r', n = noise(tt, rim ? .08 : .25), bp = a.createBiquadFilter(), g = G(0, dIn), o = a.createOscillator(), og = G(0, dIn);
      bp.type = 'bandpass'; bp.frequency.value = rim ? 2600 : 1700; bp.Q.value = rim ? 2 : .7; n.connect(bp); bp.connect(g);
      g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime((rim ? .22 : .32) * v, tt + .003); g.gain.exponentialRampToValueAtTime(.0001, tt + (rim ? .06 : .2));
      o.type = rim ? 'triangle' : 'sine'; o.frequency.setValueAtTime(rim ? 820 : 190, tt); o.frequency.exponentialRampToValueAtTime(rim ? 760 : 165, tt + .05);
      og.gain.setValueAtTime(.0001, tt); og.gain.exponentialRampToValueAtTime((rim ? .16 : .2) * v, tt + .003); og.gain.exponentialRampToValueAtTime(.0001, tt + (rim ? .04 : .11)); o.connect(og); o.start(tt); o.stop(tt + .14);
      send(g, rim ? .15 : .22, 0); live.push(tt + .25, tt + .14);
    } else {
      const d = k === 'o' ? .28 : .045; if (!room(tt, 1, 0)) return; const n = noise(tt, d + .02), g = G(0, hHp);
      g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime(.2 * v, tt + .002); g.gain.exponentialRampToValueAtTime(.0001, tt + d); n.connect(g); live.push(tt + d + .02);
    }
  };
  const DQ = after(DR).sort((x, y) => x.t - y.t); let di = 0;
  return function pump() {
    const hz = a.currentTime + (MOBILE ? 8 : 30);
    while (di < DQ.length && t0 + DQ[di].t < hz) { const e = DQ[di++], tt = t0 + e.t; if (tt >= a.currentTime - .02) dHit(Math.max(tt, a.currentTime + .003), e.k, e.v); }
  };
};
