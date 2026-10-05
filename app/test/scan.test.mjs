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
t('inventory is sane and pause is never offered as a letter', () => {
  ok(D.units.length > 40, `only ${D.units.length} units`);
  ok(Object.keys(D.legal).length >= 6, 'too few contexts');
  /* ctl_pause is not typeable: it is grafted onto the all-wait path at runtime
     so that doing nothing pauses instead of typing. It must never appear in a
     legality set, or it becomes a selectable character. */
  for (const [ctx, list] of Object.entries(D.legal))
    ok(!list.includes('ctl_pause'), `${ctx} offers ctl_pause as a letter`);
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
/* A virama joins to a consonant, OR to a chillu when transliterating foreign
   names — ഗെയ്ൽ, "Gail", occurs in the corpus. The hand-written rule said
   chillu was impossible there; the measured data disagreed and the data was
   right. What must never follow a virama is a vowel sign or another virama. */
t('no vowel sign or second virama may follow a virama', () => {
  const cls = Object.fromEntries(D.units.map(u => [u.id, u.class]));
  for (const id of D.legal.VIR)
    ok(!['S', 'VIR', 'V'].includes(cls[id]), `VIR→${cls[id]} should be illegal`);
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
t('a context tree holds exactly its legal set, plus the grafted pause', () => {
  for (const ctx of Object.keys(D.legal)) {
    const got = leaves(treeFor(D, ctx)).sort();
    const want = [...D.legal[ctx], 'ctl_pause'].sort();
    eq(got.join(','), want.join(','), ctx);
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

console.log('\nword prediction (C5)');
t('word candidates enter the tree and stay reachable', () => {
  const extra = { 'w:എന്റെ': 0.17, 'w:എവിടെ': 0.17 };
  const tree = treeFor(D, 'SP', extra);
  for (const id of Object.keys(extra)) ok(codeOf(tree, id), `${id} unreachable`);
});

t('words get SHORT codes — the whole point of giving them mass', () => {
  const extra = { 'w:എന്റെ': 0.34 };
  const tree = treeFor(D, 'SP', extra);
  const w = codeOf(tree, 'w:എന്റെ');
  const letter = codeOf(tree, 'ka');
  ok(w.steps <= letter.steps,
     `word ${w.steps} steps vs letter ${letter.steps} — prediction would not pay`);
});

t('letters keep at least half the mass, so none becomes unreachable', () => {
  const extra = Object.fromEntries(
    Array.from({ length: 5 }, (_, i) => [`w:x${i}`, 0.4]));   // deliberately greedy
  const tree = treeFor(D, 'SP', extra);
  for (const id of D.legal.SP) ok(codeOf(tree, id), `${id} lost to word candidates`);
});

t('no candidates behaves exactly as before', () => {
  eq(JSON.stringify(leaves(treeFor(D, 'SP')).sort()),
     JSON.stringify(leaves(treeFor(D, 'SP', null)).sort()));
});

console.log('\ncounting');
const SAMPLE = ['na', 's_ii', 'p_sp', 'sa', 's_u', 'kha', 'x_anu',
                'p_sp', 'v_aa', 'nna', 's_oo'];
/* A real name, and a good regression target: it exercises an independent
   vowel, a vowel sign, and the virama that joins ത + യ into the conjunct ത്യ —
   the three things that are hard to find on a scanning keyboard. */
t('ആദിത്യ decomposes, round-trips, and every unit is legal in turn', () => {
  const ids = decompose(D, 'ആദിത്യ');
  eq(ids.join(' '), 'v_aa da s_i ta x_vir ya');
  const chr = Object.fromEntries(D.units.map(u => [u.id, u.char]));
  eq(ids.map(i => chr[i]).join(''), 'ആദിത്യ', 'round-trip');
  let ctx = 'SP';
  for (const id of ids) {
    ok(D.legal[ctx].includes(id), `${id} illegal after ${ctx}`);
    ok(codeOf(treeFor(D, ctx), id), `${id} unreachable in ${ctx}`);
    ctx = D.units.find(u => u.id === id).class;
  }
});

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
/* This began as "C4 beats C3b" — the project's hypothesis. Findings 001-007
   disproved it on hand-estimated AND measured data, at legal-set sizes from
   32% to 63%. The test now pins the established result instead of the hope:
   the hard constraint is within noise of the soft model, in either direction.
   If a future model ever moves this by more than 5%, that is a real discovery
   and this test should fail loudly so nobody misses it. */
t('the hard constraint stays within noise of the soft model (findings 001-007)', () => {
  const c = simulate(D, SAMPLE, 'C3b'), b = simulate(D, SAMPLE, 'B');
  const delta = 100 * (c.steps - b.steps) / c.steps;
  ok(Math.abs(delta) < 5,
     `constraint moved steps by ${delta.toFixed(1)}% (C3b=${c.steps} B=${b.steps}) `
     + '— if real, this overturns findings 001-007');
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
