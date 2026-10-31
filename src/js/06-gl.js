/* ════════════════════════ GL setup ════════════════════════ */
let progS, progD, uS = {}, uD = {}, IM = [], imFrom = 0, imTo = 0, imMix = 1, fbo = [], tex = [], FW = 1600, FH = 900, ready = false;
const IM_MAX = 5, imFull = () => IM.length >= IM_MAX, IM_FULL_MSG = 'Max ' + IM_MAX + ' images: remove one (✕) first';   // image limit: one check (imFull), one wording
let IMGFAIL = false;   // set when the requested image(s) could not load (share link / ?img=); read by the boot handler (toast)
// home-screen logo renderer state (second WebGL2 context, owned only while gate is open)
let homeGL = null, homeProgS = null, homeProgD = null, homeUS = {}, homeUD = {}, homeFbo = [], homeTex = [], homeW = 0, homeH = 0, homeCur = 0, homeCanvas = null;
let homeTexImg = null, homeAspect = 1672 / 941, homeStartedAt = 0, homeRaf = 0, homeFirstFrame = false, homeReduced = false;
let homeFixedTime = Q.has('hometime') ? (parseFloat(Q.get('hometime')) || 0) : null;
// shared GL helpers (T182): every one takes the context (the main one and the home logo's own); the home renderer keeps its own programs / uniforms and only uses these
function glProg(g, fs) {
  const mk = (t, s) => { const sh = g.createShader(t); g.shaderSource(sh, s); g.compileShader(sh); if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh)); return sh; };
  const p = g.createProgram(); g.attachShader(p, mk(g.VERTEX_SHADER, VS)); g.attachShader(p, mk(g.FRAGMENT_SHADER, fs)); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p)); return p;
}
function glLocs(g, p, names) { const u = {}; names.forEach(n => u[n] = g.getUniformLocation(p, n)); return u; }
// filters + wrap of the TEXTURE_2D bound now: wrap = g.CLAMP_TO_EDGE (render targets, code) or g.MIRRORED_REPEAT (pictures, video, webcam); mip = LINEAR_MIPMAP_LINEAR (the caller calls generateMipmap) else LINEAR
function glTexParams(g, wrap, mip) {
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, mip ? g.LINEAR_MIPMAP_LINEAR : g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, wrap); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, wrap);
}
// a new texture, bound, with the parameters set (the caller uploads the pixels)
function glTex(g, wrap, mip) { const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t); glTexParams(g, wrap, mip); return t; }
// two cleared w x h render targets (texture + framebuffer) to ping-pong between: { tex: [a, b], fbo: [a, b] }; the caller deletes the old ones first
function pingPong(g, w, h) {
  const half = !!g.getExtension('EXT_color_buffer_float'), r = { tex: [], fbo: [] };
  for (let i = 0; i < 2; i++) {
    const t = glTex(g, g.CLAMP_TO_EDGE);
    g.texImage2D(g.TEXTURE_2D, 0, half ? g.RGBA16F : g.RGBA8, w, h, 0, g.RGBA, half ? g.HALF_FLOAT : g.UNSIGNED_BYTE, null);
    const f = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, f); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0);
    g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT); r.tex.push(t); r.fbo.push(f);
  }
  g.bindFramebuffer(g.FRAMEBUFFER, null); return r;
}
function initGL() {
  progS = glProg(gl, FS_SCENE); progD = glProg(gl, FS_SHOW);
  uS = glLocs(gl, progS, ['uTex', 'uTex2', 'uImgMix', 'uMo', 'uMi', 'uMj', 'uMuA', 'uMr', 'uMuB', 'uGhostA', 'uGhostB', 'uGhostMix', 'uPrev', 'uRes', 'uT', 'uWarp', 'uKal', 'uKalN', 'uFb', 'uFbHue', 'uHue', 'uPal', 'uSide', 'uBreath', 'uMelt', 'uZoom', 'uRot', 'uAber', 'uPulse', 'uBright', 'uAspect', 'uAnchor', 'uTile', 'uTileN', 'uTileMode', 'uTileSeed', 'uTileSize', 'uMono', 'uCenter', 'uRip', 'uPalC', 'uPalD', 'uHueAmt', 'uTilt', 'uTT', 'uSrcZ', 'uSrcRot', 'uStretch', 'uTunnel', 'uWarpN', 'uFx', 'uKali', 'uJulia', 'uKaliP', 'uJuliaP', 'uKalZ', 'uCode', 'uCodeAmt']);
  uD = glLocs(gl, progD, ['uTex', 'uRes', 'uT', 'uAber', 'uPulse', 'uHi', 'uFx', 'uDark', 'uBlaze', 'uStrobe', 'uRate', 'uCells', 'uGrid', 'uGlitch', 'uGSeed', 'uNeg', 'uPh', 'uCol', 'uCacc', 'uCph']);
  CODE.tex = glTex(gl, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  makeTargets();
}
// graphics quality: internal resolution, warp layers, colour fringing / grain. Default depends on the renderer (software GL = low).
const QUAL = { high: { res: 1, dpr: 1.5, warpN: 4, fx: 1 }, medium: { res: .7, dpr: 1, warpN: 3, fx: 1 }, low: { res: .5, dpr: 1, warpN: 2, fx: 0 } };
let quality = 'high';
function softwareGL() { const e = gl.getExtension('WEBGL_debug_renderer_info'); return !!e && /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL))); }
function makeTargets() {
  tex.forEach(t => gl.deleteTexture(t)); fbo.forEach(f => gl.deleteFramebuffer(f));
  const res = parseFloat(Q.get('res')) || QUAL[quality].res; FW = Math.round(1600 * res); FH = Math.round(900 * res);
  ({ tex, fbo } = pingPong(gl, FW, FH)); cur = 0;
}
let ASPECT = 1; let cellPrev = 0, cellGrid = 4;   // strobe grid: size of the current launch (N x N, N in 3..10), drawn at each launch
const GALLERY = __GALLERY__;   // [{id, title, src}] inlined by build.mjs; a picture is decoded only when its thumb is clicked (galPick)
// T167 colour-first morph: per-channel mean / std (0..1) of a 64x64 copy, taken once when an image loads (a tainted canvas gives the neutral default)
const MSTAT0 = { mu: [.5, .5, .5], sd: [.2, .2, .2] };
function imgStats(img) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data, mu = [0, 0, 0], sd = [0, 0, 0], n = 4096;
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) mu[k] += d[i * 4 + k] / 255 / n;
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) sd[k] += (d[i * 4 + k] / 255 - mu[k]) ** 2 / n;
    return { mu, sd: sd.map(Math.sqrt) };
  } catch (e) { return MSTAT0; }
}
function loadImg(src, ok, fail, maxPx) {
  const bad = () => { if (fail) fail(); else hint.textContent = 'Could not load that image'; };
  const give = (img, url) => {
    if (maxPx && img.naturalWidth * img.naturalHeight > maxPx) return bad();
    const t = glTex(gl, gl.MIRRORED_REPEAT, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
    ok({ tex: t, aspect: img.naturalWidth / img.naturalHeight, url, st: imgStats(img) });
  };
  const img = new Image();
  img.onload = () => { try { give(img, src); } catch (e) { retry(); } };   // a tainted cross-origin image throws SecurityError in texImage2D
  let tried = false;
  function retry() {   // second chance: fetch -> blob -> object URL (same-origin to the page)
    if (tried || /^(data|blob):/.test(src)) return bad(); tried = true;
    fetch(src, { mode: 'cors', referrerPolicy: 'no-referrer', credentials: 'omit' }).then(r => { if (!r.ok) throw 0; return r.blob(); }).then(b => {
      const u = URL.createObjectURL(b), im2 = new Image();
      im2.onload = () => { try { give(im2, u); } catch (e) { URL.revokeObjectURL(u); bad(); } };
      im2.onerror = () => { URL.revokeObjectURL(u); bad(); }; im2.src = u;
    }).catch(bad);
  }
  img.onerror = retry;
  let cross = false; try { cross = !/^(data|blob):/.test(src) && new URL(src, location.href).origin !== location.origin; } catch (e) {}
  if (cross) { img.crossOrigin = 'anonymous'; img.referrerPolicy = 'no-referrer'; }   // before src; the host must answer with Access-Control-Allow-Origin
  img.src = src;
}
function loadPoster(src, done, fail) { loadImg(src, e => { if (src === GALLERY[0].src) e.gid = GALLERY[0].id; IM[0] = e; imFrom = imTo = 0; imMix = 1; ASPECT = e.aspect; done && done(); }, fail); }
// several images: #1 is the default picture (the 1943 poster), #2..#5 are the user's. T167: a change is a masked morph (USER.morph; styles in the 05-shaders.js texI block), drawn once per change from the play seed + the change counter
// MORPH.n; imMix = progress through MORPH.dur (0..1, `imMix += dt / dur` in render()), MORPH.m = B's share after the stages (morphM). Off = the plain 1.5 s crossfade of old.
const MSTY = ['crossfade', 'organic dissolve', 'iris', 'colour first'];
const MORPH = { n: 0, st: 0, seed: 0, dur: 1.5, l: 0, h: 0, a0: 1, m: 0, from: 0, to: 0, c: [[.5, .5], [.5, .5], [.5, .5]], ni: 1 };
function morphM(x) {   // stages: one smoothstep move, or (l > 0) a move to the level l, a hold of h of the duration, then on to 1
  if (!MORPH.l) return smooth(0, 1, x);
  const h = MORPH.h, a = (1 - h) / 2;
  return x < a ? MORPH.l * smooth(0, a, x) : x < a + h ? MORPH.l : MORPH.l + (1 - MORPH.l) * smooth(a + h, 1, x);
}
function morphDraw(on) {
  const n = ++MORPH.n, r = k => seedHash(n, 50 + k), E = USER.energy;
  MORPH.st = on ? Math.floor(r(0) * 4) : 0; MORPH.seed = r(2) * 40; MORPH.l = MORPH.h = 0; MORPH.dur = 1.5;
  if (!on) return;
  if (hcOn()) MORPH.st = 0;   // Extreme: the plain crossfade (duration as strong)
  if (!SHOW) MORPH.dur = E <= 1 ? 10 + 50 * r(1) : E === 2 ? 4 + 26 * r(1) : 3 + 12 * r(1);   // calm / soft 10-60 s, normal 4-30 s, strong / Extreme 3-15 s, every control level (showcase: 1.5 s, style still drawn)
  if (MORPH.dur >= 4 && r(3) < .5) { MORPH.l = .3 + .2 * r(4); MORPH.h = .2 + .15 * r(5); }   // half of the long ones: two stages
  MORPH.ni = 1 + Math.floor(r(6) * 3); for (let i = 0; i < 3; i++) MORPH.c[i] = [.2 + .6 * r(7 + 2 * i), .15 + .7 * r(8 + 2 * i)];
}
function showImg(n, quiet, auto) {
  if (n < 0 || n >= IM.length || (n === imTo && imMix >= 1)) return;
  if (!auto) AI.acc = 0;   // a manual switch restarts the auto-image timer
  const on = !!USER.morph, mid = imMix < 1, a0 = ASPECT;
  if (on && mid) {   // a switch mid-morph starts from the image with the larger share (no jump back to the old one); asking for that one again just shows it
    if (n === imTo) return;
    imFrom = MORPH.m >= .5 ? imTo : imFrom;
    if (imFrom === n) { imTo = n; imMix = 1; ASPECT = IM[n].aspect; markThumbs(); markCopy(); return; }
  } else imFrom = imTo;   // (off: a switch mid-fade restarts from the target it was heading to, as before)
  imTo = n; imMix = 0; morphDraw(on); MORPH.from = imFrom; MORPH.to = n; MORPH.m = 0; MORPH.a0 = on ? a0 : IM[imFrom].aspect;
  markThumbs(); markCopy(); if (!quiet) toast('Image ' + (n + 1) + ' / ' + IM.length, 1500);
  const nm = on ? MSTY[MORPH.st] : 'crossfade', ds = MORPH.dur < 10 ? +MORPH.dur.toFixed(1) : Math.round(MORPH.dur);
  codeAdd('image -> ' + (n + 1) + '  // ' + nm + ', ' + ds + ' s', 'a', 'morph: image ' + (imFrom + 1) + ' -> ' + (n + 1) + ' · ' + nm + ' · ' + ds + ' s', 'img');
}
function markThumbs() { document.querySelectorAll('#thumbs button,.imgs .im').forEach(b => b.classList.toggle('on', +b.dataset.k === imTo)); }
// "Copy link" is only offered for the image currently shown when it came from an https link (IM[imTo].remote); gallery / file / poster images have none
function markCopy() { const e = IM[imTo]; $('imgcopy').hidden = !(e && e.remote); }
// Load a list of remote image URLs into IM[] (share link / multi-image restore). 'poster' or null entries resolve to the default poster.
function loadSharedImages(urls, target, done) {
  const entries = new Array(urls.length);
  let loaded = 0;
  const finish = () => {
    IM.length = 0;
    entries.forEach(e => { if (e) IM.push(e); });
    if (!IM.length) { IMGFAIL = true; loadPoster(GALLERY[0].src, done); return; }
    imFrom = imTo = 0; imMix = 1;
    const t = (typeof target === 'number' && !isNaN(target)) ? Math.max(0, Math.min(IM.length - 1, Math.round(target))) : 0;
    imFrom = imTo = t; imMix = 1; ASPECT = IM[imTo].aspect;
    renderImgs(); markThumbs(); markCopy();
    try { done(); } catch (e) {}
  };
  if (!urls || !urls.length) { done(); return; }
  urls.forEach((raw, i) => {
    let spec;   // {src, remote, gid}
    if (raw && typeof raw === 'object') {
      const gi = (typeof raw.g === 'number') ? raw.g : (typeof raw.gallery === 'number' ? raw.gallery : (typeof raw.index === 'number' ? raw.index : null));
      if (gi != null && GALLERY && GALLERY.length) { const g = GALLERY[Math.max(0, Math.min(GALLERY.length - 1, gi))] || GALLERY[0]; spec = { src: g.src, remote: null, gid: g.id }; }
      else if (raw.remote || raw.url) { const u = raw.remote || raw.url; spec = { src: String(u), remote: String(u), gid: null }; }
      else { spec = { src: GALLERY[0].src, remote: null, gid: GALLERY[0].id }; }
    } else if (typeof raw === 'number') {
      const g = (GALLERY && GALLERY.length) ? (GALLERY[Math.max(0, Math.min(GALLERY.length - 1, raw))] || GALLERY[0]) : GALLERY[0]; spec = { src: g.src, remote: null, gid: g.id };
    } else if (raw === 'poster' || raw === null || raw === undefined) {
      const g = GALLERY[0]; spec = { src: g.src, remote: null, gid: g.id };
    } else {
      const s = String(raw);
      if (s === 'poster') { const g = GALLERY[0]; spec = { src: g.src, remote: null, gid: g.id }; }
      else spec = { src: s, remote: s, gid: null };
    }
    loadImg(spec.src, e => {
      if (spec.gid) e.gid = spec.gid;
      if (spec.remote) e.remote = spec.remote;
      entries[i] = e;
      if (++loaded === urls.length) finish();
    }, () => { entries[i] = null; if (++loaded === urls.length) finish(); });
  });
}
// auto image (USER.auto: 0 off, N = every N s of song time, -1 = on some scene changes, seeded, ~2 in 5; key ; and chips in Settings): advances through IM[] with the usual crossfade.
// Song time = the sum of the frame steps, so it never runs while paused; begin() / startLive() reset the scene memory so a seek can't trigger a change.
const AI = { acc: 0, scene: null };
function autoImg(dt, scene) {
  const n = USER.auto; AI.acc += dt; const was = AI.scene; AI.scene = scene;
  if (!n || IM.length < 2 || SHOW || imMix < 1) return;
  if (n < 0 ? (was !== null && scene !== was && homeHash(scene | 0, seedUsed) < .4) : AI.acc >= n) { AI.acc = 0; showImg((imTo + 1) % IM.length, false, true); }
}
// image manager: the same strip on the home card (#gimgs) and in Settings (#timgs): click = show, ✕ = remove, + = add; #thumbs = bottom row while playing
function renderImgs() {
  const bg = e => e.url && !e.vid ? 'url("' + e.url + '")' : 'none', lab = e => e.vid ? 'Video' : e.cam ? 'Cam' : '';   // a video / the webcam has no picture to use as a CSS background: a text label
  $('thumbs').replaceChildren(...IM.map((e, k) => { const b = document.createElement('button'); b.dataset.k = k; b.style.backgroundImage = bg(e); b.textContent = lab(e); b.title = 'Image ' + (k + 1) + '  (Shift+' + (k + 1) + ')'; return b; }));
  ['gimgs', 'timgs'].forEach(id => {
    const tiles = IM.map((e, k) => { const b = document.createElement('div'); b.className = 'im'; b.dataset.k = k; b.style.backgroundImage = bg(e); if (e.cam) { b.textContent = lab(e); b.style.display = 'flex'; b.style.alignItems = 'center'; b.style.justifyContent = 'center'; } b.title = 'Image ' + (k + 1) + ': click to show'; b.tabIndex = 0; b.setAttribute('role', 'button'); b.setAttribute('aria-label', 'Show image ' + (k + 1));
      if (IM.length > 1) { const x = document.createElement('i'); x.textContent = '✕'; x.title = 'Remove'; x.setAttribute('aria-label', 'Remove image ' + (k + 1)); b.appendChild(x); } return b; });
    if (!imFull()) { const l = document.createElement('label'); l.title = 'Add images or short videos (MP4 H.264, WebM)'; l.tabIndex = 0; l.setAttribute('role', 'button'); l.setAttribute('aria-label', 'Add images'); l.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); l.querySelector('input').click(); } }); l.innerHTML = '+<input type="file" accept="image/*,video/*" multiple hidden>'; tiles.push(l); }
    $(id).replaceChildren(...tiles);
  });
  document.body.classList.toggle('multi', IM.length > 1); markThumbs(); renderGallery(); markCopy();
}
// built-in gallery strip (home card #ggal and Settings #tgal): a thumb marked .in is already in IM[]
function renderGallery() {
  ['ggal', 'tgal'].forEach(id => $(id).replaceChildren(...GALLERY.map(g => {
    const b = document.createElement('button'); b.type = 'button'; const inUse = IM.some(e => e.gid === g.id);
    b.className = 'gal' + (inUse ? ' in' : ''); b.dataset.gid = g.id; b.style.backgroundImage = 'url("' + g.src + '")';
    b.title = g.title + (inUse ? '  (in use)' : ''); b.setAttribute('aria-label', g.title + (inUse ? ', in use' : '')); return b;
  })));
}
function galPick(gid) {
  const g = GALLERY.find(x => x.id === gid); if (!g) return;
  const k = IM.findIndex(e => e.gid === gid); if (k >= 0) return showImg(k);   // already in the list: just show it
  if (imFull()) return toast(IM_FULL_MSG, 2500);
  loadImg(g.src, e => {   // decode on demand, same texture path as a user image
    const have = IM.findIndex(x => x.gid === gid);
    if (have >= 0 || imFull()) { gl.deleteTexture(e.tex); if (have >= 0) showImg(have); else toast(IM_FULL_MSG, 2500); return; }
    e.gid = gid; IM.push(e); renderImgs(); showImg(IM.length - 1);
  });
}
function removeImg(k) {
  if (IM.length < 2 || k >= IM.length) return;
  const cur = imTo, [e] = IM.splice(k, 1);
  if (e && e.vid) { try { e.cam.pause(); e.cam.removeAttribute('src'); e.cam.load(); } catch (err) {} }   // a video file: release the decoder (its blob URL is revoked below), no stream
  else if (e && e.cam && e.stream) { try { e.stream.getTracks().forEach(t => t.stop()); } catch (err) {} e.cam.srcObject = null; }
  gl.deleteTexture(e.tex); if (e && e.url && String(e.url).startsWith('blob:')) URL.revokeObjectURL(e.url);
  imTo = imFrom = cur > k ? cur - 1 : Math.min(cur, IM.length - 1); imMix = 1; ASPECT = IM[imTo].aspect;   // removing the shown image cuts to its neighbour
  renderImgs();
}
function addImages(files) {
  const fs = [...files].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')).slice(0, IM_MAX - IM.length);
  if (!fs.length) { if (imFull()) toast(IM_FULL_MSG, 2500); return; }
  let first = -1, n = 0;
  const fin = () => { if (++n === fs.length && first >= 0) showImg(first, true), hint.textContent = IM.length + ' images loaded'; };
  fs.forEach(f => { const url = URL.createObjectURL(f), put = e => {
    if (imFull()) { if (e.vid) dropVideo(e); else { gl.deleteTexture(e.tex); URL.revokeObjectURL(url); } return; }
    IM.push(e); if (first < 0) first = IM.length - 1; renderImgs(); fin();
  };
    if (f.type.startsWith('video/')) loadVideo(url, put, () => { URL.revokeObjectURL(url); toast('Cannot play that video: use MP4 (H.264) or WebM (VP8/VP9). iPhone HEVC / .mov: convert first', 5000); fin(); });
    else loadImg(url, put);
  });
}
// T172 short video file as an image source: the webcam path (a <video> in e.cam, uploaded by render()'s "webcam source textures" loop) with a file instead of a stream; muted, looped, never a pure function of t (its own clock)
function dropVideo(e) { try { e.cam.pause(); e.cam.removeAttribute('src'); e.cam.load(); } catch (err) {} gl.deleteTexture(e.tex); URL.revokeObjectURL(e.url); }
function vidPause(p) { for (const e of IM) if (e && e.vid) { try { p ? e.cam.pause() : e.cam.play().catch(() => {}); } catch (err) {} } }
function loadVideo(url, ok, fail) {
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.autoplay = true; v.src = url;
  v.addEventListener('error', () => fail(), { once: true });
  v.addEventListener('loadeddata', () => {   // first decoded frame: texture, aspect, colour stats; only now does the entry exist (an undecodable file never gets one)
    if (!v.videoWidth || !v.videoHeight) return fail();
    const t = glTex(gl, gl.MIRRORED_REPEAT); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v); } catch (e) { gl.deleteTexture(t); return fail(); }
    const e = { tex: t, aspect: v.videoWidth / v.videoHeight, url, cam: v, stream: null, label: 'Video', vid: true, remote: null, gid: null, st: imgStats(v), _init: true };
    if (typeof paused !== 'undefined' && paused) v.pause();
    ok(e); const d = isFinite(v.duration) ? Math.round(v.duration * 10) / 10 : 0;
    codeAdd('image ' + (IM.indexOf(e) + 1) + ' = video  // ' + d + ' s loop', 'a', 'image ' + (IM.indexOf(e) + 1) + ': video, ' + d + ' s loop', 'vid');
  }, { once: true });
  try { v.play().catch(() => {}); } catch (e) {}
}
function addWebcam() {   // webcam becomes one more image source; LOW resolution (320 px width), no audio
  if (imFull()) { toast(IM_FULL_MSG, 2500); return; }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') { toast('No camera available on this browser', 3000); return; }
  navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 } }, audio: false }).then(stream => {
    if (imFull()) { stream.getTracks().forEach(t => t.stop()); toast(IM_FULL_MSG, 2500); return; }
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.autoplay = true; video.srcObject = stream;
    const tex0 = glTex(gl, gl.MIRRORED_REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    const entry = { tex: tex0, aspect: 4 / 3, url: null, cam: video, stream, label: 'Webcam', remote: null, gid: null, _init: true };
    try { video.play(); } catch (e) {}
    video.addEventListener('loadedmetadata', () => { if (video.videoWidth && video.videoHeight) entry.aspect = video.videoWidth / video.videoHeight; }, { once: true });
    IM.push(entry); renderImgs(); showImg(IM.length - 1, true); toast('Webcam added', 1500);
  }).catch(err => { toast('Camera: ' + (err && (err.message || err.name) || 'permission denied'), 3000); });
}
function stopCams() {
  for (const e of IM) if (e && e.cam && e.stream) try { e.stream.getTracks().forEach(t => t.stop()); e.cam.srcObject = null; } catch (err) {}
}
