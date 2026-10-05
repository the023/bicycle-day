// Shared by replay.mjs / sweep.mjs: run a spectrogram through the app's REAL liveStep(), and score the result against tools/refs.json
import fs from 'node:fs';
const html = fs.readFileSync(process.env.APP_HTML || new URL('../src/index.html', import.meta.url), 'utf8');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('cannot find ' + a); return html.slice(i, j); };
export const NB = 330, FPS = 60, SR = 44100;
const body = `const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t;
let LIVE=null, LF=new Float32Array(1024).fill(-200), LB=null, cur=0;
const analyser={getFloatFrequencyData:a=>a.set(SPEC.subarray(cur*NB,cur*NB+NB))};
${grab('const bandsFor', 'async function startLive')}
${grab('function liveStep', 'function liveLoop')}
const k=SR/2048; LB=bandsFor(k);
LIVE=newLive();
const rows=[]; let lastScene=0, lastMinor=0, events=[], minors=[];
for(cur=0; cur<NF; cur++){ liveStep(1/${FPS});
  if(LIVE.scenes!==lastScene){ lastScene=LIVE.scenes; events.push({t:+(cur/${FPS}).toFixed(1), scene:LIVE.scenes, kind:LIVE.kinds[LIVE.scenes]}); }
  if(LIVE.minors!==lastMinor){ lastMinor=LIVE.minors; minors.push(+(cur/${FPS}).toFixed(1)); }
  if(cur%${FPS}===0) rows.push({t:cur/${FPS}, dp:+(LIVE.dprof||0).toFixed(2), gap:+(Math.abs(LIVE.sf[0]-LIVE.ss[0])+Math.abs(LIVE.sf[1]-LIVE.ss[1])+.5*Math.abs(LIVE.sf[2]-LIVE.ss[2])).toFixed(2), lv:+LIVE.lv.toFixed(2), bn:+LIVE.bn.toFixed(2), state:LIVE.state, scene:LIVE.scenes, I:+LIVE.I.toFixed(2)}); }
return {rows, events, minors};`;
const detLine = grab('const DET = ', '\n');
export const DET0 = new Function('return ' + detLine.slice('const DET = '.length).replace(/;\s*$/, ''))();
const cache = {};
export function spec(prefix) { if (!cache[prefix]) { const b = fs.readFileSync(prefix + '.spec.bin'); cache[prefix] = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); } return cache[prefix]; }
export function replayTrack(prefix, det = {}) {
  const sp = spec(prefix), nf = sp.length / NB;
  const code = body.replace(/const DET = \{[^\n]*\};/, 'const DET = ' + JSON.stringify({ ...DET0, ...det }) + ';');
  return new Function('SPEC', 'NB', 'SR', 'NF', code)(sp, NB, SR, nf);
}
const refs = JSON.parse(fs.readFileSync(new URL('./refs.json', import.meta.url), 'utf8'));
export const trackNames = Object.keys(refs).filter(k => !k.startsWith('_'));
const LO = 3, HI = 4;   // an event counts for a reference at r if r-3 <= t <= r+4
export function score(results, verbose = false) {
  const T = { big: 0, bigHit: 0, small: 0, smallHit: 0, fs: 0, fm: 0, delay: [] };
  for (const name of trackNames) {
    const r = refs[name], rep = results[name], sc = rep.events.map(e => e.t), mi = rep.minors, w = r.weight ?? 1;
    const near = (t, l) => l.some(x => x - LO <= t && t <= x + HI), ign = r.ignore || [-1, -1];
    const big = (r.big || []).map(b => [b, sc.find(t => b - LO <= t && t <= b + HI)]);
    const small = (r.small || []).map(s => [s, [...sc, ...mi].find(t => s - LO <= t && t <= s + HI)]);
    const all = [...(r.big || []), ...(r.small || []), ...(r.weak || [])], out = t => !(ign[0] <= t && t <= ign[1]);
    const fs_ = sc.filter(t => !near(t, all) && out(t)), fm_ = mi.filter(t => !near(t, all) && out(t));
    T.big += w * big.length; T.bigHit += w * big.filter(x => x[1] !== undefined).length; T.small += w * small.length; T.smallHit += w * small.filter(x => x[1] !== undefined).length;
    T.fs += w * fs_.length; T.fm += w * fm_.length; big.forEach(([b, h]) => h !== undefined && T.delay.push(h - b));
    if (verbose) console.log(`${name.padEnd(12)} big ${big.filter(x => x[1] !== undefined).length}/${big.length} ${big.map(([b, h]) => b + '->' + (h === undefined ? '-' : (h - b).toFixed(1))).join(' ')} | small ${small.filter(x => x[1] !== undefined).length}/${small.length} | false scenes [${fs_}] minors [${fm_}]`);
  }
  const dl = T.delay.reduce((a, b) => a + b, 0) / Math.max(1, T.delay.length);
  T.obj = 3 * T.bigHit + T.smallHit - 2 * T.fs - .4 * T.fm - .15 * dl;
  if (verbose) console.log(`TOTAL big ${T.bigHit.toFixed(1)}/${T.big.toFixed(1)}  small ${T.smallHit.toFixed(1)}/${T.small.toFixed(1)}  false scenes ${T.fs.toFixed(1)}  false minors ${T.fm.toFixed(1)}  mean delay ${dl.toFixed(1)}s  objective ${T.obj.toFixed(1)}`);
  return T;
}
export const replayAll = (dir, det) => Object.fromEntries(trackNames.map(n => [n, replayTrack(`${dir}/${n}`, det)]));
