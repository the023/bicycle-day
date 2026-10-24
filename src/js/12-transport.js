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
  if (LOC) return integrateLocal(off);   // fast-forward the drifting state (hue, spin) to a given time; mirrors render()
  hue = hueBase; rotA = 0; const hk = HCr.v ?? 0;
  for (let s = 0; s < off; s += .5) { const { u, u0 } = uAt(s, UE.off), e = score(u); hue += e[4] * UE.hueK * UE.calm * .5; rotA += UE.amp * (.5 * rotDir * HCspin(s) * hk + .5 * rotDir * opening(u0) * (.25 + .75 * smooth(.12, .35, u)) * (ENGINE.kal.spinBase + ENGINE.kal.spinKal * e[1] + ENGINE.kal.spinWob * wob(s, 5))); }   // T155: x UE.amp = render()'s spin speed
}
const setPP = () => { $('pp').textContent = $('mpp').textContent = paused ? '▶' : '❚❚'; };
function begin(off, fresh) {   // (re)start sound + state at song time `off`; the picture is a pure function of time so it just follows
  syncNow(); clearInterval(pumpId); if (ac) ac.close().catch(() => {}); document.body.classList.toggle('filesrc', !!LOC);   // a local file: no #vol in the auto pupitre (CSS)
  ac = new (window.AudioContext || window.webkitAudioContext)(MOBILE ? { latencyHint: 'playback' } : undefined); ac.resume();
  off = clamp(off, 0, Math.max(0, TOTAL - 3));
  t0 = ac.currentTime + .2 - off; lat = ac.outputLatency || ac.baseLatency || 0;
  if (fresh) newSeed(); else rng = mulberry32(seedUsed + Math.floor(off) + 1);
  AI.scene = null; bi = 0; bassE = 0; lastT = off; snapLook = true; cellPrev = 0; strPrev = 0; strLn = cellLn = null; cellGrid = 4; paused = false; setPP();
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
function seekTo(sec) { if (!playing) return; const was = paused; begin(sec, false); if (was) { ac.suspend(); paused = true; setPP(); } }
function togglePause() { if (!playing) return; if (paused) ac.resume(); else ac.suspend(); paused = !paused; setPP(); }
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
// Clip recording (T79): the canvas + the master output (volNode, tapped, speakers unchanged). One clip at a time; webcam footage is recorded too.
let REC = null, CLIP = null;   // REC = the clip being recorded; CLIP = the last finished clip
const REC_MIME = window.MediaRecorder ? ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '' : '';
const REC_BPS = 12e6, REC_ABPS = 192e3;   // clip bitrates (video / audio); the browser default is far lower
function recStart(sec) {
  if (REC || !playing || liveOn || !REC_MIME) return;
  const tap = ac.createMediaStreamDestination(), stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...tap.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: REC_MIME, videoBitsPerSecond: REC_BPS, audioBitsPerSecond: REC_ABPS }), chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => recDone(chunks, rec.mimeType, sec);
  REC = { ac, tap, out: null, rec, sec, t0: performance.now(), txt: '', timer: setTimeout(recStop, sec * 1000) };
  if (volNode) { volNode.connect(tap); REC.out = volNode; }
  CLIP = null; $('recshare').hidden = true; $('recpick').hidden = true;
  rec.start(1000); document.body.classList.add('recording'); toast('Recording ' + sec + ' s', 2000);
}
function recStop(msg) {   // stop now (timer, button, Stop, or the piece changed); the recorder's onstop saves the clip
  const r = REC; if (!r) return;
  REC = null; clearTimeout(r.timer); if (r.out) r.out.disconnect(r.tap);
  document.body.classList.remove('recording'); $('rec').textContent = 'Record';
  if (msg) toast(msg, 4000);
  if (r.rec.state !== 'inactive') r.rec.stop();
}
function recTick() {   // once per frame while recording: keep the tap on the current master, end the clip if the piece restarted or a webcam was added
  if (ac !== REC.ac) return recStop('Clip ended: the piece restarted');
  if (volNode && REC.out !== volNode) { volNode.connect(REC.tap); REC.out = volNode; }
  const txt = '■ ' + Math.max(0, Math.ceil(REC.sec - (performance.now() - REC.t0) / 1000)) + ' s';
  if (txt !== REC.txt) { REC.txt = txt; $('rec').textContent = txt; }
}
function recDone(chunks, type, sec) {
  if (!chunks.length) { toast('Nothing recorded', 3000); return; }
  CLIP = new File(chunks, 'bicycle-day-' + seedUsed + '-' + sec + 's.' + (type.includes('mp4') ? 'mp4' : 'webm'), { type });
  if (navigator.canShare && navigator.canShare({ files: [CLIP] })) { $('recshare').hidden = false; toast('Clip ready · tap Share clip', 4000); }   // Web Share needs a tap, so it is a button
  else saveClip();
}
function saveClip() {   // download the last clip
  const a = document.createElement('a'), url = URL.createObjectURL(CLIP);
  a.href = url; a.download = CLIP.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('Saved ' + CLIP.name, 3000);
}
$('rec').addEventListener('click', () => { if (REC) recStop(); else $('recpick').hidden = !$('recpick').hidden; });
document.querySelectorAll('#recpick button').forEach(b => b.addEventListener('click', () => recStart(+b.dataset.s)));
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
  const tc = Math.min(t, TOTAL); render(tc, dt, bass, mid, hi);
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
// Transport follows pointer activity; settings only open by explicit click.
let PEND = null, SWAPPING = false, PGEN = null;   // PGEN: Style/Shape/Length picked in the Source panel for the next generated piece (applied by switchSource);   // Source panel: the card picked but not applied yet; a switch or a file decode in progress (declared before setTuning, which runs early)
// Pupitre shown = H (pultH) or pointer in the bottom zone (pultZ) or Source panel open (tuning)
const syncPult = () => { const b = document.body.classList; b.toggle('pshow', b.contains('pultH') || b.contains('pultZ') || b.contains('tuning')); };
const setTuning = open => {
  if (!open) PEND = null;
  $('tune').hidden = !open; document.body.classList.toggle('tuning', open); syncSource();
  $('settings').setAttribute('aria-expanded', String(open)); $('settings').textContent = open ? 'Close source' : 'Source'; $('settings').setAttribute('aria-label', open ? 'Close source' : 'Source');
  syncPult();
};
// Source panel: the card of the sound now playing (mic > tab > audio file > generated), and the Audio file options (Now: file name)
const curSrc = () => document.body.classList.contains('mic') ? 'mic' : liveOn ? 'tab' : LOC ? 'file' : 'gen';
const nowText = () => {   // the one text of "what is playing": Style · Shape (generated), file name, Browser tab, Microphone
  const cur = curSrc(), t = n => { const e = document.querySelector(n); return e ? e.textContent : ''; };
  return cur === 'mic' ? 'Microphone' : cur === 'tab' ? 'Browser tab' : cur === 'file' ? LOCNAME : `${t('#mus button[data-music="'+MUSIC+'"]')} · ${t('#opts button[data-arc="'+arcName+'"]')}`;
};
const syncNow = () => {   // pupitre titles (#pnow, #mnow) + the Source panel line
  const x = nowText();
  ['pnow', 'mnow'].forEach(i => { const e = $(i); e.textContent = '♪ ' + x; e.title = x; });
  $('tnowgen').textContent = x + (curSrc() === 'gen' ? ` · ${MIN} min` : ''); $('tnowgen').title = x;
};
const syncSource = () => {
  const cur = curSrc();
  document.querySelectorAll('#tune .tcard').forEach(c => { c.classList.toggle('on', c.dataset.src === cur); c.classList.toggle('pend', c.dataset.src === PEND); });
  if (PEND !== 'gen') PGEN = null; $('tgen').hidden = PEND !== 'gen'; if (PEND === 'gen') markGen(); syncNow(); $('tfile').hidden = !LOC; $('tapply').hidden = !PEND;
};
$('settings').addEventListener('click', () => { setTuning($('tune').hidden); showUI(); });
const showUI = () => {
  document.body.classList.add('ui'); clearTimeout(hideT);
  hideT = setTimeout(() => {
    const hovered = matchMedia('(hover:hover)').matches && [$('pult'), $('mpult'), $('actions'), $('live'), $('tune')].some(el => el.matches(':hover'));
    if (dragging || hovered) showUI(); else document.body.classList.remove('ui');
  }, 2500);
};
function togglePult() {   // H (while playing): shows the pupitre until H again
  const on = document.body.classList.toggle('pultH'); syncPult();
  toast(on ? 'Controls shown (H to hide)' : 'Controls hidden', 1600);
}
function zoneCheck(e) {   // pupitre shows while the pointer is in the bottom 10 % or over it / the Source panel
  const th = $('thumbs').getBoundingClientRect(), top = th.height ? Math.min(innerHeight * 0.9, th.top - 4) : innerHeight * 0.9;   // T148: the zone reaches up to the image thumbnails (when shown), so the pointer can climb onto them
  const low = e.clientY >= top || !!(e.target && e.target.closest && e.target.closest('#pult,#mpult,#tune,#ctl'));
  const b = document.body.classList; if (low !== b.contains('pultZ')) { b.toggle('pultZ', low); syncPult(); }
  if (low) showUI();   // body.ui un-hides the cursor
}
function openDemo() {   // home Help: read-only copy of the pupitre (same DOM + CSS), fixed demo gauge values, no engine
  const box = $('phelp'); box.innerHTML = '';
  const cl = $('pult').cloneNode(true);
  cl.removeAttribute('id'); cl.querySelectorAll('.pctl,.pexpb').forEach(el => el.remove());   // (the explanation panel stays: open in the demo, see #phelp .pxt) cl.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  let k = 0; cl.querySelectorAll('.pg i').forEach(i => { i.style.width = (30 + (k++ * 17) % 41) + '%'; });
  cl.querySelectorAll('input[type=range]').forEach(i => { i.disabled = true; i.value = Math.round(i.max * .4); });
  box.append(Object.assign(document.createElement('div'), { className: 'phtext', textContent: 'This is the control panel you get while playing (move the mouse, or H to pin it). Hover a key for its meaning.' }), cl, Object.assign(document.createElement('button'), { id: 'phx', textContent: '✕', title: 'Close (Esc)' }));
  box.classList.add('on'); document.body.classList.add('help-open');
}
function closeDemo() { const box = $('phelp'); box.classList.remove('on'); box.innerHTML = ''; document.body.classList.remove('help-open'); }
// Source panel stays open while the pointer is in its box or on the Source button (+12 px bridge: the gap between them and the 8 px gaps between action buttons are not "outside")
const liveZone = e => { const z = e.clientX < innerWidth * .2 && e.clientY < innerHeight * .2; if (z !== document.body.classList.contains('liveZ')) document.body.classList.toggle('liveZ', z); };
const nearSource = e => [$('tune'), $('settings')].some(el => { const r = el.getBoundingClientRect(), m = 12; return e.clientX >= r.left - m && e.clientX <= r.right + m && e.clientY >= r.top - m && e.clientY <= r.bottom + m; });
addEventListener('pointermove', e => { if (playing || liveOn) { liveZone(e); const tr = e.clientY < innerHeight * 0.15 || !!e.target.closest('#actions,#tune'); document.body.classList.toggle('side-ui', tr); if (tr) showUI(); zoneCheck(e); if (document.body.classList.contains('tuning') && !e.buttons && !nearSource(e) && e.clientY >= innerHeight * 0.15) setTuning(false); } });
addEventListener('pointerdown', e => { if (playing || liveOn) { showUI(); zoneCheck(e); } });
document.documentElement.addEventListener('mouseleave', () => { document.body.classList.remove('pultZ', 'liveZ'); syncPult(); });
const updateFullscreen = () => {
  const active = !!document.fullscreenElement; $('fullscreen').textContent = active ? 'Exit fullscreen' : 'Fullscreen';
  $('fullscreen').setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  if (playing || liveOn) showUI();
};
document.addEventListener('fullscreenchange', updateFullscreen);
const resetControls = () => { setTuning(false); document.body.classList.remove('side-ui'); };

let toastT = 0;
function toast(msg, ms = 5000) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms); }
const toggleFullscreen = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('Fullscreen is not supported by this browser');
  } catch (e) { toast('Fullscreen unavailable — try opening this page in Chrome'); }
};
$('fullscreen').addEventListener('click', toggleFullscreen);
function stopPlay() {   // back to the start screen
  if (!playing) return; recStop(); playing = false; clearInterval(pumpId); if (ac) ac.close().catch(() => {}); ac = null; analyser = null;
  leaveLocal(); resetFx(); resetControls(); document.body.classList.remove('playing', 'ui', 'pultH', 'pultZ', 'pshow'); syncPult(); homeGate(true); hint.textContent = 'Stopped · seed ' + seedUsed;
  if (document.fullscreenElement) document.exitFullscreen();
}
const bar = $('bar'), mbar = $('mbar'), frac = (e, b = bar) => clamp((e.clientX - b.getBoundingClientRect().left) / b.clientWidth);
const setHead = f => { $('head').style.left = $('mhead').style.left = f * 100 + '%'; };
bar.addEventListener('pointerdown', e => { dragging = true; bar.setPointerCapture(e.pointerId); setHead(frac(e)); });
bar.addEventListener('pointermove', e => { if (dragging) { setHead(frac(e)); $('tm').textContent = $('mtm').textContent = fmt(frac(e) * TOTAL) + ' / ' + fmt(TOTAL); } });
mbar.addEventListener('pointerdown', e => { dragging = true; mbar.setPointerCapture(e.pointerId); setHead(frac(e, mbar)); });   // T78: the minimal pupitre's bar seeks the same way
mbar.addEventListener('pointermove', e => { if (dragging) { setHead(frac(e, mbar)); $('tm').textContent = $('mtm').textContent = fmt(frac(e, mbar) * TOTAL) + ' / ' + fmt(TOTAL); } });
if (SHOW) {   // showcase side panel: every effect by name, the current one highlighted, click = jump (slides in on hover)
  document.body.classList.add('showc'); const fp = $('fxpanel');
  fp.innerHTML = FX.map((f, i) => `<div class="${f.cls || 'gG'}" data-i="${i}">${i + 1} · ${f.name}</div>`).join('');
  fp.addEventListener('click', e => { e.stopPropagation(); const r = e.target.closest('div[data-i]'); if (r) fxSelect(+r.dataset.i); });
  ['pointerdown', 'pointerup', 'pointermove', 'wheel'].forEach(n => fp.addEventListener(n, e => e.stopPropagation()));
}
function fxPanelMark(i) {
  const fp = $('fxpanel'), rows = fp.children; for (let j = 0; j < rows.length; j++) rows[j].classList.toggle('on', j === i);
  const r = rows[i]; if (r) fp.scrollTop = r.offsetTop - fp.clientHeight / 2 + r.offsetHeight / 2;   // (manual: scrollIntoView would scroll the page sideways while the panel is slid off-screen)
}
const fxStart = i => clamp(i, 0, FX.length - 1) * SHOW.seg;
// select an effect (list, N/P, seek bar): loop on = play its loop from the start; loop off = jump to its segment
function fxSelect(i) { i = clamp(i, 0, FX.length - 1); TUNE.i = i; if (TUNE.loop) { tuneRestart(); } else seekTo(fxStart(i)); }   // showcase: seek bar snaps to the start of an effect
bar.addEventListener('pointerup', e => { if (!dragging) return; dragging = false; if (SHOW) fxSelect(Math.floor(frac(e) * FX.length)); else seekTo(frac(e) * TOTAL); });
mbar.addEventListener('pointerup', e => { if (!dragging) return; dragging = false; if (SHOW) fxSelect(Math.floor(frac(e, mbar) * FX.length)); else seekTo(frac(e, mbar) * TOTAL); });
$('pp').addEventListener('click', togglePause); $('mpp').addEventListener('click', togglePause);
$('mesc').addEventListener('click', e => { e.stopPropagation(); if (liveOn) stopLive(); else stopPlay(); });   // T87: same action as the Esc key (mic mode)
$('vol').addEventListener('input', e => { if (volNode) volNode.gain.value = +e.target.value; });
$('stopb').addEventListener('click', stopPlay);
$('xclose').addEventListener('click', () => { if (liveOn) stopLive(); else stopPlay(); });   // same as Esc
const trTxt = () => USER.trans ? ' → ' + USER.trans + ' s' : '';
const AIS = [0, 30, 60, -1], aiTxt = v => v === 0 ? 'off' : v < 0 ? 'some scenes (~2 in 5)' : v + ' s';
const markAI = () => { const pai = $('pai'); if (pai) pai.textContent = USER.auto === 0 ? 'off' : USER.auto < 0 ? 'scenes' : USER.auto + ' s'; };
function setAuto(v, quiet) { USER.auto = v; AI.acc = 0; markAI(); autosave(); if (!quiet) toast('Auto image: ' + aiTxt(v) + (IM.length < 2 ? '  (add a second image first)' : ''), 1800); }
const TRS = [0, 1, 3, 5, 10];
const markTR = () => { $('u-trans').value = USER.trans; };
const holdTxt = h => h <= 0 ? 'rand' : h >= 31 ? '∞' : h + ' s';
const markHold = () => { $('u-hold').value = USER.hold; $('uhv').textContent = holdTxt(USER.hold); };
const markCalm = () => { const v = USER.calm; if ($('u-calm')) { $('u-calm').value = v; $('ucv').textContent = v + '%'; } $('m-calm').value = v; $('mcv').textContent = v + '%'; };
const setCalm = (v, quiet) => { USER.calm = clamp(Math.round(v), 0, 100); markCalm(); autosave(); };
function setTrans(v, quiet) { USER.trans = v; markTR(); autosave(); if (!quiet) toast('Transition: ' + (v ? v + ' s' : 'instant'), 1400); }
const AUTO_OK = new Set(['KeyZ', 'KeyX', 'KeyV', 'BracketLeft', 'BracketRight', 'Semicolon', 'Space', 'Escape', 'KeyF', 'KeyH', 'KeyB', 'KeyM', 'ShiftLeft', 'ShiftRight']);
let hintAt = -1e9;
const hintAuto = () => { if (performance.now() - hintAt > 5000) { hintAt = performance.now(); toast('Auto: the engine decides · M = assisted to play the effects', 2200); } };
function setEnergy(n, quiet) {   // Energy 0..4 (keys Z X, pupitre, home screen); look only, the music does not change
  n = clamp(Math.round(n), 0, 4); if (n === USER.energy && !quiet) { toast('Energy ' + EN.names[n] + ' (' + n + '/4)', 1000); return; }
  if (!quiet && !SHOW && CL !== 2 && (playing || liveOn)) ETR.pend = n > USER.energy ? 1 : -1;   // T155: render() draws the Energy-change transition
  USER.energy = n; markEN(); autosave();   if (!quiet && (playing || liveOn)) toast('Energy: ' + EN.names[n] + ' (' + n + '/4)' + (CTRL && n === 4 ? '  ·  Extreme look does not apply in manual' : ''), 1400);
}
addEventListener('keydown', e => {
  if (e.code === 'Escape' && $('phelp').classList.contains('on')) { closeDemo(); return; }
  if (!playing && !liveOn) return;
  // (in fullscreen the browser uses the FIRST Esc to leave fullscreen and never shows it to the page; the next Esc stops)
  if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.altKey) { togglePult(); return; }
  if (e.code === 'Escape') { if (liveOn) stopLive(); else stopPlay(); return; }
  if (e.code === 'KeyF') { toggleFullscreen(); return; }
  if (e.code === 'KeyB' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) { snapWant = true; return; }   // Shift+B: mark this moment ("bad")
  if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey && !e.altKey) { if (!e.repeat) codeToggle(); return; }   // live-coding overlay, every level
  if (e.code === 'KeyM' && !SHOW && !e.ctrlKey && !e.metaKey && !e.altKey) { if (!e.repeat) setLevel((CL + 1) % 3); return; }   // control level: auto / assisted / manual
  if (!SHOW && !CL && !AUTO_OK.has(e.code) && !/^(Digit[1-8]|Arrow(Up|Down|Left|Right))$/.test(e.code) && !e.ctrlKey && !e.metaKey) { hintAuto(); return; }   // auto: the engine decides everything but Energy, images, camera and the tools
  if (CL && !e.ctrlKey && !e.metaKey && !e.altKey && ctrlKey(e)) return;
  if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.code === 'KeyZ' || e.code === 'KeyX') && !e.shiftKey) { setEnergy(USER.energy + (e.code === 'KeyX' ? 1 : -1)); return; }   // Energy - / +, every level
  const isMod = e.shiftKey || e.altKey || e.ctrlKey || e.metaKey;
  // tile mode cycle on plain T
  if (e.code === 'KeyT' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
    const seq = [-1, 0, 1, 2, -1]; // off -> checker -> wave -> shatter -> off
    const cur = USER.force;
    const idx = seq.indexOf(cur); const next = seq[idx >= 0 ? idx + 1 : 0];
    setTileMode(next); autosave(); toast(next < 0 ? 'Tiles: auto' : 'Tiles: ' + ['checkerboard', 'wave', 'shatter'][next], 1500); return;
  }
  // amount keys: Shift (down) / Alt (up)
  if (!e.ctrlKey && !e.metaKey && (e.shiftKey || e.altKey) && (LVK[e.code] || e.code === 'KeyT')) {
    const field = e.code === 'KeyT' ? 'tile' : LVK[e.code], el = $(SLID[field] || 'u-lv-' + field), delta = e.shiftKey ? -0.1 : +0.1;
    const v = Math.round(clamp(lvGet(field) + delta, +el.min, +el.max) * 100) / 100;
    lvSet(field, v); el.value = v; autosave(); e.preventDefault();
    const nm = (PEFF.find(r => r[0] === e.code) || [0, 0, 'tiles'])[2]; codeKey((e.shiftKey ? 'Shift' : 'Alt') + '+' + nm + ' → ' + Math.round(v * 100) + ' %'); toast(nm + ' ' + Math.round(v * 100) + ' %' + trTxt(), 1200);
    return;
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.code === 'KeyV' || e.code === 'KeyB')) { setCalm(USER.calm + (e.code === 'KeyB' ? 10 : -10)); return; }   // Calm - / + (V less calm, B more), all levels, repeats while held
  if ((e.code === 'BracketLeft' || e.code === 'BracketRight') && IM.length > 1) { showImg((imTo + (e.code === 'BracketRight' ? 1 : IM.length - 1)) % IM.length); return; }
  // Comma / Period transition time in all levels
  if (!isMod && (e.code === 'Comma' || e.code === 'Period')) { const v = USER.trans, nx = e.code === 'Period' ? TRS.find(x => x > v) : [...TRS].reverse().find(x => x < v); setTrans(nx ?? (e.code === 'Period' ? TRS[TRS.length - 1] : 0)); return; }
  // Semicolon auto image in all levels
  if (!isMod && e.code === 'Semicolon') { setAuto(AIS[(Math.max(0, AIS.indexOf(USER.auto)) + 1) % AIS.length]); return; }
  // C palette cycle all levels
  if (!isMod && e.code === 'KeyC') { CT.palAge = 0; CT.palLife = lifeDraw(); CT.pal = (CT.pal + 1) % 7; toast(CT.pal ? 'Palette ' + CT.pal + '/6' : 'Original colours', 1200); return; }
  if (e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyC') { CT.palAge = 0; CT.palLife = lifeDraw(); CT.pal = (CT.pal + 6) % 7; toast(CT.pal ? 'Palette ' + CT.pal + '/6' : 'Original colours', 1200); return; }
  // Presets on digit row
  if (/^Digit[1-8]$/.test(e.code) && !e.altKey && !e.ctrlKey && !e.metaKey) {
    const n = +e.code.slice(5);
    if (e.shiftKey) { lsSet('slot' + n, snapTweaks()); toast('Preset ' + n + ' saved', 1500); }
    else { const o = lsGet('slot' + n); if (o) { applyTweaks(o); autosave(); toast('Preset ' + n + ' loaded', 1500); } else toast('Preset ' + n + ' is empty', 2000); }
    return;
  }
  // arrows held rotate/zoom (all levels, also Live: this sits before the liveOn return)
  if (!isMod && /^Arrow(Up|Down|Left|Right)$/.test(e.code)) { CT.held.add(e.code); e.preventDefault(); return; }
  if (liveOn) return;
  // +.5 on lastT: right after a seek (paused) it can sit a hair before the effect start, and N would land on the same effect
  if (SHOW && (e.code === 'KeyN' || e.code === 'KeyP')) { fxSelect((TUNE.loop ? TUNE.i : fxIndex(lastT + .5)) + (e.code === 'KeyN' ? 1 : -1)); return; }
  // Space pause/resume all levels
  if (!isMod && e.code === 'Space') { e.preventDefault(); togglePause(); return; }
  // shift+arrows seek
  if (e.shiftKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !liveOn) { seekTo(lastT + (e.code === 'ArrowRight' ? 10 : -10)); return; }
});
// ---- pupitre (B4): one cell per effect / mood = key + name + gauge (green = what the engine sends, orange marker = your slider in assisted / manual) ----
const PEFF = EFFECTS.filter(e => !e.mood).map(e => [e.code, e.cap, e.name, e.field, e.ref, e.lv, e.amt]);   // derived from EFFECTS: [code, cap, name, P field, gauge full scale, slider key, has Shift/Alt amount]
const PMOOD = EFFECTS.filter(e => e.mood).map(e => [e.code, e.cap, e.name, e.field]);
const PSNAP = Object.fromEntries(EFFECTS.filter(e => e.lv).map(e => [e.lv, e.snap])), PMAX = Object.fromEntries(EFFECTS.filter(e => e.max).map(e => [e.lv, e.max]));
const lvGet = k => k === 'kal' || k === 'fb' || k === 'tile' ? USER[k] : USER.lv[k], lvSet = (k, v) => { if (k === 'kal' || k === 'fb' || k === 'tile') USER[k] = v; else USER.lv[k] = v; };
const fireKey = (code, type = 'keydown', shift = false) => dispatchEvent(new KeyboardEvent(type, { code, key: code, shiftKey: shift, bubbles: true, cancelable: true }));
const PCELLS = [];
(function buildPult() {
  const mk = (code, cap, name, field, ref, lv, amt, isMood) => {
    const el = document.createElement('div'); el.className = 'pcell'; el.title = name + (lv ? ' · key ' + cap + (amt ? ' (Shift less / Alt more)' : '') : ' · key ' + cap) + '. yellow name = this effect is ON (assisted/manual: you switched it on; auto: the engine is using it strongly)';
    const mx = PMAX[lv] ?? 1.5, id = lv === 'kal' || lv === 'tile' || lv === 'fb' ? 'u-' + lv : 'u-lv-' + lv, g = isMood ? 'gM' : 'gE';
    el.innerHTML = `<kbd class="pk ${g}">${cap}</kbd><span class="n">${name}</span><span class="pg${isMood ? ' m' : ''}"><i></i>${lv ? `<input type="range" id="${id}" min="0" max="${mx}" step=".05" value="1" aria-label="${name} amount">` : ''}</span>`;
    const c = { el, f: field, ref, lv, code, e: CT_KEYS.find(x => x.code === code), i: el.querySelector('i'), inp: el.querySelector('input') }; PCELLS.push(c);
    if (c.e && c.e.mode === 'h') { el.addEventListener('pointerdown', e => { if (!e.target.closest('.pg')) { fireKey(code); const up = () => { fireKey(code, 'keyup'); removeEventListener('pointerup', up); }; addEventListener('pointerup', up); } }); }
    else el.addEventListener('click', e => { if (!e.target.closest('.pg')) fireKey(code); });
    if (c.inp) { c.inp.addEventListener('input', e => { lvSet(lv, +e.target.value); snapUser(PSNAP[lv]); autosave(); }); c.inp.addEventListener('change', e => e.target.blur()); }
    return el;
  };
  PEFF.forEach(a => $('pfx').appendChild(mk(a[0], a[1], a[2], a[3], a[4], a[5], a[6])));
  PMOOD.forEach(a => $('pmd').appendChild(mk(a[0], a[1], a[2], a[3], 1, null, 0, true)));
})();
document.querySelectorAll('#pult .pk[data-code],#mpult .pk[data-code]').forEach(k => { k.addEventListener('click', e => { e.stopPropagation(); fireKey(k.dataset.code, 'keydown', !!k.dataset.shift); }); });
document.querySelectorAll('#plk .pcell').forEach(r => r.addEventListener('click', e => { if (!e.target.closest('.pk')) fireKey(r.dataset.code); }));
const pultRO = new ResizeObserver(() => { const h = Math.max($('pult').getBoundingClientRect().height, $('mpult').getBoundingClientRect().height); if (h) document.documentElement.style.setProperty('--pult-h', h + 'px'); }); pultRO.observe($('pult')); pultRO.observe($('mpult'));   // (T78: whichever of the two pupitres is shown)   // T34: toasts / thumbs / code / tune follow the real height (0 = hidden: keep the last value)
function pultTick() {   // ~10 Hz: gauges read lastP (never touch the render); markers follow the sliders
  const on = playing || liveOn; if (!on || !lastP || !document.body.classList.contains('ui') && !document.body.classList.contains('tuning')) return;
  const b = document.body.classList; for (let l = 0; l < 3; l++) b.toggle('lv' + l, l === CL);
  for (const c of PCELLS) {
    const raw = c.f === 'surge' ? lastP.surge : lastP[c.f], v = clamp((raw || 0) / c.ref);
    c.i.style.width = v * 100 + '%'; c.el.classList.toggle('on', CL && c.e ? !!(c.e.on || c.e.r > .05) : v > .6);
    if (c.inp) { c.inp.disabled = !CL; if (document.activeElement !== c.inp) c.inp.value = lvGet(c.lv); }
  }
  $('plkP').textContent = CL ? (CT.pal ? CT.pal + '/6' : 'original') : 'engine'; $('plkP').parentNode.classList.toggle('on', !!CL && !!CT.pal);
  $('plkT').textContent = CL ? ['auto', 'checker', 'wave', 'shatter'][USER.force + 1] : 'engine'; $('plkT').parentNode.classList.toggle('on', !!CL && USER.force >= 0);
  $('plkL').textContent = ['off', 'log', 'overlay', 'crazy'][CODE.mode]; $('plkL').parentNode.classList.toggle('on', !!CODE.mode);
  const own = CL || SHOW, tr = $('u-trans'); tr.disabled = !own; if (document.activeElement !== tr) tr.value = own ? USER.trans : (TRN || 0);
  $('ptrv').textContent = own ? (USER.trans ? USER.trans + ' s' : 'instant') : (TRN ? TRN + ' s' : 'cut');
  const hd = $('u-hold'); hd.disabled = CL !== 1; if (document.activeElement !== hd) hd.value = USER.hold; $('uhv').textContent = holdTxt(USER.hold);
}
document.body.classList.add('lv' + CL); setInterval(pultTick, 100);
[['u-kal', 'kal'], ['u-tile', 'tile'], ['u-fb', 'fb']].forEach(([id, k]) => {
  $(id).addEventListener('input', e => { USER[k] = +e.target.value; snapUser(k); });   // (a dragged slider snaps, only keys ease)
  $(id).addEventListener('change', e => e.target.blur());   // keep the keyboard free for pause / seek / fullscreen
});
const styleDefault = () => { try { return !LIVE && !LOC && !SHOW && !CTRL ? 3 : 0; } catch (e) { return 3; } };   // the engine's choice: auto (Kali / Julia per scene) for generated pieces, off for live / local
const styleNow = () => USER.style ?? styleDefault();   // try: called once at load before LIVE/LOC exist (TDZ)
$('u-trans').addEventListener('input', e => setTrans(+e.target.value, true));   // slider = USER.trans (assisted / manual; disabled in auto)
$('u-trans').addEventListener('change', e => e.target.blur());   // keep the keyboard free
$('u-hold').addEventListener('input', e => { USER.hold = +e.target.value; markHold(); autosave(); });
$('u-hold').addEventListener('change', e => e.target.blur());
if ($('u-calm')) { $('u-calm').addEventListener('input', e => { setCalm(+e.target.value); }); $('u-calm').addEventListener('change', e => e.target.blur()); }
$('m-calm').addEventListener('input', e => { setCalm(+e.target.value); }); $('m-calm').addEventListener('change', e => e.target.blur());

{ const sp = Q.get('style'); if (sp) USER.style = { kali: 1, julia: 2, auto: 3 }[sp] ?? 0; }   // ?style= (tests): applies in assisted / manual; auto = the engine's choice
const markQ = () => { document.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === quality)); };
function setQuality(q, save = true) { if (!QUAL[q]) return; quality = q; if (save) lsSet('quality', q); if (gl && progS) { makeTargets(); resize(); } markQ(); }
$('helpbtn').addEventListener('click', e => { e.stopPropagation(); openDemo(); });
$('phelp').addEventListener('click', e => { if (!e.target.closest('.pult')) closeDemo(); });   // click outside the demo (or ✕) closes it
$('qual').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b) setQuality(b.dataset.q); });
$('tgfxbtn').addEventListener('click', () => { const open = $('tgfx').hidden; $('tgfx').hidden = !open; $('tgfxbtn').setAttribute('aria-expanded', String(open)); });
$('tgfx').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b) setQuality(b.dataset.q); });
const setTileMode = m => { USER.force = m; };
const COLS = ['auto', 'frozen', 'b&w'], KEYS_U = ['auto', 'trans', 'hold', 'calm', 'energy', 'kal', 'tile', 'fb', 'col', 'src', 'force', 'style', 'grid'], SLID = { kal: 'u-kal', tile: 'u-tile', fb: 'u-fb' };
const lsGet = k => { try { return JSON.parse(localStorage.getItem('bicycleday.' + k)); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem('bicycleday.' + k, JSON.stringify(v)); } catch (e) {} };
function setPexp(on, save = true) {   // T37: ▾ / ▴ unfolds the explanation panel #pxt above the pupitre (outside the flow: the height does not change)
  document.body.classList.toggle('pexpo', on); $('pexp').textContent = on ? '▴' : '▾'; $('pexp').setAttribute('aria-expanded', String(on)); if (save) lsSet('pexp', on);
}
$('pexp').addEventListener('click', e => { e.stopPropagation(); setPexp(!document.body.classList.contains('pexpo')); });
setPexp(lsGet('pexp') === true, false);   // T124: closed by default; only a panel the user opened (saved true) starts open
{ let m = Q.has('code') ? +Q.get('code') : +lsGet('code');   // (an old saved 'true' = overlay)
  if (!Q.has('code') && lsGet('codev') !== 2) { m = m === 1 ? 2 : m === 2 ? 3 : m; lsSet('codev', 2); lsSet('code', m); }   // T38: saved 1 (overlay) -> 2, 2 (crazy) -> 3; once only
  CODE.mode = CODE.user = m >= 1 && m <= 3 ? Math.round(m) : 0; codeLook(); }   // (an old saved 'true' = overlay)
{ const v = lsGet('micdb'); if (typeof v === 'number') MICDB = clamp(v, -12, 24); $('u-mg').value = MICDB; $('mgv').textContent = (MICDB > 0 ? '+' : '') + MICDB + ' dB'; }
{ const v = lsGet('micauto'); if (typeof v === 'boolean') MICAUTO = v; }
const setMicAuto = on => { MICAUTO = on; lsSet('micauto', on); $('mauto').classList.toggle('on', on); $('mauto').setAttribute('aria-pressed', on); };
setMicAuto(MICAUTO);
$('mauto').addEventListener('click', e => { e.preventDefault(); setMicAuto(!MICAUTO); });
$('mauto').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setMicAuto(!MICAUTO); } });
$('u-mg').addEventListener('input', e => {
  setMicAuto(false); MICDB = +e.target.value; $('mgv').textContent = (MICDB > 0 ? '+' : '') + MICDB + ' dB'; lsSet('micdb', MICDB);
  if (micGain) micGain.gain.setTargetAtTime(Math.pow(10, MICDB / 20), ac.currentTime, .05);
});
$('u-mg').addEventListener('change', e => e.target.blur());
const markGrid = () => document.querySelectorAll('#tgrid [data-grid]').forEach(b => b.classList.toggle('on', +b.dataset.grid === USER.grid));
function setGrid(g, save = true) { g = clamp(Math.round(+g) || 0, 0, 2); USER.grid = g; if (save) { lsSet('grid', g); autosave(); } markGrid(); }   // T51: only the next change moves (pure function of t, no state to reset)
$('tgrid').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-grid]'); if (b) setGrid(b.dataset.grid); });
function applyTweaks(o) {   // push saved values into USER and into the panel widgets
  if (o.v !== 2) o = { ...o, energy: clamp(Math.round(2 + 2 * (o.inten ?? 0) + 2 * ((o.fx ?? 1) - 1)), 0, 4) };   // old preset (Effects + Intensity) -> Energy; its kal / tile / fb keep their value
  KEYS_U.forEach(k => { if (typeof o[k] === 'number') USER[k] = o[k]; });
  if (o.lv && typeof o.lv === 'object') for (const k in USER.lv) if (typeof o.lv[k] === 'number') USER.lv[k] = o.lv[k];
  markEN();
  for (const k in SLID) $(SLID[k]).value = USER[k];
  markTR(); markHold(); markCalm(); markAI(); if (typeof o.grid === 'number') setGrid(o.grid, true); else markGrid();
}
const snapTweaks = () => ({ v: 2, ...Object.fromEntries(KEYS_U.map(k => [k, USER[k]])), lv: { ...USER.lv } });
// B = bookmark this moment: state + final render params + tiny thumbnail → localStorage ('bicycleday.snaps'), clipboard and a downloaded bicycle-<ID>.json
function takeSnapshot(t) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, 320, 180);
  const d = x.getImageData(0, 0, 320, 180).data; let sum = 0, sat = 0; for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); sum += (d[i] + d[i + 1] + d[i + 2]) / 3; sat += mx - mn; }
  const n = d.length / 4, id = 'bd-' + seedUsed + '-' + Math.round(t) + 's', rd = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v));
  const mode = LOC ? 'local' : liveOn ? 'live' : CTRL ? 'controlled' : SHOW ? 'showcase' : 'generative';
  const snap = { id, when: new Date().toISOString(), mode, t: +t.toFixed(2), total: TOTAL, frac: +(t / TOTAL).toFixed(3), seed: seedUsed, arc: arcName, music: MUSIC, min: MIN, quality, image: imTo, images: IM.length, aspect: ASPECT,
    meanLuma: +(sum / n / 255).toFixed(3), meanSat: +(sat / n / 255).toFixed(3), user: snapTweaks(), params: rd(lastP), live: LIVE && mode !== 'generative' ? rd({ u: LIVE.u, scenes: LIVE.scenes }) : undefined,
    url: location.origin === 'null' || location.protocol === 'file:' ? location.pathname + '?t=' + Math.round(t) + '&seed=' + seedUsed + '&arc=' + arcName + '&min=' + MIN + '&music=' + MUSIC + '&quality=high' : undefined, thumb: c.toDataURL('image/jpeg', .6) };
  const all = lsGet('snaps') || []; all.push(snap); lsSet('snaps', all.slice(-30));
  const json = JSON.stringify(snap, null, 1);
  try { navigator.clipboard.writeText(json).catch(() => {}); } catch (e) {}
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = 'bicycle-' + id + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  cv.toBlob(b => { if (!b) return; const a2 = document.createElement('a'); a2.href = URL.createObjectURL(b); a2.download = 'bicycle-' + id + '.png'; setTimeout(() => { a2.click(); setTimeout(() => URL.revokeObjectURL(a2.href), 1000); }, 400); }, 'image/png');   // (the click is delayed: browsers drop two downloads in the same instant)   // full-resolution frame next to the JSON (toBlob copies the drawing buffer at call time, i.e. right after render())
  toast('Saved ' + id + ' (.json + .png) · luma ' + snap.meanLuma, 4000);
}
let saveT = 0; const autosave = () => { clearTimeout(saveT); saveT = setTimeout(() => lsSet('last', snapTweaks()), 300); };   // the panel remembers where you left it
$('tune').addEventListener('input', autosave); $('tune').addEventListener('click', autosave);
const TWEAK0 = snapTweaks();   // the defaults, captured before the saved values load (Reset settings)
{ const o = lsGet('last'); if (o) applyTweaks(o); USER.calm = 100; }   // calm always starts at 100%: a calm saved on the last visit does not carry over (?calm= below, presets and share links still set it)
if (Q.has('energy')) { USER.energy = clamp(Math.round(+Q.get('energy') || 0), 0, 4); } else if (Q.has('fx')) USER.energy = clamp(Math.round(2 + 2 * ((+Q.get('fx')) - 1)), 0, 4); else if (Q.get('hc') === '1') USER.energy = 4;   // ?energy=0..4 (tests); the old ?fx= and ?hc=1 map onto it
{ const g = lsGet('grid'); if (typeof g === 'number') USER.grid = clamp(Math.round(g), 0, 2); if (Q.has('grid')) USER.grid = Math.max(0, GRID_NAMES.indexOf(Q.get('grid'))); setGrid(USER.grid, false); }   // T51: ?grid=beat|bar|phrase
// T130: UI theme (modern default / classic / geek): body class only, never touches picture, music or presets
const THEMES = ['modern', 'classic', 'geek'];
function setTheme(n, save = true) { if (!THEMES.includes(n)) n = 'modern'; THEMES.forEach(t => document.body.classList.toggle('th-' + t, t === n && n !== 'modern')); document.querySelectorAll('#tthemes [data-theme]').forEach(b => b.classList.toggle('on', b.dataset.theme === n)); if (save) lsSet('theme', n); }
$('tthemes').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-theme]'); if (b) setTheme(b.dataset.theme); });
setTheme(Q.has('theme') ? Q.get('theme') : lsGet('theme'), false);
markEN();
if (Q.has('trans')) USER.trans = Math.max(0, +Q.get('trans') || 0); markTR();
if (Q.has('calm')) USER.calm = clamp(Math.round(+Q.get('calm') || 0), 0, 100); markCalm();
if (Q.has('autoimg')) USER.auto = +Q.get('autoimg') || 0; markAI();   // ?autoimg=<s> (tests; -1 = some scenes, ~2 in 5)   // ?trans=<s> (tests)
markAI();   // pupitre `;` auto-image mode label
// share link restore (?u=<base64url JSON>): apply the compact tweaks it carries (all tweaks except quality, plus level/images when present)
{ const UQ = Q.get('u'); if (UQ) {
  try {
    const o = JSON.parse(b64urlDecode(UQ));
    if (o && typeof o === 'object') {
      applyTweaks(o);
      if (typeof o.level === 'number') window.__sharedLevel = o.level;
      if (Array.isArray(o.images)) window.__sharedImgs = o.images;
      if (typeof o.imTo === 'number') window.__sharedImTo = o.imTo;
      if (o.seed != null) try { Q.set('seed', String(o.seed)); } catch (e) {}
      if (o.music && MUSICS.includes(o.music)) MUSIC = o.music;
      if (o.arc && ARCS[o.arc]) { arcName = o.arc; applyArc(); }
      if (o.min) { MIN = parseFloat(o.min) || MIN; TOTAL = MIN * 60; }
      if (o.hue != null) try { Q.set('hue', String(o.hue)); } catch (e) {}
    }
  } catch (e) { console.warn('share u decode failed', e); }
} }
// image link: https only, decoded like a dropped file (cap 3 Mpx); the Images drawer and the thumb row update through renderImgs()
function addImageUrl(raw) {
  const msg = t => { $('imgurlmsg').textContent = $('timgurlmsg').textContent = t; };
  let u; try { u = new URL(raw.trim()); } catch (e) { return msg('Paste a full link starting with https://'); }
  if (u.protocol !== 'https:') return msg('Only https:// links are allowed');
  if (IM.length >= 5) return msg('5 images max: remove one first');
  msg('Loading…');
  loadImg(u.href, e => {
    if (IM.length >= 5) { gl.deleteTexture(e.tex); return msg('5 images max: remove one first'); }
    e.remote = u.href; IM.push(e); renderImgs(); showImg(IM.length - 1, true);
    $('imgurl').value = $('timgurl').value = ''; msg('');
  }, () => msg('Could not load it. The site may block other pages from using its images, or it is larger than 3 megapixels.'), 3e6);
}
$('imgurlgo').addEventListener('click', () => addImageUrl($('imgurl').value));
$('timgurlgo').addEventListener('click', () => addImageUrl($('timgurl').value));
$('timgurl').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); addImageUrl(e.target.value); } });
$('webcamgo').addEventListener('click', () => addWebcam());
$('twebcam').addEventListener('click', () => addWebcam());
// Copy a shareable link (?img=<the shown remote image>) so it can be pasted in a chat; hidden again by markCopy() when a non-remote image is shown
$('imgcopy').addEventListener('click', () => {
  const e = IM[imTo]; if (!e || !e.remote) return;
  const link = location.origin === 'null' || location.protocol === 'file:' ? location.href.split(/[?#]/)[0] + '?img=' + encodeURIComponent(e.remote) : location.origin + location.pathname + '?img=' + encodeURIComponent(e.remote);
  const ok = () => toast('Link copied', 2000), bad = () => toast('Could not copy: ' + link, 6000);
  try { navigator.clipboard.writeText(link).then(ok, bad); } catch (err) { bad(); }
});
function shareBase() { return location.origin === 'null' || location.protocol === 'file:' ? location.href.split(/[?#]/)[0] : location.origin + location.pathname; }
function shareEncode() {   // returns a URL string, or null if a local (non-shareable) image is present
  const imgEntries = [];
  for (const e of IM) {
    if (e && e.cam) continue;   // webcam is not in the link (the receiver has no camera); the other images are shared
    if (e && e.remote) imgEntries.push(e.remote);
    else {
      const gi = (GALLERY || []).findIndex(g => g && e && e.gid === g.id);
      if (gi >= 0) imgEntries.push({ g: gi });
      else { toast('Cannot share: a local image cannot be shared', 3000); return null; }
    }
  }
  if (!imgEntries.length) imgEntries.push(null);
  const uObj = { ...snapTweaks(), images: imgEntries, imTo, level: CL };
  const params = new URLSearchParams();
  params.set('seed', String(seedUsed));
  params.set('music', MUSIC);
  params.set('arc', arcName);
  params.set('min', String(MIN));
  params.set('hue', String(hueBase));
  params.set('t', (isFinite(lastT) ? lastT : 0).toFixed(1));
  params.set('u', b64urlEncode(JSON.stringify(uObj)));  const cur = IM[imTo];
  if (cur && cur.remote) params.set('img', cur.remote);
  return shareBase() + '?' + params.toString();
}
function shareNow() {
  const url = shareEncode(); if (!url) return;
  const copy = () => { try { navigator.clipboard.writeText(url).then(() => toast('Link copied', 2000), () => toast('Could not copy: ' + url, 6000)); } catch (e) { toast('Could not copy: ' + url, 6000); } };
  if (typeof navigator.share === 'function') {
    navigator.share({ title: 'Bicycle Day', url }).then(() => toast('Shared', 1500)).catch(err => { if (err && err.name !== 'AbortError') copy(); });
  } else copy();
}
$('sharehome').addEventListener('click', shareNow);
$('shareplay').addEventListener('click', shareNow);
$('imgurl').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); addImageUrl(e.target.value); } });   // stopPropagation: typing here must not fire the global shortcuts
// Reset buttons (Settings and home card): settings = back to the defaults in TWEAK0; memory = wipe every bicycleday.* key and reload
document.querySelectorAll('[data-reset="settings"]').forEach(b => b.addEventListener('click', () => {
  applyTweaks(TWEAK0); KEYS_U.forEach(snapUser); lsSet('last', TWEAK0); toast('Settings reset', 2000);
}));
document.querySelectorAll('[data-reset="memory"]').forEach(b => b.addEventListener('click', () => {
  if (!confirm('Forget everything saved in this browser (tweaks, presets, quality, music, bookmarks) and reload?')) return;
  try { const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('bicycleday.')) keys.push(k); } keys.forEach(k => localStorage.removeItem(k)); } catch (e) {}
  location.reload();
}));
// mouse / touch on the picture: move = centre of the kaleidoscope, click = ripple, drag = rotate, wheel = zoom
const wrapEl = $('wrap'); let ptr = null;
const toP = e => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width - .5) * 16 / 9, y: -((e.clientY - r.top) / r.height - .5) }; };
wrapEl.addEventListener('pointerdown', e => { if (playing || liveOn) ptr = { x: e.clientX, y: e.clientY, drag: false }; });
wrapEl.addEventListener('pointermove', e => {
  if (!(playing || liveOn)) return;
  if (ptr) {
    if (!ptr.drag && Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y) > 6) ptr.drag = true;
    if (ptr.drag) { USER.rot += (e.clientX - ptr.x) / cv.clientWidth * 4; ptr.x = e.clientX; ptr.y = e.clientY; }
  } else if (e.pointerType === 'mouse') { const p = toP(e); USER.tx = p.x; USER.ty = p.y; }
});
addEventListener('pointerup', e => { if (ptr && !ptr.drag) { const p = toP(e); USER.rip = { x: p.x, y: p.y, t0: performance.now() }; } ptr = null; });
wrapEl.addEventListener('wheel', e => { if (!(playing || liveOn)) return; e.preventDefault(); USER.zoom = clamp(USER.zoom * Math.exp(-e.deltaY * .0012), .25, 2.0); }, { passive: false });
function drawProfile() {   // the arc's intensity curve, drawn behind the seek bar
  let pl; const c = $('prof'), x = c.getContext('2d'), w = c.width, h = c.height; x.clearRect(0, 0, w, h);
  x.fillStyle = 'rgba(244,241,234,.28)'; x.beginPath(); x.moveTo(0, h);
  for (let i = 0; i <= 200; i++) x.lineTo(i / 200 * w, h - 4 - (LOC ? energy(LOC.u[Math.min(LOC.nf - 1, Math.floor(i / 200 * LOC.nf))]) : (pl = !SHOW && vplan().length ? (CHLV ? lvlAt(i / 200 * TOTAL) : planE(i / 200 * TOTAL)) : null) != null ? pl : energy(i / 200)) * (h - 8));
  x.lineTo(w, h); x.fill();
  if (SHOW) { x.font = '14px sans-serif'; x.lineWidth = 2;   // showcase: one tick + number per effect, coloured like the pupitre classes
    const clsColor = c => c === 'gE' ? '#5cf08a' : c === 'gM' ? '#ff6fae' : c === 'gX' ? '#ffc94d' : c === 'gI' ? '#4fe0ff' : c === 'gT' ? '#7db4ff' : c === 'gN' ? '#7fb09a' : '#c9c9d6';
    FX.forEach((f, i) => { const X = i / FX.length * w, col = clsColor(f.cls); x.strokeStyle = col; x.fillStyle = col; x.beginPath(); x.moveTo(X, 0); x.lineTo(X, h); x.stroke(); x.fillText(i + 1, X + 3, 14); }); }
  const m = $('mprof').getContext('2d'); m.clearRect(0, 0, m.canvas.width, m.canvas.height); m.drawImage(c, 0, 0);   // T78: the minimal pupitre shows the same curve (cleared first: each call stacked a copy)
}
const updateHint = () => { if (ready) hint.textContent = ''; };
const chips = [...document.querySelectorAll('#opts button')];
const ARC_HINT = { journey: 'calm build → big finish', slam: 'slow build → hard cut to stillness', intense: 'short calm → long relentless plateau', extreme: 'relentless from the first second' };
const markArcHint = () => { $('arc-hint').textContent = ARC_HINT[arcName] || ''; };
const markArcOn = () => chips.forEach(b => b.classList.toggle('on', b.dataset.arc === arcName)); markArcOn(); markArcHint();
document.getElementById('opts').addEventListener('click', e => {
  e.stopPropagation(); const b = e.target.closest('button'); if (!b) return;
  arcName = b.dataset.arc; applyArc(); drawProfile(); markArcOn(); markArcHint();
});
$('opts').addEventListener('pointerover', e => { const b = e.target.closest('button'); if (b) $('arc-hint').textContent = ARC_HINT[b.dataset.arc]; });   // hover/focus previews that Shape's hint
$('opts').addEventListener('focusin', e => { const b = e.target.closest('button'); if (b) $('arc-hint').textContent = ARC_HINT[b.dataset.arc]; });
$('opts').addEventListener('pointerleave', markArcHint); $('opts').addEventListener('focusout', markArcHint);
const musBtns = [...document.querySelectorAll('#mus button')], markMus = () => { musBtns.forEach(b => b.classList.toggle('on', b.dataset.music === MUSIC)); $('opts').style.opacity = ARC.piano ? .35 : 1; };
markMus();
$('mus').addEventListener('click', e => {
  e.stopPropagation(); const b = e.target.closest('button'); if (!b || SHOW) return;
  MUSIC = b.dataset.music; lsSet('music', MUSIC); applyArc(); drawProfile(); markMus();
});
const durBtns = [...document.querySelectorAll('#dur button')], markDur = () => { durBtns.forEach(b => b.classList.toggle('on', +b.dataset.min === MIN)); $('len-sum').textContent = `Length: ${MIN} min, more options`; };
markDur();
$('dur').addEventListener('click', e => {
  e.stopPropagation(); const b = e.target.closest('button'); if (!b) return;
  if (SHOW) return; MIN = +b.dataset.min; TOTAL = MIN * 60; applyArc(); markDur(); updateHint();
});
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); addImages(e.dataTransfer.files); });
addEventListener('pagehide', stopCams); addEventListener('beforeunload', stopCams);
