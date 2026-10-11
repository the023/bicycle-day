// Builds dist/bicycle-day.html: src/index.html with its image assets inlined as data URIs.
// (The poster must be inlined: WebGL refuses to use an image loaded from file:// as a texture.)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('src/index.html', 'utf8');
const poster = readFileSync('assets/poster.jpg').toString('base64');
const homeLogo = readFileSync('assets/bicycle-day-logo-combined-soft-v6.png').toString('base64');
if (!html.includes('__POSTER__')) throw new Error('src/index.html has no __POSTER__ placeholder');
if (!html.includes('__HOME_LOGO__')) throw new Error('src/index.html has no __HOME_LOGO__ placeholder');
const out = html
  .replace('__POSTER__', `data:image/jpeg;base64,${poster}`)
  .replace('__HOME_LOGO__', `data:image/png;base64,${homeLogo}`);

// syntax-check every inline script so a typo fails the build instead of the browser
for (const m of out.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(m[1], { filename: 'inline-script' });

mkdirSync('dist', { recursive: true });
writeFileSync('dist/bicycle-day.html', out);
console.log(`dist/bicycle-day.html  ${(out.length / 1024).toFixed(0)} KB`);
