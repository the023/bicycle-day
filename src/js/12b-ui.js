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
const hEsc = x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const HELP_TOOLS = `<div class="phtools"><div class="ptcol"><h4>Tools</h4>
<a href="bicycle-day.html?showcase=1&tune=1" target="_blank" rel="noopener"><b>Effects showcase + tuning</b><span>every effect alone, engine sliders, export JSON</span></a>
<a href="bicycle-day-doc.html" target="_blank" rel="noopener"><b>Engine doc</b><span>signal flow, effect cards, invariants</span></a>
<a href="../tools/sound-lab.html" target="_blank" rel="noopener"><b>Sound lab</b><span>tune the synth voices by ear, export constants</span></a>
<a href="../tools/morph-lab.html" target="_blank" rel="noopener"><b>Morph lab</b><span>image-change morph styles</span></a>
<p>The labs only work from the repo folder (not from a lone copy of the .html). The morph lab needs http for its default images: <code>python3 -m http.server</code> from the repo root.</p></div>
<div class="ptcol"><h4>URL parameters (testing / debug)</h4><div class="ptp">
${TQ_HELP.map(([n, q, w]) => `<a href="bicycle-day.html?${q}" target="_blank" rel="noopener">${hEsc(n)}</a><span>${hEsc(w)}</span>`).join('\n')}
</div></div></div>`;
function openDemo() {   // home Help: read-only copy of the pupitre (same DOM + CSS), fixed demo gauge values, no engine
  const box = $('phelp'); box.innerHTML = '';
  const cl = $('pult').cloneNode(true);
  cl.removeAttribute('id'); cl.querySelectorAll('.pctl,.pexpb').forEach(el => el.remove());   // (the explanation panel stays: open in the demo, see #phelp .pxt) cl.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  let k = 0; cl.querySelectorAll('.pg i').forEach(i => { i.style.width = (30 + (k++ * 17) % 41) + '%'; });
  cl.querySelectorAll('input[type=range]').forEach(i => { i.disabled = true; i.value = Math.round(i.max * .4); });
  box.insertAdjacentHTML('beforeend', HELP_TOOLS);
  box.append(Object.assign(document.createElement('div'), { className: 'phtext', textContent: 'This is the control panel you get while playing (move the mouse, or H to pin it). Hover a key for its meaning.' }), cl, Object.assign(document.createElement('button'), { id: 'phx', textContent: '✕', title: 'Close (Esc)' }));
  box.classList.add('on'); document.body.classList.add('help-open'); fitHelpTools();
}
function fitHelpTools() {   // the Tools block uses the free space above the explanation panel (scrolls inside if it does not fit)
  const t = document.querySelector('#phelp .phtools'), x = document.querySelector('#phelp .pxt'); if (!t) return;
  t.style.maxHeight = Math.max(120, (x ? x.getBoundingClientRect().top : innerHeight - 200) - 12 - 16) + 'px';
}
addEventListener('resize', fitHelpTools);
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
