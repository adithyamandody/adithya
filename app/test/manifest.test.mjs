/* The three file lists must agree.  node app/test/manifest.test.mjs
 *
 * A new module has to be added by hand in three places: the import in app.js,
 * ASSETS in sw.js (or it is missing offline), and ASSETS in scripts/
 * build-www.mjs (or it is missing from the deploy entirely, which 404s the
 * import and takes the whole app down). Adding clock.js caught both omissions
 * in one afternoon, the second one only because the build output happened to
 * get listed before pushing.
 *
 * Hand-synchronised lists in three files is the actual defect. Until there is
 * a bundler, this test is the thing that notices.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const repo = join(appDir, '..');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};

console.log('\nthe file manifests agree\n');

/** Pull the first `const ASSETS = [ ... ]` array literal out of a source file. */
function assetsOf(file) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/const ASSETS\s*=\s*\[([\s\S]*?)\]/);
  if (!m) throw new Error(`no ASSETS array found in ${file}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

const swAssets    = assetsOf(join(appDir, 'sw.js'));
const buildAssets = assetsOf(join(repo, 'scripts', 'build-www.mjs'));

/** Local ES imports across the app's own modules, e.g. './clock.js'. */
function localImports() {
  const out = new Set();
  for (const f of readdirSync(appDir).filter(x => x.endsWith('.js'))) {
    const src = readFileSync(join(appDir, f), 'utf8');
    for (const m of src.matchAll(/^\s*import[^'"]*['"]\.\/([^'"]+)['"]/gm)) out.add(m[1]);
  }
  return [...out];
}

const imports = localImports();

t('something was actually parsed out of each list', () => {
  if (swAssets.length < 5)    throw new Error(`sw.js ASSETS looks empty: ${swAssets.length}`);
  if (buildAssets.length < 5) throw new Error(`build ASSETS looks empty: ${buildAssets.length}`);
  if (imports.length < 1)     throw new Error('no local imports found — regex drifted?');
});

t('every file the app imports is in the deploy list', () => {
  const missing = imports.filter(f => !buildAssets.includes(f));
  if (missing.length) {
    throw new Error(`not in scripts/build-www.mjs, so it would 404 live: ${missing.join(', ')}`);
  }
});

t('every file the app imports is in the offline cache', () => {
  const missing = imports.filter(f => !swAssets.includes(f));
  if (missing.length) {
    throw new Error(`not in sw.js ASSETS, so it breaks offline: ${missing.join(', ')}`);
  }
});

t('the deploy list covers everything the offline cache expects', () => {
  const missing = swAssets.filter(f => !buildAssets.includes(f));
  if (missing.length) {
    throw new Error(`sw.js caches files that are never deployed: ${missing.join(', ')}`);
  }
});

t('every listed file exists on disk', () => {
  const gone = [...new Set([...swAssets, ...buildAssets])]
    .filter(f => !existsSync(join(appDir, f)));
  if (gone.length) throw new Error(`listed but absent: ${gone.join(', ')}`);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
