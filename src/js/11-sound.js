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
const STYLE_FN = {};   // music style name -> function (ctx) returning pump(); filled by 11a-electro.js ... 11h-lofi.js (buildAudio runs after every file has loaded)
function buildAudio(a, t0, off = 0) {
  EVT = []; CHLV = null; EVTM = MUSIC;   // T101: refilled by the style branches below (whole-piece plan loops only)
  const rand = rng, pick = arr => arr[Math.floor(rand() * arr.length)];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12), SC = SCALE;            // D dorian
  const note = i => ROOT + SC[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
  const master = a.createGain(), fi = Math.min(5, TOTAL * .15), fo = Math.min(10, TOTAL * .25);
  const ts = t0 + off;   // song time 'off' happens now when seeking
  const TRIM = ARC.piano ? 1 : STYLES[MUSIC]?.trim ?? .8;   // the richer kit voices are ~2-3 dB hotter than the old plain ones
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

  // Style dispatch: one file per style (src/js/11a-electro.js ... 11h-lofi.js): each registers STYLE_FN.<name> = function (ctx) and returns the style's pump(). ctx = what the bodies read from this scope.
  // Piano stays above (its branch needs nothing from the kit); the ambient default below is for every other MUSIC.
  if (STYLE_FN[MUSIC]) return STYLE_FN[MUSIC]({ off, a, master, send, makeKit, ts, t0, PRp, EPALS, FPAL, mkPal, noise, env, note, mtof, nb, dly, fb });

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

