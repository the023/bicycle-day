// [[STYLE drone]]: same, for MUSIC === 'drone'
STYLE_FN.drone = function (ctx) {   // experimental drone / dark ambient: section plan from the seed, persistent oscillator layers driven by sampled curves, sparse transients (grains, scrapes, thuds)
  const { off, master, send, a, noise, ts, t0, mtof } = ctx;
  const sr = mulberry32((seedUsed * 2654435761 + 977) | 0), r = () => sr(), pk2 = arr => arr[Math.floor(r() * arr.length)];   // own seeded stream: the plan is identical after a seek
  const SETS = [   // semitone offsets from the section root (fractions = microtonal)
    { n: 'root+fifth', iv: [0, 7, 12, 19, 24] }, { n: 'minor-2nd cluster', iv: [0, 1, 12, 13, 24.5] }, { n: 'tritone', iv: [0, 6, 12, 18, 24] },
    { n: 'micro cluster', iv: [0, .35, 7.2, 12.5, 19.4] }, { n: 'minor 7/9', iv: [0, 3, 10, 12, 15] }, { n: 'quartal', iv: [0, 5, 10, 15, 22] }, { n: 'quarter-tone', iv: [0, 3.5, 7, 10.5, 12.5] }];
  const TEX = ['wind', 'metal', 'grain', 'thud', 'shimmer'], OCT = [1, 1, 1, 2, 2];
  const NS = clamp(Math.round(TOTAL / (45 + r() * 25)), 2, 10), wsec = Array.from({ length: NS }, () => .75 + .5 * r()), wsum = wsec.reduce((x, y) => x + y, 0);
  const bnd = [0]; for (let i = 0; i < NS; i++) bnd.push(i === NS - 1 ? TOTAL : bnd[i] + TOTAL * wsec[i] / wsum);
  const SEC = []; let prevSet = -1, prevRoot = 0, prevTex = -1;
  for (let i = 0; i < NS; i++) {
    let si = i === 0 ? pk2([0, 3]) : i === NS - 1 ? pk2([0, 3, 5]) : Math.floor(r() * SETS.length); if (si === prevSet) si = (si + 1 + Math.floor(r() * 5)) % SETS.length;
    let rt = i === 0 ? 0 : pk2([0, 7, 5, 6, 3, -2, 1, 10]); if (rt === prevRoot && i) rt = pk2([7, 5, 3, 6]);
    let m = Math.floor(r() * 5); if (m === prevTex) m = (m + 1 + Math.floor(r() * 3)) % 5; const m2 = (m + 1 + Math.floor(r() * 4)) % 5;
    const tw = [.08, .08, .08, .08, .08]; tw[m] = 1; tw[m2] = .45; const len = bnd[i + 1] - bnd[i], sw = [];
    for (let k = 0, n = 1 + (r() < .6 ? 1 : 0); k < n; k++) sw.push({ c: bnd[i] + len * (.3 + .5 * r()), s: 5 + 8 * r(), a: .12 + .2 * r() });
    SEC.push({ i, t0: bnd[i], t1: bnd[i + 1], len, set: si, setName: SETS[si].n, iv: SETS[si].iv, rootOff: rt, f0: mtof(ROOT - 24 + rt), tex: TEX[m], tex2: TEX[m2], tw, dens: .3 + .7 * r(), bright: .3 + .7 * r(),
      eo: i === 0 ? -.1 : i === NS - 1 ? -.08 : -.05 + .22 * r(), modr: pk2([1.4142, 2.7183, 1.618, 1.5]), sw });
    prevSet = si; prevRoot = rt; prevTex = m;
  }
  globalThis.DRONEPLAN = SEC.map(s => ({ from: +s.t0.toFixed(1), to: +s.t1.toFixed(1), root: s.rootOff, f0: +s.f0.toFixed(1), set: s.setName, tex: s.tex + '+' + s.tex2, dens: +s.dens.toFixed(2), bright: +s.bright.toFixed(2), eo: +s.eo.toFixed(2) }));
  // T101 events: sections only. The drone plan has no role, so sec is derived from the energy with the chiptune thresholds
  evtSet(SEC.map((s, i) => { const e = planEnergy(globalThis.DRONEPLAN[i]); return evtSec(s.t0, e >= .62 ? 'drop' : e < .3 ? 'break' : 'build', e); }));
  const SWL = SEC.flatMap(s => s.sw), hwOf = j => Math.min(10, .22 * Math.min(SEC[j - 1].len, SEC[j].len));
  const stateAt = t => {   // everything that varies in time, blended across section boundaries (frequencies in the log domain)
    const X = [1]; for (let j = 1; j < NS; j++) { const hw = hwOf(j); X.push(smooth(bnd[j] - hw, bnd[j] + hw, t)); } X.push(0);
    const w = SEC.map((s, i) => X[i] * (1 - X[i + 1])), u = t / TOTAL;
    const ex = fn => { let l = 0; for (let i = 0; i < NS; i++) if (w[i] > 1e-5) l += w[i] * Math.log(fn(SEC[i])); return Math.exp(l); }, lin = fn => { let v = 0; for (let i = 0; i < NS; i++) if (w[i] > 1e-5) v += w[i] * fn(SEC[i]); return v; };
    let swl = 0; for (const s of SWL) swl += s.a * Math.exp(-Math.pow((t - s.c) / s.s, 2));
    let I = clamp(.1 + .75 * energy(u) + lin(s => s.eo) + swl + .04 * Math.sin(t / 3.7));
    I *= (.25 + .75 * smooth(0, .12, u)) * (1 - .88 * smooth(.86, .99, u));
    const f0 = ex(s => s.f0), P = [0, 1, 2, 3, 4].map(k => ex(s => s.f0 * Math.pow(2, s.iv[k] / 12 + OCT[k])) * (1 + .003 * Math.sin(t * 6.283 / (31 + 7 * k) + k)));
    return { t, I, f0, P, tw: [0, 1, 2, 3, 4].map(j => lin(s => s.tw[j])), br: lin(s => s.bright), dens: lin(s => s.dens), modr: lin(s => s.modr) };
  };
  lvlSet(Array.from({ length: Math.ceil(TOTAL / 3) + 1 }, (_, i) => { const t = Math.min(TOTAL, 3 * i); return [t, stateAt(t).I]; }));   // T146: the chart follows the drone's own intensity I(t) (slow fade in / out, swells), data only
  const N = clamp(Math.round((TOTAL - off) / 1.5), 24, 700), cdur = Math.max(1, TOTAL - off), ST = [];
  for (let i = 0; i < N; i++) ST.push(stateAt(Math.min(TOTAL, off + cdur * i / (N - 1))));
  const cv = (param, fn) => { const arr = new Float32Array(N); for (let i = 0; i < N; i++) { const v = fn(ST[i]); arr[i] = isFinite(v) ? v : 0; } param.setValueCurveAtTime(arr, ts, cdur); };
  const OS = (type, f) => { const o = a.createOscillator(); o.type = type; o.frequency.value = f; o.start(ts); o.stop(t0 + TOTAL + .5); return o; };
  const G = (v, dest) => { const g = a.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
  const bus = G(1, master); send(bus, .4, 0);
  cv(bus.gain, S => 1 + 1.7 * (1 - smooth(.04, .5, S.I)));   // loudness makeup: the quiet opening (low intensity) was too faint to hear; up to ~+8.5 dB at the very start, back to 1 from I = .5
  // slow LFOs (shared): tremolo on the partials, filter movement
  const lfoA = OS('sine', .06 + .1 * r()), lfoB = OS('sine', .13 + .25 * r()), dA = G(.3), dB = G(.35); lfoA.connect(dA); lfoB.connect(dB);
  const trem = (src, dest, which) => { const tg = G(.7, dest); (which ? dB : dA).connect(tg.gain); src.connect(tg); return tg; };
  // sub + beating sub
  const sub = OS('sine', 40), subB = OS('sine', 40), sg = G(0, master), sgB = G(0, master); sub.connect(sg); subB.connect(sgB);
  cv(sub.frequency, S => S.f0); cv(subB.frequency, S => S.f0 + .08 + 1.4 * S.I); cv(sg.gain, S => .42 * (.12 + .88 * Math.pow(S.I, 1.3))); cv(sgB.gain, S => .26 * Math.pow(S.I, 1.3));
  // fundamental: two detuned saws through a moving lowpass
  const fA = OS('sawtooth', 80), fB = OS('sawtooth', 80), fl = a.createBiquadFilter(), fg = G(0); fl.type = 'lowpass'; fl.Q.value = 3; fA.connect(fl); fB.connect(fl); fl.connect(fg); trem(fg, bus, 0);
  const cents = S => 1.5 + 22 * Math.pow(S.I, 1.5);
  cv(fA.frequency, S => 2 * S.f0 * Math.pow(2, -cents(S) / 2400)); cv(fB.frequency, S => 2 * S.f0 * Math.pow(2, cents(S) / 2400));
  cv(fl.frequency, S => 70 + 1900 * Math.pow(S.I, 1.4) * (.35 + .65 * S.br)); cv(fg.gain, S => .14 * (.03 + .97 * Math.pow(S.I, 1.4)));
  const flD = G(60, fl.frequency); lfoA.connect(flD);
  // five partials of the section's interval set (clusters beat against each other)
  for (let k = 0; k < 5; k++) {
    const o = OS(k === 2 ? 'triangle' : 'sine', 100), g = G(0); o.connect(g); trem(g, bus, k & 1);
    cv(o.frequency, S => S.P[k]); cv(g.gain, S => .055 / (1 + .35 * k) * (.06 + .94 * Math.pow(S.I, 1.3)) * (k > 2 ? .4 + .6 * S.br : 1));
  }
  // slow FM voice
  const fc = OS('sine', 150), fm = OS('sine', 200), fmg = G(0), fcg = G(0); fm.connect(fmg); fmg.connect(fc.frequency); fc.connect(fcg); trem(fcg, bus, 1);
  cv(fc.frequency, S => S.P[0] * 2); cv(fm.frequency, S => S.P[0] * 2 * S.modr); cv(fmg.gain, S => S.P[0] * 2 * (.05 + 2.4 * S.I * S.br)); cv(fcg.gain, S => .05 * Math.pow(S.I, 1.4));
  // noise: wind (swept bandpass) and air (narrow high band)
  const nW = noise(ts, cdur + .5), bW = a.createBiquadFilter(), gW = G(0, bus); bW.type = 'bandpass'; bW.Q.value = 4; nW.connect(bW); bW.connect(gW);
  cv(bW.frequency, S => 160 + 1200 * S.I * (.4 + .6 * S.br) + 250 * Math.sin(S.t / 9)); cv(gW.gain, S => .2 * (.1 + 1.1 * S.tw[0]) * (.1 + .9 * S.I)); const bwD = G(150, bW.frequency); lfoB.connect(bwD);
  const nH = noise(ts, cdur + .5), bH = a.createBiquadFilter(), gH = G(0, bus); bH.type = 'bandpass'; bH.Q.value = 10; nH.connect(bH); bH.connect(gH);
  cv(bH.frequency, S => 1800 + 3200 * S.br * (.5 + .5 * Math.sin(S.t / 13 + 1))); cv(gH.gain, S => .05 * (.25 * S.tw[1] + .8 * S.tw[4] + .1) * (.2 + S.I));
  // shimmering high partials, reverb-heavy
  const shb = G(1, master); send(shb, .85, 0);
  for (const [k, mul] of [[1, 8], [3, 4]]) { const o = OS('sine', 1000), g = G(0); o.connect(g); trem(g, shb, k & 1); cv(o.frequency, S => Math.min(6500, S.P[k] * mul)); cv(g.gain, S => .014 * (.15 + 1.1 * S.tw[4]) * (.3 + S.I)); }
  // saturation (parallel path): opens up at the peaks
  const crvD = new Float32Array(1025); for (let i = 0; i < 1025; i++) crvD[i] = Math.tanh((i / 512 - 1) * 3);
  const pre = G(1), ws = a.createWaveShaper(), post = G(0), plp = a.createBiquadFilter(); ws.curve = crvD; plp.type = 'lowpass'; plp.frequency.value = 2600;
  bus.connect(pre); pre.connect(ws); ws.connect(plp); plp.connect(post); post.connect(master); send(post, .2, 0);
  cv(pre.gain, S => 1 + 6 * S.I * S.I); cv(post.gain, S => .3 * smooth(.45, .9, S.I));
  // transients (own seeded stream; voice budget counted by time overlap)
  const er = mulberry32((seedUsed * 31 + Math.floor(off) + 5) | 0), e = () => er(), ep = arr => arr[Math.floor(e() * arr.length)];
  const gb = G(.5, master), scb = G(.5, master), thb = G(.9, master); send(gb, .6, 0); send(scb, .7, .15); send(thb, .35, 0);
  const BUD = MOBILE ? 6 : 9, act = []; let nx = Math.max(ts + .2, t0 + .5), lastScrape = -99, lastThud = -99;
  const book = (tt, d, n) => { act.push([tt + d, n]); };
  const used = tt => { let c = 0; for (let i = act.length - 1; i >= 0; i--) { if (act[i][0] < nx - 1) act.splice(i, 1); else if (act[i][0] > tt) c += act[i][1]; } return c; };
  const grain = (tt, S) => {
    const d = .05 + .2 * e(), o = a.createOscillator(), g = a.createGain(), pn = a.createStereoPanner ? a.createStereoPanner() : null;
    o.type = e() < .3 ? 'triangle' : 'sine'; o.frequency.value = Math.min(7000, ep(S.P) * Math.pow(2, 1 + Math.floor(e() * 3)) * Math.pow(2, (e() - .5) * .08));
    g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.05 * (.3 + S.I), tt + .008); g.gain.exponentialRampToValueAtTime(.0005, tt + d);
    o.connect(g); if (pn) { pn.pan.value = e() * 2 - 1; g.connect(pn); pn.connect(gb); } else g.connect(gb); o.start(tt); o.stop(tt + d + .02); book(tt, d + .02, 1);
  };
  const scrape = (tt, S) => {   // metallic scrape: inharmonic partials, long decay
    const base = 260 + 1500 * e() * (.4 + .6 * S.br), d = 2 + 3 * e(), RA = [1, 2.76, 5.4, 8.93, 13.34], n = MOBILE ? 3 : 5, g = a.createGain();
    g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.05 * (.4 + S.I), tt + .02 + .3 * e()); g.gain.exponentialRampToValueAtTime(.0005, tt + d); g.connect(scb);
    for (let k = 0; k < n; k++) { const o = a.createOscillator(); o.frequency.value = Math.min(9000, base * RA[k] * (1 + .004 * (e() - .5))); o.connect(G(1 / (1 + k * .7), g)); o.start(tt); o.stop(tt + d + .05); }
    book(tt, d + .05, n);
  };
  const thud = (tt, S) => {
    const o = a.createOscillator(), d = 1.2 + 1.5 * e(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(S.f0 * 2.2, tt); o.frequency.exponentialRampToValueAtTime(Math.max(24, S.f0), tt + .25);
    g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.5 * (.4 + .6 * S.I), tt + .01); g.gain.exponentialRampToValueAtTime(.0005, tt + d); o.connect(g); g.connect(thb); o.start(tt); o.stop(tt + d + .05); book(tt, d + .05, 1);
  };
  return function pump() {
    const hz = a.currentTime + (MOBILE ? 8 : 30);
    while (nx < hz && nx < t0 + TOTAL - 4) {
      const st = nx - t0, S = stateAt(st), tw = S.tw, mob = MOBILE ? .5 : 1;
      if (nx > a.currentTime - .1) {
        let ng = Math.floor(14 * tw[2] * S.dens * (.15 + S.I) * .5 * mob + e());
        for (; ng > 0; ng--) { const tt = nx + e() * .5; if (used(tt) + 1 <= BUD) grain(tt, S); }
        if (st - lastScrape > 4 && e() < .04 * tw[1] * S.dens * (.3 + S.I) && used(nx) + 5 <= BUD) { scrape(nx + e() * .4, S); lastScrape = st; }
        if (st - lastThud > 4 && e() < (.015 + .09 * tw[3] * S.dens) * (.3 + 1.2 * S.I) && used(nx) + 1 <= BUD) { thud(nx + e() * .4, S); lastThud = st; }
      }
      nx += .5;
    }
  };
};
