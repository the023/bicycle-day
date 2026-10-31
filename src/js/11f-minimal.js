// [[STYLE minimal]] (T22): Reich / Riley-style minimalism. One seeded cell of 8-12 eighths in a mode; every melodic voice plays that cell: phasing (a second marimba drifts one eighth ahead, then locks in),
// additive build-up / thinning (rests filled in one per cycle, removed the same way), canon (vibraphone n eighths behind) and augmentation (vibraphone in quarters in the calm sections).
// A steady eighth pulse (chord, breath swells) and one chord per section from a 4-6 chord cycle (bass + pad change, the pulse re-enters). Whole piece = a sorted event list built from the seed (seek resumes it).
// PERSISTENT oscillators for the pulse chord (retriggered by automation), the bass and the clarinet / voice pad; per-note nodes only for the mallets (marimba, vibraphone, e-piano), with a voice budget.
STYLE_FN.minimal = function (ctx) {
  const { mtof, t0, a, send, master, off, ts } = ctx;
  const sr = mulberry32((seedUsed * 2654435761 + 6173) | 0), r = () => sr(), pk2 = arr => arr[Math.floor(r() * arr.length)], rr = (x, y) => x + (y - x) * r(), cc = (x, lo, hi) => Math.min(hi, Math.max(lo, x)), MOB = MOBILE;
  const shuf = arr => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const mode = pk2(['dorian', 'aeolian', 'mixolydian', 'dorian', 'aeolian']), tonic = pk2([45, 47, 48, 50, 50, 52]), st = d => MT.st(mode, d), dg7 = d => ((d % 7) + 7) % 7;
  // — the cell: a compound line (a low and a high strand interleaved, like Piano Phase / Electric Counterpoint); the best of 32 drafts (distinct notes, no repeats, no tritone, smooth wrap-around)
  const L = pk2([8, 10, 12, 12]); let cell = null, best = -1e9;
  for (let tr = 0; tr < 32; tr++) {
    const c = []; let lo = pk2([0, 0, 2, 4]), hi = pk2([4, 5, 7]), up = false;
    for (let j = 0; j < L; j++) {
      if (j) { if (r() < .75) up = !up; if (up) hi = cc(hi + pk2([-2, -1, -1, 0, 1, 1, 2]), 3, 7); else lo = cc(lo + pk2([-2, -1, -1, 1, 1, 2]), -2, 4); }
      c.push(up ? hi : lo);
    }
    const nd = new Set(c).size; let sc = Math.min(nd, 7) - Math.max(0, nd - 7);
    for (let j = 0; j < L; j++) { const x = c[j], y = c[(j + 1) % L]; if (x === y) sc -= 1.5; if (Math.abs(st(y) - st(x)) === 6) sc -= 2; if (Math.abs(y - x) > 5) sc -= 2; }
    if (c.filter(x => [0, 2, 4].includes(dg7(x))).length >= L / 2) sc += 1.5;
    sc -= Math.max(0, c.filter(x => dg7(x) === 6).length - 1); sc += .5 * r();
    if (sc > best) { best = sc; cell = c; }
  }
  const CELL = cell.slice(), nR = L >= 10 ? pk2([0, 1, 1, 2]) : pk2([0, 0, 1]);
  for (let k = 0, tr = 0; k < nR && tr < 20; tr++) { const j = 1 + Math.floor(r() * (L - 1)); if (CELL[j] !== null && CELL[j - 1] !== null && CELL[(j + 1) % L] !== null) { CELL[j] = null; k++; } }
  const LEAD = tonic + 12, cm = j => LEAD + st(CELL[j]);   // lead register ~A3-E5
  // — grid: a fixed tempo (quarter 100-132), stretched a hair so a whole number of cycles ends ~3 s before the end
  const q0 = rr(100, 132), T0 = .3, END = TOTAL - 3.2, NC = Math.max(6, Math.round((END - T0) / (L * 30 / q0))), e8 = (END - T0) / (NC * L), C = L * e8;
  // — sections (whole cycles): intro, build, then drop / build / break from the arc's energy, outro
  const NS = cc(Math.round(TOTAL / 34), 3, 40), KB = { intro: .2, build: .55, drop: .9, break: .3, outro: .15 }, wv = Array.from({ length: NS }, () => rr(.85, 1.2)), wsum = wv.reduce((x, y) => x + y, 0);
  const SEC = []; let cw = 0;
  for (let i = 0; i < NS; i++) {
    const c0 = Math.round(NC * cw / wsum); cw += wv[i]; const c1 = i === NS - 1 ? NC : Math.round(NC * cw / wsum), tA = T0 + c0 * C, tB = T0 + c1 * C, eu = energy(clamp((tA + tB) / 2 / TOTAL));
    SEC.push({ i, c0, c1, tA, tB, eu, kind: i === 0 ? 'intro' : i === NS - 1 ? 'outro' : i === 1 && NS >= 4 ? 'build' : eu > .6 ? 'drop' : eu < .35 ? 'break' : 'build' });
  }
  const MID = SEC.slice(1, -1);
  if (NS >= 4 && !MID.some(s => s.kind === 'drop')) MID.reduce((x, y) => y.eu > x.eu ? y : x).kind = 'drop';
  if (NS >= 6 && !MID.some(s => s.kind === 'break')) { const c = MID.filter(s => s.i > 1 && s.kind !== 'drop'); if (c.length) c.reduce((x, y) => y.eu < x.eu ? y : x).kind = 'break'; }
  // — harmony: a cycle of 4-6 chords (roots with a perfect fifth in the mode), one per section; the outro comes home, the section before it is the cycle's last chord
  const okR = shuf([1, 2, 3, 4, 5, 6].filter(d => st(d + 4) - st(d) === 7)), nCh = Math.min(okR.length + 1, pk2([4, 5, 5, 6])), CYC = [0, ...okR.slice(0, nCh - 1)];
  const li = CYC.findIndex((d, k) => k && [3, 4, 6].includes(d)); if (li > 0) [CYC[li], CYC[nCh - 1]] = [CYC[nCh - 1], CYC[li]];
  let proc = r() < .7 ? 'phase' : 'canon';
  SEC.forEach(s => {
    s.ch = s.kind === 'outro' ? 0 : CYC[s.i % nCh]; if (s.i === NS - 2 && s.ch === 0) s.ch = CYC[nCh - 1];
    s.I = cc(.5 * KB[s.kind] + .5 * s.eu + rr(-.05, .05), 0, 1);
    if (s.kind === 'build' || s.kind === 'drop') { s.proc = proc; proc = r() < .75 ? (proc === 'phase' ? 'canon' : 'phase') : proc; } else s.proc = s.kind === 'break' ? 'augment' : s.kind === 'intro' ? 'additive' : 'thin';
  });
  // — voicings (voice-led: least total movement, no unisons, few seconds)
  const pcs = ds => ds.map(d => ((tonic + st(d)) % 12 + 12) % 12);
  const voice = (P, lo, hi, prev) => {
    const opts = P.map(pc => { const o = []; for (let m = lo; m <= hi; m++) if ((m - pc) % 12 === 0) o.push(m); return o; }); let bv = null, bs = 1e9;
    const rec = (i, cur) => {
      if (i === opts.length) { const s = cur.slice().sort((x, y) => x - y); let sc = 0; for (let k = 1; k < s.length; k++) { const d = s[k] - s[k - 1]; sc += d < 1 ? 99 : d < 3 ? 4 : 0; }
        sc += prev ? s.reduce((x, m, k) => x + Math.abs(m - prev[k]), 0) : Math.abs(s[0] + s[s.length - 1] - lo - hi); if (sc < bs) { bs = sc; bv = s; } return; }
      for (const m of opts[i]) { cur.push(m); rec(i + 1, cur); cur.pop(); }
    };
    rec(0, []); return bv;
  };
  let pvP = null, pvU = null;
  SEC.forEach(s => {
    const d = s.ch; s.pad = pvP = voice(pcs([d, d + 2, d + 4, d + 8]), 48, 65, pvP); s.pul = pvU = voice(pcs([d, d + 2, d + 4]), 57, 71, pvU);
    s.pul4 = voice(pcs([d + 8]), s.pul[2] + 1, s.pul[2] + 12)[0]; s.bass = 36 + (((tonic + st(d) - 36) % 12) + 12) % 12; s.cht = new Set(pcs([d, d + 2, d + 4]));
  });
  window.MINIMALPLAN = SEC.map(s => ({ kind: s.kind, from: s.i ? +s.tA.toFixed(1) : 0, to: +(s.i < NS - 1 ? s.tB : TOTAL).toFixed(1), e: +s.I.toFixed(2), chord: s.ch, proc: s.proc, bpm: Math.round(30 / e8), mode, cell: CELL.map(x => x === null ? '-' : x).join(' ') }));   // read by vplan() via EVT
  // — the event list (pure function of the seed, every draw in a fixed order)
  const EV = [], LOCK = [], jit = () => (r() + r() - 1) * .004, secOf = c => SEC.find(s => c < s.c1) || SEC[NS - 1];
  const mal = (b, t, f, v, D) => EV.push({ t: Math.max(.05, t), i: 'm', b, f, v: cc(v, .03, 1), D });
  // P1 additive / thinning: notes in ORD order are on while their rank < cnt[c]; cnt moves one note per cycle toward the section's target
  const ORD = [0, ...shuf(CELL.map((x, j) => x !== null && j ? j : -1).filter(j => j > 0))], FULL = ORD.length, k0 = Math.min(FULL, 2 + (r() < .5 ? 1 : 0)), RANK = []; ORD.forEach((j, k) => RANK[j] = k);
  const TGT = { intro: FULL, build: FULL, drop: FULL, break: Math.max(k0 + 1, Math.round(FULL * .55)), outro: 1 }, cnt = [];
  for (let c = 0; c < NC; c++) { const T = TGT[secOf(c).kind]; cnt.push(c ? cnt[c - 1] + Math.sign(T - cnt[c - 1]) : k0); }
  const fullC = cnt.findIndex(x => x === FULL);
  const bright = s => .3 + .7 * s.I, mv = s => .75 + .35 * s.I;
  let phi = 0, p2was = false;
  for (const s of SEC) {
    const K = s.kind, ce = Math.max(s.c0, fullC < 0 ? NC : fullC);
    for (let c = s.c0; c < s.c1; c++) for (let j = 0; j < L; j++) if (CELL[j] !== null && RANK[j] < cnt[c]) mal('m1', T0 + (c * L + j) * e8 + jit(), mtof(cm(j)), (j ? .5 : .62) * rr(.9, 1.05) * mv(s), 1);
    // P2: the phasing marimba (other side). On in drops, in phase builds, and in canon builds if it was already playing (then it stays locked)
    const p2 = ce < s.c1 - 1 && (K === 'drop' || (K === 'build' && (s.proc === 'phase' || p2was)));
    if (p2) {
      const seg = (ta, tb, drift) => {   // P2 is at x(t) = (t - T0)/e8 + phi(t) and plays CELL[x mod L] at each integer x; a drift raises phi by one eighth over [ta, tb]
        const xs = (ta - T0) / e8 + phi, xe = (tb - T0) / e8 + phi + (drift ? 1 : 0), rate = 1 / e8 + (drift ? 1 / (tb - ta) : 0);
        for (let x = Math.ceil(xs - 1e-6); x < xe - 1e-6; x++) { const j = ((x % L) + L) % L; if (CELL[j] !== null) mal('m2', ta + (x - xs) / rate + jit(), mtof(cm(j)) * 1.0017, (j ? .48 : .56) * rr(.9, 1.05) * mv(s), 1); }
        if (drift) { phi += 1; LOCK.push(tb); }
      };
      let c = ce;
      if (s.proc === 'phase') { const lk = Math.min(s.c1 - c, pk2([2, 3])); seg(T0 + c * C, T0 + (c + lk) * C, false); c += lk; }
      while (c < s.c1) {   // phase: drift dd cycles, lock ll cycles, ... (a drift never crosses the section end); canon: one lock to the end
        const dd = pk2([2, 3, 3, 4]);
        if (s.proc === 'phase' && c + dd <= s.c1 - 1) { seg(T0 + c * C, T0 + (c + dd) * C, true); c += dd; let ll = pk2([2, 3, 4]); if (s.c1 - c - ll < 3) ll = s.c1 - c; seg(T0 + c * C, T0 + (c + ll) * C, false); c += ll; }
        else { seg(T0 + c * C, T0 + s.c1 * C, false); c = s.c1; }
      }
    }
    p2was = p2;
    // P3 vibraphone: canon (the cell n eighths behind) in canon builds and in drops; augmentation (the cell in quarters, long decay) in breaks
    if (K === 'break') { for (let g = s.c0 * L + L; g < s.c1 * L - 2; g += 2) { const j = (g / 2) % L; if (CELL[j] !== null) mal('vib', T0 + g * e8 + jit(), mtof(cm(j)), .42 * rr(.9, 1.05), 2.6); } }
    const p3 = (K === 'drop' || (K === 'build' && s.proc === 'canon')) && ce < s.c1 - 1;
    if (p3) {
      const o3 = pk2([2, 3, 4, 5, 6].filter(x => x < L)), oc = K === 'drop' && s.I > .72 ? 2 : 1, c3 = K === 'drop' ? ce : Math.min(s.c1 - 1, ce + 1);
      for (let g = c3 * L + o3; g < s.c1 * L; g++) { const j = (((g - o3) % L) + L) % L; if (CELL[j] !== null) mal('vib', T0 + g * e8 + jit(), mtof(cm(j)) * oc, (oc > 1 ? .26 : .36) * rr(.88, 1.05) * mv(s), 1.3); }
    }
    // P4 e-piano an octave down: the cell's chord tones only, on the quarters, offset by o4 eighths (a resultant pattern); drops and strong builds, desktop only
    if (!MOB && (K === 'drop' || (K === 'build' && s.I > .72)) && ce + 2 < s.c1) {
      const o4 = pk2([2, 4, 6].filter(x => x < L));
      for (let g = (ce + 2) * L; g < s.c1 * L; g += 2) { const j = (((g - o4) % L) + L) % L; if (CELL[j] !== null && s.cht.has(cm(j) % 12)) mal('ep', T0 + g * e8 + jit(), mtof(cm(j) - 12), .4 * rr(.9, 1.05) * mv(s), 1.4); }
    }
    // pulse chord: eighths (quarters in strong breaks, none in calm ones); it re-enters softly at each section start and swells with the breath
    const den = K === 'break' ? (s.I > .3 ? 1 : 0) : 2, pv = (K === 'intro' ? .3 : .3 + .5 * s.I);
    if (den) for (let g = s.c0 * L; g < s.c1 * L; g += 3 - den) {
      const t = T0 + g * e8, x = (t - s.tA) / (s.tB - s.tA), ent = K === 'intro' ? Math.min(1, (t - s.tA) / (2.5 * C)) : Math.min(1, .3 + .7 * (t - s.tA) / C), ex = K === 'outro' ? Math.pow(1 - x, 1.5) : 1 - .35 * smooth(s.tB - C * .5, s.tB, t);
      EV.push({ t, i: 'p', s: s.i, v: pv * ent * ex * (g % 2 ? .86 : 1) * rr(.94, 1.02) });
    }
    // bass: a sustained drone (intro / break / outro) or pulses (quarters in builds, eighths in drops); an accented entry signals each chord change
    const bm = K === 'build' ? 2 : K === 'drop' ? 1 : 0;
    EV.push({ t: s.tA - .02, i: 'bf', f: mtof(s.bass) }); EV.push({ t: s.tA, i: 'b', f: mtof(s.bass), v: .9 });
    if (bm) for (let g = s.c0 * L + bm; g < s.c1 * L; g += bm) {
      const t = T0 + g * e8, cyc = Math.floor(g / L), pos = g % L, five = K !== 'intro' && cyc % 2 === 1 && pos >= L - 2;
      EV.push({ t, i: 'b', f: mtof(s.bass + (five ? 7 : 0)), v: (bm === 1 ? .42 : .55) * (pos === 0 ? 1.2 : 1) * (.8 + .3 * s.I) });
    }
  }
  // the last note: tonic on marimba + vibraphone, bass
  const tE = T0 + NC * C; mal('m1', tE, mtof(LEAD), .6, 2.2); mal('vib', tE + .01, mtof(LEAD + 12), .3, 4); EV.push({ t: tE, i: 'b', f: mtof(SEC[NS - 1].bass), v: 1 });
  EV.sort((x, y) => x.t - y.t);
  // T99 events: a section per plan entry, a phrase at each phasing lock-in
  evtSet([...SEC.map((s, i) => evtSec(s.tA, s.kind, planEnergy(window.MINIMALPLAN[i]))), ...LOCK.map(t => ({ t, k: 'phrase', s: .5, d: 0 }))]);
  lvlSet(Array.from({ length: NC + 1 }, (_, c) => { const s = secOf(Math.min(c, NC - 1)); return [T0 + c * C, s.I * (.55 + .45 * cnt[Math.min(c, NC - 1)] / FULL)]; }));   // T146 chart level (data only): the section's I x how much of the cell the marimba plays (additive build-up in the intro, thinning in breaks and the outro)
  const secT = t => { let i = 0; while (i < NS - 1 && t >= SEC[i + 1].tA) i++; return SEC[i]; };
  // — sound. Buses: gain -> pan -> (mallets: shared brightness lowpass) -> master, + reverb send
  const G = (v, dest) => { const g = a.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; };
  const endT = t0 + TOTAL + .5, OS = (type, f, wave) => { const o = a.createOscillator(); if (wave) o.setPeriodicWave(wave); else o.type = type; o.frequency.value = f; o.start(ts); o.stop(endT); return o; };
  const PW = (arr) => a.createPeriodicWave(new Float32Array(arr.length), new Float32Array(arr), { disableNormalization: false });
  const CLAR = PW([0, 1, .05, .42, .04, .22, .03, .12, .02, .06]), OOH = PW([0, 1, .42, .16, .08, .04]);
  // owner's ear-tuned voice settings (sound lab, 2026-10-18): lvl = voice gain (/.8), tone = brightness x 2^((tone-.5)*3) on the lowpass AND a bus tone filter (lowpass below .5, high shelf above), len = duration x 2^((len-.5)*2.5), x = partial / FM / detune amount, sat = tanh waveshaper on the voice bus
  const MSET = { m1: { lvl: .24, tone: .1, len: .25, x: .89, sat: .56 }, m2: { lvl: .27, tone: .88, len: .11, x: .8, sat: .24 }, vib: { lvl: .52, tone: .83, len: .32, x: .4, sat: .08 }, ep: { lvl: .8, tone: .5, len: 1, x: .91, sat: 0 },
    pulse: { lvl: .45, tone: .5, len: .5, x: .78, sat: .14 }, bass: { lvl: .8, tone: .5, len: .5, x: .5, sat: 0 }, pad: { lvl: .18, tone: .21, len: .5, x: 1, sat: .54 } };
  const VBr = k => Math.pow(2, (MSET[k].tone - .5) * 3), VL = k => Math.pow(2, (MSET[k].len - .5) * 2.5), VG = k => MSET[k].lvl / .8;
  // bus tail = tone filters + waveshaper -> master; skipped (returns master) when neutral. Returns the node to feed.
  const tail = k => { const s = MSET[k]; if (s.tone === .5 && !s.sat) return master;
    const sh = a.createWaveShaper(), c = new Float32Array(1025), kk = .05 + 6 * s.sat, nn = Math.tanh(kk); for (let i = 0; i <= 1024; i++) c[i] = Math.tanh(kk * (i / 512 - 1)) / nn; sh.curve = c; sh.connect(master);
    const tl = a.createBiquadFilter(), ts = a.createBiquadFilter(); tl.type = 'lowpass'; tl.Q.value = .5; ts.type = 'highshelf'; ts.frequency.value = 3500; tl.connect(ts); ts.connect(sh);
    tl.frequency.value = s.tone >= .5 ? 20000 : 250 * Math.pow(2, s.tone * 12.4); ts.gain.value = s.tone > .5 ? (s.tone - .5) * 18 : 0; return tl; };
  const MLP = {}, BUS = {}, mk = (k, pan, rv, gn) => { const g = G(gn), p = a.createStereoPanner(), lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .5; lp.connect(tail(k)); lp.frequency.value = VBr(k) * (2500 + 3500 * bright(secT(off)));
    for (const s of SEC) if (s.tA > off) lp.frequency.setTargetAtTime(VBr(k) * (2500 + 3500 * bright(s)), t0 + s.tA, .8);
    p.pan.value = pan; g.connect(p); p.connect(lp); send(p, rv); BUS[k] = g; MLP[k] = lp; };
  mk('m1', -.45, .22, 1); mk('m2', .45, .22, 1); mk('vib', .15, .42, .8); mk('ep', -.12, .3, .9);
  if (!MOB) { const lf = OS('sine', 5.3), lg = G(.25); lf.connect(lg); lg.connect(BUS.vib.gain); }   // vibraphone motor tremolo
  // mallets: P = [ratio, amp, decay factor]; harmonic woody partials (marimba 1 + 4, vibraphone 1 + 4 short), e-piano = 1:1 FM with a falling index
  const MI = { m1: { P: [[1, 1, 1], [4, .3 * MSET.m1.x / .4, .1]], A: .2 * VG('m1'), atk: .002 }, m2: { P: [[1, 1, 1], [4, .3 * MSET.m2.x / .4, .1]], A: .2 * VG('m2'), atk: .002 }, vib: { P: [[1, 1, 1], [4, .12 * MSET.vib.x / .4, .06]], A: .15 * VG('vib'), atk: .003 }, ep: { A: .16 * VG('ep'), atk: .004 } };
  const CAP = MOB ? 12 : 22, act = [];
  const busy = (t) => { let n = 0; for (let i = act.length - 1; i >= 0; i--) { if (act[i].e < a.currentTime) act.splice(i, 1); else if (act[i].e > t && act[i].s <= t) n += act[i].n; } return n; };
  const play = (e, tt) => {
    const I = MI[e.b], ep = e.b === 'ep', D = e.D * VL(e.b) * (e.b === 'vib' || ep ? 1 : cc(Math.pow(220 / e.f, .6), .45, 1.5)), out = BUS[e.b];
    let np = ep ? 2 : I.P.length; const used = busy(tt);
    if (used + np > CAP) { if (ep || used + 1 > CAP) return; np = 1; }
    act.push({ s: tt, e: tt + D + .03, n: np });
    if (ep) {
      const cr = a.createOscillator(), md = a.createOscillator(), mg = a.createGain(), g = a.createGain(); cr.frequency.value = md.frequency.value = e.f;
      mg.gain.setValueAtTime(e.f * (.8 + 1.6 * e.v) * 2 * MSET.ep.x, tt); mg.gain.exponentialRampToValueAtTime(e.f * .08, tt + D * .4); md.connect(mg); mg.connect(cr.frequency);
      g.gain.setValueAtTime(.0001, tt); g.gain.linearRampToValueAtTime(I.A * e.v, tt + I.atk); g.gain.exponentialRampToValueAtTime(I.A * e.v * .002, tt + D); cr.connect(g); g.connect(out);
      cr.start(tt); md.start(tt); cr.stop(tt + D + .03); md.stop(tt + D + .03); return;
    }
    for (let k = 0; k < np; k++) {
      const [ra, am, df] = I.P[k], o = a.createOscillator(), g = a.createGain(), amp = I.A * e.v * am * (k ? .5 + .9 * e.v : 1), d = Math.max(.05, D * df); o.frequency.value = e.f * ra;
      g.gain.setValueAtTime(.0001, tt); g.gain.linearRampToValueAtTime(amp, tt + I.atk); g.gain.exponentialRampToValueAtTime(amp * .002, tt + d); o.connect(g); g.connect(out); o.start(tt); o.stop(tt + d + .03);
    }
  };
  // pulse chord: persistent tones (fundamental + a short 2nd partial, piano / marimba-like), retriggered by automation at every pulse
  const pbus = G(1), pl = a.createBiquadFilter(); pl.type = 'lowpass'; pl.frequency.value = 3200 * VBr('pulse'); pbus.connect(pl); pl.connect(tail('pulse')); send(pl, .3);
  const NP = MOB ? 2 : 4, PT = [];
  for (let k = 0; k < NP; k++) {
    const p = a.createStereoPanner(); p.pan.value = [-.25, .25, 0, .1][k]; p.connect(pbus); const o1 = OS('sine', 220), g1 = G(0, p); o1.connect(g1); let o2 = null, g2 = null;
    if (!MOB) { o2 = OS('sine', 440); g2 = G(0, p); o2.connect(g2); } PT.push({ o1, g1, o2, g2, f: 0 });
  }
  // bass: sine + clarinet wave through a lowpass; two gains in parallel: the drone (sampled curve) and the pulses (events)
  const bo1 = OS('sine', 55), bo2 = OS(null, 55, CLAR), blp = a.createBiquadFilter(), bmix = G(1), bdr = G(0), bpu = G(0), bbus = G(1, master); blp.type = 'lowpass'; blp.frequency.value = 520 * VBr('bass');
  bo1.connect(bmix); bo2.connect(G(.64 * MSET.bass.x, blp)); blp.connect(bmix); bmix.connect(bdr); bmix.connect(bpu); bdr.connect(bbus); bpu.connect(bbus); send(bbus, .12);
  // pad: 4 voices (clarinet / 'ooh' waves alternating, two detuned oscillators each on desktop), shared vibrato, gain = breath swells (sampled curve)
  const plp = a.createBiquadFilter(); plp.type = 'lowpass'; plp.frequency.value = 1500 * VBr('pad'); plp.Q.value = .4; const padB = G(1); padB.connect(plp); plp.connect(tail('pad')); send(plp, .55);
  const vib = OS('sine', 4.6), vg = G(5); vib.connect(vg);
  const NPV = MOB ? 3 : 4, PADV = [];
  for (let k = 0; k < NPV; k++) {
    const p = a.createStereoPanner(); p.pan.value = [-.3, .3, -.1, .15][k]; const g = G(0, p); p.connect(padB); const os = [];
    for (let z = 0; z < (MOB ? 1 : 2); z++) { const o = OS(null, 110, k % 2 ? OOH : CLAR); o.detune.value = MOB ? 0 : (z ? 1 : -1) * 8 * MSET.pad.x; vg.connect(o.detune); o.connect(g); os.push(o); }
    PADV.push({ g, os, P: rr(5.5, 8.5), ph: r() });
  }
  const Bp = rr(4, 6.5), Bb = rr(6, 9), br = (t, P, ph = 0) => .5 - .5 * Math.cos(6.2832 * (t / P + ph));
  const xf = (t, fn) => { const s = secT(t), n = SEC[s.i + 1], p = SEC[s.i - 1]; let v = fn(s, t); if (n && t > n.tA - .8) v = lerp(v, fn(n, t), smooth(n.tA - .8, n.tA + .8, t)); if (p && t < s.tA + .8) v = lerp(fn(p, t), v, smooth(s.tA - .8, s.tA + .8, t)); return v; };
  const padLv = (s, t) => { const x = (t - s.tA) / (s.tB - s.tA); return s.kind === 'intro' ? .75 * smooth(.35, .9, x) : s.kind === 'outro' ? .9 * (1 - smooth(.55, 1, (t - s.tA) / (tE + 2 - s.tA))) : s.kind === 'break' ? 1 : s.kind === 'drop' ? .5 : .72; };
  const drLv = s => s.kind === 'drop' ? .22 : s.kind === 'build' ? .32 : s.kind === 'intro' ? .7 : .85;
  const dip = t => { let m = 1; for (const s of SEC) if (s.i && Math.abs(t - s.tA) < .7) m = Math.min(m, .35 + .65 * Math.abs(t - s.tA) / .7); return m; };
  const NCV = Math.max(2, Math.ceil((TOTAL - off) * 20)), cdur = Math.max(.1, TOTAL - off);
  const cv = (param, fn) => { const arr = new Float32Array(NCV); for (let i = 0; i < NCV; i++) { const v = fn(off + cdur * i / (NCV - 1)); arr[i] = isFinite(v) ? v : 0; } param.setValueCurveAtTime(arr, ts, cdur); };
  PADV.forEach((V, k) => cv(V.g.gain, t => .052 * VG('pad') * (.15 + .85 * Math.pow(br(t, V.P, V.ph), 1.4)) * xf(t, padLv) * dip(t)));
  cv(bdr.gain, t => .24 * xf(t, drLv) * (.6 + .4 * br(t, Bb)) * Math.min(1, t / 3) * (1 - smooth(tE, tE + 2.5, t)));
  // pad + bass pitch: set at ts, then a short glide at each later chord change
  const s0 = secT(off); PADV.forEach((V, k) => V.os.forEach(o => o.frequency.setValueAtTime(mtof(s0.pad[k]), ts)));
  bo1.frequency.setValueAtTime(mtof(s0.bass), ts); bo2.frequency.setValueAtTime(mtof(s0.bass), ts);
  for (const s of SEC) if (s.i && s.tA > off + .2) PADV.forEach((V, k) => V.os.forEach(o => { o.frequency.setValueAtTime(mtof(SEC[s.i - 1].pad[k]), t0 + s.tA - .15); o.frequency.exponentialRampToValueAtTime(mtof(s.pad[k]), t0 + s.tA + .15); }));
  let pS = -1;
  const fire = (e, tt) => {
    if (e.i === 'm') return play(e, tt);
    if (e.i === 'p') {
      const s = SEC[e.s];
      if (e.s !== pS) { pS = e.s; PT.forEach((P, k) => { const f = mtof(k < 3 ? s.pul[k] : s.pul4); P.o1.frequency.setTargetAtTime(f, tt - .03, .006); if (P.o2) P.o2.frequency.setTargetAtTime(2 * f, tt - .03, .006); }); }
      const v = e.v * (.62 + .38 * br(e.t, Bp)), tau = Math.min(.12, e8 * .45) * VL('pulse');
      PT.forEach((P, k) => {
        const a1 = .085 * VG('pulse') * v * (k < 3 ? 1 : s.kind === 'drop' ? .55 : 0);
        P.g1.gain.setTargetAtTime(a1, tt, .002); P.g1.gain.setTargetAtTime(0, tt + .008, tau);
        if (P.g2) { P.g2.gain.setTargetAtTime(a1 * 1.2 * MSET.pulse.x * (.5 + .5 * v), tt, .0015); P.g2.gain.setTargetAtTime(0, tt + .006, tau * .4); }
      });
      return;
    }
    if (e.i === 'bf' || e.i === 'b') { bo1.frequency.setTargetAtTime(e.f, tt - .004, .008); bo2.frequency.setTargetAtTime(e.f, tt - .004, .008); }
    if (e.i === 'b') { const v = .26 * VG('bass') * e.v * (.7 + .3 * br(e.t, Bb)); bpu.gain.setTargetAtTime(v, tt, .006); bpu.gain.setTargetAtTime(0, tt + .03, (e.v >= .9 ? .45 : Math.min(.16, e8 * .6)) * VL('bass')); }
  };
  let ei = EV.findIndex(e => e.t >= off - .02); if (ei < 0) ei = EV.length;
  return function pump() {
    const hz = a.currentTime + (MOB ? 8 : 30);
    while (ei < EV.length && t0 + EV[ei].t < hz) { const e = EV[ei++], tt = t0 + e.t; if (tt >= a.currentTime - .02 && e.t < TOTAL - .3) fire(e, Math.max(tt, a.currentTime + .005)); }
  };
};
