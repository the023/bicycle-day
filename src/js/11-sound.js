/* ════════════════════════ generative sound (different every play) ════════════════════════ */
// [[MUSIC TOOLS]] (T96) shared composition helpers, pure functions of an rng r (= mulberry32(...)). Used by chiptune2; meant for electro / gamelan later.
// A melody bar = [{s step 0..15, d scale degree above the key's tonic (0 tonic, 7 octave, may be < 0), l length in steps}]; gaps between notes are rests.
const MT = (() => {
  const ri = (r, n) => Math.floor(r() * n), rp = (r, a) => a[ri(r, a.length)], cl = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const MODES = { dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10] };
  const st = (mode, d) => MODES[mode][((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);   // degree -> semitones above the tonic
  // chord progressions (chord roots as degrees, 4 or 8 bars); no = modes where it sounds wrong, only = modes it is made for
  const PROGS = [{ p: [0, 5, 2, 6], no: ['harmonic'] }, { p: [0, 6, 5, 6], no: ['harmonic'] }, { p: [0, 3, 6, 2], no: ['harmonic'] }, { p: [0, 5, 3, 4] }, { p: [0, 3, 0, 4] },
    { p: [3, 4, 0, 0] }, { p: [5, 3, 0, 4] }, { p: [0, 3, 0, 3], only: ['dorian'] }, { p: [0, 1, 0, 6], only: ['dorian', 'phrygian'] }, { p: [0, 5, 3, 1, 0, 5, 3, 4] },
    { p: [0, 5, 3, 6, 0, 5, 3, 4], no: ['harmonic'] }, { p: [0, 2, 3, 4, 5, 3, 1, 4], no: ['harmonic'] }, { p: [0, 6, 5, 4, 3, 5, 4, 4], no: ['harmonic'] }, { p: [0, 0, 5, 5, 3, 3, 4, 4] }];
  const prog = (r, mode) => rp(r, PROGS.filter(x => !(x.no || []).includes(mode) && (!x.only || x.only.includes(mode)))).p;
  // nearest chord tone (as a degree) to d, for chord root degree cr (sev = with the 7th); ties go down
  const fit = (d, cr, sev) => { let b = d, bd = 99; for (let x = d - 3; x <= d + 3; x++) { const m = ((x - cr) % 7 + 7) % 7; if ((m === 0 || m === 2 || m === 4 || (sev && m === 6)) && Math.abs(x - d) < bd) { bd = Math.abs(x - d); b = x; } } return b; };
  // one-bar rhythm cells [step, length]: syncopations (3+3+2, off-beat starts) and rests
  const RHY = [[[0, 3], [3, 3], [6, 2], [10, 2], [12, 4]], [[0, 2], [2, 2], [4, 4], [10, 2], [12, 2], [14, 2]], [[0, 6], [6, 2], [8, 3], [11, 5]], [[2, 2], [4, 2], [6, 4], [12, 4]],
    [[0, 4], [6, 2], [8, 6], [14, 2]], [[0, 1], [1, 1], [2, 2], [4, 4], [8, 3], [11, 5]], [[0, 3], [3, 1], [4, 4], [8, 2], [10, 6]], [[0, 2], [3, 3], [6, 2], [8, 8]], [[0, 4], [4, 2], [7, 3], [10, 2], [12, 4]]];
  const IVS = [-1, 1, -1, 1, 1, -2, 2, 2, -3, 3, 4, -4, 5, -5, 7];   // weighted intervals: steps, thirds, leaps up to the octave
  const motif = (r, lo = -2, hi = 9) => {   // a leap (>= 4th) is followed by a step back the other way (gap fill), so the line sounds composed, not random
    let d = rp(r, [0, 2, 4, 4, 7]), last = 0;
    return rp(r, RHY).map(([s, l], j) => {
      if (j) { let iv = Math.abs(last) >= 3 ? -Math.sign(last) * (1 + ri(r, 2)) : rp(r, IVS); if (d + iv > hi || d + iv < lo) iv = -iv; d = cl(d + iv, lo, hi); last = iv; }
      return { s, d, l };
    });
  };
  const orn = (r, m) => {   // passing / neighbour notes: a long note before a third gets split and walks through the middle degree; a repeated long note gets an upper neighbour
    const out = [];
    m.forEach((e, j) => {
      const n = m[j + 1], gap = n ? n.d - e.d : 0;
      if (n && e.l >= 4 && Math.abs(gap) === 2 && r() < .8) out.push({ ...e, l: e.l - 2 }, { s: e.s + e.l - 2, d: e.d + gap / 2, l: 2 });
      else if (n && e.l >= 4 && gap === 0 && r() < .6) out.push({ ...e, l: e.l - 1 }, { s: e.s + e.l - 1, d: e.d + 1, l: 1 });
      else out.push({ ...e });
    });
    return out;
  };
  // a variation of a motif bar: tail (new ending), seq (diatonic sequence), inv (inverted contour), shift (2 steps later = syncopated), thin (rests), orn, oct, same
  const vary = (r, m, how) => {
    let c = m.map(e => ({ ...e }));
    if (how === 'tail') { for (let j = Math.max(1, c.length - 2); j < c.length; j++) c[j].d += rp(r, [-2, -1, 1, 2, 3]); }
    else if (how === 'seq') { const k = rp(r, [1, -1, 2, 3]); c.forEach(e => e.d += k); }
    else if (how === 'inv') { const p = c[0].d; c.forEach(e => e.d = p - (e.d - p)); }
    else if (how === 'shift') c = c.map(e => ({ ...e, s: e.s + 2 })).filter(e => e.s < 16).map((e, j, A) => ({ ...e, l: Math.min(e.l, (A[j + 1] ? A[j + 1].s : 16) - e.s) }));
    else if (how === 'thin') { const n = 1 + ri(r, 2); for (let i = 0; i < n && c.length > 2; i++) c.splice(1 + ri(r, c.length - 1), 1); }
    else if (how === 'orn') c = orn(r, c);
    else if (how === 'oct') c.forEach(e => e.d += 7);
    c.forEach(e => e.d = cl(e.d, -4, 13)); return c;
  };
  const cad = (m, end) => {   // first half of a bar + a long note from step 8 on `end` (4 = half cadence, 0 = home), the octave closer to the last note
    const c = m.filter(e => e.s < 8).map(e => ({ ...e, l: Math.min(e.l, 8 - e.s) })), p = c.length ? c[c.length - 1].d : end;
    c.push({ s: 8, d: Math.abs(end + 7 - p) < Math.abs(end - p) ? end + 7 : end, l: 8, cad: 1 }); return c;
  };
  // an 8-bar period: A A' B half-cadence | A(ornamented) A'' B' full cadence. The motif comes back varied instead of a random walk.
  const period = r => {
    const A = motif(r), B = motif(r), how = () => rp(r, ['tail', 'seq', 'inv', 'orn', 'shift', 'thin']);
    return [A, vary(r, A, how()), B, cad(vary(r, B, 'tail'), 4), vary(r, A, 'orn'), vary(r, A, how()), vary(r, B, how()), cad(A, 0)];
  };
  // drum patterns (steps): K kick, S snare, H closed hat, O open hat
  const DRUMS = [{ K: [0, 8], S: [4, 12], H: [2, 6, 10, 14] }, { K: [0, 4, 8, 12], S: [4, 12], H: [2, 6, 10, 14], O: [14] }, { K: [0, 7, 8, 14], S: [4, 12], H: [0, 2, 4, 6, 8, 10, 12, 14] },
    { K: [0, 3, 8, 11], S: [4, 12], H: [0, 2, 4, 6, 8, 10, 12, 14] }, { K: [0, 10], S: [8], H: [0, 4, 8, 12] }, { K: [0, 6, 10], S: [4, 12, 15], H: [0, 2, 3, 6, 8, 10, 11, 14] },
    { K: [0, 8, 9], S: [4, 12], H: [2, 6, 10, 14], O: [6] }, { K: [0, 3, 6, 10], S: [4, 12], H: [0, 2, 4, 6, 8, 10, 12, 14], O: [15] }];
  // fills for the last bar before a section change, from step 8: [step, k kick / s snare / t tom / o open hat, velocity 0..1, tom pitch factor]; 'stop' = silence then two hits
  const FILLS = { roll: [[8, 'k', .8], [8, 's', .45], [10, 's', .55], [12, 'k', .8], [12, 's', .65], [13, 's', .7], [14, 's', .85], [15, 's', 1]],
    toms: [[8, 's', .7], [10, 's', .6], [12, 't', 1, 1.6], [13, 't', .9, 1.35], [14, 't', .9, 1.1], [15, 't', .8, .9]],
    stop: [[14, 's', .7], [15, 's', .9]],
    synco: [[8, 'k', .8], [11, 'k', .7], [11, 's', .6], [14, 's', .8], [15, 's', 1]],
    flam: [[8, 's', .5], [10, 'o', .6], [12, 's', .6], [13, 's', .6], [14, 'k', .7], [14, 's', .8], [15, 's', 1]] };
  const fill = (r, next) => next === 'drop' ? rp(r, ['roll', 'stop', 'toms', 'roll']) : rp(r, ['roll', 'toms', 'synco', 'flam']);
  return { ri, rp, MODES, st, prog, fit, motif, orn, vary, cad, period, DRUMS, FILLS, fill };
})();
let analyser = null, fdata = null;
function buildAudio(a, t0, off = 0) {
  EVT = []; EVTM = MUSIC;   // T101: refilled by the style branches below (whole-piece plan loops only)
  const rand = rng, pick = arr => arr[Math.floor(rand() * arr.length)];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12), SC = SCALE;            // D dorian
  const note = i => ROOT + SC[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
  const master = a.createGain(), fi = Math.min(5, TOTAL * .15), fo = Math.min(10, TOTAL * .25);
  const ts = t0 + off;   // song time 'off' happens now when seeking
  const TRIM = ARC.piano || MUSIC === 'chiptune' || MUSIC === 'chiptune2' || MUSIC === 'drone' ? 1 : MUSIC === 'gamelan' ? 2 : MUSIC === 'minimal' ? .87 : MUSIC === 'berlin' ? 1 : MUSIC === 'lofi' ? .75 : MUSIC === 'electro' ? .72 : .8;   // the richer kit voices are ~2-3 dB hotter than the old plain ones
  master.gain.setValueAtTime(0, ts); master.gain.linearRampToValueAtTime(.9 * TRIM, ts + (off ? 1.2 : fi));
  master.gain.setValueAtTime(.9 * TRIM, Math.max(ts + .01, t0 + TOTAL - fo)); master.gain.linearRampToValueAtTime(0, Math.max(ts + .02, t0 + TOTAL - .3));   // clamped: a seek into the last seconds must not schedule at a negative time
  const comp = a.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.knee.value = 14;
  analyser = a.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = .6; fdata = new Uint8Array(analyser.frequencyBinCount);
  master.connect(comp); comp.connect(analyser); const outG = a.createGain(); outG.gain.value = +document.getElementById('vol').value; volNode = outG; comp.connect(outG); outG.connect(a.destination);
  const irL = a.sampleRate * (MOBILE ? 1.8 : 3.5), ir = a.createBuffer(2, irL, a.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < irL; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / irL, 2.5); }
  const rev = a.createConvolver(); rev.buffer = ir; const rg = a.createGain(); rg.gain.value = .55; rev.connect(rg); rg.connect(master);
  const dly = a.createDelay(2); dly.delayTime.value = .42; const fb = a.createGain(); fb.gain.value = .42;
  const dlf = a.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2400; dly.connect(dlf); dlf.connect(fb); fb.connect(dly); dlf.connect(master); if (!MOBILE) dlf.connect(rev);
  const send = (n, r, d = 0) => { if (r) { const s = a.createGain(); s.gain.value = r; n.connect(s); s.connect(rev); } if (d) { const s = a.createGain(); s.gain.value = d; n.connect(s); s.connect(dly); } };
  const nb = a.createBuffer(1, a.sampleRate * 2, a.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;
  const noise = (t, d) => { const s = a.createBufferSource(); s.buffer = nb; s.loop = true; s.start(t, rand() * 1.5); s.stop(t + d); return s; };
  const env = (t, at, pk, dec, dest) => { const g = a.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + at); g.gain.exponentialRampToValueAtTime(.0001, t + at + dec); g.connect(dest); return g; };

  if (ARC.piano) {   // piano: additive partials (slight inharmonicity), fast attack, long decay, hammer noise, reverb send; no drone/heartbeat/arps
    const live = [], onsets = [], CAP = MOBILE ? 120 : 240;   // sounding notes (oldest first) and recent onset times: oscillator cap + density-aware voices (the slow styles peak near 225 oscillators, below the cap)
    const pn = (t, m, v, rs = 1, dl = 9) => {
      t = Math.max(t, a.currentTime);
      while (onsets.length && onsets[0] < t - 1) onsets.shift();
      onsets.push(t); const dd = clamp((onsets.length - 8) / 12);   // 0 up to 8 notes in the last second (the slow styles never leave it), 1 at 20: fewer partials, one string, shorter decay
      const f = mtof(m), tau = lerp(3.4, .8, clamp((m - 36) / 60)) * rs * (1 - .5 * dd), K0 = Math.min(m < 50 ? 8 : m < 70 ? 6 : 4, MOBILE ? 5 : 8), lt = dl < 9, K1 = lt ? Math.min(K0, m < 60 ? 5 : 4) : K0, K = dd ? Math.max(2, Math.round(K1 * (1 - .55 * dd))) : K1, one = dl < .2 || dd > .5 || lt && m >= 60, lp = a.createBiquadFilter(), out = a.createGain(), oscs = [];
      lp.type = 'lowpass'; lp.frequency.value = 900 + 4500 * v + f; out.gain.value = v * .2; lp.connect(out); out.connect(master); send(out, .32);
      let end = t; const es = [];
      for (let k = 1; k <= K; k++) for (let s = 0; s < (k === 1 && !MOBILE && !one ? 2 : 1); s++) {   // two slightly detuned strings on the fundamental
        const o = a.createOscillator(), g = a.createGain(), A = (k === 1 ? (one ? .7 : .55) : .9 / Math.pow(k, 1.15)) * (k > 2 ? .5 + v : 1);
        o.frequency.value = f * k * Math.sqrt(1 + 3e-4 * k * k * (f > 260 ? 1.6 : 1)); o.detune.value = s ? 1.6 : -1.6;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(A, t + .004); const tk = tau / (1 + .55 * (k - 1)); g.gain.setTargetAtTime(0, t + .004, tk);
        o.connect(g); g.connect(lp); o.start(t); const e = t + Math.min(tau * 5, 12, .1 + 8 * tk); o.stop(e); end = Math.max(end, e); oscs.push(o); es.push(e);   // stop once inaudible (-70 dB): the upper partials die in ~1 s, so far fewer live oscillators
      }
      const n = noise(t, .06), bp = a.createBiquadFilter(), ng = a.createGain(); bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 4, 5000); bp.Q.value = 1.2;   // hammer
      ng.gain.setValueAtTime(v * .25, t); ng.gain.setTargetAtTime(0, t, .012); n.connect(bp); bp.connect(ng); ng.connect(out);
      for (let i = live.length; i--;) if (live[i].end <= t) live.splice(i, 1);
      for (let c = live.reduce((q, o) => q + o.es.filter(e => e > t).length, oscs.length), lim = CAP - 90 * dd - (lt ? 60 : 0); c > lim && live.length;) { const o = live.shift(); c -= o.es.filter(e => e > t).length; o.out.gain.setValueAtTime(o.v, t); o.out.gain.setTargetAtTime(0, t, .03); o.oscs.forEach(x => { if (o.end > t + .25) x.stop(t + .25); }); }   // voice cap: the oldest notes fade out in ~0.1 s
      live.push({ end, out, oscs, es, v: v * .2 });
    };
    {   // T102: phrase events (data only): the first melody note after a gap >= 1.8 s (s .2-.35), key / section / bridge changes (s .5); the whole piece, whatever `off` is
      const key = PKEY.slice().sort((x, y) => x - y), L = key.map(t => ({ t, k: 'phrase', s: .5, d: 0 }));
      MEL.forEach((n, i) => { const g = n.t - (i ? MEL[i - 1].t : 0); if (g >= 1.8 && !key.some(q => Math.abs(q - n.t) < 1.5)) L.push({ t: n.t, k: 'phrase', s: +(.2 + .15 * clamp((g - 1.8) / 4)).toFixed(3), d: 0 }); });
      evtSet(L);
    }
    let pi = NOTES.findIndex(n => n.t >= off); if (pi < 0) pi = NOTES.length;
    return function pump() { const hz = a.currentTime + (MOBILE ? 8 : 30); while (pi < NOTES.length && t0 + NOTES[pi].t < hz) { const n = NOTES[pi++]; if (t0 + n.t > a.currentTime - .05) pn(Math.max(t0 + n.t, a.currentTime), n.m, n.v, n.r, n.l); } };
  }

  // [[KIT]] shared instrument kit for electro + ambient (chiptune/drone/piano keep their own voices). makeKit(dest, nBase): dest = tonal bus, nBase = persistent oscillators of the caller.
  // Voices return their output gain (for reverb/delay sends). Sound palettes (one per play, seeded; electro may switch per section) pick bass/lead/pad/arp/bell/drum character.
  const DEFP = { br: 1, sat: .3, ksat: .3, k0: 180, k1: 50, kd: .1, click: .2, snr: 'snare', snF: 1900, hatF: 7500, det: 12, pdet: 7, fmr: 2, fi: 2.5, bellR: 3.5, air: .005 };
  const EPALS = [   // electro
    { n: 'analog-warm', bass: 'sub', lead: 'super', pad: 'warm', arp: 'saw', br: .95, sat: .3, ksat: .3, k0: 190, click: .2, snr: 'snare', det: 12 },
    { n: 'reese-dark', bass: 'reese', lead: 'pwm', pad: 'hollow', arp: 'tri', br: .7, sat: .55, ksat: .55, k0: 150, k1: 44, kd: .13, click: .12, snr: 'both', snF: 1500, hatF: 6500, det: 18 },
    { n: 'acid-line', bass: 'acid', lead: 'super', pad: 'string', arp: 'saw', br: 1.05, sat: .5, ksat: .45, k0: 230, k1: 52, click: .35, snr: 'clap', snF: 2200, hatF: 8500, det: 9 },
    { n: 'glass-fm', bass: 'fm', lead: 'fm', pad: 'glass', arp: 'fm', br: 1.2, sat: .15, ksat: .15, k0: 170, click: .3, snr: 'snare', hatF: 9500, fmr: 3, fi: 3, pdet: 4 },
    { n: 'tape-mallet', bass: 'pulse', lead: 'fm', pad: 'warm', arp: 'mallet', br: .6, sat: .4, ksat: .35, k0: 160, k1: 46, click: .1, snr: 'both', snF: 1300, hatF: 5500, fmr: 1, fi: 1.2, pdet: 10 },
    { n: 'neon-saw', bass: 'reese', lead: 'super', pad: 'string', arp: 'saw', br: 1.25, sat: .35, ksat: .5, click: .4, snr: 'clap', hatF: 9000, det: 22 }];
  const APALS = [   // ambient: calm, soft
    { n: 'airy-glass', pad: 'glass', bell: 'glass', arp: 'mallet', br: 1.2, pdet: 5, air: .007 },
    { n: 'warm-wood', pad: 'warm', bell: 'fm', bellR: 2, arp: 'tri', br: .85, pdet: 8, air: .004 },
    { n: 'deep-hollow', pad: 'hollow', bell: 'fm', bellR: 1.5, arp: 'tri', br: .7, pdet: 6, air: .006 },
    { n: 'silk-strings', pad: 'string', bell: 'glass', arp: 'fm', br: 1, pdet: 9, air: .005, fmr: 3, fi: 1.5 },
    { n: 'dusk-bells', pad: 'warm', bell: 'fm', bellR: 5.19, arp: 'mallet', br: .6, pdet: 11, air: .003 }];
  const PRp = mulberry32((((seedUsed | 0) * 40503) + 91) >>> 0);   // palette rng: depends only on the seed (stable across seeks)
  const mkPal = p => Object.assign({}, DEFP, p), FPAL = Q.get('spal');   // ?spal=<index> forces a sound palette (tests)
  const makeKit = (dest, nBase, noChorus) => {
    const CAPV = (MOBILE ? 16 : 25) - nBase - (MOBILE ? 4 : noChorus ? 4 : 5), liveV = [], endT = t0 + TOTAL + 2;   // persistents: chorus LFO, air noise, pad LFO (mobile: pad LFO) + a margin of 1-2 for forced voices
    const vo = (t, d, n = 1, force, res = 0) => { for (let i = liveV.length - 1; i >= 0; i--) if (liveV[i].e < a.currentTime) liveV.splice(i, 1); let c = 0; for (const p of [t, ...liveV.filter(x => x.s > t && x.s < t + d).map(x => x.s)]) { let k = 0; for (const x of liveV) if (x.s <= p && x.e > p) k += x.n; c = Math.max(c, k); }   // worst overlap anywhere inside [t, t+d]
      if (!force && c + n > CAPV - res) return false; liveV.push({ s: t, e: t + d, n }); return true; };
    const mkWave = am => { const re = new Float32Array(am.length + 1), im = new Float32Array(am.length + 1); am.forEach((x, i) => im[i + 1] = x); return a.createPeriodicWave(re, im); };
    const WV = { warm: mkWave(Array.from({ length: 14 }, (_, i) => (i % 2 ? .8 : 1) / Math.pow(i + 1, 1.12))), hollow: mkWave(Array.from({ length: 16 }, (_, i) => i % 2 ? 0 : 1 / (i + 1))), glass: mkWave([1, 0, .35, 0, .12, 0, .05]) };
    { const re = new Float32Array(25), im = new Float32Array(25); for (let k = 1; k < 25; k++) re[k] = 2 * Math.sin(k * Math.PI * .25) / (k * Math.PI); WV.pulse = a.createPeriodicWave(re, im); }   // 25 % pulse
    const osc = (w, f, ts_, te_, det = 0) => { const o = a.createOscillator(); if (typeof w === 'string') o.type = w; else o.setPeriodicWave(w); o.frequency.value = f; if (det) o.detune.value = det; o.start(ts_); o.stop(te_); return o; };
    const satBus = (out, pk) => { const pre = a.createGain(), sh = a.createWaveShaper(), post = a.createGain(), c = new Float32Array(1025), T4 = Math.tanh(4); for (let i = 0; i <= 1024; i++) c[i] = Math.tanh(4 * (i / 512 - 1)) / T4; sh.curve = c; if (!MOBILE) sh.oversample = '2x'; pre.connect(sh); sh.connect(post); post.connect(out);
      return { in: pre, set: (am, t) => { const x = .25 + .75 * am; pre.gain.setTargetAtTime(x / pk, t, .05); post.gain.setTargetAtTime(pk * T4 / Math.tanh(4 * x), t, .05); } }; };   // normalised soft clipper: more 'am' = more drive, same peak
    let chor = null;   // chorus-ish: one modulated delay, shared (desktop only)
    if (!MOBILE && !noChorus) { const dl = a.createDelay(.05), l = a.createOscillator(), lg = a.createGain(), ou = a.createGain(); dl.delayTime.value = .017; l.frequency.value = .5; lg.gain.value = .004; l.connect(lg); lg.connect(dl.delayTime); ou.gain.value = .5; dl.connect(ou); ou.connect(dest); l.start(ts); l.stop(endT); chor = dl; }
    const bus = (amt) => { const g = a.createGain(); g.connect(dest); if (chor) { const s = a.createGain(); s.gain.value = amt; g.connect(s); s.connect(chor); } return g; };
    const leadB = bus(.6), padB = bus(.5);
    const plfo = a.createOscillator(), plg = a.createGain(); plfo.frequency.value = .09 + PRp() * .1; plg.gain.value = 450; plfo.connect(plg); plfo.start(ts); plfo.stop(endT);   // slow filter motion for every pad
    const air = a.createGain(); air.gain.value = 0;   // breath of noise under the pads (desktop)
    if (!MOBILE) { const n = noise(ts, endT - ts), bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = .4; n.connect(bp); bp.connect(air); air.connect(padB); }
    // drums: soft-clipped kick bus, snare band, metallic hat bands
    const kb = satBus(master, 1), kHp = a.createBiquadFilter(); kHp.type = 'highpass'; kHp.frequency.value = 2200; kHp.connect(kb.in);
    const bb = satBus(dest, .4);
    const snB = a.createBiquadFilter(); snB.type = 'bandpass'; snB.frequency.value = 1900; snB.Q.value = .7; snB.connect(master); send(snB, .25);
    const hIn = a.createGain(), hHp = a.createBiquadFilter(), hM = [8300, 11200].map(f => { const b = a.createBiquadFilter(), g = a.createGain(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = 5; g.gain.value = .6; hIn.connect(b); b.connect(g); g.connect(master); return b; });
    hHp.type = 'highpass'; hHp.frequency.value = 7500; hIn.connect(hHp); hHp.connect(master);
    const setPal = (P, t) => { bb.set(P.sat, t); kb.set(P.ksat, t); hHp.frequency.setTargetAtTime(P.hatF, t, .05); hM[0].frequency.setTargetAtTime(P.hatF * 1.1, t, .05); hM[1].frequency.setTargetAtTime(P.hatF * 1.5, t, .05); snB.frequency.setTargetAtTime(P.snF, t, .05); air.gain.setTargetAtTime(P.air, t, .3); };
    const bass = (t, f, d, v, c, P) => {
      const ty = P.bass, big = ty === 'reese' && !MOBILE, fm = ty === 'fm', acid = ty === 'acid';
      if (!vo(t, d + .1, big || fm ? (big ? 3 : 2) : 2, 1)) return;
      const e = t + d + .08, lp = a.createBiquadFilter(), g = a.createGain(), vv = v * (big ? .65 : 1);
      lp.type = 'lowpass'; lp.Q.value = acid ? 12 : ty === 'reese' ? 2.5 : 5;
      lp.frequency.setValueAtTime(clamp(c * P.br * (acid ? 1.7 : 1), 200, 14000), t); lp.frequency.exponentialRampToValueAtTime(acid ? 80 : 140, t + d * (acid ? .75 : 1));
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vv, t + .006); g.gain.setValueAtTime(vv, t + d * .7); g.gain.linearRampToValueAtTime(.0001, t + d);
      if (fm) { const cr = osc('sine', f, t, e), m = osc('sine', f, t, e), mg = a.createGain(); mg.gain.setValueAtTime(f * 3.2, t); mg.gain.exponentialRampToValueAtTime(f * .3, t + d); m.connect(mg); mg.connect(cr.frequency); cr.connect(lp); }
      else { const sg = a.createGain(); sg.gain.value = .55; osc('sine', f, t, e).connect(sg); sg.connect(g);   // sub keeps the note audible on small speakers
        if (ty === 'reese') { osc('sawtooth', f, t, e, big ? -P.det : 0).connect(lp); if (big) osc('sawtooth', f, t, e, P.det).connect(lp); }
        else osc(ty === 'pulse' ? WV.pulse : 'sawtooth', f, t, e).connect(lp); }
      lp.connect(g); g.connect(bb.in); };
    const lead = (t, f, v, d, P, det) => {
      const ty = P.lead, n = ty === 'fm' ? 2 : MOBILE ? 1 : ty === 'super' ? 3 : 2;
      if (!vo(t, d + .25, n)) return;
      const e = t + d + .25, g = a.createGain(), lp = a.createBiquadFilter(), cb = clamp(f * 3.5 * P.br, 1200, 8000);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .012); g.gain.setValueAtTime(v, t + d); g.gain.linearRampToValueAtTime(.0001, t + d + .2);
      lp.type = 'lowpass'; lp.Q.value = 1.2; lp.frequency.setValueAtTime(cb * 2.2, t); lp.frequency.exponentialRampToValueAtTime(cb, t + .2);
      if (ty === 'fm') { const cr = osc('sine', f, t, e), m = osc('sine', f * P.fmr, t, e), mg = a.createGain(); mg.gain.setValueAtTime(f * P.fi, t); mg.gain.exponentialRampToValueAtTime(f * P.fi * .3, t + d); m.connect(mg); mg.connect(cr.frequency); cr.connect(lp); }
      else for (let i = 0; i < n; i++) { const x = n > 1 ? (i - (n - 1) / 2) * det * 1.4 : 0, o = osc(ty === 'pwm' ? WV.pulse : 'sawtooth', f, t, e, x); o.detune.linearRampToValueAtTime(x + (i % 2 ? 4 : -4), t + d); o.connect(lp); }   // detune drifts slowly during the note
      lp.connect(g); g.connect(leadB); };
    const pluck = (t, f, v, d, P, dst = dest, res = 0) => {
      const ty = P.arp, n = ty === 'fm' || ty === 'mallet' ? 2 : 1;
      if (!vo(t, d + .1, n, 0, res)) return null;
      const e = t + d + .1, g = env(t, ty === 'mallet' ? .002 : .003, v, d, dst);
      if (ty === 'fm') { const cr = osc('sine', f, t, e), m = osc('sine', f * 3, t, e), mg = a.createGain(); mg.gain.setValueAtTime(f * (P.fi || 2) * .7, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + d * .5); m.connect(mg); mg.connect(cr.frequency); cr.connect(g); }
      else if (ty === 'mallet') { osc('sine', f, t, e).connect(g); const g2 = env(t, .001, v * .45, d * .2, dst); osc('sine', f * 3.99, t, e).connect(g2); }
      else { const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(clamp(f * 8 * P.br, 800, 9000), t); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.4, 400), t + d * .6); osc(ty === 'tri' ? 'triangle' : 'sawtooth', f, t, e).connect(lp); lp.connect(g); }
      return g; };
    const bell = (t, f, v, d, P, dst = dest, res = 0) => {
      const gl = P.bell === 'glass', n = gl ? (MOBILE ? 2 : 3) : 2;
      if (!vo(t, d + .3, n, 0, res)) return null;
      const e = t + d + .3, out = env(t, .004, v, d, dst);
      if (gl) [[1, 1], [2.76, .4], [5.4, .15]].slice(0, n).forEach(([r, k]) => { const g = a.createGain(); g.gain.setValueAtTime(k, t); g.gain.exponentialRampToValueAtTime(.002, t + d / Math.sqrt(r)); osc('sine', f * r, t, e).connect(g); g.connect(out); });
      else { const cr = osc('sine', f, t, e), m = osc('sine', f * P.bellR, t, e), mg = a.createGain(); mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(1, t + d * .65); m.connect(mg); mg.connect(cr.frequency); cr.connect(out); }
      return out; };
    const pad = (t, hold, at, rel, notes, v, P, fc, force, thin) => {   // thin: top note single (fewer oscillators). notes = midi list; envelope: up over `at`, hold until t+hold, down over `rel`
      const per = MOBILE ? 1 : 2, e = t + hold + rel + .1, cnt = notes.length * per - (thin && per > 1 ? 1 : 0);
      if (!vo(t, hold + rel, cnt, force)) return null;
      const lp = a.createBiquadFilter(), g = a.createGain(), w = P.pad === 'string' ? 'sawtooth' : WV[P.pad];
      lp.type = 'lowpass'; lp.Q.value = .8; lp.frequency.value = fc * P.br; plg.connect(lp.detune);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + at); g.gain.setValueAtTime(v, t + Math.max(at, hold)); g.gain.linearRampToValueAtTime(.0001, t + Math.max(at, hold) + rel);
      notes.forEach((m, i) => { for (let k = 0; k < (thin && i === notes.length - 1 ? 1 : per); k++) osc(w, mtof(m), t, e, (per > 1 ? (k ? 1 : -1) * P.pdet : 0) + (i - 1) * 2).connect(lp); });
      lp.connect(g); g.connect(padB); return g; };
    const kick = (t, v, P) => {
      vo(t, .45, 2, 1); const o = a.createOscillator(); o.frequency.setValueAtTime(P.k0, t); o.frequency.exponentialRampToValueAtTime(P.k1, t + P.kd); o.frequency.exponentialRampToValueAtTime(P.k1 * .82, t + .3);
      o.connect(env(t, .002, v, .32, kb.in)); o.start(t); o.stop(t + .4);
      if (P.click) noise(t, .02).connect(env(t, .0005, v * P.click, .01, kHp)); };
    const snare = (t, v, body, P) => {
      const tone = body && P.snr !== 'clap', clap = P.snr === 'clap' || (P.snr === 'both' && body);
      if (!vo(t, .3, tone ? 3 : 1)) return;
      const n = noise(t, .3), g = a.createGain(); g.gain.setValueAtTime(.0001, t);
      if (clap) { for (let i = 0; i < 3; i++) { g.gain.setValueAtTime(v * .8, t + i * .011); g.gain.exponentialRampToValueAtTime(.0001, t + i * .011 + .009); } g.gain.setValueAtTime(v, t + .033); g.gain.exponentialRampToValueAtTime(.0001, t + .033 + .17); }
      else { g.gain.exponentialRampToValueAtTime(v, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + .17); }
      n.connect(g); g.connect(snB);
      if (tone) for (const [f0, f1, k] of [[190, 140, .5], [330, 250, .25]]) { const o = a.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + .08); o.connect(env(t, .002, v * k, .09, master)); o.start(t); o.stop(t + .16); } };
    const hat = (t, v, open) => { if (!vo(t, .3)) return; noise(t, open ? .3 : .06).connect(env(t, .002, v, open ? .22 : .035, hIn)); };
    return { vo, WV, osc, air, setPal, bass, lead, pluck, bell, pad, kick, snare, hat, snB };
  };

  // [[STYLE electro]]: dark melodic techno / synthwave. Beat grid = BEATS (same as the picture's pulse). Section plan from the seed (kinds intro/drop/break/outro), per-section key shift, chords, drums, bass, arp, lead, cutoff.
  if (MUSIC === 'electro') {
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
  }
  // (do not put style code between these markers; each style has its own marker)
  // [[STYLE chiptune]]: 8-bit game music. 2 pulse channels (duty via saw - delayed saw), triangle bass, noise/sine drums, all on PERSISTENT oscillators
  // (parameters are scheduled with setValueAtTime, no node per note). Everything is a pure function of (seed, bar), so seek just resumes at a bar.
  if (MUSIC === 'chiptune') {
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
    const schedBar = k => {
      const S = secAt(k), lb = k - S.k0, nb = S.k1 - S.k0, br = mulberry32(S.seed * 131 + lb * 17 + 5), tbar = B[4 * k];
      const pr = cc((tbar - S.tA) / Math.max(1, S.tB - S.tA), 0, 1);
      const d = cc(Math.max(.14, energy(tbar / TOTAL) * .7 + .2 + S.eOff + S.eRamp * pr), 0, 1), vs = .4 + .75 * d, role = S.role, brk = role === 'break';
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
  }
  // (spacer)
  // [[STYLE chiptune2]] (T96): a richer 8-bit style next to `chiptune` (which stays as it was). Same rules: PERSISTENT oscillators, pure function of (seed, bar), window.CHIPPLAN.
  // Melody = MT.period (motif + variations, leaps, passing notes, syncopation, rests); mode (dorian / aeolian / harmonic minor) and key per section, 7th chords;
  // 3 pulse channels (lead with delayed vibrato, counter-melody or echo, fast tracker arps), triangle bass with small slides, drum pool + fills before section changes.
  if (MUSIC === 'chiptune2') {
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
    const schedBar = k => {
      const S = secAt(k), lb = k - S.k0, nb = S.k1 - S.k0, br = mulberry32(S.seed * 131 + lb * 17 + 5), tbar = B[4 * k], NX = SEC[S.i + 1];
      const pr = cc((tbar - S.tA) / Math.max(1, S.tB - S.tA), 0, 1);
      const d = cc(Math.max(.14, energy(tbar / TOTAL) * .7 + .2 + S.eOff + S.eRamp * pr), 0, 1), vs = .4 + .75 * d, role = S.role, brk = role === 'break';
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
  }
  // (spacer)
  // [[STYLE drone]]: same, for MUSIC === 'drone'
  if (MUSIC === 'drone') {   // experimental drone / dark ambient: section plan from the seed, persistent oscillator layers driven by sampled curves, sparse transients (grains, scrapes, thuds)
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
  }


  // [[STYLE gamelan]]: tuned bronze percussion. Seeded tuning (pelog-like 5 of 7 unequal degrees, or slendro-like 5 near-equal), colotomic cycle (gong ageng at the cycle end, kenong / kempul / kethuk),
  // balungan core melody on demung + saron, fast interlocking polos/sangsih (imbal) in dense sections, gender in calm ones. The whole piece is a sorted event list built from the seed (like the piano: seek just resumes it).
  // Metal = sine partial stacks (inharmonic ratios, own decay per partial) + a short noise strike; paired instruments are detuned by a few Hz (ombak beating); each hit has its own velocity, tiny timing jitter and round-robin detune.
  if (MUSIC === 'gamelan') {
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
  }

  // [[STYLE minimal]] (T22): Reich / Riley-style minimalism. One seeded cell of 8-12 eighths in a mode; every melodic voice plays that cell: phasing (a second marimba drifts one eighth ahead, then locks in),
  // additive build-up / thinning (rests filled in one per cycle, removed the same way), canon (vibraphone n eighths behind) and augmentation (vibraphone in quarters in the calm sections).
  // A steady eighth pulse (chord, breath swells) and one chord per section from a 4-6 chord cycle (bass + pad change, the pulse re-enters). Whole piece = a sorted event list built from the seed (seek resumes it).
  // PERSISTENT oscillators for the pulse chord (retriggered by automation), the bass and the clarinet / voice pad; per-note nodes only for the mallets (marimba, vibraphone, e-piano), with a voice budget.
  if (MUSIC === 'minimal') {
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
  }

  // [[STYLE berlin]] (T119): Berlin School (Tangerine Dream / Schulze, 1970s). No drums: the rhythm IS the sequencer. One constant tempo per piece (112-128 BPM, seeded; BEATS is re-laid on it).
  // Voices, all PERSISTENT oscillators driven by automation: sequencer bass (saw + square + sine through a resonant lowpass; per-step gate on a VCA, per-step filter accent on filter.detune,
  // slow cutoff / resonance / level curves on the other params), a second sequence (soft square, 16ths, another length = phasing), 3 detuned-saw pad voices with voice leading, a portamento lead (calm sections).
  // Same material everywhere: one mode, one chord progression per section, the sequence pattern follows the chord root diatonically, the 2nd sequence = the pattern's own tones an octave+ up,
  // the lead = MT.period fitted to the chords. Plan (sections, chords, patterns, lead notes) drawn up front from the seed, so a seek just resumes it.
  if (MUSIC === 'berlin') {
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
  }

  // [[STYLE lofi]] (T23): lo-fi / trip-hop, kept small. 70-90 BPM, swung 16ths. Sections intro (chords + crackle) / groove (drums in) / break (drums out) / outro; energy = drums on/off + filter brightness.
  // Rhodes-like 7th / rootless 9th chords (4-bar loop per section from MT.prog, voice-led in C3-E4) and a round bass on the roots, both on PERSISTENT oscillators re-articulated by automation;
  // tape wobble = two slow LFOs on the chord/motif detune; dusty drums = short per-note nodes under a voice budget; vinyl crackle + hiss = one looped buffer. The whole plan is drawn from the seed (seek just resumes it).
  if (MUSIC === 'lofi') {
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
  }

  // — ambient engine: sound palette (seeded, one per play) + the shared kit; drone = two soft saws that slowly drift apart (beating), a sub, and a filter that opens with the score
  const AP = mkPal(APALS[FPAL !== null ? (+FPAL) % APALS.length : Math.floor(PRp() * APALS.length)]), K = makeKit(master, 4, 1), PADN = MOBILE ? 4 : 7, RES = PADN + 1;   // pads reserve room (PADN) so bells/arps never push the total over the voice cap
  if (!off) console.log('[sound] ambient palette: ' + AP.n);
  K.setPal(AP, ts); K.air.gain.setTargetAtTime(AP.air, ts, 1);
  const dl = a.createBiquadFilter(); dl.type = 'lowpass'; dl.Q.value = 4; const dg = a.createGain(); dg.gain.value = .2; dl.connect(dg); dg.connect(master); send(dg, .25);
  const o1 = a.createOscillator(), o2 = a.createOscillator(), o3 = a.createOscillator(), sg = a.createGain(); sg.gain.value = .5;
  o1.setPeriodicWave(K.WV.warm); o2.setPeriodicWave(AP.pad === 'hollow' ? K.WV.hollow : K.WV.warm); o3.type = 'sine'; o1.frequency.value = o2.frequency.value = mtof(ROOT - 12); o3.frequency.value = mtof(ROOT - 24);
  o1.connect(dl); o2.connect(dl); o3.connect(sg); sg.connect(dg);
  const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = .07; lg.gain.value = 120; lfo.connect(lg); lg.connect(dl.frequency);
  const CN = 128, cut = new Float32Array(CN), det = new Float32Array(CN), u0 = off / TOTAL;
  for (let i = 0; i < CN; i++) { const k = energy(lerp(u0, 1, i / (CN - 1))); cut[i] = 200 * AP.br * Math.pow(2, 4.5 * k); det[i] = 3 + 45 * smooth(.2, .9, k); }
  dl.frequency.setValueCurveAtTime(cut, ts, TOTAL - off); o2.detune.setValueCurveAtTime(det, ts, TOTAL - off);
  [o1, o2, o3, lfo].forEach(o => { o.start(ts); o.stop(t0 + TOTAL + 1); });

  const pad = (t, idxs, dur) => { const g = K.pad(t, dur - 3.5, 3, 3.5, idxs.map(i => note(i)), .045, AP, 1700, 1, 1); if (g) send(g, .5); };
  const bell = (t, i, v) => { const g = K.bell(t, mtof(note(i) + 12), v, 4.5, AP, master, RES); if (g) send(g, .7, .35); };
  const arp = (t, i, v) => { const g = K.pluck(t, mtof(note(i) + 12), v, .22, AP, master, RES); if (g) send(g, MOBILE ? 0 : .3, .5); };   // mobile: arps feed only the delay
  const kick = (t, v) => K.kick(t, v, AP), hat = (t, v) => K.hat(t, v);
  // hardcore kick (drive 2): a pitch dive through a hard clipper, the gabber sound
  const crv = new Float32Array(256); for (let i = 0; i < 256; i++) crv[i] = Math.tanh((i / 128 - 1) * 7);
  const gkick = (t, v) => { const o = a.createOscillator(), sh = a.createWaveShaper(); o.type = 'sine'; sh.curve = crv; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(52, t + .09); o.frequency.exponentialRampToValueAtTime(38, t + .22); const g = env(t, .002, v, .26, master); o.connect(sh); sh.connect(g); o.start(t); o.stop(t + .3); };
  const thump = (t, v) => {
    K.vo(t, .6, 2, 1);
    for (const [dt, f0, f1, k] of [[0, 78, 42, 1], [.22, 64, 38, .6]]) {
      const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t + dt); o.frequency.exponentialRampToValueAtTime(f1, t + dt + .14);
      const g = env(t + dt, .005, v * k, .25, master); o.connect(g); o.start(t + dt); o.stop(t + dt + .35);
    }
  };
  // one-off gestures: riser into the dissolve, impact, exhale
  evtSet([{ t: TOTAL * ARC.marks.riser[0], k: 'riser', s: .8, d: TOTAL * (ARC.marks.riser[1] - ARC.marks.riser[0]) }, { t: TOTAL * ARC.marks.hit, k: 'hit', s: .9, d: 0 }, { t: TOTAL * ARC.marks.exhale, k: 'fill', s: .4, d: 0 }]);   // T102: data only, emitted whether or not the audio plays them (seek / still)
  if (t0 + TOTAL * ARC.marks.riser[0] > a.currentTime + .1) { const t = t0 + TOTAL * ARC.marks.riser[0], d = TOTAL * (ARC.marks.riser[1] - ARC.marks.riser[0]), n = noise(t, d + .1), f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(7000, t + d);
    const g = a.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + d); g.gain.setValueAtTime(.0001, t + d + .05);
    n.connect(f); f.connect(g); g.connect(master); send(g, .5); }
  if (t0 + TOTAL * ARC.marks.hit > a.currentTime + .1) { const t = t0 + TOTAL * ARC.marks.hit, o = a.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.8);
    o.connect(env(t, .01, .9, 2.2, master)); o.start(t); o.stop(t + 2.4);
    const n = noise(t, 2.5), f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 4000; const g = env(t, .005, .35, 2.2, master); n.connect(f); f.connect(g); send(g, .6); }
  if (t0 + TOTAL * ARC.marks.exhale > a.currentTime + .1) { const t = t0 + TOTAL * ARC.marks.exhale, d = Math.min(5, TOTAL * .04), n = noise(t, d + .1), f = a.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(150, t + d);
    const g = a.createGain(); g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); n.connect(f); f.connect(g); g.connect(master); send(g, .5); }

  // rolling scheduler: random notes, a few seconds at a time
  const nw = Math.max(t0 + 1, ts + .1); let nextPad = nw, nextBell = Math.max(t0 + TOTAL * .04, ts + .1), nextArp = nw, hb = (() => { const i = BEATS.findIndex(b => b >= off); return i < 0 ? BEATS.length : i; })(), chord = 0, ai = 12;
  const prog = [0, 3, 4, 2, 5, 6];
  return function pump() {
    const hz = a.currentTime + 30;
    while (nextPad < hz && nextPad < t0 + TOTAL - 4) {
      chord = pick(prog); pad(nextPad, [chord, chord + 2, chord + 4, rand() < .5 ? chord + 6 : chord + 7], 11 + rand() * 4); nextPad += 7 + rand() * 4;
    }
    while (nextBell < hz && nextBell < t0 + TOTAL - 4) {
      const p = .04 + .4 * clamp(energy((nextBell - t0) / TOTAL) * 1.3);
      if (rand() < p * (MOBILE ? .5 : 1)) bell(nextBell, 14 + [0, 2, 4, 5, 7, 9][Math.floor(rand() * 6)] % 7 + (rand() < .3 ? 7 : 0), .05 + rand() * .06);
      nextBell += .5;
    }
    while (nextArp < hz && nextArp < t0 + TOTAL - 4) {
      const en = energy((nextArp - t0) / TOTAL);
      if (en > .2 && rand() < (MOBILE ? .35 : .55)) { ai = clamp(ai + pick([-2, -1, 1, 2]), 7, 17); arp(nextArp, ai, .05 * smooth(.2, .5, en)); }
      nextArp += .25;
    }
    while (hb < BEATS.length && t0 + BEATS[hb] < hz) {
      const bt = t0 + BEATS[hb], uu = BEATS[hb] / TOTAL, w = hbW(uu), en = energy(uu);
      if (w > .01 && bt > a.currentTime - .1) {
        if (ARC.drive > 1) { gkick(bt, .55); hat(bt + 15 / bpmAt(uu), .1); hat(bt + 30 / bpmAt(uu), .16); hat(bt + 45 / bpmAt(uu), .1); }   // hardcore: distorted kick on every beat, 16th hats, no heartbeat
        else thump(bt, .6 * w);
        if (ARC.drive === 1 && en > .3) { kick(bt, .5 * en); hat(bt + 30 / bpmAt(uu), .12 * en); }   // intense: kick + off-beat hat
      }
      hb++;
    }
  };
}

