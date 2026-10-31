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
  MUSIC = pick(MUSICS); arcName = pick(['journey', 'slam', 'intense']); MIN = pick([2, 5, 10]); TOTAL = MIN * 60;
  applyArc(); drawProfile(); markMus(); markDur(); markArcOn(); markArcHint(); markEN(); start();
});
$('galtoggle').addEventListener('click', e => { e.stopPropagation(); const g = $('ggal'); g.hidden = !g.hidden; e.currentTarget.setAttribute('aria-expanded', String(!g.hidden)); e.currentTarget.textContent = g.hidden ? 'Gallery ▾' : 'Gallery ▴'; });
document.querySelectorAll('#gate label[role=button]').forEach(l => l.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); l.querySelector('input').click(); } }));
$('lvl').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b) setLevel(+b.dataset.cl, true, true); });
$('plvl').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLevel(+b.dataset.cl, true, true); });
$('mplvl').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLevel(+b.dataset.cl, true, true); });
document.body.classList.toggle('phone', PHONE);
const TOUCHDEV = MOBILE || PHONE || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
document.body.classList.toggle('touchdev', !!TOUCHDEV);
function applyTouchEnergyLabels() {
  if (!document.body.classList.contains('touchdev')) return;
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
