/* Unit tests for the scan algorithm.  node app/test/scan.test.mjs
 *
 * These guard the numbers. If a refactor quietly changes how presses or steps
 * are counted, the comparison on the demo table silently becomes a lie — so
 * every counting rule gets a test.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  buildTree, treeFor, treeForUnconstrained, leaves, codeOf, simulate, decompose,
} from '../scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = n => JSON.parse(readFileSync(join(here, '..', 'data', n), 'utf8'));
const D = {
  units: read('units.json'),
  bigrams: read('bigrams.json'),
  legal: read('legal.json'),
  grid: read('gridA.json'),
};

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};
const eq = (a, b, m = '') => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, m) => { if (!c) throw new Error(m); };

console.log('\ndata');
t('75 units, 8 contexts', () => {
  eq(D.units.length, 75);
  eq(Object.keys(D.legal).length, 8);
});
t('every legal id exists in the inventory', () => {
  const ids = new Set(D.units.map(u => u.id));
  for (const [ctx, list] of Object.entries(D.legal))
    for (const id of list) ok(ids.has(id), `${ctx} allows unknown id ${id}`);
});
t('bigram rows are normalised', () => {
  for (const [ctx, row] of Object.entries(D.bigrams)) {
    const z = Object.values(row).reduce((a, b) => a + b, 0);
    ok(Math.abs(z - 1) < 1e-4, `${ctx} sums to ${z}`);
  }
});
t('the grid covers every unit exactly once', () => {
  eq(D.grid.order.length, D.units.length);
  eq(new Set(D.grid.order).size, D.units.length);
});

console.log('\nlegality — this is the contribution, so it gets the most tests');
t('a vowel sign cannot follow a vowel sign', () => {
  ok(!D.legal.S.includes('s_aa'), 'S→S should be illegal');
});
t('only consonants (plus space/control) may follow a virama', () => {
  const cls = Object.fromEntries(D.units.map(u => [u.id, u.class]));
  for (const id of D.legal.VIR)
    ok(['C', 'SP', 'CTL'].includes(cls[id]), `VIR→${cls[id]} should be illegal`);
});
t('an independent vowel cannot follow a consonant', () => {
  const cls = Object.fromEntries(D.units.map(u => [u.id, u.class]));
  ok(!D.legal.C.some(id => cls[id] === 'V'), 'C→V should be illegal');
});
t('nothing attaches to a space', () => {
  const cls = Object.fromEntries(D.units.map(u => [u.id, u.class]));
  for (const id of D.legal.SP)
    ok(!['S', 'VIR', 'ANU', 'CH'].includes(cls[id]), `SP→${cls[id]} should be illegal`);
});
t('the constraint actually constrains', () => {
  const mean = Object.values(D.legal).reduce((a, l) => a + l.length, 0)
             / Object.keys(D.legal).length;
  ok(mean < D.units.length * 0.9,
     `mean legal set ${mean.toFixed(1)}/${D.units.length} — too loose to matter`);
});

console.log('\ntree');
t('Huffman: the likeliest symbol gets the shortest code', () => {
  const tree = buildTree({ a: 0.6, b: 0.25, c: 0.1, d: 0.05 });
  const d = id => codeOf(tree, id).steps;
  ok(d('a') <= d('b') && d('b') <= d('c') && d('c') <= d('d'),
     `depths a=${d('a')} b=${d('b')} c=${d('c')} d=${d('d')}`);
});
t('hand-checked 4-symbol tree: a=1 step, the rest deeper', () => {
  const tree = buildTree({ a: 0.5, b: 0.25, c: 0.125, d: 0.125 });
  eq(codeOf(tree, 'a').steps, 1, 'a');
  eq(codeOf(tree, 'b').steps, 2, 'b');
  eq(codeOf(tree, 'c').steps, 3, 'c');
  eq(codeOf(tree, 'd').steps, 3, 'd');
});
t('a single-symbol tree is a leaf', () => {
  eq(buildTree({ only: 1 }).unit, 'only');
});
t('leaves() of a context tree equal that context\'s legal set', () => {
  for (const ctx of Object.keys(D.legal)) {
    const got = leaves(treeFor(D, ctx)).sort();
    eq(got.join(','), [...D.legal[ctx]].sort().join(','), ctx);
  }
});
t('every legal unit is reachable in its context', () => {
  for (const ctx of Object.keys(D.legal)) {
    const tree = treeFor(D, ctx);
    for (const id of D.legal[ctx]) ok(codeOf(tree, id), `${ctx} → ${id} unreachable`);
  }
});
t('the unconstrained control offers every unit', () => {
  eq(leaves(treeForUnconstrained(D, 'VIR')).length, D.units.length);
});

console.log('\ncounting');
const SAMPLE = ['na', 's_ii', 'p_sp', 'sa', 's_u', 'kha', 'x_anu',
                'p_sp', 'v_aa', 'nna', 's_oo'];
t('the sample sentence decomposes to 11 units', () => {
  eq(decompose(D, 'നീ സുഖം ആണോ').join(' '), SAMPLE.join(' '));
});
t('no unit is missing from any method', () => {
  for (const m of ['A', 'B', 'C3b']) eq(simulate(D, SAMPLE, m).missing, 0, m);
});
t('row–column costs exactly 2 presses per selection', () => {
  eq(simulate(D, SAMPLE, 'A').presses, SAMPLE.length * 2);
});
t('presses never exceed steps', () => {
  for (const m of ['A', 'B', 'C3b']) {
    const r = simulate(D, SAMPLE, m);
    ok(r.presses <= r.steps, `${m}: ${r.presses} presses > ${r.steps} steps`);
  }
});
t('B beats A on scan steps', () => {
  const a = simulate(D, SAMPLE, 'A'), b = simulate(D, SAMPLE, 'B');
  ok(b.steps < a.steps, `A=${a.steps} B=${b.steps}`);
});
t('B beats the unconstrained control — the actual research claim', () => {
  const c = simulate(D, SAMPLE, 'C3b'), b = simulate(D, SAMPLE, 'B');
  ok(b.steps <= c.steps, `C3b=${c.steps} B=${b.steps}`);
});
t('counting is deterministic', () => {
  eq(JSON.stringify(simulate(D, SAMPLE, 'B')),
     JSON.stringify(simulate(D, SAMPLE, 'B')));
});
t('an empty sequence costs nothing', () => {
  eq(simulate(D, [], 'B').steps, 0);
});

const a = simulate(D, SAMPLE, 'A');
const b = simulate(D, SAMPLE, 'B');
const c = simulate(D, SAMPLE, 'C3b');
console.log(`\nനീ സുഖം ആണോ — ${SAMPLE.length} selections`);
console.log(`  A  row–column        ${String(a.steps).padStart(4)} steps  ${String(a.presses).padStart(3)} presses`);
console.log(`  C3b context only     ${String(c.steps).padStart(4)} steps  ${String(c.presses).padStart(3)} presses`);
console.log(`  B  + legality        ${String(b.steps).padStart(4)} steps  ${String(b.presses).padStart(3)} presses`);
console.log(`  B vs A    ${(a.steps / b.steps).toFixed(2)}× fewer steps`);
console.log(`  B vs C3b  ${(100 * (c.steps - b.steps) / c.steps).toFixed(1)}% fewer steps  ← the research claim`);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
