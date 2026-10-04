// Replay a spectrogram (from tools/spectro.py) through the app's REAL liveStep() and print the timeline.
// usage: node tools/replay.mjs out_prefix   -> writes <out>.replay.json, prints states / scene changes
import fs from 'node:fs';
const prefix = process.argv[2], html = fs.readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const grab = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error('cannot find ' + a); return html.slice(i, j); };
const NB = 330, FPS = 60, SR = 44100;
const buf = fs.readFileSync(prefix + '.spec.bin'), spec = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4), nf = spec.length / NB;
const src = `const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), lerp=(a,b,t)=>a+(b-a)*t;
let LIVE=null, LF=new Float32Array(1024).fill(-200), LB=null, cur=0;
const analyser={getFloatFrequencyData:a=>a.set(SPEC.subarray(cur*NB,cur*NB+NB))};
${grab('const bandsFor', 'async function startLive')}
${grab('function liveStep', 'function liveLoop')}
const k=SR/2048; LB=bandsFor(k);
LIVE=newLive();
const rows=[]; let lastScene=0, lastMinor=0, events=[], minors=[];
for(cur=0; cur<${nf}; cur++){ liveStep(1/${FPS});
  if(LIVE.scenes!==lastScene){ lastScene=LIVE.scenes; events.push({t:+(cur/${FPS}).toFixed(1), scene:LIVE.scenes, kind:LIVE.kinds[LIVE.scenes]}); }
  if(LIVE.minors!==lastMinor){ lastMinor=LIVE.minors; minors.push(+(cur/${FPS}).toFixed(1)); }
  if(cur%${FPS}===0) rows.push({t:cur/${FPS}, dp:+(LIVE.dprof||0).toFixed(2), gap:+(Math.abs(LIVE.sf[0]-LIVE.ss[0])+Math.abs(LIVE.sf[1]-LIVE.ss[1])+.5*Math.abs(LIVE.sf[2]-LIVE.ss[2])).toFixed(2), lv:+LIVE.lv.toFixed(2), bn:+LIVE.bn.toFixed(2), state:LIVE.state, scene:LIVE.scenes, I:+LIVE.I.toFixed(2)}); }
return {rows, events, minors};`;
const res = new Function('SPEC', 'NB', 'SR', src)(spec, NB, SR);
fs.writeFileSync(prefix + '.replay.json', JSON.stringify(res));
const runs = []; for (const r of res.rows) { const l = runs[runs.length - 1]; if (l && l.state === r.state) l.end = r.t; else runs.push({ state: r.state, start: r.t, end: r.t }); }
console.log('scene changes:', res.events.map(e => `${e.t}s(${e.kind ? 'energetic' : 'calm'})`).join(' '));
console.log('minor changes:', res.minors.join(' '));
console.log('state runs   :', runs.map(r => `${r.state}@${r.start}-${r.end}`).join(' '));
console.log('per minute   : scenes', (res.events.length / (nf / FPS / 60)).toFixed(1), ' state changes', (runs.length / (nf / FPS / 60)).toFixed(1));
