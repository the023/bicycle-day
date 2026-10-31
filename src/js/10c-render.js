// T185: the one drift integrator. Advances the drifting state s = {hue, rotA} by one step dt; render() calls it every frame (dt = the frame step), integrateTo (dt = .5) and integrateLocal (dt = LSTEP) along the same inputs.
// st = { t, u, u0, kal0, hueSpd, calm (UE.calm), amp (UE.amp), hk (Extreme blend 0..1), live (Live / Local: + mid = the eased BAND.mid, tr, tm = the scene / minor punch envelopes) }. T155: amp scales the spin SPEED, never the angle.
const DRIFT = { hue: 0, rotA: 0 }, DST = {};
function driftStep(s, dt, st) {
  s.hue += st.hueSpd * st.calm * dt; const dA = dt * st.amp, EK = ENGINE.kal;
  if (st.live) s.rotA += (st.mid * .12 + st.tr * .5 + st.tm * .2) * dA * rotDir;
  if (st.hk > 0) s.rotA += dA * rotDir * HCspin(st.t) * st.hk;
  s.rotA += dA * rotDir * opening(st.u0) * (.25 + .75 * smooth(.12, .35, st.u)) * (EK.spinBase + EK.spinKal * st.kal0 + EK.spinWob * wob(st.t, 5));   // poster stays upright while calm
}
const bandMidStep = (mid, dt) => BAND.mid += (mid - BAND.mid) * (1 - Math.exp(-dt * 3));   // the eased mids (render() and integrateLocal)
function render(t, dt, bass, mid = 0, hi = 0) {
  const { u, u0 } = uAt(t, UE.off), [warp, kal0, n0, fb0, hueSpd, pal, side, breath, melt, zoomAmp, aber, bright] = score(u);
  const morphOn = (IM.length >= 2) && !SHOW && !LIVE && !LOC;
  const gi = morphOn ? ghostIndices(t) : { a: imTo, b: imTo, mix: 0 };
  easeUser(dt); const HC = hcOn(), hk = ramp(HCr, HC ? 1 : 0, dt, transT()), Hd = hk > .5, hl = (a, b) => lerp(a, b, hk), isGen = !(LIVE || LOC || SHOW || CTRL || HC);   // hk = hardcore blend 0..1 (a toggle ramps over the transition time); Hd = its discrete half (scene period, timelines, palette flips)
  // deformation gate (tiles, tilt, scene punches, tunnel, kaleidoscope, warp, pulse...): generated = calm start over the first ~15 % of the piece;
  // local file = 5 s ramp-up (fixed, not track-proportional); live = calmer for 10 s (x0.3 → 1), then the full music-driven look; controlled / showcase / extreme = always 1
  const g15 = CTRL || SHOW || Hd ? 1 : LOC ? smooth(0, 5, t) : LIVE ? lerp(.3, 1, smooth(0, 10, t)) : HC ? smooth(.13, .18, t / TOTAL) : rampIn(t);   // generated (T133): the stepped ramp on the music's sections replaces the 13-18 % gate
  const cal = isGen ? rampIn(t) : calm(t), calG = isGen && !Hd ? 1 : cal;   // cal = the slow-start factor (generated: the same ramp as g15); calG = the factor next to g15 in products (g15 already is the ramp: once, not squared)
  // scene look: which effect leads and which palette, changing on every drop (live) or every ~45 s (generated); per-state emphasis eases in
  const EV = isGen && !Hd && evOK(), sc = sceneAt(t, Hd, EV), VP = Hd ? [] : vplan();
  let wi = sc.wi, wf = sc.wf, since = sc.since, secE = 1;   // scene = the music's own section when the generator publishes a plan (electro / chiptune / chiptune2 / drone / gamelan), else a fixed ~45 s period
  if (VP.length) { let i = VP.findIndex(x => t < x.b); if (i < 0) i = VP.length - 1; const c = VP[i], pe = VP[i - 1] ? VP[i - 1].e : c.e; wi = i; since = t - c.a; wf = clamp(since / Math.max(1, c.b - c.a)); secE = lerp(pe, c.e, smooth(0, 4, since)); }
  const scene = LIVE ? LIVE.scenes : wi;
  const kindOf = n => LIVE ? (LIVE.kinds[n] ?? 1) : VP.length ? (VP[n] && VP[n].e < .4 ? 0 : 1) : 1;   // 1 = energetic section, 0 = calm one
  if (LIVE && scene !== lastScene) { lastScene = scene; trT0 = t; }
  const mn = minorAt(t, Hd, EV), mi = LIVE ? LIVE.minors : mn.mi;
  if (LIVE && mi !== lastMinor) { lastMinor = mi; tmT0 = t; }
  // auto: the ENGINE picks the transition time per scene (a pure function of seed + scene): short in energetic sections, long in calm ones; assisted / manual use USER.trans. scenePunch() (10b-clock.js) also gives the punch envelopes
  const { TRN: trn, trD, tr, tm, th, trP, hH } = scenePunch(t, { CL, SHOW, LIVE, Hd, isGen, cal, calG, g15, scene, wi, since, kind: kindOf(scene), EV, mn, trT0, tmT0 }); TRN = trn;
  if (!SHOW) autoImg(dt, scene);
  const tk = scene * 50 + mi;
  // T155: Energy change (keys Z / X, chips; auto and assisted): ONE short transition drawn from the seed + a change counter among the existing punches. It follows a key press, so it is not a pure function of t: it is not in integrateTo / integrateLocal (a seek past it finds it decayed). Down = softer (no tile burst) and slower
  if (ETR.pend) { const dn = ETR.pend < 0, pool = dn ? ETR_DN : ETR_UP; ETR.pend = 0; ETR.n++; ETR.k = pool[Math.floor(seedHash(ETR.n, 41) * pool.length)]; ETR.t0 = t; ETR.D = trD * (dn ? 1.6 : 1); ETR.s = dn ? .6 : 1; ETR.sg = seedHash(ETR.n, 42) < .5 ? -1 : 1; if (ETR.k === 'hue jump') { ETR.hv = ETR.sg * (.9 + .9 * seedHash(ETR.n, 43)); ETR.tk = tk; } }   // hue jump: .9-1.8 rad on top of the minor's own hue offset (a plain re-roll can land near the old value), until the next minor change
  if (t < ETR.t0) ETR.k = '';   // a seek back past the key press drops the transition (else it would replay when the song gets there again)
  const eD = t - ETR.t0, eEnv = ETR.k && eD >= 0 ? Math.exp(-eD / ETR.D) * g15 * ETR.s : 0;   // 1 at the key press, decays like the scene punch (trD)
  const eZ = ETR.k === 'zoom punch in' ? .4 * eEnv * UE.big : ETR.k === 'zoom punch out' ? -ENGINE.zoom.punchOut * Math.pow(eEnv, ENGINE.zoom.punchTail) : 0, eTile = ETR.k === 'tile burst' ? eEnv : 0, eW = ETR.k === 'warp flash' ? eEnv : 0;
  const eRot = ETR.k === 'rotation kick' ? ETR.sg * ETR_ROT * smooth(0, .3 * ETR.D, eD) * eEnv : 0;   // a bounded angle (<= ETR_ROT rad) that rises over .3 D, then fades; added to P.rot only, never to rotA
  const palRaw = n => { const pool = kindOf(n) ? PAL_HI : PAL_LO; return pool[Math.floor(seedHash(n, 4) * pool.length)]; };
  const palIdx = n => { const a = palRaw(n); if (n > 0 && a === palRaw(n - 1)) { const pool = kindOf(n) ? PAL_HI : PAL_LO; return pool[(pool.indexOf(a) + 1) % pool.length]; } return a; };
  const pp = Hd && !LIVE && extKind(t) === 'pingpong';   // ping-pong (generated, Extreme): look A (even wi) = tiles lead, B = not; palette per A/B, not per beat
  const leadTile = pp ? (wi & 1) === 0 : seedHash(scene, 3) < .5, st = LIVE ? LIVE.state : '', sv = LIVE_LOOK[st] || [1, 1, 1, 1], base = kindOf(scene) ? [1, 1.1, 1, 1] : [.35, .8, .7, .7];
  const tg = base.map((b, i) => b * (1 + .3 * (sv[i] - 1)));   // the section sets the look; the instantaneous state only nudges it
  if (st === 'drop' && leadTile) tg[0] *= .35;
  const hcPal = Hd && !LOC && !pp, PL = PALS[TQ.pal !== null ? TQ.pal : hcPal ? palIdx(1000 + (LIVE ? Math.floor(t / 2) : bi >> 2)) : palIdx(scene)], ez = snapLook ? 1 : 1 - Math.exp(-dt / (CL || SHOW ? hl(1.2, .3) : Math.max(.05, TRN / 3))), ezS = snapLook ? 1 : CL || SHOW ? (USER.trans ? 1 - Math.exp(-dt / (USER.trans / 3)) : ez) : ez;   // auto: the engine's own transition time (0 = a hard cut); snapLook = first frame after a seek   // hardcore: the palette flips every 4 beats, quickly
  const LP = LIVE && !SHOW && !CTRL && !Hd, prT = LP ? lerp(1, EN.lp[USER.energy] * (kindOf(scene) ? 1 : EN.lpS[USER.energy][0]) * (st === 'breakdown' || st === 'calm' ? EN.lpS[USER.energy][1] : 1), LOC ? EN.lpL : 1) : 1;   // T151: presence of the baseline effects (EN.lp)
  LOOK.pr += (prT - LOOK.pr) * (snapLook ? 1 : 1 - Math.exp(-dt / (prT > LOOK.pr ? EN.lpT / 3 : Math.max(EN.lpT, TRN / 3))));   // up 3x faster than down: a drop is at full strength at once
  LOOK.k += (tg[0] - LOOK.k) * ez; LOOK.w += (tg[1] - LOOK.w) * ez; LOOK.f += (tg[2] - LOOK.f) * ez; LOOK.p += (tg[3] - LOOK.p) * ez; LOOK.ha += (PL.ha - LOOK.ha) * ez; LOOK.hj += (seedHash(tk, 7) * 2 + (tk === ETR.tk ? ETR.hv : 0) - LOOK.hj) * (1 - Math.exp(-dt / 1.5));   // hue offset re-rolled on every minor change
  // styles (opt-in): auto picks one per scene (20 % none); calm sections get a lighter touch
  const lsOn = (isGen || (LIVE && !SHOW && !CTRL)) && !Hd, lw = LIVE ? scene : wi;   // T143 / T150: the light set replaces the per-window Kali / Julia pick: generated auto (window = wi) and Live / Local auto (window = the live scene), any Energy but Extreme
  const sty = LIVE && lsOn ? (CL && USER.style != null ? USER.style : 3) : CL ? styleNow() : styleDefault(), sIdx = sty === 3 ? [0, 1, 2, 1, 2][Math.floor(seedHash(LIVE ? scene : wi, 8) * 5)] : sty, sAmt = sty === 3 ? (kindOf(scene) ? .55 : .3) : .5;
  const lsT = lsOn ? lightSet(lw) : null;   // a fixed style in the menu still wins
  if (lsT && sty !== 3) { lsT[0] = sty === 1; lsT[1] = sty === 2; }
  LOOK.sk += (((lsT ? lsT[0] : sIdx === 1) ? sAmt : 0) - LOOK.sk) * ezS; LOOK.sj += (((lsT ? lsT[1] : sIdx === 2) ? sAmt : 0) - LOOK.sj) * ezS;   // style switch: eases over the transition time
  for (let i = 0; i < 4; i++) LOOK.ls[i] += ((lsT && lsT[i] ? 1 : 0) - LOOK.ls[i]) * ezS;   // eased membership of the light set
  for (let i = 0; i < 3; i++) { LOOK.c[i] += (PL.c[i] - LOOK.c[i]) * ez; LOOK.d[i] += (PL.d[i] - LOOK.d[i]) * ez; }
  // camera tilt amplitude by state; tilt direction drifts slowly and re-rolls per scene
  const EC = ENGINE.cam, camT = g15 * (LIVE ? (kindOf(scene) ? EC.tilt : EC.tiltCalm) * (1 + EC.stateK * ((EC.state[st] ?? EC.stateElse) / EC.stateRef - 1)) : EC.tiltArc * smooth(.2, .5, u));
  CAM.a += (camT - CAM.a) * ez;
  const tilt = [CAM.a * Math.sin(t * .11 + seedHash(scene, 5) * 6.28), CAM.a * Math.cos(t * .087 + seedHash(scene, 6) * 6.28)];
  // band reactivity: mids spin the picture, bass speeds the tiles up, highs add sparkle (live only where it would break the pure f(t))
  BAND.hi += (hi - BAND.hi) * (1 - Math.exp(-dt * 3)); bandMidStep(mid, dt); BAND.zt += ((LIVE ? .45 * LIVE.tension : 0) - BAND.zt) * (1 - Math.exp(-dt * 2)); BAND.tt = LIVE ? BAND.tt + dt * (1 + 2.5 * bass) : t;
  USER.cx += (USER.tx - USER.cx) * (1 - Math.exp(-dt * 4)); USER.cy += (USER.ty - USER.cy) * (1 - Math.exp(-dt * 4));
  const EK = ENGINE.kal, ET = ENGINE.tile, EW = ENGINE.warp, KMAX = hl(ARC.kalMax ?? EK.max, EK.maxHc), dip = hl(1 - EK.dip * smooth(.55, .95, .5 + .5 * Math.sin(t * .11 + PH)), 1);   // kaleidoscope capped, and it regularly lets the source breathe back
  // tunnel: seeded stretches (generated), or on drops / strong builds (live, eased); stretch of the source ghost grows with intensity + surges
  if (LIVE) tunLive += ((st === 'drop' ? EC.tunDrop : st === 'build' ? EC.tunBuild * smooth(.25, .6, LIVE.tension) : 0) - tunLive) * (1 - Math.exp(-dt / 1.5));
  const tun = g15 * (TQ.tunnel !== null ? TQ.tunnel : LIVE ? tunLive : tunnelAt(t));
  const cz = calG * g15, sg = TQ.surge !== null ? TQ.surge : (hk <= 0 || hk >= 1 ? surgeAt(t, hk >= 1, EV) : lerp(surgeAt(t, false, EV), surgeAt(t, true), hk)) * cz * (VP.length ? .6 + .8 * secE * UE.big : 1),
    mdR = hk <= 0 || hk >= 1 ? moodAt(t, hk >= 1, EV) : (m0 => { const m1 = moodAt(t, true), o = {}; for (const k in m1) o[k] = lerp(m0[k], m1[k], hk); return o; })(moodAt(t, false, EV)),   // a hardcore toggle blends both seeded schedules
    md = Hd && extKind(t) === 'pingpong' ? { ...mdR, strobe: 0 } : mdR;   // T41: no strobe during a ping-pong (a copy: mdR may be a cached timeline object)
  // T85: when the background ghost is morphing between two images (T77), raise its
  // blend so the (slow) change is actually visible - only in that case, so the
  // one-image look stays unchanged. Blend stays a smooth fraction of the frame.
  const kal = g15 * clamp(kal0 * KMAX * dip * (1 + .2 * wob(t, 3)) * UE.kal * LOOK.k * (hl(EK.base, EK.baseHc) + EK.surge * sg)), anchor = .13 * clamp(kal0 + melt * .5 + pal * .5) * (1 + (1 - sg)) * (morphOn ? 2.5 : 1);
  const fold = Math.max(EK.foldMin, n0 + EK.foldWob * wob(t, 4) * kal0);
  const PR = LP ? LOOK.pr : 1, fbx = fb0 * (1 + .08 * wob(t, 2)) * UE.fb * LOOK.f * Math.pow(PR, EN.lpX[0]), fb = clamp(fbx <= .7 ? fbx : .7 + .18 * (1 - Math.exp(-(fbx - .7) / .18)), 0, .9);   // soft knee: cranking the slider still leaves the engine's variation
  Object.assign(DST, { t, u, u0, kal0, hueSpd, calm: UE.calm, amp: UE.amp, hk, live: !!LIVE, mid: BAND.mid, tr, tm }); DRIFT.hue = hue; DRIFT.rotA = rotA; driftStep(DRIFT, dt, DST); hue = DRIFT.hue; rotA = DRIFT.rotA;   // T155: the master amount scales the spin SPEED (the angle is never scaled: an Energy change must not turn the picture); integrateTo / integrateLocal use the same driftStep
  // tiles: a window every ~45 s (more often on drops); each window picks its own grid size and mode from the seed
  let tile = clamp((smooth(ET.win[0], ET.win[1], wf) * (1 - smooth(ET.win[2], ET.win[3], wf)) * smooth(ET.gate[0], ET.gate[1], u) * (1 - ET.kalCut * kal) * (leadTile ? 1 : ET.nonLead) * (LIVE ? 0 : 1) + (LIVE ? LIVE.boost * .9 * (leadTile ? 1 : .15) : 0) + trP * ET.punch * (leadTile ? 1 : 0) + eTile * ET.punch + tm * ET.minor * (leadTile ? 1 : .5)) * UE.tile) * g15, tileN = ET.sizes[Math.floor(seedHash(LIVE ? tk : wi, 1) * ET.sizes.length)], tileMode = Math.floor(seedHash(LIVE ? tk : wi, 2) * ET.modes);
  if (CL && USER.force >= 0) { tile = clamp(Math.max(tile, (.55 + .25 * Math.sin(t * .35 + PH)) * UE.tile)) * g15; tileMode = USER.force; }   // a chosen mode keeps the tiles on, still breathing
  // heartbeat (lub-dub) + low-frequency energy of the actual sound
  let pulse = 0;
  if (LIVE) pulse = LIVE.pulse;
  else { while (bi + 1 < BEATS.length && BEATS[bi + 1] <= t) bi++; }
  if (!LIVE && t >= BEATS[0]) { const d = t - BEATS[bi], d2 = d - .22; pulse = (Math.exp(-d * 7) + (d2 > 0 ? .6 * Math.exp(-d2 * 7) : 0)) * hbW(u0); }
  bassE += (bass - bassE) * .2; pulse = Math.min(1.3, pulse * (1 + (ARC.drive || 0) * .6) + bassE * .5 * (LIVE ? 1 : hbW(u0)));
  if (ARC.piano) pulse = .12 * noteGlow(t);   // piano: no heartbeat, only a very soft breath after each melody note
  // zoom: slow breathing in and out (below 1 the picture tiles into a tunnel), a build slowly pushes in, every new scene punches out or in
  const op = isGen && !Hd ? g15 : opening(u0) * g15; pulse *= op;   // generated (T133): the ramp itself; opening(u0) stays on the slow spin
  const zOn = !(SHOW || CTRL || HC); if (zOn && LIVE && !LOC) zoomPulseLive(t);   // T113: zoom pulses in every source (not Extreme / manual / showcase)
  const zpMap = (z, c) => z < 1 ? 1 + (z - 1) * Math.sqrt(c) : Math.pow(1 + (z - 1) * c, UE.big);   // T134: calm / soft shrink the zoom-in pulse (zp ** big); T145: a zoom-out is not a deformation: calm and soft keep it, and the slow-start ramp lets it in as its square root
  const zp = zOn ? zpMap(zoomPulseAt(t), cal) : 1;
  const EZ = ENGINE.zoom, punchZ = kindOf(scene) ? (seedHash(scene, 11) < EZ.pPunchOut ? -EZ.punchOut * Math.pow(trP, EZ.punchTail) : .55 * trP * UE.big * hl(1, 1.6)) : trP * UE.big * hl(1, 1.6) * (scene % 2 ? .55 : -.4);   // T145: a scene start on an energetic section mostly jumps OUT at once and returns slowly (trP ** tail); a calm one keeps the old alternating nudge
  const zoom = (1 + zoomAmp * op * .25 * Math.sin(t * .23 + wob(t, 6) * 2)) * Math.exp(EZ.swing * cz * Math.sin(t * .06 + PH * 1.7)) * Math.pow(EZ.rest, cz) * Math.exp(-EZ.kalOut * kal) * (1 + BAND.zt) * (1 + punchZ + eZ) * (1 + tm * UE.big * hl(.12, .3) * (mi % 2 ? 1 : -1)) * USER.zoom * (1 + bassE * .04) * zp;
  const stretch = TQ.stretch !== null ? TQ.stretch : clamp(LP ? (EN.st[0] * Math.max(0, u - EN.st[1]) + .5 * sg) * smooth(10, 50, t) * PR : (.15 + .6 * u + .5 * sg) * (LIVE ? smooth(10, 50, t) : cz * op) * .9);
  const wr = warp * op * (1 + EW.wob * wob(t, 1)) * (1 + EW.mid * BAND.mid) * (1 + EW.punch * (trP + eW)) * LOOK.w * (EW.base + EW.surge * sg) * hl(1, EW.hc) * UE.wp * PR, ab = (aber * op + BAND.hi * .6) * PR * (1 + .5 * sg) * hl(1, LIVE ? EN.hcAb[0] : 1.8) + hl(0, LIVE ? EN.hcAb[1] : .4);   // T153: Live / Local Extreme aberration = x hcAb[0] + hcAb[1] (generated keeps 1.8 / .4)
  const fadeT = clamp(TOTAL * .06, 8, 15), gFade = isGen ? smooth(0, fadeT, t) : 1, gZoom = isGen ? 1 + .22 * (1 - smooth(0, fadeT * 1.5, t)) : 1;   // generated start: black, the picture comes up over 8-15 s with a slow zoom-out
  // final parameters of this frame: in showcase mode they are replaced by a neutral baseline + the active FX entry
  const cellNow = hk * smooth(.8, .95, sg);
  const P = { t, warp: wr, kal, fold, fb: fb * (1 - ET.fbCut * (TQ.tile ? 1 : tile)), fbHue: (.006 + .02 * pal) * LOOK.ha, hue: hue + LOOK.hj, pal: pal * LOOK.p, side, breath: breath * op, melt: melt * op * (.5 + sg) * UE.mt * Math.pow(PR, EN.lpX[1]), zoom: zoom * gZoom, rot: rotA + USER.rot + eRot, ab, pulse, bright: bright * gFade * (Hd && !LOC ? smooth(0, 3, t) : 1), anchor, tilt,
    srcZ: 1 + .3 * cz * Math.sin(t * .045 + PH), srcRot: .5 * cz * Math.sin(t * .031 + PH * 2), palC: LOOK.c, palD: LOOK.d, ha: LOOK.ha, stretch: stretch * UE.st, tun: clamp(tun * UE.tn), mono: Math.max(0, md.bw), tile, tileN, tileMode,
    surge: sg, kali: Math.min(1, LOOK.sk * (.3 + sg) * cz * UE.ka), julia: Math.min(1, LOOK.sj * (.3 + sg) * cz * UE.ju), dark: md.dark, blaze: Math.max(md.blaze, hH ? ENGINE.mood.hit * hH.s * Math.exp(-(t - hH.t) / .3) * cz : 0), strobe: md.strobe, rate: md.rate, rate1: 0, sT0: 0, sD: 0, sNeg: 0, cT0: 0, cD: 0, cCol: 0, cells: cellNow, grid: cellGrid, glitch: glitchAmt(t) };
  if (UE.amp !== 1) { const f = UE.amp; for (const k of ['warp', 'kal', 'breath', 'melt', 'ab', 'pulse', 'stretch', 'tun', 'tile', 'kali', 'julia', 'pal']) P[k] *= f; P.tilt = P.tilt.map(v => v * f); P.ha *= Math.min(1, f); P.fb *= Math.min(1, f); P.srcZ = 1 + (P.srcZ - 1) * f; P.srcRot *= f; { const zr = P.zoom / USER.zoom; P.zoom = Math.pow(zr, zr < 1 ? Math.max(1, f) : f) * USER.zoom; } }   // master Effects: 0 = plain image
  if (UE.big !== 1) for (const k of ['tile', 'tun', 'glitch', 'blaze']) P[k] *= UE.big;   // T134: the big moves are smaller at calm / soft (generated, Live and Local auto; UE.big = 1 in manual / showcase); before ctrlParams, so a held G / J still works at full
  if (UE.strb !== 1) P.strobe *= UE.strb;   // strobe mood: off at calm, half at soft
  { const m = P.strobe > .001 && CL !== 2 ? moodRun(t, hk >= .5) : null; SVAR.s = m && { v: m.v, t0: m.a, D: m.b - m.a }; } SVAR.c = null;   // T161: the running mood stretch carries the strobe variant; manual (CL 2) drops the mood, so a held key draws its own; a build accent overrides it below
  if (LIVE && !SHOW && !CTRL) liveAccents(P, t, dt); else { ACC.name = ''; ACC.k = -1; }   // T157: build accents + the breakdown / calm gate on strobe and checkerboard (Live / Local); before the soft cap, so glitch and warp stay inside it at calm / soft
  if (lsOn) {   // T143: the light set. lsw 1 (calm, soft): a member is exactly its set strength and a non-member is off (the arc no longer drives Kali / Julia / kal / tiles); lsw 0 (normal): the engine value, floored at the member's strength
    const E = USER.energy, RL = (UE.rs >= .5 ? ENGINE.ramp.strong : ENGINE.ramp).lv, gate = smooth(RL[0], RL[2], cal);   // slow start: fades in from the ramp's 1st level to its 3rd
    for (let i = 0; i < 4; i++) { const f = LS_FX[i], gm = LIVE ? srcGainMul(LOC ? 'loc' : 'live', f) : 1, a = LOOK.ls[i] * lsAmt(i, lw, E, cal, gate) / gm; P[f] = lerp(Math.max(P[f], a), a, UE.lsw); }   // T150: Live / Local: srcGainApply() runs later, so the member is divided by the source gain (the set strength is what ends up in P)
  }
  if (lsOn && UE.lsw > 0) for (const f of ['warp', 'melt', 'stretch', 'fb', 'glitch']) P[f] = lerp(P[f], softCap(P[f], VIS[f][1] * UE.capK, EN.knee), UE.lsw);   // T143: calm / soft strength cap (<= light / 1.5 x light), a soft knee, surges and the arc's end included
  // arrow rotate / zoom holds (all levels, independent of control params)
  const wdt = clamp((performance.now() - CT.wall) / 1000, 0, .1); CT.wall = performance.now();   // T149: wall-clock step, because the song step dt is 0 while paused (arrows were dead then)
  CT.held.forEach(c => { if (c === 'ArrowUp') USER.zoom *= Math.exp(.7 * wdt); else if (c === 'ArrowDown') USER.zoom *= Math.exp(-.7 * wdt); else if (c === 'ArrowLeft') USER.rot -= 1.1 * wdt; else if (c === 'ArrowRight') USER.rot += 1.1 * wdt; });
  USER.zoom = clamp(USER.zoom, .25, 2.0);   // T71: zoom in capped at ×2
  // Calm master slider (T64): one final multiplier toward the neutral poster. Applied to both auto and user paths, before showcase/ctrl so their deltas sit on top of the calmed base.
  if (SHOW) showcaseParams(P, t); else if (CL) ctrlParams(P, t, dt);
  // strobe-grid launch tracking: each rising edge (0 -> on) draws a new grid size
  // the size is drawn from the song second of the launch (seeded), so a seek to the same moment gives the same grid; fades keep it
  strobeVars(P, t);   // T161 (reads cellPrev / strPrev, so before they are updated)
  if (P.cells > 0 && cellPrev <= 0) { const Ns = [3, 4, 5, 6, 7, 8, 9, 10]; cellGrid = Ns[Math.floor(seedHash(Math.floor(t), 80) * 8)]; }
  cellPrev = P.cells; strPrev = P.strobe;
  P.grid = cellGrid;
  // Calm master slider (T64): one final multiplier toward the neutral poster, after every other term (incl. user keys).
  const cf = UE.calm;
  if (cf !== 1) {    for (const k of ['warp', 'kal', 'breath', 'melt', 'ab', 'pulse', 'stretch', 'tun', 'tile', 'kali', 'julia', 'pal']) if (typeof P[k] === 'number') P[k] *= cf;
    if (typeof P.fold === 'number') P.fold = n0 + (P.fold - n0) * cf;
    if (Array.isArray(P.tilt)) P.tilt = P.tilt.map(v => v * cf);
    if (typeof P.ha === 'number') P.ha *= cf;
    if (typeof P.fb === 'number') P.fb *= cf;
    if (typeof P.fbHue === 'number') P.fbHue *= cf;
    if (typeof P.srcZ === 'number') P.srcZ = 1 + (P.srcZ - 1) * cf;
    if (typeof P.srcRot === 'number') P.srcRot *= cf;
    if (typeof P.zoom === 'number') P.zoom = USER.zoom * (1 + (P.zoom / (USER.zoom || 1) - 1) * cf);
    if (typeof P.rot === 'number') P.rot = USER.rot + (P.rot - USER.rot) * cf;
    if (typeof P.glitch === 'number') P.glitch *= cf;
  }
  P.zoom = clamp(P.zoom, .15, 2.0);   // T71: zoom in capped at ×2; zoom out down to ×.15 (the wheel / USER.zoom stays at .25)
  snapLook = false;
  lastP = P;   // for the B snapshot
  { // T114: per-source calibration of the effect amounts (SRCGAIN in 08z-effects.js); not in showcase / manual; Extreme too (T153)
    SRC_NOW = LOC ? 'loc' : LIVE ? 'live' : 'gen';
    if (!(SHOW || CTRL)) {
      srcGainApply(P, SRC_NOW);
      const sgKey = SRC_NOW + '|' + CODE.mode + '|' + HC, sgTxt = srcGainText(SRC_NOW);   // log: one line when the source starts (or the log is switched on)
      if (sgKey !== SG_LOGGED) { SG_LOGGED = sgKey; CODE.st = t; if (sgTxt) codeAdd('source gain: ' + SRC_NOW + ' ' + sgTxt, 'a', 'source gain: ' + ({ loc: 'local', live: 'live' }[SRC_NOW] || 'generated') + ' ' + sgTxt, 'srcgain'); }
    }
  }
  if (PNEUTRAL || PSETN) { if (PNEUTRAL) { pfNeutral(P); P.fbHue = (.006 + .02 * P.pal) * P.ha; P.zoom *= USER.zoom; } for (const k in PSET) P[k] = PSET[k]; }   // T144 test hook (?neutral=1&pset=): same baseline as showcaseParams, then the listed fields
  if (PLOG && t >= PLOG.nx) { PLOG.nx = t + .5; PLOG.push({ t, scene, warp: P.warp, kal: P.kal, fb: P.fb, melt: P.melt, tile: P.tile, kali: P.kali, julia: P.julia, tun: P.tun, stretch: P.stretch, zoom: P.zoom, ab: P.ab, dark: P.dark, mono: P.mono, blaze: P.blaze, strobe: P.strobe, rate: P.rate, rate1: P.rate1, sNeg: P.sNeg, cells: P.cells, cD: P.cD, cCol: P.cCol, glitch: P.glitch, st: LIVE ? LIVE.state : '', ak: ACC.name, kd: LIVE ? (LIVE.kinds[LIVE.scenes] ?? 1) : 1 }); }   // T108 (?debug=1 + silent still only): compact sample of the final P every 0.5 s of song time
  if (CL === 2 && !MAN_BASE) { MAN_BASE = cloneP(P); captureManual(P); }
  clampP(P);   // T109: the P contract (08z-effects.js), once per frame, before codeFeed and the uniforms
  const zpAct = zOn ? zoomPulseActive(t) : null;   // T141: the factor the pulse really reaches: its plateau (a + ramp) with the same ramp (rampIn / calm) and UE.big as zp above
  const zpPk = zpAct ? zpAct.a + zoomEase(zpAct)[0] : 0, zpCal = zpAct ? (isGen ? rampIn(zpPk) : calm(zpPk)) : 1;
  codeFeed(P, { zp: zpAct, zpF: zpAct ? zpMap(zpAct.f, zpCal) : 1, scene, palI: TQ.pal !== null ? TQ.pal : palIdx(scene), lead: leadTile, t, kind: kindOf(scene), ls: lsT ? lsNames(lsT) : null }, dt);
  drawFrame(P, t, dt, gi);
}

// GL part of a frame: P is final here (clampP, codeFeed done); uploads the uniforms and textures, draws pass 1 (FBO) and pass 2 (screen), flips the ping-pong.
// Also advances the image crossfade (imMix / ASPECT / MORPH.m) in the middle of pass 1, as before: imK depends on it, so it is computed here, not passed in.
function drawFrame(P, t, dt, gi) {
  // pass 1 → offscreen (with feedback from the previous frame)
  const w = cur ^ 1;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[w]); gl.viewport(0, 0, FW, FH); gl.useProgram(progS);
  if (imMix < 1) { imMix = Math.min(1, imMix + dt / MORPH.dur); MORPH.m = morphM(imMix); ASPECT = lerp(MORPH.a0, IM[imTo].aspect, MORPH.m); if (imMix >= 1) { imFrom = imTo; ASPECT = IM[imTo].aspect; } }
  if (imMix >= 1 && IM[imTo]) ASPECT = IM[imTo].aspect;
  const imK = imMix >= 1 ? 0 : MORPH.m;
  // webcam source textures: upload only the current/crossfade frames when their video frame changed
  for (let _wi = 0; _wi < IM.length; _wi++) {
    const _we = IM[_wi]; if (!_we || !_we.cam) continue;
    const _v = _we.cam; if (_v.readyState < 2 || !_v.videoWidth || !_v.videoHeight) continue;
    if (_we._w === _v.videoWidth && _we._h === _v.videoHeight && _we._t === _v.currentTime) continue;
    gl.bindTexture(gl.TEXTURE_2D, _we.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, _v); } catch (e) {}
    if (!_we._init) {
      glTexParams(gl, gl.MIRRORED_REPEAT);
      _we._init = true;
    }
    _we._w = _v.videoWidth; _we._h = _v.videoHeight; _we._t = _v.currentTime; _we.aspect = _v.videoWidth / _v.videoHeight;
  }
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, IM[imFrom].tex); gl.uniform1i(uS.uTex, 0);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, IM[imTo].tex); gl.uniform1i(uS.uTex2, 2); gl.uniform1f(uS.uImgMix, imK); morphUniforms();
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, IM[Math.min(gi.a, IM.length - 1)].tex); gl.uniform1i(uS.uGhostA, 4);
  gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, IM[Math.min(gi.b, IM.length - 1)].tex); gl.uniform1i(uS.uGhostB, 5);
  gl.uniform1f(uS.uGhostMix, gi.mix);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex[cur]); gl.uniform1i(uS.uPrev, 1);
  gl.uniform2f(uS.uRes, FW, FH); gl.uniform1f(uS.uT, t); gl.uniform1f(uS.uWarp, P.warp); gl.uniform1f(uS.uKal, P.kal); gl.uniform1f(uS.uKalN, P.fold);
  // trails would smear the tiles away, so they thin out while tiles are on
  gl.uniform1f(uS.uFb, P.fb); gl.uniform1f(uS.uFbHue, P.fbHue); gl.uniform1f(uS.uHue, P.hue); gl.uniform1f(uS.uPal, P.pal);
  gl.uniform1f(uS.uSide, P.side); gl.uniform1f(uS.uBreath, P.breath); gl.uniform1f(uS.uMelt, P.melt); gl.uniform1f(uS.uZoom, P.zoom);
  gl.uniform1f(uS.uRot, P.rot); gl.uniform1f(uS.uAber, P.ab); gl.uniform1f(uS.uPulse, P.pulse); gl.uniform1f(uS.uBright, P.bright); gl.uniform1f(uS.uAspect, ASPECT); gl.uniform1f(uS.uAnchor, P.anchor);
  const rAge = (performance.now() - USER.rip.t0) / 1000; gl.uniform4f(uS.uRip, USER.rip.x, USER.rip.y, rAge, rAge < 2.2 ? 1 : 0);
  gl.uniform2f(uS.uTilt, P.tilt[0], P.tilt[1]); gl.uniform1f(uS.uTT, BAND.tt); gl.uniform1f(uS.uSrcZ, P.srcZ); gl.uniform1f(uS.uSrcRot, P.srcRot); gl.uniform3f(uS.uPalC, ...P.palC); gl.uniform3f(uS.uPalD, ...P.palD); gl.uniform1f(uS.uHueAmt, P.ha); gl.uniform1f(uS.uStretch, P.stretch); gl.uniform1f(uS.uTunnel, P.tun);
  gl.uniform2f(uS.uCenter, USER.cx, USER.cy); gl.uniform1f(uS.uMono, P.mono);
  const fT = TQ.tile;   // test override: ?tile=<mode 0-2>,<grid N> forces the tile effect
  if (fT) { const [m, n] = fT.split(','); gl.uniform1f(uS.uTile, 1); gl.uniform1f(uS.uTileN, +n || 12); gl.uniform1f(uS.uTileMode, +m || 0); }
  else { gl.uniform1f(uS.uTile, P.tile); gl.uniform1f(uS.uTileN, P.tileN); gl.uniform1f(uS.uTileMode, P.tileMode); }
  gl.uniform1f(uS.uTileSeed, PH % 7); gl.uniform1f(uS.uTileSize, tileSizeAt(t)); gl.uniform1f(uS.uWarpN, QUAL[quality].warpN); gl.uniform1f(uS.uFx, QUAL[quality].fx);
  gl.uniform1f(uS.uKali, P.kali); gl.uniform1f(uS.uJulia, P.julia);
  { const EK = ENGINE.kali, EJ = ENGINE.julia; gl.uniform3f(uS.uKaliP, EK.zoom, EK.iter, EK.scale); gl.uniform3f(uS.uJuliaP, EJ.zoom, EJ.iter, EJ.drift); gl.uniform1f(uS.uKalZ, ENGINE.kal.zoom); }
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, CODE.tex); gl.uniform1i(uS.uCode, 3); gl.uniform1f(uS.uCodeAmt, .8 * CODE.k);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // pass 2 → screen (aberration, vignette, grain)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); gl.useProgram(progD);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex[w]); gl.uniform1i(uD.uTex, 0);
  gl.uniform2f(uD.uRes, cv.width, cv.height); gl.uniform1f(uD.uT, t); gl.uniform1f(uD.uAber, P.ab); gl.uniform1f(uD.uPulse, P.pulse); gl.uniform1f(uD.uHi, BAND.hi); gl.uniform1f(uD.uFx, QUAL[quality].fx);
  gl.uniform1f(uD.uDark, P.dark); gl.uniform1f(uD.uBlaze, P.blaze); gl.uniform1f(uD.uStrobe, P.strobe); gl.uniform1f(uD.uRate, P.rate); gl.uniform1f(uD.uCells, P.cells); gl.uniform1f(uD.uGrid, P.grid || 4);
  gl.uniform1f(uD.uNeg, P.sNeg); gl.uniform1f(uD.uPh, strobePhase(P)); gl.uniform1f(uD.uCol, P.cCol); gl.uniform1f(uD.uCacc, P.cD > 0 ? 1 : 0); gl.uniform1f(uD.uCph, cellPhase(P));
  gl.uniform1f(uD.uGlitch, P.glitch); gl.uniform1f(uD.uGSeed, PH + 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  cur = w;
}

