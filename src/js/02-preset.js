/* ════════════════════════ PRESET: everything that gives a piece its character ════════════════════════
   Generic parts: the engine (shaders + synth) and the energy "arc". Swappable parts: image, arc, scale, root, tempo, colour, seed.
   URL: ?arc=journey|waves|slam  ?scale=dorian|lydian|phrygian|minor  ?root=50 (midi note)  ?bpm=52-118
        ?seed=7 (same seed = same piece; omit = new each play)  ?hue=random|<radians>  ?min=5   — and drop any image on the page. */
const SCALES = { dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10], minor: [0, 2, 3, 5, 7, 8, 10] };
const SCALE = SCALES[Q.get('scale')] || SCALES.dorian, ROOT = parseInt(Q.get('root')) || 50;
const [BPM0, BPM1] = (Q.get('bpm') || '52-118').split('-').map(Number);
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

