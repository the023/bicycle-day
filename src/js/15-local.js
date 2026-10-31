/* ════════════════════════ LOCAL MODE: play an audio file; the whole file is analysed first (offline, so it can look ahead) ════════════════════════
   Same features and section/drop detector as liveStep(), but zero-phase smoothing and back-dated scene starts. The result is a timeline sampled at the audio clock
   time t (localView), written into the LIVE-shaped object so render() runs its live look path unchanged: the picture stays a pure function of t. */
let LOC = null, LOCNAME = '', localData = null, FFT = null, NEXT = null, NEXTDATA = null, NEXTGO = false, NEXTFAIL = false;   // NEXT = chosen File; NEXTDATA = its analysed timeline (kept apart from LOC until it plays)
const LST = ['', 'drop', 'build', 'groove', 'breakdown', 'calm'];
const zp = (a, tau, fps) => { const k = 1 - Math.exp(-1 / (tau * fps)), o = new Float32Array(a.length); let y = a[0]; for (let i = 0; i < a.length; i++) { y += (a[i] - y) * k; o[i] = y; } for (let i = a.length - 1; i >= 0; i--) { y += (o[i] - y) * k; o[i] = y; } return o; };   // forward + backward EMA = no lag
function fft(re, im) {   // in-place radix-2
  const n = re.length; if (!FFT || FFT.n !== n) { const rv = new Uint16Array(n), b = Math.log2(n); for (let i = 0; i < n; i++) { let r = 0; for (let j = 0; j < b; j++) r |= ((i >> j) & 1) << (b - 1 - j); rv[i] = r; } FFT = { n, rv, c: Float64Array.from({ length: n / 2 }, (_, i) => Math.cos(2 * Math.PI * i / n)), s: Float64Array.from({ length: n / 2 }, (_, i) => -Math.sin(2 * Math.PI * i / n)) }; }
  for (let i = 0; i < n; i++) { const j = FFT.rv[i]; if (j > i) { let x = re[i]; re[i] = re[j]; re[j] = x; x = im[i]; im[i] = im[j]; im[j] = x; } }
  for (let len = 2; len <= n; len <<= 1) for (let i = 0; i < n; i += len) for (let k = 0, h = len >> 1, st = n / len; k < h; k++) {
    const c = FFT.c[k * st], s = FFT.s[k * st], a = i + k, b = a + h, xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c;
    re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
  }
}
async function analyseLocal(buf, progress) {
  const sr = buf.sampleRate, N = 2048, hop = Math.round(sr / 40), fps = sr / hop, nf = Math.max(2, Math.floor((buf.length - N) / hop) + 1), B = bandsFor(sr / N);
  const ch = [...Array(buf.numberOfChannels).keys()].map(c => buf.getChannelData(c)), re = new Float64Array(N), im = new Float64Array(N), win = Float64Array.from({ length: N }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / N));
  const rawB = [new Float32Array(nf), new Float32Array(nf), new Float32Array(nf)], prof = new Float32Array(nf * 10), mag = new Float64Array(N / 2);
  for (let f = 0; f < nf; f++) {
    for (let j = 0; j < N; j++) { let x = 0; const p = f * hop + j; if (p < buf.length) for (const c of ch) x += c[p]; re[j] = x / ch.length * win[j]; im[j] = 0; }
    fft(re, im); for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]) / N;
    [B.b, B.m, B.h].forEach(([a, b], r) => { let x = 0; for (let k = a; k < b; k++) x += mag[k]; rawB[r][f] = x / Math.max(1, b - a); });
    for (let i = 0; i < 10; i++) { let x = 0; const a = B.p[i], b = Math.max(a + 1, B.p[i + 1]); for (let k = a; k < b; k++) x += Math.max(-120, 20 * Math.log10(mag[k] + 1e-9)); prof[f * 10 + i] = x / (b - a); }
    if (f % 300 === 299) { progress(f / nf); await new Promise(r => setTimeout(r)); }
  }
  // per-band auto-gain: the loudest value within +-30 s (the live one only has the past)
  const bl = Math.round(fps), nb = Math.ceil(nf / bl), n = rawB.map(r => {
    const mx = new Float32Array(nb); for (let f = 0; f < nf; f++) mx[Math.floor(f / bl)] = Math.max(mx[Math.floor(f / bl)], r[f]);
    const ref = new Float32Array(nf); for (let f = 0; f < nf; f++) { const j = Math.floor(f / bl); let m = 1e-5; for (let q = Math.max(0, j - 30); q <= Math.min(nb - 1, j + 30); q++) m = Math.max(m, mx[q]); ref[f] = m; }
    const rs = zp(ref, 3, fps); return r.map((v, f) => clamp(v / rs[f]));
  });
  // absolute loudness over the WHOLE track (raw energy vs its 95th percentile): a calm intro stays calm next to the loud parts, whatever the local auto-gain says
  const rl = zp(rawB[0].map((b, f) => .45 * b + .35 * rawB[1][f] + .2 * rawB[2][f]), 1, fps), srt = Float32Array.from(rl).sort(), ref95 = Math.max(1e-6, srt[Math.floor(.95 * (nf - 1))]);
  const ag = rl.map(v => clamp(Math.pow(v / ref95, 1.3) * 1.6));   // 0 quiet .. 1 as loud as the loud parts
  const [nB, nM, nH] = n, lvl = nB.map((b, f) => .45 * b + .35 * nM[f] + .2 * nH[f]), bri = nB.map((b, f) => nH[f] / (b + nM[f] + nH[f] + 1e-6));
  const lv = zp(lvl, .8, fps), ls = zp(lvl, 10, fps), bf = zp(bri, 1.5, fps), bsl = zp(bri, 10, fps), bLong = zp(nB, 2.5, fps), bSlow = zp(nB, 6, fps);
  const kick = nB.map((b, f) => clamp((b - (f ? nB[f - 1] : b)) * 5));
  const D = { ...DET, warm: 6 }, dt = 1 / fps, ease = tau => 1 - Math.exp(-dt / tau);   // the auto-gain is exact here, so the detectors can start after 6 s instead of 25
  const P = { buf, dur: buf.duration, fps, nf, off: N / 2 / sr, u: new Float32Array(nf), kick, bn: nB, mn: nM, hn: nH, tens: new Float32Array(nf), boo: new Float32Array(nf), st: new Uint8Array(nf), sceneT: [], minorT: [], accA: [], accB: [], accBld: [], kinds: [ag.subarray(0, Math.round(10 * fps)).reduce((a, b) => a + b, 0) / Math.round(10 * fps) < .3 ? 0 : 1] };
  let tension = 0, sinceDrop = 99, boost = 0, sinceScene = 0, sinceMinor = 0, secT = 0, pT = 0, bigT = 0, dm = null, u = -1, stT = 0, st = 0, cand = -1, candT = 0, sf = [0, 0, 0], ss = [0, 0, 0], pf = null, ps = null;
  const acc = accNew();
  for (let f = 0; f < nf; f++) {
    const t = f * dt, age = t;
    const rising = (bf[f] - bsl[f]) > .01 && lv[f] > ls[f] + .02;
    tension = rising ? Math.min(1, tension + dt * .12) : tension * Math.exp(-dt * .4); sinceDrop += dt;
    const slam = nB[f] > .75 && bSlow[f] < D.slamBass && lv[f] > ls[f] + D.slamLv, afterBuild = tension > .35 && lv[f] - ls[f] > .12 && nB[f] > .6;
    let dropped = false; if (age > D.warm && sinceDrop > D.dropDwell && (slam || afterBuild)) { boost = 1; tension = 0; sinceDrop = 0; dropped = true; }
    const cur = [lv[f], clamp(bf[f] * 2.5), bLong[f]];
    for (let i = 0; i < 3; i++) { sf[i] += (cur[i] - sf[i]) * ease(D.sfTau); ss[i] += (cur[i] - ss[i]) * ease(sinceScene < 5 ? .5 : D.ssTau); }
    if (age < D.warm) ss = sf.slice();
    const gap = Math.abs(sf[0] - ss[0]) + Math.abs(sf[1] - ss[1]) + .5 * Math.abs(sf[2] - ss[2]);
    secT = gap > D.gapThr ? secT + dt : Math.max(0, secT - dt); sinceScene += dt;
    const pr = prof.subarray(f * 10, f * 10 + 10); if (!pf) { pf = Float64Array.from(pr); ps = Float64Array.from(pr); }
    let dprof = 0; for (let i = 0; i < 10; i++) { pf[i] += (pr[i] - pf[i]) * ease(1.5); ps[i] += (pr[i] - ps[i]) * ease(sinceMinor < 4 ? .5 : 10); dprof += Math.abs(pf[i] - ps[i]) / 10; }
    dm = (dm ?? dprof) + (dprof - (dm ?? dprof)) * ease(60);
    pT = dprof > Math.max(D.minFloor, D.minK * dm) ? pT + dt : Math.max(0, pT - dt); sinceMinor += dt;
    bigT = dprof > Math.max(D.bigFloor, D.bigK * dm) ? bigT + dt : Math.max(0, bigT - dt);
    if (age > D.warm && ((dropped && sinceScene > D.dropGap && (gap > D.dropMinGap || dprof > D.dropMinProf)) || ((secT > D.gapDur || bigT > D.bigDur) && sinceScene > D.dwell))) {
      if (ag[f] > .3) {   // (no scene punches inside a quiet stretch)
      P.sceneT.push(Math.max(P.sceneT.at(-1) ?? 0, t - (dropped ? 0 : Math.min(3, Math.max(secT, bigT)))));   // back-dated: the change began when the gap began, not when it was confirmed
      P.kinds.push(dropped || sf[0] >= ss[0] ? 1 : 0); } sinceScene = 0; secT = 0; sinceMinor = 0; pT = 0; bigT = 0; ss = cur.slice();
    }
    else if (age > D.warm + 5 && ag[f] > .3 && pT > D.minDur && sinceMinor > D.minDwell && sinceScene > 6) { P.minorT.push(Math.max(P.minorT.at(-1) ?? 0, t - Math.min(3, pT))); sinceMinor = 0; pT = 0; }
    boost *= Math.exp(-dt / 6);
    const I = clamp(.12 + .62 * lv[f] + .3 * tension + .45 * boost) * Math.min(1, ag[f] * 1.5), tgt = lerp(.04, .88, I) * smooth(0, 5, t);  u = u < 0 ? tgt : u + (tgt - u) * ease(tgt > u ? .45 : 2.5);   // I scaled by absolute loudness; fades in over the first 5 s
    P.u[f] = u; const gq = Math.min(1, ag[f] * 1.5); P.tens[f] = tension * gq; P.boo[f] = boost * gq;   // no tile bursts / tension look in a quiet stretch
    const rawSt = boost > .5 ? 1 : tension > .25 ? 2 : bLong[f] > .3 ? 3 : lv[f] < .27 ? 4 : 5;   // state label with the same hold rules as live
    if (age < 4) st = 0; else { stT += dt;
      if (rawSt === st) cand = -1; else if (rawSt === 1 || st === 0) { st = rawSt; stT = 0; cand = -1; }
      else if (stT > 4) { if (rawSt !== cand) { cand = rawSt; candT = 0; } else if ((candT += dt) > 3) { st = rawSt; stT = 0; cand = -1; } } }
    P.st[f] = st;
    { const nu = accTrack(acc, LST[st], P.kinds[P.sceneT.length], P.sceneT.length, t), na = P.accA.length;   // T157: the build-accent units: [accA, accB) while the state is drop / build / groove in an energetic scene
      if ((nu || !acc.on) && na && P.accB[na - 1] > 1e8) P.accB[na - 1] = t;
      if (nu) { P.accA.push(t); P.accBld.push(acc.bld); P.accB.push(1e9); } }
  }
  const sh = Math.round(.25 * fps); P.u = P.u.map((_, f, a) => a[Math.min(nf - 1, f + sh)]);   // look ahead 0.25 s: the picture arrives with the hit instead of after it
  return P;
}
const upper = (a, t) => { let l = 0, h = a.length; while (l < h) { const m = (l + h) >> 1; if (a[m] <= t) l = m + 1; else h = m; } return l; };   // how many entries are <= t
function localView(t) {   // timeline at time t → the LIVE-shaped object render() reads (pure function of t)
  const P = LOC, L = LIVE, f = clamp((t - P.off) * P.fps, 0, P.nf - 1), i = Math.floor(f), j = Math.min(i + 1, P.nf - 1), w = f - i, g = a => a[i] + (a[j] - a[i]) * w;
  L.u = g(P.u); L.bn = g(P.bn); L.mn = g(P.mn); L.hn = g(P.hn); L.tension = g(P.tens); L.boost = g(P.boo); L.state = LST[P.st[Math.round(f)]]; L.kinds = P.kinds;
  let pu = 0; for (let k = i; k >= Math.max(0, i - 24); k--) pu = Math.max(pu, P.kick[k] * Math.exp(-8 * Math.max(0, t - P.off - k / P.fps))); L.pulse = pu;
  L.scenes = lastScene = upper(P.sceneT, t); trT0 = L.scenes ? P.sceneT[L.scenes - 1] : -99;   // (set here so render() never sees a "new" scene: seeking is pure)
  L.minors = lastMinor = upper(P.minorT, t); tmT0 = L.minors ? P.minorT[L.minors - 1] : -99;
}
const LSTEP = .05;   // integrateLocal's step (s): the punch envelopes / mids change within a second, so .5 s sums them ~1 rad too high per minute (generated integrateTo stays at .5, its inputs are smooth)
function integrateLocal(off) {   // like integrateTo(), but along the timeline: the same inputs render() gives driftStep in its Live / Local branch (T185)
  // render()'s inputs, stepped here from the same data: the eased mids (BAND.mid, restarted at 0 like a fresh play), the scene / minor punch envelopes from scenePunch() (its decays ENGINE.scene.*, TRN per scene, the Extreme gate g15 = 1), the Extreme blend hk. hk is a user toggle (not a function of t), so it is the settled value of render()'s ramp: 1 when Extreme is on, else 0
  const hk = hcOn() ? 1 : 0, Hd = hk > .5, st = { live: true, hk, calm: UE.calm, amp: UE.amp };
  DRIFT.hue = hueBase; DRIFT.rotA = 0; BAND.mid = 0;
  for (let s = 0; s < off; s += LSTEP) {
    localView(s); const { u, u0 } = uAt(s, UE.off), e = score(u), g15 = CTRL || SHOW || Hd ? 1 : smooth(0, 5, s), scene = LIVE.scenes, cal = calm(s);   // g15 = render()'s local ramp-up gate
    const { tr, tm } = scenePunch(s, { CL, SHOW, LIVE, Hd, isGen: false, cal, calG: cal, g15, scene, wi: scene, since: 0, kind: LIVE.kinds[scene] ?? 1, EV: false, mn: null, trT0, tmT0 });
    bandMidStep(LIVE.mn, LSTEP); Object.assign(st, { t: s, u, u0, kal0: e[1], hueSpd: e[4], mid: BAND.mid, tr, tm }); driftStep(DRIFT, LSTEP, st);
  }
  hue = DRIFT.hue; rotA = DRIFT.rotA; localView(off);
}
function playLocal(a, t0, off) {   // the decoded file through the speakers; returns the (empty) scheduler
  const src = a.createBufferSource(), outG = a.createGain(); src.buffer = LOC.buf; outG.gain.value = +$('vol').value; volNode = outG; src.connect(outG); outG.connect(a.destination); src.start(t0 + off, off);
  return () => {};
}
function leaveLocal() { if (!LOC) return; LOC = null; LIVE = null; document.body.classList.remove('filesrc'); TOTAL = MIN * 60; applyArc(); drawProfile(); syncNext(); }
async function decodeLocal(src, progress = () => {}) {   // File or URL → decoded + analysed timeline. No UI side effects, so it can run in the background
  const ab = await (src instanceof Blob ? src : await (await fetch(src)).blob()).arrayBuffer();
  const buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(ab);
  if (!buf.length) throw new Error('empty file');
  return analyseLocal(buf, progress);
}
async function loadLocal(src) {   // File or URL → decode → analyse; enables Play
  const note = $('localnote'), go = $('playlocal'); go.disabled = true; localData = null; note.style.color = '';
  try {
    note.textContent = 'Decoding…';
    LOCNAME = src.name || String(src).split('/').pop().split('?')[0];
    localData = await decodeLocal(src, p => { note.textContent = 'Analysing… ' + Math.round(p * 100) + '%'; });
    note.textContent = `Ready · ${fmt(localData.dur)} · ${localData.sceneT.length + 1} scenes`; go.disabled = false;
  } catch (e) { note.textContent = 'Cannot read this file as audio (' + (e.message || e.name) + ')'; note.style.color = '#ff6b6b'; console.log('local:', e); }
}
function startLocal() {
  if (!localData || playing || !ready || liveOn) return; lsSet('setup', { src: 'local' });
  LOC = localData; LIVE = newLive(); TOTAL = LOC.dur; setArc('journey'); drawProfile(); syncNext(); start();
}
const nfile = document.querySelector('#nextpick input');
$('nextpick').addEventListener('click', e => e.stopPropagation());
function syncNext() { $('nextnow').style.display = LOC && NEXT ? '' : 'none'; $('tnext').style.display = LOC ? '' : 'none'; $('tnext').textContent = NEXT ? 'Next: ' + NEXT.name : 'Next track…'; syncSource(); }   // "Play next now": Local mode with a next track chosen
function clearNext() { NEXT = null; NEXTDATA = null; NEXTGO = false; NEXTFAIL = false; nfile.value = ''; $('nextname').textContent = ''; $('nextclear').style.display = 'none'; syncNext(); }
function prepNext(f) {   // decode + analyse the chosen next file in the background (the result waits in NEXTDATA)
  NEXTDATA = null; NEXTFAIL = false;
  decodeLocal(f).then(d => { if (NEXT === f) NEXTDATA = d; }, e => { if (NEXT === f) NEXTFAIL = true; console.log('local next:', e); });
}
function goNext() {   // swap the queued track in as LOC and restart at t = 0; begin() closes the old AudioContext (and its source) and re-derives the state
  const d = NEXTDATA, name = NEXT.name; clearNext();
  LOC = d; LIVE = newLive(); TOTAL = LOC.dur; drawProfile(); begin(0, true); toast('Now: ' + name, 3000);
}
function playNextNow() { if (!playing || !LOC || !NEXT) return; NEXTGO = true; if (!NEXTDATA && !NEXTFAIL) toast('Loading next track…', 60000); }   // the loop picks it up on the next frame (waits there if still decoding)
$('nextnow').addEventListener('click', e => { e.stopPropagation(); playNextNow(); });
const setNext = f => { if (f) { NEXT = f; $('nextname').textContent = f.name; $('nextclear').style.display = ''; prepNext(f); syncNext(); } };
nfile.addEventListener('change', () => setNext(nfile.files && nfile.files[0]));
$('tnext').addEventListener('click', e => { e.stopPropagation(); $('tnextfile').click(); });   // Settings: pick the next file while playing
$('tnextfile').addEventListener('change', e => { setNext(e.target.files && e.target.files[0]); e.target.value = ''; });
$('nextclear').addEventListener('click', e => { e.stopPropagation(); clearNext(); });
