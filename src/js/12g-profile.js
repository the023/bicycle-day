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
