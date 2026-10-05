// usage: node tools/replay.mjs [analysis_dir] [track]
// Replays every track through the app's real liveStep(), prints scene / minor events and the score vs tools/refs.json.
import fs from 'node:fs';
import { replayAll, score, trackNames } from './lib.mjs';
const dir = process.argv[2] || 'mp3sources/analysis', only = process.argv[3];
const res = replayAll(dir);
for (const n of trackNames) {
  fs.writeFileSync(`${dir}/${n}.replay.json`, JSON.stringify(res[n]));
  if (only && only !== n) continue;
  const r = res[n], runs = [];
  for (const x of r.rows) { const l = runs[runs.length - 1]; if (l && l.state === x.state) l.end = x.t; else runs.push({ state: x.state, start: x.t, end: x.t }); }
  console.log(`== ${n}\n scenes : ${r.events.map(e => `${e.t}(${e.kind ? 'E' : 'c'})`).join(' ')}\n minors : ${r.minors.join(' ')}\n states : ${runs.map(x => `${x.state}@${x.start}-${x.end}`).join(' ')}`);
}
score(res, true);
