// Builds dist/bicycle-day.html: src/index.html with the logo (home screen + default picture) and the image gallery inlined as data URIs.
// (The images must be inlined: WebGL refuses to use an image loaded from file:// as a texture.)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

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

const html = readFileSync('src/index.html', 'utf8');
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
