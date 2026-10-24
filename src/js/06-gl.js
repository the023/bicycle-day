/* ════════════════════════ GL setup ════════════════════════ */
let progS, progD, uS = {}, uD = {}, IM = [], imFrom = 0, imTo = 0, imMix = 1, fbo = [], tex = [], FW = 1600, FH = 900, ready = false;
// home-screen logo renderer state (second WebGL2 context, owned only while gate is open)
let homeGL = null, homeProgS = null, homeProgD = null, homeUS = {}, homeUD = {}, homeFbo = [], homeTex = [], homeW = 0, homeH = 0, homeCur = 0, homeCanvas = null;
let homeTexImg = null, homeAspect = 1672 / 941, homeStartedAt = 0, homeRaf = 0, homeFirstFrame = false, homeReduced = false;
let homeFixedTime = Q.has('hometime') ? (parseFloat(Q.get('hometime')) || 0) : null;
function prog(fs) {
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p;
}
function locs(p, names) { const u = {}; names.forEach(n => u[n] = gl.getUniformLocation(p, n)); return u; }
function initGL() {
  progS = prog(FS_SCENE); progD = prog(FS_SHOW);
  uS = locs(progS, ['uTex', 'uTex2', 'uImgMix', 'uGhostA', 'uGhostB', 'uGhostMix', 'uPrev', 'uRes', 'uT', 'uWarp', 'uKal', 'uKalN', 'uFb', 'uFbHue', 'uHue', 'uPal', 'uSide', 'uBreath', 'uMelt', 'uZoom', 'uRot', 'uAber', 'uPulse', 'uBright', 'uAspect', 'uAnchor', 'uTile', 'uTileN', 'uTileMode', 'uTileSeed', 'uTileSize', 'uMono', 'uCenter', 'uRip', 'uPalC', 'uPalD', 'uHueAmt', 'uTilt', 'uTT', 'uSrcZ', 'uSrcRot', 'uStretch', 'uTunnel', 'uWarpN', 'uFx', 'uKali', 'uJulia', 'uKaliP', 'uJuliaP', 'uKalZ', 'uCode', 'uCodeAmt']);
  uD = locs(progD, ['uTex', 'uRes', 'uT', 'uAber', 'uPulse', 'uHi', 'uFx', 'uDark', 'uBlaze', 'uStrobe', 'uRate', 'uCells', 'uGrid', 'uGlitch', 'uGSeed', 'uNeg', 'uPh', 'uCol', 'uCacc', 'uCph']);
  CODE.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, CODE.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  makeTargets();
}
// graphics quality: internal resolution, warp layers, colour fringing / grain. Default depends on the renderer (software GL = low).
const QUAL = { high: { res: 1, dpr: 1.5, warpN: 4, fx: 1 }, medium: { res: .7, dpr: 1, warpN: 3, fx: 1 }, low: { res: .5, dpr: 1, warpN: 2, fx: 0 } };
let quality = 'high';
function softwareGL() { const e = gl.getExtension('WEBGL_debug_renderer_info'); return !!e && /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL))); }
function makeTargets() {
  const half = !!gl.getExtension('EXT_color_buffer_float');
  tex.forEach(t => gl.deleteTexture(t)); fbo.forEach(f => gl.deleteFramebuffer(f)); tex.length = 0; fbo.length = 0;
  const res = parseFloat(Q.get('res')) || QUAL[quality].res; FW = Math.round(1600 * res); FH = Math.round(900 * res);
  for (let i = 0; i < 2; i++) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA8, FW, FH, 0, gl.RGBA, half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); tex.push(t); fbo.push(f);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); cur = 0;
}
let ASPECT = 1; let cellPrev = 0, cellGrid = 4;   // strobe grid: size of the current launch (N x N, N in 3..10), drawn at each launch
const GALLERY = __GALLERY__;   // [{id, title, src}] inlined by build.mjs; a picture is decoded only when its thumb is clicked (galPick)
function loadImg(src, ok, fail, maxPx) {
  const bad = () => { if (fail) fail(); else hint.textContent = 'Could not load that image'; };
  const give = (img, url) => {
    if (maxPx && img.naturalWidth * img.naturalHeight > maxPx) return bad();
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    ok({ tex: t, aspect: img.naturalWidth / img.naturalHeight, url });
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
// several images: #1 is the default picture (the 1943 poster), #2..#5 are the user's; switching crossfades over ~1.5 s without touching clock or sound
function showImg(n, quiet, auto) {
  if (n < 0 || n >= IM.length || (n === imTo && imMix >= 1)) return;
  if (!auto) AI.acc = 0;   // a manual switch restarts the auto-image timer
  if (imMix < 1) { imFrom = imTo; imMix = 0; } else imFrom = imTo;   // a switch mid-fade restarts from the target it was heading to
  imTo = n; imMix = 0; markThumbs(); markCopy(); if (!quiet) toast('Image ' + (n + 1) + ' / ' + IM.length, 1500); codeAdd(null, 'a', 'image ' + (n + 1) + ' / ' + IM.length, 'img');
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
  const bg = u => u ? 'url("' + u + '")' : 'none';
  $('thumbs').replaceChildren(...IM.map((e, k) => { const b = document.createElement('button'); b.dataset.k = k; b.style.backgroundImage = bg(e.url); if (e.cam) b.textContent = 'Cam'; b.title = 'Image ' + (k + 1) + '  (Shift+' + (k + 1) + ')'; return b; }));
  ['gimgs', 'timgs'].forEach(id => {
    const tiles = IM.map((e, k) => { const b = document.createElement('div'); b.className = 'im'; b.dataset.k = k; b.style.backgroundImage = bg(e.url); if (e.cam) { b.textContent = 'Cam'; b.style.display = 'flex'; b.style.alignItems = 'center'; b.style.justifyContent = 'center'; } b.title = 'Image ' + (k + 1) + ': click to show'; b.tabIndex = 0; b.setAttribute('role', 'button'); b.setAttribute('aria-label', 'Show image ' + (k + 1));
      if (IM.length > 1) { const x = document.createElement('i'); x.textContent = '✕'; x.title = 'Remove'; x.setAttribute('aria-label', 'Remove image ' + (k + 1)); b.appendChild(x); } return b; });
    if (IM.length < 5) { const l = document.createElement('label'); l.title = 'Add images (or drop them on the page)'; l.tabIndex = 0; l.setAttribute('role', 'button'); l.setAttribute('aria-label', 'Add images'); l.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); l.querySelector('input').click(); } }); l.innerHTML = '+<input type="file" accept="image/*" multiple hidden>'; tiles.push(l); }
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
  if (IM.length >= 5) return toast('Max 5 images: remove one first (✕)', 2500);
  loadImg(g.src, e => {   // decode on demand, same texture path as a user image
    const have = IM.findIndex(x => x.gid === gid);
    if (have >= 0 || IM.length >= 5) { gl.deleteTexture(e.tex); if (have >= 0) showImg(have); else toast('Max 5 images: remove one first (✕)', 2500); return; }
    e.gid = gid; IM.push(e); renderImgs(); showImg(IM.length - 1);
  });
}
function removeImg(k) {
  if (IM.length < 2 || k >= IM.length) return;
  const cur = imTo, [e] = IM.splice(k, 1);
  if (e && e.cam && e.stream) { try { e.stream.getTracks().forEach(t => t.stop()); } catch (err) {} e.cam.srcObject = null; }
  gl.deleteTexture(e.tex); if (e && e.url && String(e.url).startsWith('blob:')) URL.revokeObjectURL(e.url);
  imTo = imFrom = cur > k ? cur - 1 : Math.min(cur, IM.length - 1); imMix = 1; ASPECT = IM[imTo].aspect;   // removing the shown image cuts to its neighbour
  renderImgs();
}
function addImages(files) {
  const fs = [...files].filter(f => f.type.startsWith('image/')).slice(0, 5 - IM.length);
  if (!fs.length) { if (IM.length >= 5) toast('5 images max: remove one first', 2000); return; }
  let first = -1, n = 0;
  fs.forEach(f => { const url = URL.createObjectURL(f); loadImg(url, e => {
    if (IM.length >= 5) { gl.deleteTexture(e.tex); URL.revokeObjectURL(url); return; }
    IM.push(e); if (first < 0) first = IM.length - 1; renderImgs();
    if (++n === fs.length) showImg(first, true), hint.textContent = IM.length + ' images loaded';
  }); });
}
function addWebcam() {   // webcam becomes one more image source; LOW resolution (320 px width), no audio
  if (IM.length >= 5) { toast('Max 5 images: remove one (✕) first', 2500); return; }
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') { toast('No camera available on this browser', 3000); return; }
  navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 } }, audio: false }).then(stream => {
    if (IM.length >= 5) { stream.getTracks().forEach(t => t.stop()); toast('Max 5 images: remove one (✕) first', 2500); return; }
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.setAttribute('playsinline', ''); video.autoplay = true; video.srcObject = stream;
    const tex0 = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    const entry = { tex: tex0, aspect: 4 / 3, url: null, cam: video, stream, label: 'Webcam', remote: null, gid: null, _init: true };
    try { video.play(); } catch (e) {}
    video.addEventListener('loadedmetadata', () => { if (video.videoWidth && video.videoHeight) entry.aspect = video.videoWidth / video.videoHeight; }, { once: true });
    IM.push(entry); renderImgs(); showImg(IM.length - 1, true); toast('Webcam added', 1500);
  }).catch(err => { toast('Camera: ' + (err && (err.message || err.name) || 'permission denied'), 3000); });
}
function stopCams() {
  for (const e of IM) if (e && e.cam && e.stream) try { e.stream.getTracks().forEach(t => t.stop()); e.cam.srcObject = null; } catch (err) {}
}
