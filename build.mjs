// Builds dist/bicycle-day.html: src/index.html + src/js/*.js (via tools/assemble.mjs) with the logo (home screen + default picture) and the image gallery inlined as data URIs.
// (The images must be inlined: WebGL refuses to use an image loaded from file:// as a texture.)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { appHtml } from './tools/assemble.mjs';

// gallery manifest: [file in assets/gallery/, title shown in the app]; order = order in the app
const GALLERY = [
  ['poster.jpg', 'Bicycle Day poster (1943)'],
  ['manet-dejeuner-sur-lherbe.jpg', 'Manet · Le Déjeuner sur l\'herbe'],
  ['bosch-garden-of-earthly-delights.jpg', 'Bosch · Garden of Earthly Delights'],
  ['huys-temptation-of-saint-anthony.jpg', 'Huys · Temptation of Saint Anthony'],
  ['bruegel-fall-of-the-rebel-angels.jpg', 'Bruegel · Fall of the Rebel Angels'],
  ['hirschl-souls-at-the-acheron.jpg', 'Hirschl · Souls at the Acheron'],
];
const gallery = GALLERY.map(([file, title]) => {
  let bytes;
  try { bytes = readFileSync(`assets/gallery/${file}`); }
  catch { throw new Error(`build: gallery file missing: assets/gallery/${file} (listed in GALLERY in build.mjs)`); }
  return { id: file.replace(/\.jpg$/, ''), title, src: `data:image/jpeg;base64,${bytes.toString('base64')}` };
});

const html = appHtml();
const homeLogo = readFileSync('assets/bicycle-day-logo-home.webp').toString('base64');
if (!html.includes('__HOME_LOGO__')) throw new Error('src/index.html has no __HOME_LOGO__ placeholder');
if (!html.includes('__GALLERY__')) throw new Error('src/index.html has no __GALLERY__ placeholder');
const out = html
  .replaceAll('__HOME_LOGO__', `data:image/webp;base64,${homeLogo}`)
  .replaceAll('__GALLERY__', () => JSON.stringify(gallery));

// syntax-check every inline script so a typo fails the build instead of the browser
for (const m of out.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(m[1], { filename: 'inline-script' });

mkdirSync('dist', { recursive: true });
writeFileSync('dist/bicycle-day.html', out);
console.log(`dist/bicycle-day.html  ${(out.length / 1024).toFixed(0)} KB`);

// T112: dist/bicycle-day-doc.html = src/doc.html with the effect tables cut verbatim out of the app sources (no copy by hand).
// PF, ENGINE, EFFECTS, FX are pure data (FX set() bodies only touch PALS when called), TUNE_G is the FX -> ENGINE group rule of the tuning panel.
const cut = (src, start, end, what) => {
  const i = src.indexOf(start); if (i < 0) throw new Error(`doc build: "${start}" not found (${what})`);
  const j = end === '\n' ? src.indexOf('\n', i) : src.indexOf(end, i); if (j < 0) throw new Error(`doc build: end of ${what} not found`);
  return src.slice(i, j + (end === '\n' ? 0 : end.length));
};
const eff = readFileSync('src/js/08z-effects.js', 'utf8'), fxs = readFileSync('src/js/09-fx.js', 'utf8');
const arcs = readFileSync('src/js/03-arcs.js', 'utf8'), dir = readFileSync('src/js/08-director.js', 'utf8');
// Doc stamp: date + short hash of the last commit that touched the app sources (so dist/ only changes when the sources do).
const sh = (c) => { try { return execSync(c, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const stamp = sh('git log -1 --format=%cs -- src build.mjs tools') + ' · ' + sh('git log -1 --format=%h -- src build.mjs tools');
const docData = [cut(arcs, 'const STYLES = {', '\n', 'STYLES'), cut(arcs, 'const MUSICS = [', '\n', 'MUSICS'), cut(dir, 'const EN = {', '\n', 'EN'), cut(eff, 'const PF = {', '\n};', 'PF'), cut(eff, 'const ENGINE = {', '\n};', 'ENGINE'), cut(eff, 'const EFFECTS = [', '\n];', 'EFFECTS'), cut(fxs, 'const FX = [', '\n];', 'FX'), cut(fxs, 'const TUNE_G = ', '\n', 'TUNE_G')].join('\n');
const doc = readFileSync('src/doc.html', 'utf8').replace('__DOC_DATA__', () => docData).replace('__DOC_STAMP__', stamp);
for (const m of doc.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(m[1], { filename: 'doc-inline-script' });
writeFileSync('dist/bicycle-day-doc.html', doc);
console.log(`dist/bicycle-day-doc.html  ${(doc.length / 1024).toFixed(0)} KB`);
