/* Copy only the web assets into www/ for Capacitor.
   app/ also holds PLAN.md, FINDINGS.md, test/, firmware/ and server/, none of
   which belong inside an APK. */
import { mkdirSync, copyFileSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
/* Stamp the service-worker cache name with a hash of the assets. Without this
   sw.js is byte-identical on every deploy, the browser never re-runs install,
   and devices keep serving the first version they ever loaded. */
const hash = createHash('sha256');
for (const f of ASSETS) hash.update(readFileSync(join(OUT, f)));
const build = 'aksharascan-' + hash.digest('hex').slice(0, 10);

const sw = join(OUT, 'sw.js');
writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD__', build));

console.log(`www/: ${ASSETS.length} files`);
console.log(`cache: ${build}`);
