// [[STYLE gamelan]]: tuned bronze percussion. Seeded tuning (pelog-like 5 of 7 unequal degrees, or slendro-like 5 near-equal), colotomic cycle (gong ageng at the cycle end, kenong / kempul / kethuk),
// balungan core melody on demung + saron, fast interlocking polos/sangsih (imbal) in dense sections, gender in calm ones. The whole piece is a sorted event list built from the seed (like the piano: seek just resumes it).
// Metal = sine partial stacks (inharmonic ratios, own decay per partial) + a short noise strike; paired instruments are detuned by a few Hz (ombak beating); each hit has its own velocity, tiny timing jitter and round-robin detune.
STYLE_FN.gamelan = function (ctx) {
  const { mtof, a, master, send, noise, off, t0 } = ctx;
  const sr = mulberry32((seedUsed * 2654435761 + 4129) | 0), r = () => sr(), pk2 = arr => arr[Math.floor(r() * arr.length)], rr = (x, y) => x + (y - x) * r(), cc = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  // — tuning (cents of the 5 degrees; octave slightly stretched)
  const slendro = r() < .5, OCT = 1200 + rr(0, 8);
  let SCc;
  if (slendro) SCc = [0, 1, 2, 3, 4].map(i => i * 240 + (i ? rr(-14, 14) : 0));
  else { const P7 = [0, 120, 270, 540, 670, 785, 950].map((c, i) => c + (i ? rr(-10, 10) : 0)), ix = pk2([[0, 1, 2, 4, 5], [1, 2, 3, 5, 6], [0, 1, 3, 4, 6]]); SCc = ix.map(i => P7[i] - P7[ix[0]]); }
  const baseF = mtof(rr(55.5, 61.5)), omb = rr(.85, 1.2);   // omb: seed's overall ombak (beating) speed
  const fq = (d, oc = 0) => { const o = Math.floor(d / 5); return baseF * Math.pow(2, (SCc[d - 5 * o] + OCT * (o + oc)) / 1200); };
  // — sections: intro (slow, sparse) / build / drop (dense, fast) / break (calm) / outro (thinning); each lasts whole colotomic cycles of CL balungan beats
  const NS = cc(Math.round(TOTAL / 50), 3, 14), CL = TOTAL < 150 ? 8 : 16, KIND = ['intro'];
  if (NS >= 4) KIND.push('build');
  for (let j = 0, m = NS - KIND.length - 1; j < m; j++) KIND.push(j % 2 ? 'break' : 'drop');
  KIND.push('outro');
  const KP = { intro: { bpm: [60, 66], w: .8, kv: .85 }, build: { bpm: [68, 76], w: 1, kv: .92 }, drop: { bpm: [82, 96], w: 1.3, kv: 1 }, break: { bpm: [62, 70], w: .9, kv: .8 }, outro: { bpm: [58, 64], w: .9, kv: .8 } };
  const SEC = KIND.map((k, i) => ({ i, kind: k, bpm: rr(KP[k].bpm[0], KP[k].bpm[1]), w: KP[k].w * rr(.9, 1.15) })), wS = SEC.reduce((x, s) => x + s.w, 0), BT = []; let R = 0;
  for (const s of SEC) {
    const bt = 60 / s.bpm; s.n = Math.max(1, Math.round(TOTAL * s.w / wS / (CL * bt))); s.b0 = BT.length;
    for (let c = 0; c < s.n; c++) for (let idx = 0; idx < CL; idx++) {
      const rit = c === s.n - 1 ? (s.kind === 'outro' ? .45 : s.kind === 'break' || s.kind === 'build' ? .12 : 0) : 0, d = bt * (1 + rit * (idx / CL) ** 2);   // last cycle of some sections slows down
      BT.push({ s: s.i, c, idx, d }); R += d;
    }
    s.b1 = BT.length;
  }
  const T0 = .35, fs = (TOTAL - 1.5 - T0) / R; let tc = T0;   // scale all beats so the last gong lands ~1.5 s before the end (tempo stays near the table)
  for (const b of BT) { b.d *= fs; b.t = tc; tc += b.d; }
  window.GAMELANPLAN = SEC.map(s => ({ kind: s.kind, from: s.i ? +BT[s.b0].t.toFixed(1) : 0, to: +(s.i < NS - 1 ? BT[SEC[s.i + 1].b0].t : TOTAL).toFixed(1), bpm: Math.round(s.bpm / fs), cycles: s.n, tuning: slendro ? 'slendro' : 'pelog' }));   // read by vplan()
  // — instruments: P = [partial ratio, amplitude, decay factor]; D = decay of the fundamental (s); tw = ombak beat in Hz at baseF (scaled with pitch); A = level.
  //   mobile: dm = decay scale, pm = partial count, twm = keep the beating twin, nzm = keep the noise strike; res = voices kept free for the bed (gongs, balungan)
  const BAR = [[1, 1, 1], [2.756, .5, .4], [5.404, .22, .18]], KET = [[1, 1, 1], [1.58, .35, .45], [2.35, .18, .3]], MOB = MOBILE;
  const INS = {
    gong: { P: [[1, 1, 1], [2.01, .6, .75], [2.97, .35, .5], [4.2, .2, .3]], D: 9, dm: .66, pm: 3, tw: .5, twm: 1, A: .24, atk: .008, nz: .5, nzm: 1, bus: 'gong', res: -2 },
    kenong: { P: [[1, 1, 1], [2.4, .4, .5], [3.1, .15, .3]], D: 2.8, dm: .6, pm: 2, tw: 1.5, twm: 0, A: .17, atk: .004, nz: .3, nzm: 0, bus: 'kgong', res: 0 },
    kempul: { P: [[1, 1, 1], [2.02, .45, .6], [3.4, .2, .3]], D: 3.2, dm: .6, pm: 2, tw: 1, twm: 0, A: .15, atk: .005, nz: .3, nzm: 0, bus: 'kgong', res: 1 },
    kethuk: { P: [[1, 1, 1], [2.7, .5, .5]], D: .24, dm: 1, pm: 1, tw: 0, twm: 0, A: .13, atk: .001, nz: .9, nzm: 1, bus: 'kethuk', res: 2 },
    demung: { P: BAR, D: 2.4, dm: .5, pm: 1, tw: 3.6, twm: 1, A: .24, atk: .002, nz: .4, nzm: 0, bus: 'demung', res: 0 },
    saron: { P: BAR, D: 1.3, dm: .6, pm: 2, tw: 5.6, twm: 1, A: .17, atk: .002, nz: .4, nzm: 0, bus: 'saron', res: 1 },
    peking: { P: BAR, D: .6, dm: .6, pm: 1, tw: 0, twm: 0, A: .1, atk: .0015, nz: .4, nzm: 0, bus: 'peking', res: 4 },
    bonang: { P: KET, D: .95, dm: .6, pm: 2, tw: 4.4, twm: 0, A: .13, atk: .002, nz: .35, nzm: 0, bus: 'bonang', res: 3 },
    pol: { P: KET, D: .55, dm: .6, pm: 2, tw: 4.4, twm: 0, A: .1, atk: .0015, nz: .3, nzm: 0, bus: 'pol', res: 3 },
    san: { P: KET, D: .55, dm: .6, pm: 2, tw: 4.4, twm: 0, A: .1, atk: .0015, nz: .3, nzm: 0, bus: 'san', res: 3 },
    gender: { P: [[1, 1, 1], [2.76, .08, .15], [5.4, .03, .08]], D: 3.4, dm: .55, pm: 1, tw: 2.4, twm: 1, A: .15, atk: .003, nz: .15, nzm: 0, bus: 'gender', res: 1 } };
  // — event list (pure function of the seed): every random draw happens here, in a fixed order
  const MASKS = [[[1, 0, 1, 0], [0, 1, 0, 1]], [[1, 0, 0, 1], [0, 1, 1, 0]], [[1, 0, 1, 1], [0, 1, 0, 0]], [[0, 1, 1, 0], [1, 0, 0, 1]]], EV = [], PHR = [], dd = x => cc(x, 0, 5); let V = 1;
  const hit = (i, tt, d, oc, v, jit = .006) => EV.push({ t: Math.max(.05, tt + (r() + r() - 1) * jit), i, f: fq(d, oc), v: cc(v * V * rr(.8, 1.1), .03, 1), c: rr(-3, 3) });
  SEC.forEach(s => {
    const K = s.kind, G = CL / 4, ends = [], base = [];
    s.g = s.i === 0 ? pk2([0, 2, 4]) : K === 'outro' ? SEC[0].g : pk2([0, 1, 2, 3, 4]);   // the gong tone of the section
    for (let gi = 0; gi < G; gi++) { let e = gi === G - 1 ? s.g : pk2([0, 1, 2, 3, 4]); if (gi && gi < G - 1 && e === ends[gi - 1]) e = (e + 2) % 5; ends.push(e); }
    let prev = pk2([0, 1, 2, 3, 4]);
    for (let gi = 0; gi < G; gi++) { const x1 = dd(prev + pk2([-2, -1, 0, 1, 2])), x2 = dd(x1 + pk2([-2, -1, 1, 2])), x3 = dd(ends[gi] + pk2([-1, 1])); base.push(x1, x2, x3, ends[gi]); prev = ends[gi]; }
    const ib = pk2(MASKS), st = pk2([1, -1, 2]), kv = KP[K].kv;
    for (let c = 0; c < s.n; c++) {
      const pc = base.map((d, k) => k % 4 === 3 || r() > .2 ? d : dd(d + pk2([-1, 1])));
      for (let idx = 0; idx < CL; idx++) {
        const b = BT[s.b0 + c * CL + idx], t = b.t, d = b.d, p = pc[idx], pn = pc[(idx + 1) % CL], pos = (c * CL + idx) / (s.n * CL), acc = idx % 4 === 3 ? 1 : idx % 2 ? .8 : .88;
        V = kv * (K === 'build' ? .75 + .25 * pos : K === 'outro' ? 1 - .55 * pos : 1);
        const thin = K !== 'outro' || r() < 1 - .8 * pos;
        // colotomic layer
        if (idx === CL - 1) { hit('gong', t, s.g, -2, 1, 0); PHR.push({ t: EV[EV.length - 1].t, s: kv }); }   // cycle end (T101 phrase; t = the jittered time the hit plays at)
        if (idx % 4 === 3) hit('kenong', t, p, 0, K === 'drop' ? .8 : .65, .004);
        if (idx % 4 === 1 && idx > 1 && (K === 'build' || K === 'drop')) hit('kempul', t, pc[idx + 2], -1, .55, .004);
        if ((K === 'build' || K === 'drop') && idx % 4 === 2) hit('kethuk', t, 0, 2, .5, .004);
        if (K === 'drop' && idx % 2) hit('kethuk', t + d / 2, 0, 2, .22, .004);
        // melody / elaboration layers
        if (K === 'intro') {
          if (idx % 2) hit('demung', t, p, 0, .55 * acc, .01);
          if (idx % 4 === 3 || idx % 4 === 1) { hit('gender', t + d * .04, p, 0, .38, .01); if (idx % 4 === 3) hit('gender', t + d * .5, dd(p + pk2([1, 2])), 1, .28, .01); }
        } else if (K === 'build') {
          hit('demung', t, p, 0, .6 * acc, .008); hit('saron', t, p, 1, .5 * acc, .006);
          hit('bonang', t, p, 1, .36 * acc, .008); hit('bonang', t + d / 2, dd(p + pk2([1, 2])), 1, .3, .01);
        } else if (K === 'drop') {
          hit('demung', t, p, 0, .65 * acc, .007); hit('saron', t, p, 1, .55 * acc, .005);
          hit('peking', t, p, 2, .34 * acc, .005); hit('peking', t + d / 2, p, 2, .28, .006);
          for (let sl = 0; sl < 4; sl++) {   // imbal: polos and sangsih play complementary slots; sangsih leans on a neighbour and anticipates the next balungan note
            const who = ib[0][sl] ? 'pol' : 'san', dg = who === 'pol' ? p : (sl === 3 && pn !== p ? pn : dd(p + st) === p ? dd(p - st) : dd(p + st));
            hit(who, t + sl * d / 4, dg, 2, (sl === 0 ? .42 : .32) * acc, .007);
          }
        } else if (K === 'break') {
          hit('gender', t, p, 0, .42 * acc, .01); hit('gender', t + d * .03, p, 1, .3, .01); hit('gender', t + d / 2, dd(p + pk2([-1, 1, 2])), 1, .3, .012);
          if (idx % 2) hit('demung', t, p, 0, .4, .01);
        } else {   // outro: thinning
          if (idx % 2 && thin) hit('demung', t, p, 0, .55 * acc, .01);
          if (idx % 4 === 3 && thin) hit('saron', t, p, 1, .4, .008);
          if (idx % 4 === 1 && thin) hit('gender', t, p, 0, .32, .01);
        }
      }
    }
  });
  V = 1; hit('gong', .35, SEC[0].g, -2, .9, 0);   // opening gong (buka)
  EV.sort((x, y) => x.t - y.t);
  // T101 events: a section per plan entry (its first beat), a phrase at each cycle-end gong
  evtSet([...SEC.map((s, i) => evtSec(BT[s.b0].t, s.kind, planEnergy(window.GAMELANPLAN[i]))), ...PHR.map(p => ({ t: p.t, k: 'phrase', s: p.s, d: 0 }))]);
  lvlSet(lvlSecs(SEC.map((s, i) => { const e = planEnergy(window.GAMELANPLAN[i]);   // T146 chart level (data only): a build swells (V .75 -> 1), the outro thins out (volume and notes); other sections are flat
    return { a: i ? BT[s.b0].t : 0, b: i < SEC.length - 1 ? BT[SEC[i + 1].b0].t : TOTAL, e0: s.kind === 'build' ? e - .08 : s.kind === 'outro' ? e + .1 : e, e1: s.kind === 'build' ? e + .08 : s.kind === 'outro' ? .05 : e };
  })));
  // — sound
  const BUSC = { gong: [0, .55, 1, 900], kgong: [.2, .4, 1, 2500], kethuk: [-.35, .12, 1, 4000], demung: [-.2, .35, 1, 2500], saron: [.3, .3, 1, 3200], peking: [.1, .25, 1, 4000], bonang: [-.1, .3, 1, 3000], pol: [-.6, .25, 1, 3500], san: [.6, .25, 1, 3500], gender: [.05, .5, 1, 2000] }, BUS = {};
  for (const k in BUSC) {   // one bus per voice group: gain -> pan -> master (+ the shared reverb send); noise strikes go through a bandpass into the same bus
    const [pan, rv, gn, nf] = BUSC[k], g = a.createGain(), pn = a.createStereoPanner(), nz = a.createBiquadFilter(); g.gain.value = gn; pn.pan.value = pan; g.connect(pn); pn.connect(master); send(pn, rv);
    nz.type = 'bandpass'; nz.frequency.value = nf; nz.Q.value = .8; nz.connect(g); BUS[k] = { g, nz };
  }
  const CAP = MOB ? 14 : 28, act = [];   // gong may use 2 above CAP (res -2): max 16 on phones, 30 on desktop
  //   // live sources (start/end); every oscillator and noise burst is counted
  const claim = (t, durs, res) => {
    for (let i = act.length - 1; i >= 0; i--) if (act[i].e < a.currentTime) act.splice(i, 1);
    const mx = Math.max(...durs), ps = [t]; for (const x of act) if (x.s > t && x.s < t + mx) ps.push(x.s);
    for (const p of ps) { let n = 0; for (const x of act) if (x.s <= p && x.e > p) n++; for (const d of durs) if (t + d > p) n++; if (n > CAP - res) return false; }
    for (const d of durs) act.push({ s: t, e: t + d + .03 }); return true;
  };
  const play = (e, tt) => {
    const I = INS[e.i], D = I.D * (MOB ? I.dm : 1) * (.8 + .2 * e.v), np = MOB ? I.pm : I.P.length, cr = Math.pow(2, e.c / 1200), B = BUS[I.bus];
    const durs = I.P.slice(0, np).map(q => D * q[2]); let tw = I.tw && (!MOB || I.twm) ? I.tw * omb * e.f / baseF : 0, nz = I.nz && (!MOB || I.nzm);
    const spans = () => durs.concat(tw ? [durs[0]] : [], nz ? [.05] : []);
    if (!claim(tt, spans(), I.res)) {   // out of voices: drop extras first (noise, twin, upper partials), then the hit
      nz = false; tw = 0; if (!claim(tt, spans(), I.res)) { durs.length = 1; if (!claim(tt, spans(), I.res)) return; }
    }
    const part = (f, amp, dur) => {
      const o = a.createOscillator(), g = a.createGain(); o.frequency.value = f;
      g.gain.setValueAtTime(.0001, tt); g.gain.linearRampToValueAtTime(amp, tt + I.atk); g.gain.exponentialRampToValueAtTime(amp * .003, tt + dur);
      o.connect(g); g.connect(B.g); o.start(tt); o.stop(tt + dur + .03);
    };
    durs.forEach((dur, k) => part(e.f * cr * I.P[k][0] + (k === 0 && tw ? tw / 2 : 0), I.A * e.v * I.P[k][1] * (k ? .45 + .8 * e.v : 1), dur));
    if (tw) part(e.f * cr - tw / 2, I.A * e.v * .9, durs[0]);
    if (nz) { const n = noise(tt, .05), g = a.createGain(); g.gain.setValueAtTime(.0001, tt); g.gain.linearRampToValueAtTime(I.A * e.v * I.nz * .5, tt + .001); g.gain.exponentialRampToValueAtTime(.0001, tt + .035); n.connect(g); g.connect(B.nz); }
  };
  let ei = EV.findIndex(e => e.t >= off - .02); if (ei < 0) ei = EV.length;
  return function pump() {
    const hz = a.currentTime + (MOB ? 8 : 30);
    while (ei < EV.length && t0 + EV[ei].t < hz) { const e = EV[ei++], tt = t0 + e.t; if (tt >= a.currentTime - .02 && e.t < TOTAL - .3) play(e, Math.max(tt, a.currentTime + .003)); }
  };
};
