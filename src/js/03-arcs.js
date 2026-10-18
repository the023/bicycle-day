/* ════════════════════════ ARCS: the sequential part ("score") ════════════════════════
   Each row = [position 0..1, [warp, kaleidoscope, folds, feedback, hue speed, palette, side-dark, breath, melt, zoom, aberration, brightness]]
   Values are interpolated between rows. marks = where the sound places its riser / impact / exhale. */
const ARCS = {
  journey: { marks: { riser: [.72, .88], hit: .88, exhale: .95 }, keys: [
    [0,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],   // black
    [.05, [0,  0,  6, 0,   0,   0,   1,  .2, 0,  0,  0,  1]],   // the image appears
    [.15, [.15,0,  6, .1,  .02, 0,   .9, 1,  0,  .2, .1, 1]],   // it starts to breathe
    [.30, [.6, 0,  6, .45, .08, .15, .5, 1,  .2, .4, .3, 1]],   // ripples, trails
    [.45, [.8, .5, 6, .7,  .15, .3,  0,  1,  .3, .6, .4, 1]],   // frame dissolves, kaleidoscope enters
    [.60, [1,  1,  8, .8,  .25, .5,  0,  1,  .5, .8, .6, 1]],   // full kaleidoscope
    [.75, [1.3,.7, 10,.9,  .35, .8,  0,  1,  1,  1,  .9, 1]],   // melting
    [.88, [2,  .4, 12,.94, .5,  1,   0,  1,  1,  1.2,1,  1]],   // dissolve into colour
    [.95, [.2, 0,  6, .3,  .05, 0,   .9, 1,  0,  .2, .2, 1]],   // return
    [1,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],   // black
  ] },
  waves: { marks: { riser: [.55, .72], hit: .72, exhale: .88 }, keys: [   // two swells: a medium one, then a bigger one
    [0,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],
    [.04, [0,  0,  6, 0,   0,   0,   1,  .2, 0,  0,  0,  1]],
    [.12, [.2, 0,  6, .15, .02, 0,   .8, 1,  0,  .2, .1, 1]],
    [.28, [.9, .6, 8, .75, .2,  .4,  0,  1,  .4, .7, .5, 1]],
    [.42, [.15,0,  6, .1,  .02, 0,   .9, 1,  0,  .2, .1, 1]],
    [.55, [.7, .3, 6, .5,  .12, .2,  .3, 1,  .3, .5, .3, 1]],
    [.72, [1.6,1,  12,.92, .45, 1,   0,  1,  1,  1.2,1,  1]],
    [.88, [.3, 0,  6, .3,  .05, .1,  .7, 1,  0,  .3, .2, 1]],
    [.95, [0,  0,  6, 0,   0,   0,   1,  .5, 0,  0,  0,  1]],
    [1,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],
  ] },
  slam: { marks: { riser: [.55, .781], hit: .781, exhale: .79 }, keys: [  // slow build, then a hard cut back to the still image
    [0,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],
    [.05, [0,  0,  6, 0,   0,   0,   1,  .2, 0,  0,  0,  1]],
    [.30, [.5, 0,  6, .4,  .1,  .1,  .6, 1,  .1, .4, .2, 1]],
    [.60, [1,  .6, 8, .8,  .25, .5,  0,  1,  .5, .8, .6, 1]],
    [.78, [2,  1,  12,.95, .55, 1,   0,  1,  1,  1.3,1,  1]],
    [.783,[0,  0,  6, 0,   0,   0,   1,  1,  0,  0,  0,  1]],
    [.95, [0,  0,  6, 0,   0,   0,   1,  1,  0,  0,  0,  1]],
    [1,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],
  ] },
  extreme: { bpm: [172, 190], drive: 2, kalMax: 1, marks: { riser: [.8, .86], hit: .86, exhale: .95 }, keys: [   // relentless from the first seconds, no calm: hard distorted kick on every beat (a short fade-in from black is done in render())
    [0,   [1,  .6, 10,.7,  .6,  .6,  0,  1,  .6, 1,  .8, 1]],
    [.04, [1.8,1,  14,.8,  .85, 1,   0,  1,  1,  1.4,1.2,1]],
    [.50, [2.2,1,  16,.87, 1,   1,   0,  1,  1,  1.6,1.6,1]],
    [.90, [2.4,1,  16,.9,  1,   1,   0,  1,  1,  1.7,1.8,1]],
    [.96, [1.2,.6, 10,.5,  .4,  .5,  0,  1,  .4, .8, .8, 1]],
    [1,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],
  ] },
  intense: { bpm: [84, 150], drive: 1, kalMax: .85, marks: { riser: [.18, .25], hit: .25, exhale: .93 }, keys: [   // short calm, fast climb, long relentless plateau (adds a kick + hats)
    [0,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],
    [.03, [0,  0,  6, 0,   0,   0,   1,  .3, 0,  0,  0,  1]],
    [.10, [.5, .2, 8, .5,  .15, .2,  .4, 1,  .2, .5, .3, 1]],
    [.25, [1,  .8, 10,.75, .35, .6,  0,  1,  .6, .9, .7, 1]],
    [.45, [1.6,1,  12,.8,  .6,  .9,  0,  1,  1,  1.2,1,  1]],
    [.70, [2,  1,  14,.85, .8,  1,   0,  1,  1,  1.4,1.3,1]],
    [.88, [2.2,1,  16,.87, .9,  1,   0,  1,  1,  1.5,1.5,1]],
    [.93, [.4, .3, 6, .4,  .1,  .2,  .5, 1,  .1, .3, .3, 1]],
    [.97, [0,  0,  6, 0,   0,   0,   1,  .5, 0,  0,  0,  1]],
    [1,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],
  ] },
  piano: { piano: 1, marks: { riser: [.8, .9], hit: .9, exhale: .95 }, keys: [   // Satie: slow build, low peak, long floating middle (no one-off gestures, no heartbeat)
    [0,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],
    [.05, [0,  0,  6, 0,   0,   0,   1,  .2, 0,  0,  0,  1]],
    [.20, [.15,0,  6, .15, .02, 0,   .8, 1,  0,  .15,.05,1]],
    [.40, [.4, .1, 6, .45, .05, .1,  .4, 1,  .1, .3, .12,1]],
    [.55, [.5, .25,6, .55, .07, .2,  .2, 1,  .15,.35,.15,1]],
    [.80, [.4, .15,6, .5,  .05, .15, .3, 1,  .1, .3, .1, 1]],
    [.93, [.1, 0,  6, .15, .02, 0,   .8, 1,  0,  .1, .05,1]],
    [.97, [0,  0,  6, 0,   0,   0,   1,  .5, 0,  0,  0,  1]],
    [1,   [0,  0,  6, 0,   0,   0,   1,  0,  0,  0,  0,  0]],
  ] },
};
let lastP = null, snapWant = false;
let MAN_BASE = null;   // frozen manual look copied from the previous frame when switching to manual
function cloneP(p) { if (!p) return null; const o = { ...p }; if (Array.isArray(o.tilt)) o.tilt = o.tilt.slice(); if (Array.isArray(o.palC)) o.palC = o.palC.slice(); if (Array.isArray(o.palD)) o.palD = o.palD.slice(); return o; }
function captureManual(p) { if (!p) return; CT.c = (p.palC || CT.c).slice(); CT.d = (p.palD || CT.d).slice(); CT.ha = p.ha ?? CT.ha; }   // sliders are NOT touched: same values in assisted and manual (the yellow bars)
const ARCQ = Q.get('arc') === 'hardcore' ? 'extreme' : Q.get('arc');   // old links with arc=hardcore keep working
let PKEY = [];   // T102: piano key/section/bridge change times (song time), filled by pianoScore*() for buildAudio's phrase events (data only)
let arcName = ARCS[ARCQ] ? ARCQ : 'journey', ARC, KEYS, EMAX = 1, BEATS = [], PH = 0, NOTES = [], MEL = [];
// music styles. ambient = the original engine (arc drives it, incl. bpm/drive); gnossienne/gymnopedie = piano (swap in the calm 'piano' arc); the others are standalone generators
// that read energy(u) of the chosen arc but carry their own sections/tempo. bpm = tempo range (energy 0..1) used for BEATS (the picture's pulse); nohb = no heartbeat pulse on the picture.
const STYLES = { electro: { bpm: [100, 138] }, chiptune: { bpm: [126, 164] }, chiptune2: { bpm: [118, 152] }, drone: { bpm: [60, 80], nohb: 1 }, gamelan: { bpm: [60, 96], nohb: 1 }, minimal: { bpm: [100, 132], nohb: 1 }, berlin: { bpm: [112, 128], nohb: 1 }, lofi: { bpm: [70, 90], nohb: 1 } };   // berlin: one constant tempo per piece, its buildAudio re-lays BEATS on it
const MUSICS = ['ambient', 'gnossienne', 'gnossienne3', 'tempest', 'gymnopedie', ...Object.keys(STYLES)];
let MUSIC = MUSICS.includes(Q.get('music')) ? Q.get('music') : (() => { try { const m = JSON.parse(localStorage.getItem('bicycleday.music')); return MUSICS.includes(m) ? m : 'ambient'; } catch (e) { return 'ambient'; } })();
function score(u) {
  let i = 0; while (i < KEYS.length - 2 && u > KEYS[i + 1][0]) i++;
  const [u0, a] = KEYS[i], [u1, b] = KEYS[i + 1], k = smooth(u0, u1, u);
  return a.map((x, j) => x + (b[j] - x) * k);
}
const wob = (t, s) => Math.sin(t * .13 * s + s + PH * s) * .5 + Math.sin(t * .071 * s * 1.7 + 2 * s + PH * (s + 1)) * .3 + Math.sin(t * .037 * s * 2.3 + PH) * .2;
// "energy" = how intense the arc is right now (0..1). Heartbeat tempo, drone brightness, arpeggios and bells all follow it.
const energyRaw = u => { const e = score(u); return (e[0] / 2 + e[1] + e[5] + e[8] + e[9] / 1.2) / 5; };
const energy = u => clamp(energyRaw(u) / EMAX);
const bpmAt = u => { const [a, b] = Q.get('bpm') ? [BPM0, BPM1] : (STYLES[MUSIC]?.bpm || ARC.bpm || [BPM0, BPM1]); return lerp(a, b, energy(u)); };
const hbW = u => ARC.piano || STYLES[MUSIC]?.nohb ? 0 : smooth(.05, .2, u) * (1 - smooth(.93, .97, u));
function setArc(name, pi) {   // arcName = the user's chosen arc; a piano music choice swaps in the calm 'piano' arc (pi)
  ARC = ARCS[pi && (MUSIC === 'gnossienne' || MUSIC === 'gnossienne3' || MUSIC === 'tempest' || MUSIC === 'gymnopedie') ? 'piano' : name]; KEYS = ARC.keys; EMAX = 1;
  let m = 0; for (let i = 0; i <= 200; i++) m = Math.max(m, energyRaw(i / 200)); EMAX = m || 1;
  BEATS = []; for (let s = TOTAL * .06; s < TOTAL * .97; s += 60 / bpmAt(s / TOTAL)) BEATS.push(s);   // heartbeat times, shared by sound and picture
}
const applyArc = () => setArc(arcName, 1);
applyArc();

