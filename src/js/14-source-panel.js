/* ════════════════════════ SOURCE PANEL: swap the sound while playing (a new start: arc, seed, slow-start ramp; Energy, Calm, sliders and pictures kept) ════════════════════════ */
function switchSource(kind, stream) {   // kind: 'gen' | 'file' (localData decoded) | 'tab' | 'mic' (stream from getLiveStream). No homeGate / exitFullscreen here
  if (!playing && !liveOn) { if (stream) stream.getTracks().forEach(t => t.stop()); return; }   // (stopped while the permission dialog was open)
  const wasLive = liveOn, wasPlaying = playing;
  if (wasLive) {   // old source: Live (stopLive() without its homeGate / exitFullscreen)
    liveOn = false; LIVE = null;
    if (liveStream) liveStream.getTracks().forEach(t => t.stop()); liveStream = null;
    if (ac) ac.close().catch(() => {}); ac = null; analyser = null; micGain = null; liveSrc = null; METER.db = -90;
    resetFx(); applyArc();
  } else {   // old source: Generated / Audio file (stopPlay() without its homeGate / exitFullscreen)
    playing = false; clearInterval(pumpId); if (ac) ac.close().catch(() => {}); ac = null; analyser = null;
    leaveLocal(); resetFx();
  }
  PEND = null;
  if (kind === 'tab' || kind === 'mic') {
    document.body.classList.remove('playing'); liveUp(stream, kind === 'mic');
    lsSet('setup', { src: kind === 'mic' ? 'mic' : 'tab' });
    if (!wasLive) requestAnimationFrame(liveLoop);   // (a running liveLoop picks up the new source by itself)
  } else {
    document.body.classList.remove('live', 'mic'); playing = true; document.body.classList.add('playing');
    if (kind === 'file') { LOC = localData; LIVE = newLive(); TOTAL = LOC.dur; setArc('journey'); drawProfile(); syncNext(); lsSet('setup', { src: 'local' }); }
    else { if (PGEN) { MUSIC = PGEN.music; arcName = PGEN.arc; MIN = PGEN.min; lsSet('music', MUSIC); drawProfile(); markMus(); markArcOn(); markArcHint(); markDur(); } TOTAL = MIN * 60; applyArc(); lsSet('setup', { src: 'gen', music: MUSIC, arc: arcName, min: MIN }); }
    begin(0, true);
    if (!wasPlaying) requestAnimationFrame(loop);   // (a running loop picks up the new source by itself)
  }
  syncSource();
}
const GEN_ROWS = [['tg-mus', '#mus button', 'music'], ['tg-arc', '#opts button', 'arc'], ['tg-dur', '#dur button', 'min']];
GEN_ROWS.forEach(([id, sel, k]) => { const row = $(id); document.querySelectorAll(sel).forEach(b => { const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = b.textContent; c.dataset.v = b.dataset[k === 'arc' ? 'arc' : k]; row.appendChild(c); });
  row.addEventListener('click', e => { e.stopPropagation(); const c = e.target.closest('button'); if (!c || !PGEN) return; PGEN[k] = k === 'min' ? +c.dataset.v : c.dataset.v; markGen(); }); });
const markGen = () => { if (PGEN) GEN_ROWS.forEach(([id,, k]) => $(id).querySelectorAll('button').forEach(c => c.classList.toggle('on', c.dataset.v == PGEN[k]))); };
function pickCard(src) {   // a card click: Audio file opens the picker (switch once decoded); the others wait for Apply (tab / mic need a click for the permission)
  if (SWAPPING || (src === 'tab' && $('tabmode').disabled)) return;
  if (src === 'gen') { PGEN = { music: MUSIC, arc: arcName, min: MIN }; PEND = 'gen'; syncSource(); return; }   // Generated: always offers Style / Shape / Length, even when it is already playing (= play another one)
  if (src === curSrc()) { PEND = null; syncSource(); return; }   // the card already playing does nothing (drops any pending pick)
  if (src === 'file') { PEND = null; syncSource(); $('tfpick').value = ''; $('tfpick').click(); return; }
  PEND = src; syncSource();
}
document.querySelector('#tune .tcards').addEventListener('click', e => { const c = e.target.closest('.tcard'); if (c) pickCard(c.dataset.src); });
document.querySelector('#tune .tcards').addEventListener('keydown', e => { const c = e.target.closest('.tcard'); if (c && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); pickCard(c.dataset.src); } });
$('tapplybtn').addEventListener('click', async e => {   // Apply: tab / mic take the permission click here, and the old source stops only once the stream is in hand
  e.stopPropagation(); if (!PEND || SWAPPING) return;
  const src = PEND; SWAPPING = true;
  try {
    if (src === 'tab' || src === 'mic') {
      const s = await getLiveStream(src === 'mic');
      if (!s) { toast(hint.textContent, 4000); return; }   // cancelled: the old music keeps playing
      switchSource(src, s);
    } else switchSource(src);
  } finally { SWAPPING = false; }
});
$('tfpick').addEventListener('change', async () => {   // Audio file: decode + analyse first, switch only when the timeline is ready
  const f = $('tfpick').files[0]; if (!f || SWAPPING) return;
  const card = document.querySelector('#tune .tcard[data-src="file"]'); SWAPPING = true; card.classList.add('busy');
  try { await loadLocal(f); if (localData) switchSource('file'); else toast($('localnote').textContent, 4000); }
  finally { SWAPPING = false; card.classList.remove('busy'); }
});
