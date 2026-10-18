
'use strict';
/* ════════════════════════ config ════════════════════════
   ?min=5 sets the length (default 5 min). ?t=120 renders one silent still at 120 s (debug). */
const Q = new URLSearchParams(location.search);
const MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && matchMedia('(pointer:coarse)').matches);   // phones/tablets: lighter audio graph + render cost
const PHONE = MOBILE || (matchMedia('(pointer:coarse)').matches && innerWidth < 700);   // T34: phone = auto only, short pupitre (no level switch)
let MIN = parseFloat(Q.get('min')) || 5, TOTAL = MIN * 60;
const SHOW = Q.get('showcase') || Q.get('tune') ? { seg: Math.max(2, parseFloat(Q.get('seg')) || 30) } : null;   // ?showcase=1[&seg=<s>]: one effect at a time on a plain image (see FX)
let CL = 0, CTRL = false, ARCSWAP = false;   // control level (0 auto, 1 assisted, 2 manual; any music source); CTRL = manual (the old 'controlled mode'); ARCSWAP = generated music runs the 20 min 'waves' base (see CT)
const CTRL_URL = Q.get('ctrl') !== null && Q.get('ctrl') !== '0';   // ?ctrl=1 = alias for level manual (?level=auto|assisted|manual)
const cv = document.getElementById('c'), gate = document.getElementById('gate'), hint = document.getElementById('hint');
const gl = cv.getContext('webgl2', { antialias: false, alpha: false });
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
function b64urlEncode(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlDecode(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
