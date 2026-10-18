// Assembles the app page: src/index.html with its single <script> filled from src/js/*.js (sorted by name, plain concatenation).
// Does NOT inline images (build.mjs does). Stays ONE <script> block.
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('../', import.meta.url);
export function appHtml() {
  const html = readFileSync(new URL('src/index.html', root), 'utf8');
  const js = readdirSync(new URL('src/js/', root)).filter(f => f.endsWith('.js')).sort()
    .map(f => readFileSync(new URL('src/js/' + f, root), 'utf8')).join('');
  if (!html.includes('__APP_JS__')) throw new Error('src/index.html has no __APP_JS__ placeholder');
  return html.replace('__APP_JS__', () => js);
}
