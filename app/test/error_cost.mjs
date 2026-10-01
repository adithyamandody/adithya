/* What does the hard constraint buy when the user MIS-PRESSES?
 *
 * Finding 001 showed the constraint buys ~0% scan steps on clean input. This
 * asks the question that finding pushed to the front: a real switch user
 * misses presses and makes false ones, so what happens then?
 *
 * Mechanism under test: a mis-press sends the scanner down the wrong branch and
 * it emits the wrong unit. Under a soft model that unit may be ILLEGAL in
 * context, producing malformed Malayalam that the user must notice and undo.
 * Under a hard constraint an illegal unit cannot be reached at all, so that
 * entire error class disappears.
 *
 *   node app/test/error_cost.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildTree, leaves, codeOf } from '../scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = n => JSON.parse(readFileSync(join(here, '..', 'data', n), 'utf8'));
const D = {
  units: read('units.json'), bigrams: read('bigrams.json'),
  legal: read('legal.json'), grid: read('gridA.json'),
};
const ALL = D.units.map(u => u.id);
const cls = Object.fromEntries(D.units.map(u => [u.id, u.class]));
const SAMPLE = ['na', 's_ii', 'p_sp', 'sa', 's_u', 'kha', 'x_anu',
                'p_sp', 'v_aa', 'nna', 's_oo'];

/* Deterministic PRNG so the numbers are reproducible and the paper can state
   the seed. Math.random() would make this unciteable. */
let seed = 20261001;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const norm = p => {
  const z = Object.values(p).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v / z]));
};
const softTree = ctx => {
  const row = D.bigrams[ctx] || D.bigrams.SP;
  const p = {}; for (const u of ALL) p[u] = row[u] ?? 1e-6;
  return buildTree(norm(p));
};
const hardTree = ctx => {
  const row = D.bigrams[ctx] || D.bigrams.SP;
  const p = {}; for (const u of D.legal[ctx] || D.legal.SP) p[u] = row[u] ?? 1e-9;
  return buildTree(norm(p));
};

/** Walk the tree toward `target`, flipping each decision with probability eps.
 *  Returns what actually came out. */
function typeOne(tree, target, eps) {
  let node = tree, steps = 0;
  while (node && !node.unit && steps++ < 64) {
    let want = leaves(node.hi).includes(target);
    if (rnd() < eps) want = !want;              // missed press, or a false one
    node = want ? node.hi : node.lo;
  }
  return { got: node && node.unit, steps };
}

function run(treeFn, eps, trials = 4000) {
  let wrong = 0, illegal = 0, steps = 0, sentences = 0, clean = 0;
  for (let t = 0; t < trials; t++) {
    let ctx = 'SP', bad = false;
    for (const target of SAMPLE) {
      const legal = new Set(D.legal[ctx] || D.legal.SP);
      const r = typeOne(treeFn(ctx), target, eps);
      steps += r.steps;
      if (r.got !== target) {
        wrong++; bad = true;
        if (!legal.has(r.got)) illegal++;       // malformed Malayalam
      }
      ctx = cls[target] || 'SP';                // the user retypes correctly
    }
    sentences++;
    if (!bad) clean++;
  }
  return {
    wrongPer: wrong / sentences,
    illegalPer: illegal / sentences,
    cleanRate: clean / sentences,
    stepsPer: steps / sentences,
  };
}

console.log('\nനീ സുഖം ആണോ — 11 selections, 4000 trials per cell, seeded\n');
console.log('        │        soft model (C3b)         │     hard constraint (C4)');
console.log('  eps   │  wrong  illegal  clean  steps   │  wrong  illegal  clean  steps');
console.log('  ' + '─'.repeat(74));
const rows = [];
for (const eps of [0, 0.02, 0.05, 0.10, 0.15]) {
  seed = 20261001; const s = run(softTree, eps);
  seed = 20261001; const h = run(hardTree, eps);
  rows.push({ eps, s, h });
  const f = (x, d = 2) => x.toFixed(d).padStart(6);
  console.log(`  ${eps.toFixed(2)}  │ ${f(s.wrongPer)} ${f(s.illegalPer)} ${f(s.cleanRate)} ${f(s.stepsPer, 1)}   │`
            + ` ${f(h.wrongPer)} ${f(h.illegalPer)} ${f(h.cleanRate)} ${f(h.stepsPer, 1)}`);
}

console.log('\n  wrong   = wrong units emitted per sentence');
console.log('  illegal = of those, how many were impossible Malayalam');
console.log('  clean   = fraction of sentences typed with no error at all');

const e10 = rows.find(r => r.eps === 0.10);
console.log('\nAt a 10% mis-press rate:');
console.log(`  soft model produces ${e10.s.illegalPer.toFixed(2)} impossible units per sentence`);
console.log(`  hard constraint produces ${e10.h.illegalPer.toFixed(2)} — by construction, it cannot`);
const red = 100 * (e10.s.wrongPer - e10.h.wrongPer) / Math.max(e10.s.wrongPer, 1e-9);
console.log(`  wrong units per sentence: ${e10.s.wrongPer.toFixed(2)} → ${e10.h.wrongPer.toFixed(2)}`
          + `  (${red >= 0 ? '−' : '+'}${Math.abs(red).toFixed(0)}%)`);

console.log(`
This is the claim to report. On clean input the constraint is worth nothing;
under realistic mis-press rates it removes an entire error class that the soft
model cannot avoid. Pair it with the corpus-size sweep in FINDINGS.md and the
contribution is "when your model is undertrained or your user is imprecise" —
which is every real deployment of switch scanning in an Indian language.
`);
