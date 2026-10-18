/* ════════════════════════ LIVE MODE (prototype): listen to a tab (e.g. YouTube) and follow the music ════════════════════════
   Nothing is recorded or uploaded; the audio is analysed in the browser. The tab keeps playing on its own (we never route it to the speakers).
   Real-time features → a causal "intensity" 0..1 → it picks a position on the 'journey' arc, so all the existing looks are reused. */
let LIVE = null, liveOn = false, liveStream = null, liveT0 = 0, LF = null, LB = null;
const bandsFor = k => {   // bin ranges for the 3 analysis bands + 10 log-spaced bands of the spectral profile
  const e = []; for (let i = 0; i <= 10; i++) e.push(Math.round(40 * Math.pow(6500 / 40, i / 10) / k));
  return { b: [Math.round(40 / k), Math.round(170 / k)], m: [Math.round(170 / k), Math.round(1300 / k)], h: [Math.round(1300 / k), Math.round(6500 / k)], p: e };
};
// detector settings (tuned on real tracks with tools/sweep.py; see tools/refs.json)
const DET = { sfTau: 1, ssTau: 12, gapThr: .16, gapDur: 1.5, dwell: 4, dropGap: 2.5, dropDwell: 18, slamBass: .3, slamLv: .05, warm: 25, minFloor: 1.2, minK: 1.6, minDur: 1.5, minDwell: 12, dropMinGap: 0, dropMinProf: 0, bigFloor: 99, bigK: 3, bigDur: 1 };
const newLive = () => ({ u: .07, pulse: 0, ref: { b: 1e-6, m: 1e-6, h: 1e-6 }, lv: 0, ls: 0, bf: 0, bsl: 0, bassPrev: 0, bassFast: 0, bassLong: 0, bassSlow: 0, tension: 0, boost: 0, sinceDrop: 99, scenes: 0, kinds: [1], sf: [0, 0, 0], ss: [0, 0, 0], secT: 0, sinceScene: 0, minors: 0, pT: 0, bigT: 0, pf: null, ps: null, sinceMinor: 0, age: 0, state: 'listening…', I: 0, bn: 0, mn: 0, hn: 0 });   // fresh analysis state (also used by tools/replay.mjs)
async function getLiveStream(mic) {   // getUserMedia (mic) / getDisplayMedia (tab) → an audio stream, or null (the reason goes to #hint). Call it from a click (needs the user gesture)
  const audioC = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };   // keep the music untouched
  let stream;
  try {
    if (mic) stream = await navigator.mediaDevices.getUserMedia({ audio: audioC });
    else {
      if (!navigator.mediaDevices.getDisplayMedia) throw new Error('This browser cannot capture tab audio — use Chrome or Edge on desktop');
      const ctl = window.CaptureController ? new CaptureController() : null;
      const p = navigator.mediaDevices.getDisplayMedia({ video: true, audio: audioC, surfaceSwitching: 'exclude', selfBrowserSurface: 'exclude', ...(ctl ? { controller: ctl } : {}) });
      try { ctl && ctl.setFocusBehavior('no-focus-change'); } catch (e) {}   // stay on this window instead of jumping to the shared tab
      stream = await p;
    }
  } catch (e) { hint.textContent = e.name === 'NotAllowedError' ? 'Cancelled — click again and pick a tab' : e.message; return null; }
  if (!stream.getAudioTracks().length) {
    stream.getTracks().forEach(t => t.stop());
    hint.textContent = 'No audio received — in the dialog pick a TAB (not a window) and tick “Share tab audio”'; return null;
  }
  stream.getVideoTracks().forEach(t => { t.enabled = false; });   // we only want the sound
  return stream;
}
async function startLive(mic = Q.get('live') === 'mic') {
  if (!ready || playing || liveOn) return;
  const stream = await getLiveStream(mic); if (!stream) return;
  liveUp(stream, mic); homeGate(false); toast('Esc or ■ stop to leave  ·  F fullscreen', 4000);
  requestAnimationFrame(liveLoop);
}
function liveUp(stream, mic) {   // the analysis side of Live: AudioContext + analyser on the stream (no output), 'journey' arc, a new seed
  if (ac) ac.close().catch(() => {});
  ac = new (window.AudioContext || window.webkitAudioContext)(); ac.resume();
  const src = ac.createMediaStreamSource(stream);
  analyser = ac.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .3;   // analyser only: no output
  micGain = ac.createGain(); micGain.gain.value = Math.pow(10, MICDB / 20); src.connect(micGain); micGain.connect(analyser); TD = new Float32Array(analyser.fftSize);
  document.body.classList.toggle('mic', !!mic); document.body.classList.add('live');
  LF = new Float32Array(analyser.frequencyBinCount); const k = ac.sampleRate / analyser.fftSize;
  LB = bandsFor(k);
  setArc('journey'); newSeed(); rotA = 0; bi = 0; bassE = 0; hue = hueBase;
  LIVE = newLive();
  liveStream = stream; liveOn = true; syncNow(); liveT0 = ac.currentTime; lastT = 0; lastScene = 0; trT0 = -99; AI.scene = null; AI.acc = 0;
  stream.getTracks().forEach(t => t.addEventListener('ended', stopLive));   // the user clicked Chrome's "Stop sharing"
}
function liveStep(dt) {   // causal features from the current spectrum → intensity, tension, drop, state
  const L = LIVE, ease = tau => 1 - Math.exp(-dt / tau);
  analyser.getFloatFrequencyData(LF);
  const band = ([a, b]) => { let x = 0; for (let i = a; i < b; i++) x += Math.pow(10, LF[i] / 20); return x / Math.max(1, b - a); };
  const raw = { b: band(LB.b), m: band(LB.m), h: band(LB.h) };
  const n = {}; for (const key in raw) { L.ref[key] = Math.max(raw[key], L.ref[key] * Math.exp(-dt / 30), 1e-5); n[key] = clamp(raw[key] / L.ref[key]); }   // per-band auto-gain, 30 s memory
  const lvl = .45 * n.b + .35 * n.m + .2 * n.h;
  L.lv += (lvl - L.lv) * ease(.8); L.ls += (lvl - L.ls) * ease(10);
  const bright = n.h / (n.b + n.m + n.h + 1e-6);
  L.bf += (bright - L.bf) * ease(1.5); L.bsl += (bright - L.bsl) * ease(10);
  // kicks: positive jumps of the bass band
  const kick = clamp((n.b - L.bassPrev) * 5); L.bassPrev = n.b;
  L.pulse = Math.max(L.pulse * Math.exp(-dt * 8), kick);
  L.bassFast += (n.b - L.bassFast) * ease(.3); L.bassLong += (n.b - L.bassLong) * ease(2.5); L.bassSlow += (n.b - L.bassSlow) * ease(6);
  // build = brightness and level both rising for a while; drop = bass slams back in after a quiet-bass stretch or after a build
  const rising = (L.bf - L.bsl) > .01 && L.lv > L.ls + .02;
  L.tension = rising ? Math.min(1, L.tension + dt * .12) : L.tension * Math.exp(-dt * .4);
  L.sinceDrop += dt; L.age += dt;
  const slam = n.b > .75 && L.bassSlow < DET.slamBass && L.lv > L.ls + DET.slamLv, afterBuild = L.tension > .35 && L.lv - L.ls > .12 && n.b > .6;
  let dropped = false;
  if (L.age > DET.warm && L.sinceDrop > DET.dropDwell && (slam || afterBuild))   // (no drops during the first 25 s: the auto-gain is still settling and fakes them)
    { L.boost = 1; L.tension = 0; L.sinceDrop = 0; dropped = true; }
  // section detector: a fast average of (level, brightness, bass) against a slow one; a lasting gap = the music moved on to another part
  const cur = [L.lv, clamp(L.bf * 2.5), L.bassLong];
  for (let i = 0; i < 3; i++) { L.sf[i] += (cur[i] - L.sf[i]) * ease(DET.sfTau); L.ss[i] += (cur[i] - L.ss[i]) * ease(L.sinceScene < 5 ? .5 : DET.ssTau); }   // right after a scene change the reference catches up fast, so a ramp isn't read as another change
  if (L.age < DET.warm) L.ss = L.sf.slice();
  const gap = Math.abs(L.sf[0] - L.ss[0]) + Math.abs(L.sf[1] - L.ss[1]) + .5 * Math.abs(L.sf[2] - L.ss[2]);
  L.secT = gap > DET.gapThr ? L.secT + dt : Math.max(0, L.secT - dt); L.sinceScene += dt;
  // minor changes: how much the SHAPE of the spectrum (10 log bands, in dB) just moved away from its recent average
  const prof = []; for (let i = 0; i < 10; i++) { let x = 0; const a = LB.p[i], b = Math.max(a + 1, LB.p[i + 1]); for (let j = a; j < b; j++) x += Math.max(-120, LF[j]); prof.push(x / (b - a)); }
  if (!L.pf) { L.pf = prof.slice(); L.ps = prof.slice(); }
  let dprof = 0; for (let i = 0; i < 10; i++) { L.pf[i] += (prof[i] - L.pf[i]) * ease(1.5); L.ps[i] += (prof[i] - L.ps[i]) * ease(L.sinceMinor < 4 ? .5 : 10); dprof += Math.abs(L.pf[i] - L.ps[i]) / 10; }
  L.dm = (L.dm ?? dprof) + (dprof - (L.dm ?? dprof)) * ease(60);   // typical amount of spectral movement in THIS track: busy tracks need a bigger jump to count
  L.pT = dprof > Math.max(DET.minFloor, DET.minK * L.dm) ? L.pT + dt : Math.max(0, L.pT - dt); L.sinceMinor += dt; L.dprof = dprof;
  L.bigT = dprof > Math.max(DET.bigFloor, DET.bigK * L.dm) ? L.bigT + dt : Math.max(0, L.bigT - dt);   // a very large jump of the spectral shape is a scene on its own
  if (L.age > DET.warm && ((dropped && L.sinceScene > DET.dropGap && (gap > DET.dropMinGap || dprof > DET.dropMinProf)) || ((L.secT > DET.gapDur || L.bigT > DET.bigDur) && L.sinceScene > DET.dwell))) {   // new scene: new palette / lead effect / tile grid, with a visible transition
    L.scenes++; L.kinds[L.scenes] = dropped || L.sf[0] >= L.ss[0] ? 1 : 0;   // (rising = energetic, falling = calm)
    L.sinceScene = 0; L.secT = 0; L.sinceMinor = 0; L.pT = 0; L.bigT = 0; L.ss = cur.slice();   // reference = where the music is now, not the lagging average
  }
  else if (L.age > DET.warm + 5 && L.pT > DET.minDur && L.sinceMinor > DET.minDwell && L.sinceScene > 6) { L.minors++; L.sinceMinor = 0; L.pT = 0; }   // minor: a lighter transition, same scene
  L.boost *= Math.exp(-dt / 6);
  L.I = clamp(.12 + .62 * L.lv + .3 * L.tension + .45 * L.boost);
  { const tgt = lerp(.26, .88, L.I); L.u += (tgt - L.u) * ease(tgt > L.u ? .45 : 2.5); }   // quick to rise on a build / drop, slow to fall: no flicker within a theme
  // state label: a new state must hold for 3 s before it shows (drops show at once and stay >= 4 s), so a steady passage doesn't flicker
  const rawSt = L.boost > .5 ? 'drop' : L.tension > .25 ? 'build' : L.bassLong > .3 ? 'groove' : L.lv < .27 ? 'breakdown' : 'calm';
  if (L.age < 4) L.state = 'listening…';
  else {
    L.stT = (L.stT || 0) + dt;
    if (rawSt === L.state) L.cand = null;
    else if (rawSt === 'drop' || L.state === 'listening…') { L.state = rawSt; L.stT = 0; L.cand = null; }
    else if (L.stT > 4) { if (rawSt !== L.cand) { L.cand = rawSt; L.candT = 0; } else if ((L.candT += dt) > 3) { L.state = rawSt; L.stT = 0; L.cand = null; } }
  }
  L.bn = n.b; L.mn = n.m; L.hn = n.h;
}
function liveLoop() {
  if (!liveOn) return;
  const t = ac.currentTime - liveT0, dt = clamp(t - lastT, 0, .1); lastT = t;
  liveStep(dt); render(t, dt, LIVE.bn, LIVE.mn, LIVE.hn);
  if (snapWant) { snapWant = false; takeSnapshot(t); }
  $('lstate').textContent = LIVE.state; $('lbar').firstElementChild.style.width = (LIVE.I * 100) + '%';
  analyser.getFloatTimeDomainData(TD);   // input meter: RMS in dBFS (smoothed) and clipping
  let sq = 0, pk = 0; for (let i = 0; i < TD.length; i++) { const v = TD[i]; sq += v * v; if (Math.abs(v) > pk) pk = Math.abs(v); }
  const db = 10 * Math.log10(sq / TD.length + 1e-12); METER.db += (db - METER.db) * (1 - Math.exp(-dt / .25)); if (pk >= .98) clipT = t;
  if (MICAUTO && micGain) {   // auto input level: slow up when quiet, fast down on clipping, nothing on near-silence
    const d = METER.db; let g = MICDB;
    if (t - clipT < 1.5) g -= 8 * dt;
    else if (d > -60) { const e = -20 - d; if (e > 2) g += Math.min(e, 10) * .15 * dt; else if (e < -2) g += Math.max(e, -10) * .5 * dt; }
    g = clamp(g, -12, 24);
    if (g !== MICDB) { MICDB = g; micGain.gain.setTargetAtTime(Math.pow(10, g / 20), ac.currentTime, .1); const k = Math.round(g); $('u-mg').value = k; $('mgv').textContent = (k > 0 ? '+' : '') + k + ' dB'; }
  }
  { const d = METER.db, clip = t - clipT < 1.5, st = clip ? ['clipping — lower the input volume', '#ff4d4d'] : d < -55 ? ['no signal / too quiet', '#ff4d4d'] : d < -40 ? ['low — raise sensitivity', '#ffb020'] : d < -8 ? ['good', '#2cff8a'] : ['loud', '#ffb020'];
    const m = $('mlev').firstElementChild; m.style.width = clamp((d + 60) / 60) * 100 + '%'; m.style.background = st[1]; $('mtxt').textContent = Math.round(d) + ' dB · ' + st[0]; $('mtxt').style.color = st[1]; $('mlev').title = $('mtxt').textContent; }
  if (Q.has('debug') && Math.floor(t) !== Math.floor(t - dt)) console.log(`LIVE t=${t.toFixed(0)} lv=${LIVE.lv.toFixed(2)} ls=${LIVE.ls.toFixed(2)} bn=${LIVE.bn.toFixed(2)} scene=${LIVE.scenes}/${LIVE.kinds[LIVE.scenes]} gap=${(Math.abs(LIVE.sf[0] - LIVE.ss[0]) + Math.abs(LIVE.sf[1] - LIVE.ss[1])).toFixed(2)} tension=${LIVE.tension.toFixed(2)} boost=${LIVE.boost.toFixed(2)} I=${LIVE.I.toFixed(2)} state=${LIVE.state}`);
  requestAnimationFrame(liveLoop);
}
function stopLive() {
  if (!liveOn) return; liveOn = false; LIVE = null;
  if (liveStream) liveStream.getTracks().forEach(t => t.stop()); liveStream = null;
  if (ac) ac.close().catch(() => {}); ac = null; analyser = null;
  resetFx(); resetControls(); document.body.classList.remove('live', 'mic', 'ui', 'pultH', 'pultZ', 'pshow', 'liveZ'); syncPult(); micGain = null; METER.db = -90; homeGate(true); applyArc(); updateHint();
}
$('tabmode').addEventListener('click', e => { e.stopPropagation(); lsSet('setup', { src: 'tab' }); startLive(Q.get('live') === 'mic'); });
$('micmode').addEventListener('click', e => { e.stopPropagation(); lsSet('setup', { src: 'mic' }); startLive(true); });
{ // tab capture needs desktop Chrome / Edge: say so up front instead of failing after the click
  const ua = navigator.userAgent, ok = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !/Firefox|Mobi|Android|iPhone|iPad/.test(ua);
  if (!ok) { $('tabmode').disabled = true; $('streamwarn').textContent = /Firefox/.test(ua) ? 'Not supported in Firefox (no tab audio). Use Chrome / Edge, or Live.' : 'Needs Chrome or Edge on a computer. Use Live instead.'; }
}
$('lstop').addEventListener('click', e => { e.stopPropagation(); stopLive(); });
