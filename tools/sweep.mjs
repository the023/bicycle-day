// Coordinate descent over the detector settings (DET in src/index.html) to maximise the score on tools/refs.json.
// usage: node tools/sweep.mjs [analysis_dir]   -> prints the best DET; paste it into src/index.html
import { replayAll, score, DET0 } from './lib.mjs';
const dir = process.argv[2] || 'mp3sources/analysis';
const steps = { sfTau: [1, 1.5, 2, 3], ssTau: [5, 8, 12, 16], gapThr: [.1, .12, .14, .16, .2, .24], gapDur: [.6, 1, 1.5, 2.2], dwell: [4, 6, 8, 12], dropGap: [1.5, 2.5, 4], dropDwell: [8, 12, 18, 25], slamBass: [.2, .3, .4], slamLv: [.03, .05, .1, .15], minFloor: [.8, 1.2, 1.6], minK: [1.2, 1.4, 1.6, 2, 2.4], minDur: [.5, 1, 1.5], minDwell: [8, 12, 16], dropMinGap: [0, .04, .08, .12], dropMinProf: [0, 1.5, 2.5, 99], bigFloor: [99, 2.5, 3.5, 5], bigK: [2.5, 3, 4], bigDur: [.5, 1, 1.5] };
let best = { ...DET0 }, bestS = score(replayAll(dir, best)).obj;
console.log('start', bestS.toFixed(1));
for (let pass = 0; pass < 3; pass++) {
  let improved = false;
  for (const k of Object.keys(steps)) for (const v of steps[k]) {
    if (v === best[k]) continue;
    const t = { ...best, [k]: v }, s = score(replayAll(dir, t)).obj;
    if (s > bestS + 1e-6) { best = t; bestS = s; improved = true; console.log(`pass ${pass} ${k}=${v} -> ${s.toFixed(1)}`); }
  }
  if (!improved) break;
}
console.log('BEST', JSON.stringify(best));
score(replayAll(dir, best), true);
