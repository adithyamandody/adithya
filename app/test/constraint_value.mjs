/* Does the hard legality constraint actually buy anything over a soft model?
 *
 * The unit tests found B and C3b dead level on the sample sentence. This asks
 * why, and under what conditions the constraint starts to pay — which is the
 * question BUILD.md's headline claim rests on.
 *
 *   node app/test/constraint_value.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildTree, codeOf, leaves } from '../scan.js';

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

const norm = p => {
  const z = Object.values(p).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v / z]));
};

/** Soft model with a backoff floor: illegal units get `floor` mass instead of 0.
 *  `floor` is the knob — it stands for how badly the LM is estimated. */
function softTree(ctx, floor) {
  const row = D.bigrams[ctx] || D.bigrams.SP;
  const p = {};
  for (const u of ALL) p[u] = row[u] ?? floor;
  return buildTree(norm(p));
}
function hardTree(ctx) {
  const row = D.bigrams[ctx] || D.bigrams.SP;
  const p = {};
  for (const u of D.legal[ctx] || D.legal.SP) p[u] = row[u] ?? 1e-9;
  return buildTree(norm(p));
}

function cost(ids, treeFn) {
  let steps = 0, presses = 0, ctx = 'SP';
  for (const id of ids) {
    const cw = codeOf(treeFn(ctx), id);
    if (cw) { steps += cw.steps; presses += cw.presses; }
    ctx = cls[id] || 'SP';
  }
  return { steps, presses };
}

console.log('\nHow much does the HARD constraint add over a SOFT model?');
console.log('The floor is the probability a soft model leaves on an illegal unit —');
console.log('i.e. how badly it is estimated. A perfect LM has floor ≈ 0.\n');
console.log('  floor      soft steps   hard steps   gain');
console.log('  ' + '-'.repeat(46));
for (const floor of [1e-9, 1e-6, 1e-4, 1e-3, 5e-3, 1e-2, 2e-2]) {
  const soft = cost(SAMPLE, c => softTree(c, floor));
  const hard = cost(SAMPLE, hardTree);
  const gain = 100 * (soft.steps - hard.steps) / soft.steps;
  console.log(`  ${floor.toExponential(0).padStart(7)}  ${String(soft.steps).padStart(10)}`
            + `   ${String(hard.steps).padStart(10)}   ${gain.toFixed(1).padStart(5)}%`);
}

console.log('\nWhy: a Huffman code already gives a near-zero-probability symbol a very');
console.log('long codeword, so it costs almost nothing to leave it in the tree.');
console.log('Removing it only helps when the model wrongly thinks it is plausible.\n');

/* Where the constraint is NOT about step count: a mis-press. With a hard
   constraint an illegal selection cannot be produced at all, so the scanner
   can refuse it; a soft model will happily emit it and the user must undo. */
console.log('Second effect — recovery from a mis-press:');
let reachableIllegal = 0, totalIllegal = 0;
for (const ctx of Object.keys(D.legal)) {
  const legal = new Set(D.legal[ctx]);
  const illegal = ALL.filter(u => !legal.has(u));
  totalIllegal += illegal.length;
  const tree = softTree(ctx, 1e-6);
  const inTree = new Set(leaves(tree));
  reachableIllegal += illegal.filter(u => inTree.has(u)).length;
}
console.log(`  soft model: ${reachableIllegal}/${totalIllegal} illegal units are still`);
console.log('              selectable — every one is an undo waiting to happen');
console.log('  hard model: 0 — an illegal unit cannot be reached at all\n');
console.log('So on this model the constraint is a CORRECTNESS and ERROR-COST claim,');
console.log('not a step-count claim. That is a reportable finding, and finding it now');
console.log('is worth more than finding it in November.\n');
