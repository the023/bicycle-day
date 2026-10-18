/* ════════════════════════ home-screen logo renderer (T6) ════════════════════════ */
let homeLogged = false;
const homeSeed = Q.has('homeseed') ? (parseInt(Q.get('homeseed')) || 1) : ((Math.random() * 1e6) | 0) + 1;
const homeHash = (a, b) => { let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15; return (x >>> 0) / 4294967296; };
// geometry effects (strong): set(p, k, m) with k 0..1 and m = per-segment variant 0..1
const HOME_GEO = [
  ['kaleidoscope', (p, k, m) => { p.kal = .92 * k; p.fold = [6, 8, 12][Math.floor(m * 2.99)]; p.rot = .5 * k; }],
  ['warp+melt', (p, k) => { p.warp += 1.0 * k; p.melt = 1.0 * k; }],
  ['tile grid', (p, k, m) => { p.tile = k; p.tileN = [8, 12, 16][Math.floor(m * 2.99)]; p.tileMode = Math.floor(m * 7.9) % 3; }],
  ['kali fold', (p, k) => { p.kali = .75 * k; }],
  ['julia fold', (p, k) => { p.julia = .75 * k; }],
  ['tunnel', (p, k) => { p.tun = k; }],
  ['zoom+spin', (p, k, m) => { p.zoom *= Math.exp((m < .5 ? .6 : -.7) * k); p.rot = 1.6 * k; p.srcRot += .4 * k; }]
];
const HOME_COL = [
  ['palette', (p, k, m) => { const L = PALS[1 + Math.floor(m * 4.99)]; p.pal = .85 * k; p.palC = L.c; p.palD = L.d; p.ha = .4; }],
  ['hue swing', (p, k, m) => { p.hue += 2.2 * k * Math.sin(p.t * (.35 + .3 * m)); p.pal = Math.max(p.pal, .3 * k); }],
  ['aberration', (p, k) => { p.ab += 2.0 * k; }],
  ['glow', (p, k) => { p.pulse = k * 1.2 * (.5 + .5 * Math.sin(p.t * 3.1)); p.breath += 3 * k; }]   // ~0.5 Hz, display pass only
];
const HOME_SEGS = [];
function homeSegs(t) {   // extend the seeded segment list until it covers t
  while (!HOME_SEGS.length || HOME_SEGS[HOME_SEGS.length - 1].b <= t) {
    const n = HOME_SEGS.length, a = n ? HOME_SEGS[n - 1].b : HOME_INTRO, strong = n % 2 === 0, h = i => homeHash(homeSeed, n * 16 + i);
    const seg = { a, b: a + 5 + 10 * h(0), strong, fx: [] };
    if (strong) {
      const prev = [2, 4].flatMap(d => n >= d ? HOME_SEGS[n - d].fx.map(f => f[0]) : []);
      const geo = HOME_GEO.map((g, i) => i).filter(i => !(MOBILE && HOME_GEO[i][0] === 'tunnel') && !prev.includes(i));
      const g1 = geo.splice(Math.floor(h(1) * geo.length), 1)[0];
      seg.fx.push([g1, h(2)]);
      if (h(3) < .45) seg.fx.push([geo.splice(Math.floor(h(4) * geo.length), 1)[0], h(5)]);   // second geometry effect, sometimes
      const pc = n >= 2 ? HOME_SEGS[n - 2].col : -1; let c = Math.floor(h(6) * HOME_COL.length); if (c === pc) c = (c + 1) % HOME_COL.length;
      seg.col = c; seg.cm = h(7);
    }
    HOME_SEGS.push(seg);
  }
  return HOME_SEGS;
}
const homeStrongEnv = (t, s) => s.strong ? smooth(s.a, s.a + HOME_EASE, t) * (1 - smooth(s.b - HOME_EASE, s.b, t)) : 0;
function homeBase(t) {   // gentle-level multiplier for the background motion
  if (homeReduced) return 0;
  if (t < HOME_INTRO) return lerp(.15, HOME_CALM, smooth(0, HOME_INTRO, t));
  return HOME_CALM;
}
function homeGlitch(t) { return homeReduced || t >= HOME_INTRO + 1 ? 0 : (.05 + .2 * smooth(0, HOME_INTRO, t)) * (1 - smooth(HOME_INTRO - 2, HOME_INTRO + 1, t)); }
function homeTimelineTable(upTo) { homeSegs(upTo); return HOME_SEGS.filter(s => s.a < upTo).map(s => `${s.a.toFixed(1)}-${s.b.toFixed(1)} ${s.strong ? 'STRONG ' + s.fx.map(f => HOME_GEO[f[0]][0]).concat(HOME_COL[s.col][0]).join(' + ') : 'calm'}`); }
function khprog(g, fs) {
  const mk = (type, src) => { const sh = g.createShader(type); g.shaderSource(sh, src); g.compileShader(sh); if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh)); return sh; };
  const p = g.createProgram(); g.attachShader(p, mk(g.VERTEX_SHADER, VS)); g.attachShader(p, mk(g.FRAGMENT_SHADER, fs)); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p)); return p;
}
function homeLocs(g, p, names) { const u = {}; names.forEach(n => u[n] = g.getUniformLocation(p, n)); return u; }
function initHomeGL(canvas) {
  if (!canvas) return;
  homeCanvas = canvas;
  homeGL = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!homeGL) { console.log('home: WebGL2 unavailable'); return; }
  const g = homeGL;
  try {
    homeProgS = khprog(g, FS_SCENE); homeProgD = khprog(g, FS_SHOW);
    homeUS = homeLocs(g, homeProgS, ['uTex','uTex2','uImgMix','uPrev','uRes','uT','uWarp','uKal','uKalN','uFb','uFbHue','uHue','uPal','uSide','uBreath','uMelt','uZoom','uRot','uAber','uPulse','uBright','uAspect','uAnchor','uTile','uTileN','uTileMode','uTileSeed','uTileSize','uMono','uCenter','uRip','uPalC','uPalD','uHueAmt','uTilt','uTT','uSrcZ','uSrcRot','uStretch','uTunnel','uWarpN','uFx','uKali','uJulia','uCode','uCodeAmt']);
    homeUD = homeLocs(g, homeProgD, ['uTex','uRes','uT','uAber','uPulse','uHi','uFx','uDark','uBlaze','uStrobe','uRate','uCells','uGrid','uGlitch','uGSeed']);
    // blank code texture
    const ct = g.createTexture(); g.bindTexture(g.TEXTURE_2D, ct); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(4));
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    // store on a global-ish via homeCodeTex
    homeCodeTex = ct;
    makeHomeTargets();
  } catch (e) { console.log('home shader error:', e.message); homeGL = null; }
}
let homeCodeTex = null;
function makeHomeTargets() {
  const g = homeGL; if (!g) return;
  homeTex.forEach(t => g.deleteTexture(t)); homeFbo.forEach(f => g.deleteFramebuffer(f)); homeTex.length = 0; homeFbo.length = 0;
  homeCur = 0;
  const res = parseFloat(Q.get('res')) || QUAL[quality].res;
  homeW = Math.max(16, Math.round(640 * res)); homeH = Math.max(16, Math.round(homeW / homeAspect));
  const half = !!g.getExtension('EXT_color_buffer_float');
  for (let i = 0; i < 2; i++) {
    const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
    g.texImage2D(g.TEXTURE_2D, 0, half ? g.RGBA16F : g.RGBA8, homeW, homeH, 0, g.RGBA, half ? g.HALF_FLOAT : g.UNSIGNED_BYTE, null);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    const f = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, f); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0);
    g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT); homeTex.push(t); homeFbo.push(f);
  }
  g.bindFramebuffer(g.FRAMEBUFFER, null);
}
function loadHomeLogo(src, done) {
  if (!homeGL) { done && done(); return; }
  const g = homeGL;
  const img = new Image();
  img.onload = () => {
    const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img); g.generateMipmap(g.TEXTURE_2D);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.MIRRORED_REPEAT); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.MIRRORED_REPEAT);
    homeTexImg = t; homeAspect = img.naturalWidth / img.naturalHeight;
    if (homeCanvas) { homeCanvas.width = 960; homeCanvas.height = Math.round(960 / homeAspect); }
    makeHomeTargets();
    done && done();
  };
  img.onerror = () => { console.log('home: logo load failed'); done && done(); };
  img.src = src;
}
function homeFrame(t) {
  const g = homeGL; if (!g || !homeTexImg || !homeCanvas) return;
  const canvas = homeCanvas;
  // size canvas drawing buffer if needed
  if (canvas.width !== homeW * (parseFloat(Q.get('res'))||QUAL[quality].res?1:1)) {} 
  if (homeFixedTime !== null && !homeLogged) { homeLogged = true; console.log('HOMETIMELINE seed=' + homeSeed + '\n' + homeTimelineTable(120).join('\n')); }
  const gLevel = homeBase(t);
  const P = {
    t, warp: HOME_WARP * gLevel,
    kal: 0, fold: 6,
    fb: HOME_FB * gLevel,
    fbHue: .006 * gLevel,
    hue: .7 * Math.sin(t * HOME_HUE_SPEED) * gLevel,
    pal: HOME_PAL * gLevel,
    side: 0, breath: HOME_BREATH * gLevel,
    melt: 0, zoom: 1 + HOME_ZOOM_WOB * gLevel * Math.sin(t * .2),
    rot: 0,
    ab: HOME_ABER * gLevel,
    pulse: 0, bright: 1,
    anchor: HOME_ANCHOR * gLevel,
    tilt: [0, 0], mono: 0,
    srcZ: 1, srcRot: 0, stretch: 0,
    tun: 0, tile: 0, tileN: 8, tileMode: 0,
    kali: 0, julia: 0, palC: [1.3, 1.3, 1.3], palD: [0, .33, .67], ha: 1, glitch: homeGlitch(t)
  };
  if (!homeReduced && t >= HOME_INTRO) for (const s of homeSegs(t)) if (t >= s.a && t < s.b) {
    const e = homeStrongEnv(t, s) * (MOBILE ? .7 : 1);
    if (e > 0) { s.fx.forEach(f => HOME_GEO[f[0]][1](P, e, f[1])); HOME_COL[s.col][1](P, e, s.cm); }
    break;
  }
  // pass1
  const w = homeCur ^ 1;
  g.bindFramebuffer(g.FRAMEBUFFER, homeFbo[w]); g.viewport(0, 0, homeW, homeH); g.useProgram(homeProgS);
  g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, homeTexImg); g.uniform1i(homeUS.uTex, 0);
  g.activeTexture(g.TEXTURE2); g.bindTexture(g.TEXTURE_2D, homeTexImg); g.uniform1i(homeUS.uTex2, 2); g.uniform1f(homeUS.uImgMix, 0);
  g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, homeTex[homeCur]); g.uniform1i(homeUS.uPrev, 1);
  g.uniform2f(homeUS.uRes, homeW, homeH); g.uniform1f(homeUS.uT, t); g.uniform1f(homeUS.uWarp, P.warp); g.uniform1f(homeUS.uKal, P.kal); g.uniform1f(homeUS.uKalN, P.fold);
  g.uniform1f(homeUS.uFb, P.fb); g.uniform1f(homeUS.uFbHue, P.fbHue); g.uniform1f(homeUS.uHue, P.hue); g.uniform1f(homeUS.uPal, P.pal);
  g.uniform1f(homeUS.uSide, P.side); g.uniform1f(homeUS.uBreath, P.breath); g.uniform1f(homeUS.uMelt, P.melt); g.uniform1f(homeUS.uZoom, P.zoom);
  g.uniform1f(homeUS.uRot, P.rot); g.uniform1f(homeUS.uAber, P.ab); g.uniform1f(homeUS.uPulse, P.pulse); g.uniform1f(homeUS.uBright, P.bright); g.uniform1f(homeUS.uAspect, homeAspect); g.uniform1f(homeUS.uAnchor, P.anchor);
  const rAge = 0; g.uniform4f(homeUS.uRip, 0, 0, rAge, 0);
  g.uniform2f(homeUS.uTilt, 0, 0); g.uniform1f(homeUS.uTT, 0); g.uniform1f(homeUS.uSrcZ, P.srcZ); g.uniform1f(homeUS.uSrcRot, P.srcRot); g.uniform3f(homeUS.uPalC, ...P.palC); g.uniform3f(homeUS.uPalD, ...P.palD); g.uniform1f(homeUS.uHueAmt, P.ha);
  g.uniform1f(homeUS.uStretch, P.stretch); g.uniform1f(homeUS.uTunnel, P.tun);
  g.uniform2f(homeUS.uCenter, 0, 0); g.uniform1f(homeUS.uMono, 0);
  g.uniform1f(homeUS.uTile, P.tile); g.uniform1f(homeUS.uTileN, P.tileN); g.uniform1f(homeUS.uTileMode, P.tileMode); g.uniform1f(homeUS.uTileSeed, homeSeedVal || 1); g.uniform1f(homeUS.uTileSize, 1);
  const qfx = QUAL[quality].fx; g.uniform1f(homeUS.uWarpN, QUAL[quality].warpN); g.uniform1f(homeUS.uFx, qfx);
  g.uniform1f(homeUS.uKali, P.kali); g.uniform1f(homeUS.uJulia, P.julia);
  g.activeTexture(g.TEXTURE3); g.bindTexture(g.TEXTURE_2D, homeCodeTex); g.uniform1i(homeUS.uCode, 3); g.uniform1f(homeUS.uCodeAmt, 0);
  g.drawArrays(g.TRIANGLES, 0, 3);
  // pass2
  g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, canvas.width, canvas.height); g.useProgram(homeProgD);
  g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, homeTex[w]); g.uniform1i(homeUD.uTex, 0);
  g.uniform2f(homeUD.uRes, canvas.width, canvas.height); g.uniform1f(homeUD.uT, t); g.uniform1f(homeUD.uAber, P.ab); g.uniform1f(homeUD.uPulse, P.pulse); g.uniform1f(homeUD.uHi, 0); g.uniform1f(homeUD.uFx, qfx);
  g.uniform1f(homeUD.uDark, 0); g.uniform1f(homeUD.uBlaze, 0); g.uniform1f(homeUD.uStrobe, 0); g.uniform1f(homeUD.uRate, 8); g.uniform1f(homeUD.uCells, 0); g.uniform1f(homeUD.uGrid, 4); g.uniform1f(homeUD.uGlitch, P.glitch); g.uniform1f(homeUD.uGSeed, homeSeed % 997);
  g.drawArrays(g.TRIANGLES, 0, 3);
  homeCur = w;
  // show fallback handling
  if (!homeFirstFrame) { homeFirstFrame = true; canvas.style.display = 'block'; const img = canvas.parentElement.querySelector('img'); if (img) img.style.display = 'none'; }
}
let homeSeedVal = (Math.random() * 7) | 0;
function startHomeLoop() {
  if (homeRaf || !homeGL) return;
  homeStartedAt = performance.now() / 1000;
  const tick = () => {
    if (!homeRaf) return;
    const t = homeFixedTime !== null ? homeFixedTime : (performance.now() / 1000 - homeStartedAt);
    homeFrame(t);
    homeRaf = requestAnimationFrame(tick);
  };
  homeRaf = requestAnimationFrame(tick);
}
function stopHomeLoop() {
  if (homeRaf) { cancelAnimationFrame(homeRaf); homeRaf = 0; }
}

function resize() {   // keep the canvas a 16:9 box, centred, as large as the window allows
  const w = Math.min(innerWidth, innerHeight * 16 / 9), h = w * 9 / 16, dpr = Math.min(MOBILE ? 1 : devicePixelRatio || 1, QUAL[quality].dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  cv.width = Math.min(1920, Math.round(w * dpr)); cv.height = Math.round(cv.width * 9 / 16);
}

