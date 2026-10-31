/* ════════════════════════ transport ════════════════════════ */
let ac = null, t0 = 0, playing = false, lat = 0, pump = null, pumpId = 0, rng = Math.random, seedUsed = 0;
let paused = false, hueBase = 0, dragging = false, volNode = null, hideT = 0;
const $ = id => document.getElementById(id);
['gimgs', 'timgs', 'thumbs'].forEach(id => {
  $(id).addEventListener('click', ev => {
    ev.stopPropagation(); const t = ev.target, b = t.closest('[data-k]'); if (!b) return;
    if (t.tagName === 'I') removeImg(+b.dataset.k); else showImg(+b.dataset.k);
  });
  $(id).addEventListener('change', ev => { const f = ev.target; if (f.files) { addImages(f.files); f.value = ''; } });
});
['ggal', 'tgal'].forEach(id => $(id).addEventListener('click', ev => {
  ev.stopPropagation(); const b = ev.target.closest('[data-gid]'); if (b) galPick(b.dataset.gid);
}));
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function newSeed() {   // one seed drives all the randomness of a play (notes, drift phases, spin direction, start hue)
  const q = Q.get('seed'); seedUsed = q !== null ? (parseFloat(q) || 0) : Math.floor(Math.random() * 1e6);
  rng = mulberry32(seedUsed); PH = rng() * 6.283; rotDir = rng() < .5 ? -1 : 1;
  NOTES = ARC.piano && !LOC ? pianoScore() : []; MEL = NOTES.filter(n => n.k === 'm');
  const h = Q.get('hue'); hueBase = h === 'random' ? rng() * 6.283 : (parseFloat(h) || 0);
}
function integrateTo(off) {
  if (LOC) return integrateLocal(off);   // fast-forward the drifting state (hue, spin) to a given time; mirrors render() through driftStep (T185)
  const hk = HCr.v ?? 0, st = { live: false, hk, calm: UE.calm, amp: UE.amp, mid: 0, tr: 0, tm: 0 };
  DRIFT.hue = hueBase; DRIFT.rotA = 0;
  for (let s = 0; s < off; s += .5) { const { u, u0 } = uAt(s, UE.off), e = score(u); st.t = s; st.u = u; st.u0 = u0; st.kal0 = e[1]; st.hueSpd = e[4]; driftStep(DRIFT, .5, st); }
  hue = DRIFT.hue; rotA = DRIFT.rotA;
}
const setPP = () => { $('pp').textContent = $('mpp').textContent = paused ? '▶' : '❚❚'; };
function begin(off, fresh) {   // (re)start sound + state at song time `off`; the picture is a pure function of time so it just follows
  syncNow(); clearInterval(pumpId); if (ac) ac.close().catch(() => {}); document.body.classList.toggle('filesrc', !!LOC);   // a local file: no #vol in the auto pupitre (CSS)
  ac = new (window.AudioContext || window.webkitAudioContext)(MOBILE ? { latencyHint: 'playback' } : undefined); ac.resume();
  off = clamp(off, 0, Math.max(0, TOTAL - 3));
  t0 = ac.currentTime + .2 - off; lat = ac.outputLatency || ac.baseLatency || 0;
  if (fresh) newSeed(); else rng = mulberry32(seedUsed + Math.floor(off) + 1);
  AI.scene = null; bi = 0; bassE = 0; lastT = off; snapLook = true; cellPrev = 0; strPrev = 0; strLn = cellLn = null; cellGrid = 4; paused = false; setPP(); vidPause(false);
  pump = LOC ? playLocal(ac, t0, off) : buildAudio(ac, t0, off); if (Q.has('debug') && !LOC) console.log('EVT', MUSIC, JSON.stringify(EVT)); integrateTo(off);   // T103: after buildAudio (uAt -> planE -> vplan reads EVT)
  if (STYLES[MUSIC]) drawProfile(); pump(); pumpId = setInterval(pump, 1000);
}
let SUSP = null;
function start() {
  if (playing || !ready || liveOn) return;
  SUSP = null; if (!LOC) lsSet('setup', { src: 'gen', music: MUSIC, arc: arcName, min: MIN });
  if (TUNE && !LOC) { MUSIC = 'gymnopedie'; applyArc(); }   // T117: tune mode: a fixed calm piano piece, whatever the user picked (the picture does not read it)
  begin(0, true); playing = true; homeGate(false); document.body.classList.add('playing');
  const el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  if (CL) toast('Control: ' + LVL[CL] + '  ·  M = level  ·  H = all keys  ·  Q W E R Y U I O P effects  ·  A S D G moods  ·  Enter = surge  ·  Space = pause', 7000); else toast('Move the mouse for controls  ·  Space pause  ·  Shift+← → ±10 s  ·  F fullscreen  ·  Esc leaves fullscreen, then stops');
  requestAnimationFrame(loop);
}
function seekTo(sec) { if (!playing) return; const was = paused; begin(sec, false); if (was) { ac.suspend(); paused = true; setPP(); vidPause(true); } }
function togglePause() { if (!playing) return; if (paused) ac.resume(); else ac.suspend(); paused = !paused; setPP(); vidPause(paused); }   // T172: video sources follow the pause
const DBG = Q.has('debug');
let dbgEl = null, dbgLast = 0, dbgMs = 16, dbgUr = 0, dbgUt = 0;
function dbgTick() {   // ?debug=1: fps/frame ms + audio underrun stats (playoutStats is Chrome-only, feature-detected)
  const n = performance.now(), d = n - dbgLast; dbgLast = n; if (d > 0 && d < 1000) dbgMs += (d - dbgMs) * .05;
  if (!dbgEl) { dbgEl = document.createElement('pre'); dbgEl.style.cssText = 'position:fixed;left:4px;top:4px;z-index:99;margin:0;padding:3px 5px;font:11px monospace;color:#0f0;background:#000a;pointer-events:none;white-space:pre'; document.body.appendChild(dbgEl); }
  if (n - dbgUt < 500) return; dbgUt = n;
  let s = `${(1000 / dbgMs).toFixed(0)} fps ${dbgMs.toFixed(1)} ms${MOBILE ? ' mobile' : ''} q=${quality}\nac ${ac.state} base ${(ac.baseLatency * 1000).toFixed(0)} ms out ${((ac.outputLatency || 0) * 1000).toFixed(0)} ms`;
  const ps = ac.playoutStats;
  if (ps) {
    s += `\nunderrun ${ps.underrunEvents} ev ${(ps.underrunDuration || 0).toFixed(2)} s, avg lat ${((ps.averageLatency || 0) * 1000).toFixed(0)} ms`;
    if (ps.underrunEvents > dbgUr) { console.log(`AUDIO underruns ${dbgUr} -> ${ps.underrunEvents} (${(ps.underrunDuration || 0).toFixed(2)} s) at ac t=${ac.currentTime.toFixed(1)} fps=${(1000 / dbgMs).toFixed(0)}`); dbgUr = ps.underrunEvents; }
  } else s += '\n(no playoutStats)';
  dbgEl.textContent = s;
}
let endN = 0;   // seconds shown on #endwarn (0 = hidden); see endWarn()
function endWarn(t) {   // red dot + countdown 30, 20, 10 s before the end (generated + local). Derived from TOTAL - t, so a seek just recomputes it
  const r = TOTAL - t; let n = 0;
  if (r > 0 && r <= 30 && !liveOn && !SHOW) for (const m of [30, 20, 10]) if (r <= m && r > m - 5) n = Math.ceil(r);
  if (n === endN) return; endN = n;   // the DOM is touched only when the shown number changes
  const el = $('endwarn'); el.classList.toggle('on', n > 0); if (n) el.lastElementChild.textContent = n;
}
// Clip recording (T79, T166 Live): the canvas + the master output (volNode, tapped, speakers unchanged); Live: the clean tab source (liveSrc) or the mic after its gain (micGain), never routed to the speakers. One clip at a time; webcam footage is recorded too.
let REC = null, CLIP = null;   // REC = the clip being recorded; CLIP = the last finished clip
const REC_MIME = window.MediaRecorder ? ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '' : '';
// T171 clip qualities (chosen in #recpick, saved as bicycleday.recq): h = max output height in px, v / a = video / audio bits per second; width keeps the canvas aspect (even), never upscaled. The browser default bitrate is far lower.
const RECQ = { hd: { name: 'HD', h: 1080, v: 8e6, a: 192e3 }, small: { name: 'Small', h: 720, v: 3e6, a: 128e3 } };
const recqGet = () => { const q = lsGet('recq'); return RECQ[q] ? q : 'hd'; };
function recStart(sec) {
  if (REC || !(playing || liveOn) || !REC_MIME) return;
  const qn = recqGet(), q = RECQ[qn], tap = ac.createMediaStreamDestination();
  let src = cv, c2 = null;   // canvas taller than q.h: a 2D canvas of the target size, refilled right after each rendered frame (recCopy); else the WebGL canvas itself
  if (q.h && cv.height > q.h) { c2 = document.createElement('canvas'); c2.height = q.h; c2.width = Math.max(2, 2 * Math.round(cv.width * q.h / cv.height / 2)); src = c2; }
  const stream = new MediaStream([...src.captureStream(30).getVideoTracks(), ...tap.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: REC_MIME, videoBitsPerSecond: q.v, audioBitsPerSecond: q.a }), chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => recDone(chunks, rec.mimeType, sec, qn);
  REC = { ac, tap, out: null, rec, sec, c2, x2: c2 && c2.getContext('2d'), t0: performance.now(), txt: '', timer: setTimeout(recStop, sec * 1000) };
  const o = liveOn ? liveRecNode() : volNode; if (o) { o.connect(tap); REC.out = o; }
  CLIP = null; $('recshare').hidden = true; $('recpick').hidden = true;
  rec.start(1000); document.body.classList.add('recording'); toast('Recording ' + sec + ' s · ' + q.name, 2000);
}
function recStop(msg) {   // stop now (timer, button, Stop, or the piece changed); the recorder's onstop saves the clip
  const r = REC; if (!r) return;
  REC = null; clearTimeout(r.timer); if (r.out) r.out.disconnect(r.tap);
  document.body.classList.remove('recording'); $('rec').textContent = 'Record';
  if (msg) toast(msg, 4000);
  if (r.rec.state !== 'inactive') r.rec.stop();
}
function recTick() {   // once per frame while recording (loop() and liveLoop()): keep the tap on the current master (not in Live), end the clip if the piece restarted or a webcam was added
  if (ac !== REC.ac) return recStop('Clip ended: the piece restarted');
  if (!liveOn && volNode && REC.out !== volNode) { volNode.connect(REC.tap); REC.out = volNode; }
  const txt = '■ ' + Math.max(0, Math.ceil(REC.sec - (performance.now() - REC.t0) / 1000)) + ' s';
  if (txt !== REC.txt) { REC.txt = txt; $('rec').textContent = txt; }
}
function recCopy() {   // scaled clips: copy the frame just rendered (the WebGL canvas does not keep its buffer after the task); called right after render() in loop() and liveLoop()
  const r = REC; if (r && r.c2) r.x2.drawImage(cv, 0, 0, r.c2.width, r.c2.height);
}
async function recDone(chunks, type, sec, qn) {
  if (!chunks.length) { toast('Nothing recorded', 3000); return; }
  let parts = chunks;
  if (type.includes('webm')) try { parts = [webmFix(await new Blob(chunks).arrayBuffer())]; } catch (e) {}   // T169: add Duration + Cues so players can seek (webmFix never throws; unchanged on error)
  CLIP = new File(parts, 'bicycle-day-' + seedUsed + '-' + sec + 's' + (qn === 'hd' ? '' : '-' + qn) + '.' + (type.includes('mp4') ? 'mp4' : 'webm'), { type });
  if (navigator.canShare && navigator.canShare({ files: [CLIP] })) { $('recshare').hidden = false; toast('Clip ready · tap Share clip', 4000); }   // Web Share needs a tap, so it is a button
  else saveClip();
}
function saveClip() {   // download the last clip
  const a = document.createElement('a'), url = URL.createObjectURL(CLIP);
  a.href = url; a.download = CLIP.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('Saved ' + CLIP.name, 3000);
}
$('rec').addEventListener('click', () => { if (REC) recStop(); else $('recpick').hidden = !$('recpick').hidden; });
document.querySelectorAll('#recpick button[data-s]').forEach(b => b.addEventListener('click', () => recStart(+b.dataset.s)));
$('recshare').addEventListener('click', () => { if (CLIP) navigator.share({ files: [CLIP], title: 'Bicycle Day' }).then(() => toast('Shared', 1500), err => { if (err && err.name !== 'AbortError') saveClip(); }); });
function loop() {
  if (!playing) return;
  if (REC) recTick();
  const t = SUSP !== null ? (performance.now() - SUSP) / 1000 : Math.max(0, ac.currentTime - t0 - lat), dt = clamp(t - lastT, 0, .1); lastT = t;   // SUSP: audio blocked by autoplay policy (?img= autostart): the picture runs on the wall clock until the first tap
  if (TUNE) tuneTick();   // T117: tune mode: playhead of the strip
  let bass = 0, mid = 0, hi = 0;
  if (LOC) { localView(Math.min(t, TOTAL)); bass = LIVE.bn; mid = LIVE.mn; hi = LIVE.hn; }   // local file: features come from the precomputed timeline
  else if (analyser) {
    analyser.getByteFrequencyData(fdata);
    for (let i = 1; i < 7; i++) bass += fdata[i]; for (let i = 7; i < 41; i++) mid += fdata[i]; for (let i = 41; i < 200; i++) hi += fdata[i];
    bass /= 6 * 255; mid /= 34 * 255; hi /= 159 * 255;
  }
  const tc = Math.min(t, TOTAL); render(tc, dt, bass, mid, hi); if (REC) recCopy();
  if (DBG) dbgTick();
  if (snapWant) { snapWant = false; takeSnapshot(tc); }
  if ((document.body.classList.contains('ui') || document.body.classList.contains('pshow')) && !dragging) { $('tm').textContent = $('mtm').textContent = fmt(tc) + ' / ' + fmt(TOTAL); $('head').style.left = $('mhead').style.left = (tc / TOTAL * 100) + '%'; }
  endWarn(tc);
  if (t >= TOTAL + .3 && !LOC && !SHOW && !liveOn) { toast('New piece'); { const o = MUSICS.filter(m => m !== MUSIC); MUSIC = o[Math.floor(Math.random() * o.length)]; arcName = ['journey', 'slam', 'intense'][Math.floor(Math.random() * 3)]; applyArc(); drawProfile(); markMus(); markArcOn(); markArcHint(); } if (SUSP !== null) SUSP = performance.now(); begin(0, true); requestAnimationFrame(loop); return; }   // SUSP (autoplay blocked): restart the wall clock too, else t stays past the end and restarts every frame   // generated: next piece, same settings (new seed); fullscreen and USER.* stay
  if (LOC && NEXT && (NEXTGO || t >= TOTAL + .3)) {   // a queued next track: play it when this one ends (or on "Play next now")
    if (NEXTDATA) { goNext(); requestAnimationFrame(loop); return; }
    if (NEXTFAIL) { toast('Next track could not be read'); clearNext(); }
    else { if (!NEXTGO) toast('Loading next track…', 60000); NEXTGO = true; if (t >= TOTAL + .3) { requestAnimationFrame(loop); return; } }   // still decoding: hold the last picture, silent
  }
  if (t >= TOTAL + .3) { playing = false; clearInterval(pumpId); leaveLocal(); resetFx(); resetControls(); document.body.classList.remove('playing', 'ui', 'pultH', 'pultZ', 'pshow'); syncPult(); hint.textContent = 'Finished · seed ' + seedUsed; homeGate(true); return; }
  requestAnimationFrame(loop);
}
