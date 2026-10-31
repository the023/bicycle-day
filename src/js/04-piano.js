/* ════════════════════════ Satie piano: the whole piece is a seeded list of notes in song time (sound + picture share it) ════════════════════════
   Left hand: bass, then chord; right hand: a motif replayed with mutations, cadence on tonic/dominant, long pauses; beat clock with rubato. */
const PIANO = {
  gnossienne: { beat: 1.15, bar: 4, sc: [0, 2, 3, 5, 7, 8, 11], lo: -2, hi: 9, st: 2, pool: [1, 1, 1.5, .5, 2, 3], rest: [3, 5, 8, 12], cad: 4, end: 'i',   // D harmonic minor (augmented 2nd Bb-C#)
    lh: [[0, 'b'], [1, 'c'], [2, 'b'], [3, 'c']], ch: { i: [38, [53, 57, 62]], V: [45, [52, 55, 61]], iv: [43, [50, 58, 62]], VI: [46, [53, 58, 62]] },
    prog: [['i', 'i', 'V', 'i'], ['i', 'iv', 'V', 'i'], ['i', 'VI', 'V', 'i'], ['i', 'i', 'iv', 'V']] },
  gymnopedie: { beat: .95, bar: 3, sc: [0, 2, 4, 5, 7, 9, 11], lo: 2, hi: 11, st: 5, pool: [2, 1, 3, 2, 1.5], rest: [3, 6, 9], cad: 5, end: 'D',   // D major over Gmaj7 / Dmaj7 (lydian colour)
    lh: [[0, 'b'], [1, 'c'], [2, 'c']], ch: { G: [43, [59, 62, 66]], D: [38, [57, 61, 66]], E: [40, [55, 59, 62]] },
    prog: [['G', 'D', 'G', 'D'], ['G', 'D', 'E', 'D'], ['G', 'D', 'G', 'E']] },
};
// gnossienne3: Satie's Gnossienne No. 1 itself (Mutopia Project MIDI, public domain; F minor, 82 four-beat measures: A theme + repeat, B, C run, B, A', B, C, B).
// GM3.M = the 17 distinct measures (right-hand melody notes as start*10000 + length*100 + pitch-40, in 1/8 beats; length <= 2 = grace/pickup), GM3.K = left-hand kind of each
// (0 F bass+chord, 1 Bb, 2 C minor), GM3.S = the 82 measures of the piece as indexes into M (char code - 48). The seed adds rubato, phrase dynamics, pedal ring, graces,
// trills and light variations on repeated measures; short pieces end at a phrase boundary, long ones repeat the B/C/A' blocks, and the last two measures are always the piece's ending.
const GM3 = {
  M: [[80432, 120435, 160834, 240732, 310132], [1531, 150132, 161431], [80432, 120435, 160834, 240732, 310136], [1537, 150136, 161437], [1531, 150128, 161527, 310125], [727, 70125, 82027, 310128], [727, 70127], [], [310128],
    [1530, 150128, 161527, 310128], [40432, 80434, 120436, 160437, 200439, 240443, 280439], [737, 70139, 82337, 310139], [1537, 150137, 161536, 310133], [1532, 150132, 161531, 310128], [2831], [2837], [2837, 310128]],
  K: '00000200010000000', S: '01230456701230456899689967:;<=67:;<=68996899670>2?0>2@99689967:;<=67:;<=6899689967',
  CH: [[41, [56, 60, 65]], [34, [53, 58, 61]], [48, [51, 55, 60]]],
  CUT: [0, 2, 4, 6, 9, 11, 13, 15, 18, 20, 22, 24, 26, 30, 32, 36, 38, 40, 42, 44, 46, 50, 54, 58, 62, 66, 68, 72, 74, 78], BLK: [[18, 26], [26, 38], [38, 46], [46, 54]],
};
function pianoScore3() {
  const r = mulberry32(seedUsed * 31 + 13), pick = a => a[Math.floor(r() * a.length)], ph = r() * 6.28, E = [], tEnd = TOTAL - 8, avail = tEnd - 2.5, nb = Math.floor(avail / 3.8) - 2, body = [];
  if (nb >= 80) {   // the whole piece, then repeated B / C / A' blocks until it is full
    for (let i = 0; i < 80; i++) body.push(i);
    for (let bl; (bl = GM3.BLK.filter(([a, b]) => body.length + b - a <= nb)).length;) { const [a, b] = pick(bl); for (let i = a; i < b; i++) body.push(i); }
  } else for (let i = 0, c = GM3.CUT.filter(x => x <= nb).pop() || 0; i < c; i++) body.push(i);   // short: cut at a phrase boundary
  const BS = [18, 26, 38, 46, 54, 62, 74], bst = [];   // T102: body indexes where a new block (B / C / A') starts
  body.forEach((m, i) => { if (i && (i >= 80 ? m !== body[i - 1] + 1 : BS.includes(i))) bst.push(i); });
  const ML = body.concat([80, 81]), N = ML.length, beat = clamp(avail / (N * 4), .85, 1.3), bt = [0];
  for (let i = 0; i < N * 4 + 8; i++) bt.push(bt[i] + beat * (1 + .1 * Math.sin(i * .21 + ph) + .06 * Math.sin(i * .53 + 2 * ph) + .04 * (r() - .5)));   // rubato
  const tb = x => { const i = Math.floor(x); return 1.5 + bt[i] + (bt[i + 1] - bt[i]) * (x - i); };
  let dyn = 1;
  bst.concat(N - 2).forEach(i => { if (tb(i * 4) < tEnd) PKEY.push(tb(i * 4)); });   // T102
  const add = (x, m, v, k, rs, lag) => { const t = tb(x) + (lag || 0) + (r() - .5) * .03; if (t < tEnd) E.push({ t, m, v: v * dyn * (.75 + .25 * energy(t / TOTAL)), k, r: rs || 1 }); };
  const up = p => { while (![0, 1, 3, 5, 7, 8, 10].includes(++p % 12)); return p; }, seen = {};
  ML.forEach((mid, i) => {
    const ty = GM3.S.charCodeAt(mid) - 48, [bass, ch] = GM3.CH[+GM3.K[ty]], rep = seen[mid] = (seen[mid] || 0) + 1, x0 = i * 4, last = i === N - 1, rp = rep > 1 ? 1 : 0;
    dyn = (.86 + .18 * Math.sin(Math.PI * ((i % 4) + .5) / 4)) * (1 + .08 * Math.sin(i * .15 + ph)) * ((mid >= 26 && mid < 38) || (mid >= 62 && mid < 74) ? 1.08 : 1) * (i >= N - 3 ? .82 : 1);   // phrase breathing, the C runs a bit louder, the ending fades
    const bv = .4 + .08 * r(), cv = .2 + .06 * r(), roll = rp && r() < .25 ? .045 : .02;
    add(x0, bass, bv, 'b', last ? 2.6 : 1.8);
    if (rp && !last && r() < .12) add(x0 + .02, bass + 12, bv * .45, 'b');   // octave on the bass now and then, on repeats
    ch.forEach((m, j) => add(x0 + 1 + j * roll, m, cv, 'c', last ? 2 : 1));
    if (!last && !(rp && r() < .1)) ch.forEach((m, j) => add(x0 + 3 + j * .02, m, cv * .85, 'c'));
    const mel = GM3.M[ty]; dyn *= .95;
    mel.forEach((n, j) => {
      const s = Math.floor(n / 10000) / 8, d = Math.floor(n / 100) % 100, p = n % 100 + 40;
      if (d <= 2) { add(x0 + s, p, .26 + .08 * r(), 'o'); return; }   // the score's own grace notes / pickups
      if (rp && j && d < 12 && r() < .06) return;   // a repeat may lose a note
      if (r() < .05 + .07 * rp) add(x0 + s - .2, up(p), .3 + .1 * r(), 'o');   // grace note just before the beat
      add(x0 + s, p, .5 + .18 * r() + (p > 76 ? .05 : 0), 'm', d >= 12 ? 1.5 : 1, d >= 20 ? .05 + .06 * r() : 0);   // long notes ring and arrive a touch late
      if (d >= 24 && j === mel.length - 1 && r() < .1 + .15 * rp) for (let q = 0; q < 3; q++) add(x0 + s + d / 8 - .75 + q * .25, q % 2 ? p : up(p), .24 + .05 * q, 'o');   // short trill at a cadence
    });
  });
  return E.sort((a, b) => a.t - b.t);
}
function pianoScore() {
  PKEY = [];
  if (MUSIC === 'gnossienne3') return pianoScore3();
  const P = PIANO[MUSIC], r = mulberry32(seedUsed * 31 + 7), pick = a => a[Math.floor(r() * a.length)], ph = r() * 6.28, E = [], tEnd = TOTAL - 8, bt = [0];
  for (let i = 0; i < TOTAL / (P.beat * .8) + 12; i++) bt.push(bt[i] + P.beat * (1 + .1 * Math.sin(i * .21 + ph) + .06 * Math.sin(i * .53 + 2 * ph) + .04 * (r() - .5)));   // rubato
  const tb = x => { const i = Math.floor(x); return 1.5 + bt[i] + (bt[i + 1] - bt[i]) * (x - i); };
  const add = (x, m, v, k) => { const t = tb(x) + (r() - .5) * .03; if (t < tEnd) E.push({ t, m, v: v * (.75 + .25 * energy(t / TOTAL)), k }); };
  const midi = i => 62 + P.sc[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
  let blk = null;
  for (let b = 0; tb(b * P.bar) < tEnd; b++) {   // left hand
    if (b % 4 === 0) blk = pick(P.prog); if (b > 1 && r() < .1) continue;   // now and then a silent bar
    const [bass, ch] = P.ch[blk[b % 4]];
    for (const [o, k] of P.lh) { const x = b * P.bar + o; if (k === 'b') add(x, bass, .4 + .08 * r(), 'b'); else ch.forEach((m, j) => add(x + j * .02, m, .2 + .06 * r(), 'c')); }
  }
  const steps = [-2, -1, -1, 0, 1, 1, 2], mot = Array.from({ length: 5 + Math.floor(r() * 3) }, () => [pick(steps), pick(P.pool)]);
  const tonal = d => { let best = d, bd = 99; for (let i = P.lo; i <= P.hi; i++) { const q = ((i % 7) + 7) % 7; if ((q === 0 || q === 4) && Math.abs(i - d) < bd) { bd = Math.abs(i - d); best = i; } } return best; };
  for (let x = P.bar * (1 + Math.floor(r() * 2)), d = P.st; tb(x) < tEnd;) {   // right hand
    d = clamp(P.st + pick([-1, 0, 0, 1]), P.lo, P.hi);
    for (const [s, du] of mot.map(n => r() < .3 ? [pick(steps), pick(P.pool)] : n)) { if (r() > .12) { d = clamp(d + s, P.lo, P.hi); add(x, midi(d), .5 + .2 * r(), 'm'); } x += du; }
    add(x, midi(tonal(d)), .45, 'm'); x += P.cad + pick(P.rest);
  }
  const [bass, ch] = P.ch[P.end], te = Math.max(tEnd - 4, 2); E.push({ t: te, m: bass, v: .4, k: 'b' }); ch.forEach((m, j) => E.push({ t: te + .3 + j * .04, m, v: .24, k: 'c' }));   // last chord rings out
  return E.sort((a, b) => a.t - b.t);
}
const noteGlow = t => { let lo = 0, hi = MEL.length; while (lo < hi) { const m = (lo + hi) >> 1; if (MEL[m].t <= t) lo = m + 1; else hi = m; } const n = MEL[lo - 1]; return n ? n.v * Math.exp(-(t - n.t) * 2.5) : 0; };   // soft glow after each melody note

