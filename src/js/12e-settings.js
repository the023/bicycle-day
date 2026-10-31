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
$('phelp').addEventListener('click', e => { if (!e.target.closest('.pult,.phtools')) closeDemo(); });   // click outside the demo (or ✕) closes it
$('qual').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b) setQuality(b.dataset.q); });
$('tgfxbtn').addEventListener('click', () => { const open = $('tgfx').hidden; $('tgfx').hidden = !open; $('tgfxbtn').setAttribute('aria-expanded', String(open)); });
$('tgfx').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('button'); if (b) setQuality(b.dataset.q); });
const setTileMode = m => { USER.force = m; };
const KEYS_U = ['auto', 'trans', 'hold', 'calm', 'energy', 'kal', 'tile', 'fb', 'force', 'style', 'grid'], SLID = { kal: 'u-kal', tile: 'u-tile', fb: 'u-fb' };
const recqSync = () => document.querySelectorAll('#recpick button[data-q]').forEach(b => b.classList.toggle('on', b.dataset.q === recqGet()));
document.querySelectorAll('#recpick button[data-q]').forEach(b => b.addEventListener('click', () => { lsSet('recq', b.dataset.q); recqSync(); }));   // picking a quality does not start a clip
recqSync();
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
const markMorph = () => document.querySelectorAll('#tmorph [data-morph]').forEach(b => b.classList.toggle('on', +b.dataset.morph === USER.morph));
function setMorph(v, save = true) { USER.morph = v ? 1 : 0; if (save) lsSet('morph', USER.morph); markMorph(); }   // T167: image change = masked morph (1) / plain crossfade (0); only the next change reads it
$('tmorph').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-morph]'); if (b) setMorph(+b.dataset.morph); });
{ const v = lsGet('morph'); if (v === 0 || v === 1) USER.morph = v; if (Q.has('morph')) USER.morph = Q.get('morph') === '0' ? 0 : 1; setMorph(USER.morph, false); }   // ?morph=0|1
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
