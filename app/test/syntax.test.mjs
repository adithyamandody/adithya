/* Every shipped file must at least parse.  node app/test/syntax.test.mjs
 *
 * Why this exists: sw.js carried a stray `];` for several commits and went
 * live with it. The service worker therefore never installed, so the app had
 * no offline cache — and SETUP.md's own warning is that a fair venue has no
 * WiFi and a demo needing a network scores zero.
 *
 * Seventy-six tests passed throughout, because no test ever loaded sw.js. It
 * is the one file the test suite cannot import by design: it runs in a worker
 * scope, not in node. So check it the only way that works from here — parse
 * it. Cheap, and it would have caught the thing that mattered.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};

console.log('\nevery shipped file parses\n');

const files = [
  ...readdirSync(appDir).filter(f => f.endsWith('.js')).map(f => join(appDir, f)),
  ...readdirSync(here).filter(f => f.endsWith('.mjs')).map(f => join(here, f)),
];

if (files.length < 5) {
  console.log('  FAIL found almost no files to check — is the path wrong?');
  process.exit(1);
}

for (const f of files) {
  t(relative(appDir, f), () => {
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (e) {
      throw new Error(String(e.stderr || e.message).split('\n').slice(0, 4).join('\n       '));
    }
  });
}

/* sw.js is the whole reason for this file; make sure it was actually in the
   list rather than silently skipped by a bad path. */
t('sw.js was among the files checked', () => {
  if (!files.some(f => f.endsWith('sw.js'))) throw new Error('sw.js was not checked');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
