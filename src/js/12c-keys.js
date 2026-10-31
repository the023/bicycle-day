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
