/* The last place a hard legality constraint can genuinely pay: no corpus.
 *
 * Findings 001 and 002 killed the constraint's value when a good language
 * model exists — Huffman already buries improbable symbols, so excluding them
 * changes nothing, on clean input or under mis-presses.
 *
 * But a language model requires text, and most Indian languages do not have
 * any. Legality is different: it comes from the GRAMMAR OF THE SCRIPT, which a
 * linguist can write down in an afternoon without a single sentence of corpus.
 *
 * So: how much of a trained model's benefit can you get from script rules alone?
 *
 *   node app/test/zero_resource.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildTree, codeOf } from '../scan.js';

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

/* A unigram, derived by marginalising the bigram table — stands in for "we
   counted letters once" , the cheapest corpus statistic there is. */
const UNI = (() => {
  const p = Object.fromEntries(ALL.map(u => [u, 0]));
  for (const row of Object.values(D.bigrams))
    for (const [u, v] of Object.entries(row)) p[u] += v;
  return norm(p);
})();

const METHODS = {
  'row–column grid': null,                                  // handled separately

  'uniform, no knowledge at all': () =>
    buildTree(norm(Object.fromEntries(ALL.map(u => [u, 1])))),

  'LEGALITY ONLY — zero corpus': ctx =>
    buildTree(norm(Object.fromEntries(
      (D.legal[ctx] || D.legal.SP).map(u => [u, 1])))),

  'unigram only (count letters once)': () =>
    buildTree(UNI),

  'legality + unigram': ctx =>
    buildTree(norm(Object.fromEntries(
      (D.legal[ctx] || D.legal.SP).map(u => [u, UNI[u]])))),

  'full bigram model (needs a corpus)': ctx =>
    buildTree(norm(Object.fromEntries(
      ALL.map(u => [u, (D.bigrams[ctx] || D.bigrams.SP)[u] ?? 1e-6])))),

  'bigram + legality (the proposal)': ctx =>
    buildTree(norm(Object.fromEntries(
      (D.legal[ctx] || D.legal.SP).map(
        u => [u, (D.bigrams[ctx] || D.bigrams.SP)[u] ?? 1e-9])))),
};

function cost(treeFn) {
  let steps = 0, presses = 0, ctx = 'SP';
  for (const id of SAMPLE) {
    const cw = codeOf(treeFn(ctx), id);
    if (cw) { steps += cw.steps; presses += cw.presses; }
    ctx = cls[id] || 'SP';
  }
  return { steps, presses };
}
function gridCost() {
  let steps = 0;
  for (const id of SAMPLE) {
    const i = D.grid.order.indexOf(id);
    steps += Math.floor(i / D.grid.cols) + 1 + (i % D.grid.cols) + 1;
  }
  return { steps, presses: SAMPLE.length * 2 };
}

console.log('\nWhat do you need to know to scan Malayalam efficiently?');
console.log('നീ സുഖം ആണോ — 11 selections\n');

const results = [];
for (const [name, fn] of Object.entries(METHODS)) {
  const r = fn ? cost(fn) : gridCost();
  results.push({ name, ...r, corpus: /corpus|bigram|unigram/.test(name) && !/zero|no knowledge/.test(name) });
}
const best = Math.min(...results.map(r => r.steps));
const worst = Math.max(...results.map(r => r.steps));

console.log('  method                                corpus?   steps  presses   bar');
console.log('  ' + '─'.repeat(76));
for (const r of results) {
  const w = Math.round(34 * r.steps / worst);
  console.log(`  ${r.name.padEnd(36)} ${(r.corpus ? 'yes' : 'NO ').padStart(6)}  `
            + `${String(r.steps).padStart(5)}  ${String(r.presses).padStart(7)}   `
            + '█'.repeat(w));
}

const legalOnly = results.find(r => r.name.startsWith('LEGALITY ONLY')).steps;
const full = results.find(r => r.name.startsWith('bigram + legality')).steps;
const grid = results[0].steps;
const recovered = 100 * (grid - legalOnly) / (grid - full);

console.log(`\n  Baseline (what ships):              ${grid} steps`);
console.log(`  Best possible (full corpus model):  ${full} steps`);
console.log(`  Legality alone, ZERO corpus:        ${legalOnly} steps`);
console.log(`\n  → script rules alone recover ${recovered.toFixed(0)}% of the total achievable gain,`);
console.log('    with no text, no training, and no annotation.\n');
console.log('If that number holds on real corpora it is the contribution: for the');
console.log('~20 Indian languages with no usable corpus, the grammar of the script');
console.log('is enough. That is a claim about low-resource deployment, not about');
console.log('beating a trained model — and it is the one the evidence supports.\n');
