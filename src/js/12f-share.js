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
  if (imFull()) return msg(IM_FULL_MSG);
  msg('Loading…');
  loadImg(u.href, e => {
    if (imFull()) { gl.deleteTexture(e.tex); return msg(IM_FULL_MSG); }
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
