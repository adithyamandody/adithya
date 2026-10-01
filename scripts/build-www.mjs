/* Copy only the web assets into www/ for Capacitor.
   app/ also holds PLAN.md, FINDINGS.md, test/, firmware/ and server/, none of
   which belong inside an APK. */
import { mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SRC = 'app', OUT = 'www';
const ASSETS = [
  'index.html', 'app.js', 'scan.js', 'style.css', 'manifest.json', 'icon.svg', 'sw.js',
  'data/units.json', 'data/bigrams.json', 'data/legal.json',
  'data/gridA.json', 'data/meta.json',
];

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
for (const f of ASSETS) {
  const dst = join(OUT, f);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(join(SRC, f), dst);
}
console.log(`www/: ${ASSETS.length} files`);
