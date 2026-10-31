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
