
'use strict';
/* ════════════════════════ config ════════════════════════
   ?min=5 sets the length (default 5 min). ?t=120 renders one silent still at 120 s (debug). */
const Q = new URLSearchParams(location.search);
const MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && matchMedia('(pointer:coarse)').matches);   // phones/tablets: lighter audio graph + render cost
const PHONE = MOBILE || (matchMedia('(pointer:coarse)').matches && innerWidth < 700);   // T34: phone = auto only, short pupitre (no level switch)
let MIN = parseFloat(Q.get('min')) || 5, TOTAL = MIN * 60;
const SHOW = Q.get('showcase') || Q.get('tune') ? { seg: Math.max(2, parseFloat(Q.get('seg')) || 30) } : null;   // ?showcase=1[&seg=<s>]: one effect at a time on a plain image (see FX)
let CL = 0, CTRL = false;   // control level (0 auto, 1 assisted, 2 manual; any music source); CTRL = manual (the old 'controlled mode'); manual keeps the chosen piece and shape (T139)
const CTRL_URL = Q.get('ctrl') !== null && Q.get('ctrl') !== '0';   // ?ctrl=1 = alias for level manual (?level=auto|assisted|manual)
// Test / forcing URL params used per frame (render, hcOn, clampP...), parsed ONCE here: no URLSearchParams lookups in the frame loop. null = param not given.
const TQ = {
  pal: Q.has('pal') ? +Q.get('pal') : null,               // ?pal=<0-5>: force the palette
  tunnel: Q.has('tunnel') ? +Q.get('tunnel') : null,      // ?tunnel=<0..1>: force the tunnel amount
  surge: Q.has('surge') ? +Q.get('surge') : null,         // ?surge=<0..1>: force the intensity surge
  stretch: Q.has('stretch') ? +Q.get('stretch') : null,   // ?stretch=<0..1>: force the stretch amount
  glitch: Q.has('glitch') ? +Q.get('glitch') : null,      // ?glitch=<0..1>: force the intro glitch amount
  svar: Q.has('svar') ? +Q.get('svar') : null,            // ?svar=<0..2>: force the strobe / checkerboard variant
  tile: Q.get('tile'),                                    // ?tile=<mode 0-2>,<grid N> (raw string): force the tile effect
  mood: Q.get('mood'),                                    // ?mood=dark|bw|blaze|strobe (raw string): force a mood
  hc: Q.get('hc') === '1',                                // ?hc=1: Extreme on
  debug: Q.has('debug'),                                  // ?debug=1: __pic, __plog, P range warnings
};
// The Help "URL parameters" list: [label, example query (opens in a new tab), what]. Every TQ key is here; the other test params too.
const TQ_HELP = [
  ['?debug=1', 'debug=1', '__pic(t), __plog, P range warnings'],
  ['?t=120', 't=120&res=.3&step=.5', 'silent still at song time 120 s (&res= &step=)'],
  ['?seed=3', 'seed=3', 'fixed random seed'],
  ['?energy=0..4', 'energy=2', 'calm ... extreme'],
  ['?hc=1', 'hc=1', 'Extreme (Energy 4)'],
  ['?quality=', 'quality=low', 'high | medium | low'],
  ['?level=', 'level=1', '0 auto | 1 assisted | 2 manual'],
  ['?music=', 'music=ambient', 'ambient, piano pieces, synth styles'],
  ['?root=', 'root=50', 'MIDI root note of the generated music'],
  ['?spal=', 'spal=0', 'force a sound palette (index)'],
  ['?mood=', 'mood=strobe', 'dark | bw | blaze | strobe'],
  ['?surge=0..1', 'surge=1', 'force an intensity surge'],
  ['?stretch=0..1', 'stretch=1', 'force the stretch amount'],
  ['?tunnel=0..1', 'tunnel=1', 'force the tunnel'],
  ['?glitch=0..1', 'glitch=1', 'force the intro glitch amount'],
  ['?svar=0..2', 'svar=1', 'force the strobe / checkerboard variant'],
  ['?tile=m,N', 'tile=1,8', 'force the tile effect (mode 0-2, grid N)'],
  ['?style=', 'style=kali', 'kali | julia | auto'],
  ['?pal=0..5', 'pal=0', 'force a palette'],
  ['?hue=', 'hue=random', 'start hue (a number, or random)'],
  ['?theme=', 'theme=geek', 'force the UI theme (modern | classic | geek)'],
  ['?morph=0|1', 'morph=0', 'image change: plain crossfade | morph'],
  ['?code=0..3', 'code=1', 'live-coding log: off, log, overlay, crazy'],
  ['?homeseed=', 'homeseed=3', 'fixed seed of the home logo (with &hometime=<s>)'],
  ['?neutral=1&pset=', 'debug=1&neutral=1&pset=warp:.5', 'plain image + set P fields (warp:.5,...)'],
  ['?engine=<json>', 'engine=%7B%7D', 'deep-merge ENGINE bounds'],
];
const cv = document.getElementById('c'), gate = document.getElementById('gate'), hint = document.getElementById('hint');
const gl = cv.getContext('webgl2', { antialias: false, alpha: false });
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
// T189: memo(slot, deps, build) = the cached result of build() for these deps; rebuilt when any dep differs (===) from the last call. slot = a {} that holds the cache (one per cache / key).
function memo(slot, deps, build) { const d = slot.d; if (!d || d.length !== deps.length || deps.some((x, i) => x !== d[i])) { slot.v = build(); slot.d = deps; } return slot.v; }
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
// localStorage: every key is 'bicycleday.<k>', value = JSON. lsGet returns null when missing or broken.
const lsGet = k => { try { return JSON.parse(localStorage.getItem('bicycleday.' + k)); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem('bicycleday.' + k, JSON.stringify(v)); } catch (e) {} };
const lsDel = k => { try { localStorage.removeItem('bicycleday.' + k); } catch (e) {} };
function b64urlEncode(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlDecode(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
