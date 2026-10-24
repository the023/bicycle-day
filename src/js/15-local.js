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
function integrateLocal(off) {   // like integrateTo(), but along the timeline (mirrors the LIVE branch of render())
  hue = hueBase; rotA = 0;
  for (let s = 0; s < off; s += .5) {
    localView(s); const u = uAt(s, UE.off).u, e = score(u), g = smooth(0, 5, s), tr = g * Math.exp(-(s - trT0) / 1.4), tm = g * Math.exp(-(s - tmT0) / 1.2);   // g = render()'s local ramp-up gate
    hue += e[4] * UE.hueK * UE.calm * .5; rotA += UE.amp * .5 * rotDir * ((LIVE.mn * .12 + tr * .5 + tm * .2) + (.25 + .75 * smooth(.12, .35, u)) * (ENGINE.kal.spinBase + ENGINE.kal.spinKal * e[1] + ENGINE.kal.spinWob * wob(s, 5)) + HCspin(s) * (HCr.v ?? 0));
  }
  localView(off);
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
const lfile = document.querySelector('#lpick input');
$('lpick').addEventListener('click', e => e.stopPropagation());
function markEN() { document.querySelectorAll('.enb button').forEach(b => b.classList.toggle('on', +b.dataset.en === USER.energy)); document.querySelectorAll('.enb').forEach(e => e.classList.toggle('x4', USER.energy === 4)); }
document.querySelectorAll('.enb').forEach(r => r.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b) setEnergy(+b.dataset.en); }));
lfile.addEventListener('change', () => { if (lfile.files[0]) loadLocal(lfile.files[0]); });
$('playlocal').addEventListener('click', e => { e.stopPropagation(); startLocal(); });
addEventListener('resize', resize);
$('playgen').addEventListener('click', e => { e.stopPropagation(); start(); });
$('playlast').addEventListener('click', e => {   // one click: replay the last setup (generated: music / energy / length; tab and microphone: capture again); first visit = Surprise me; a local file can't be remembered, so open the panel
  e.stopPropagation(); if (!ready || playing || liveOn) return;
  const o = lsGet('setup');
  if (!o) return $('surprise').click();
  if (o.src === 'tab') return startLive(false);
  if (o.src === 'mic') return startLive(true);
  if (o.src === 'local') { $('home-start').click(); document.querySelector('[data-source=local]').click(); return; }
  if (MUSICS.includes(o.music)) MUSIC = o.music; if (ARCS[o.arc]) arcName = o.arc; if (o.min > 0) { MIN = o.min; TOTAL = MIN * 60; }
  applyArc(); drawProfile(); markMus(); markDur(); markArcOn(); markArcHint(); markEN(); start();
});
$('surprise').addEventListener('click', e => {   // one click: random music / energy (never extreme) / length, then the normal Start; images stay as they are (poster unless the user added some)
  e.stopPropagation(); if (!ready || playing || liveOn) return;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  MUSIC = pick(['ambient', 'gnossienne', 'gnossienne3', 'gymnopedie', 'electro', 'chiptune', 'chiptune2', 'drone', 'gamelan', 'minimal', 'berlin', 'lofi'].filter(m => MUSICS.includes(m))); arcName = pick(['journey', 'slam', 'intense']); MIN = pick([2, 5, 10]); TOTAL = MIN * 60;
  applyArc(); drawProfile(); markMus(); markDur(); markArcOn(); markArcHint(); markEN(); start();
});
$('galtoggle').addEventListener('click', e => { e.stopPropagation(); const g = $('ggal'); g.hidden = !g.hidden; e.currentTarget.setAttribute('aria-expanded', String(!g.hidden)); e.currentTarget.textContent = g.hidden ? 'Gallery ▾' : 'Gallery ▴'; });
document.querySelectorAll('#gate label[role=button]').forEach(l => l.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); l.querySelector('input').click(); } }));
$('lvl').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b) setLevel(+b.dataset.cl, true, true); });
$('plvl').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLevel(+b.dataset.cl, true, true); });
$('mplvl').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLevel(+b.dataset.cl, true, true); });
document.body.classList.toggle('phone', PHONE);
const TOUCHDEV = (typeof MOBILE !== 'undefined' && MOBILE) || (typeof PHONE !== 'undefined' && PHONE) || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
document.body.classList.toggle('touchdev', !!TOUCHDEV);
function applyTouchEnergyLabels() {
  if (!document.body.classList.contains('touchdev')) return;
  const enh = $('enh'); if (enh) enh.title = "How wild the picture is, for every source (Energy buttons \u25B2 \u25BC at the right edge while playing). Look only: the music does not change.";
  const up = $('en-up'); if (up) up.title = "Energy up (right edge \u25B2)";
  const down = $('en-down'); if (down) down.title = "Energy down (right edge \u25BC)";
  const enp = $('enp'); const cell = enp ? enp.closest('.pcell') : null; if (cell) cell.title = "Energy: how wild the picture is (right-edge \u25B2/\u25BC buttons; chips too; keys Z, X). Look only.";
  document.querySelectorAll('kbd[data-code="KeyZ"],kbd[data-code="KeyX"]').forEach(k => { k.style.display = 'none'; k.textContent = ''; });
}
applyTouchEnergyLabels();
addEventListener('touchstart', () => { document.body.classList.add('touchdev'); applyTouchEnergyLabels(); }, { once: true, passive: true });
/* T48: right-edge Energy controls reuse the same setter as keys Z/X */
const enUp = $('en-up'), enDown = $('en-down');
if (enUp) enUp.addEventListener('click', e => { e.stopPropagation(); setEnergy(USER.energy + 1); });
if (enDown) enDown.addEventListener('click', e => { e.stopPropagation(); setEnergy(USER.energy - 1); });
/* T53: Energy buttons hidden by default; reveal for 3s on a tap in the right 15% */
let enShowTimer = null;
function showEnedge() {
  if (!document.body.classList.contains('touchdev')) return;
  const el = $('enedge'); if (!el) return;
  el.classList.add('show');
  document.body.classList.add('enshow');
  if (enShowTimer) clearTimeout(enShowTimer);
  enShowTimer = setTimeout(() => { try { el.classList.remove('show'); document.body.classList.remove('enshow'); } catch (e) {} enShowTimer = null; }, 3000);
}
function maybeRevealEnedge(e, markTouch) {
  if (markTouch) {
    document.body.classList.add('touchdev');
    try { applyTouchEnergyLabels(); } catch (err) {}
  }
  if (!document.body.classList.contains('touchdev')) return;
  const x = (e && (e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : null)));
  if (x == null) return;
  if (x >= window.innerWidth * 0.85) { showEnedge(); }
}
addEventListener('pointerdown', e => { maybeRevealEnedge(e, e.pointerType === 'touch'); }, true);
addEventListener('touchstart', e => { if (e.touches && e.touches[0]) { maybeRevealEnedge(e, true); } }, true);
setLevel(Q.has('level') ? (() => { const v = Q.get('level'); if (v === '0' || v === 'auto') return 0; if (v === '1' || v === 'assisted') return 1; if (v === '2' || v === 'manual') return 2; const i = ['auto', 'assisted', 'manual'].indexOf(v); return i < 0 ? 0 : i; })() : CTRL_URL ? 2 : 0, false, true);   // always starts in Auto (the level is not remembered between visits); a URL level is not saved either   // accepts both numeric and word levels for tests
// Home uses only a CSS logo animation: no audio clock, render history or user image state.
// Home: the setup is one docked block (#home-drawer). Step 1 = sound, step 2 = picture + Start.
function wizGo(n) {   // n = 1 sound, 2 picture
  $('wz1').hidden = n !== 1; $('wz2').hidden = n !== 2; $('wz-back').hidden = n === 1;
  $('wz-num').textContent = n; $('wz-tt').textContent = n === 1 ? 'Choose the sound' : 'Choose a picture · changeable later';
  if (n === 2) wizSummary();
}
function wizSummary() {   // the one line above Start: what will play
  const cur = document.querySelector('#source [aria-pressed="true"]'), s = cur ? cur.dataset.source : 'gen';
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
  $('wz-sum').textContent = s === 'gen' ? `Generated music · ${cap(MUSIC)} · ${MIN} min` : s === 'local' ? `Audio file · ${localData ? 'ready' : 'none chosen yet'}` : s === 'stream' ? 'Browser tab' : 'Microphone';
}
function homePanel(name, focus = false) {
  const drawer = $('home-drawer');
  drawer.hidden = !name;
  ['play', 'settings'].forEach(n => {
    $('home-' + n).hidden = n !== name;
    const nb = document.querySelector('[data-home="' + n + '"]'); if (nb) nb.setAttribute('aria-expanded', String(n === name));   // (Play has no nav button any more: the CTA buttons open it)
  });
  $('home-start').setAttribute('aria-expanded', String(name === 'play')); gate.classList.toggle('dr', !!name);
  if (name === 'play') wizGo(1);   // Customize always opens step 1
  if (focus && name) $('home-close').focus();
}
function homeGate(open) {
  gate.classList.toggle('off', !open); gate.inert = !open;
  if (!open) homePanel(null);
  if (open) startHomeLoop(); else stopHomeLoop();
}
document.querySelectorAll('[data-home]').forEach(b => b.addEventListener('click', () => {
  homePanel(b.getAttribute('aria-expanded') === 'true' ? null : b.dataset.home);
}));
$('home-start').addEventListener('click', () => homePanel('play', true));
$('home-close').addEventListener('click', () => {
  const active = document.querySelector('[data-home][aria-expanded="true"]'); homePanel(null); active && active.focus();
});
$('home-brand').addEventListener('click', () => homePanel(null));
function pickSource(src) {   // step 1: source card (ids and handlers unchanged)
  document.querySelectorAll('[data-source]').forEach(c => {
    const selected = c.dataset.source === src; c.setAttribute('aria-pressed', String(selected)); $('c-' + c.dataset.source).hidden = !selected;
  });
  $('playgen').hidden = src !== 'gen'; $('playlocal').hidden = src !== 'local'; $('tabmode').hidden = src !== 'stream'; $('micmode').hidden = src !== 'live';
  $('st2').hidden = false;   // the options of the chosen source (step 1)
  $('s2t').textContent = { gen: 'Music', local: 'Audio file', stream: 'Browser tab', live: 'Microphone' }[src];
}
$('source').addEventListener('click', e => { const b = e.target.closest('[data-source]'); if (b) pickSource(b.dataset.source); });
$('wz-next').addEventListener('click', e => { e.stopPropagation(); wizGo(2); });
$('wz-back').addEventListener('click', e => { e.stopPropagation(); wizGo(1); });
if (!Q.get('arc')) { arcName = 'journey'; applyArc(); markArcOn(); markArcHint(); }   // Shape starts on Journey (Surprise me stays random); ?arc= wins
pickSource('gen'); wizGo(1);   // Generated is pre-selected, so Next works at once
gate.addEventListener('click', e => { if (e.target === gate || e.target === $('home-intro')) homePanel(null); });
gate.addEventListener('keydown', e => {
  if (e.code === 'Escape' && $('phelp').classList.contains('on')) { e.stopPropagation(); closeDemo(); }
  else if (e.code === 'Escape' && !$('home-drawer').hidden) { e.stopPropagation(); $('home-close').click(); }
  // Keep native button activation/navigation while choosing a source or setup.
  else if (e.target.closest('button,summary,input,label')) e.stopPropagation();
});
addEventListener('load', () => {
  if (!gl) { hint.textContent = 'WebGL2 is not available in this browser'; return; }
  { const sw = softwareGL(), saved = lsGet('quality'); quality = QUAL[Q.get('quality')] ? Q.get('quality') : QUAL[saved] ? saved : sw || MOBILE ? 'low' : 'high'; markQ(); if (sw && !saved) $('qnote').textContent = 'No graphics card detected: Low quality selected for you'; }
  try { initGL(); } catch (e) { hint.textContent = 'Shader error: ' + e.message; console.log(e.message); return; }
  resize();
  homeReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  initHomeGL($('home-c'));
  loadHomeLogo(document.querySelector('#home-art img').src, () => { if (!playing && !liveOn && !document.body.classList.contains('still')) startHomeLoop(); });
  let IMGFAIL = false; const IMGQ = Q.get('img'), onReady = async () => {
    ready = true; $('playgen').disabled = false; $('surprise').disabled = false; $('playlast').disabled = false; updateHint(); drawProfile(); renderImgs();
    // shared level from ?u= (applied before start so manual entry is honored)
    if (window.__sharedLevel != null) { try { setLevel(window.__sharedLevel, false, true, true); } catch (e) {} window.__sharedLevel = null; }
    const lq = Q.get('local'), localReady = lq ? loadLocal(lq) : null;   // test hook: ?local=<url of an audio file> (+ &t=… for a silent still, otherwise it plays)
    if (lq && Q.get('t') === null) { await localReady; startLocal(); }
    const dbg = Q.get('t');
    if (dbg !== null && STILL) {   // silent still: step the feedback loop up to the requested time
      homeGate(false); document.body.classList.add('still'); const T = parseFloat(dbg); let t = 0; if (lq) { await localReady; if (localData) { LOC = localData; LIVE = newLive(); TOTAL = LOC.dur; setArc('journey'); } } newSeed(); if (!LOC) { try { buildAudio(new OfflineAudioContext(2, 1, 44100), 0, 0); if (Q.has('debug')) console.log('EVT', MUSIC, JSON.stringify(EVT)); } catch (e) { console.warn('section plan', e); } } rotA = 0; bi = 0; const step = parseFloat(Q.get('step')) || .2;
      const fr = x => { if (LOC) localView(x); render(x, step, LOC ? LIVE.bn : 0, LOC ? LIVE.mn : 0, LOC ? LIVE.hn : 0); };
      if (Q.has('debug')) { PLOG = window.__plog = []; PLOG.nx = 0; }
      for (; t < T; t += step) fr(t); fr(T);
    }
    else if ((IMGQ || Q.has('u')) && !lq) autoStart();
    if (IMGFAIL) toast('Image could not be loaded or the host does not allow CORS', 8000);
  };
  const sharedImgs = window.__sharedImgs;
  if (sharedImgs && sharedImgs.length) {
    loadSharedImages(sharedImgs, window.__sharedImTo || 0, onReady);
    window.__sharedImgs = null;
  } else if (IMGQ) loadPoster(IMGQ, onReady, () => { IMGFAIL = true; loadPoster(GALLERY[0].src, onReady); });
  else loadPoster(GALLERY[0].src, onReady);   // default picture = the 1943 poster (the logo is only the home screen)
});
// ?img=<url>: no start screen; Journey curve (unless ?arc=), play at once; if the browser keeps audio suspended, show a tap pill
function autoStart() {
  if (!Q.get('arc')) { arcName = 'journey'; applyArc(); drawProfile(); }
  start();
  const tParam = Q.get('t'); if (tParam !== null && playing) { try { seekTo(parseFloat(tParam)); } catch (e) {} }
  if (!playing) return;
  setTimeout(() => {    if (!playing || !ac || ac.state === 'running') return;
    SUSP = performance.now() - lastT * 1000;   // keep the picture moving; the tap restarts the sound at the current picture time
    const pill = $('tap'); pill.hidden = false;
    const go = () => {
      removeEventListener('pointerdown', go, true); removeEventListener('keydown', go, true); pill.hidden = true;
      if (!playing || SUSP === null) return; const off = lastT; SUSP = null; begin(off, false);
    };
    addEventListener('pointerdown', go, true); addEventListener('keydown', go, true);
  }, 400);
}
