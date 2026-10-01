/* BUILD.md IV4: does the scanning UNIT change the answer?
 *
 * Findings 001-003 all used DECOMPOSED units — base consonant, then vowel sign,
 * then virama, each its own selection. The alternative is whole AKSHARA
 * CLUSTERS: ക + ാ is one unit കാ, not two.
 *
 * The caveat on finding 003 was that clusters might make legality bite harder.
 * This tests it, and the answer is not the one the caveat expected.
 *
 *   node app/test/cluster_units.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildTree, codeOf } from '../scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = n => JSON.parse(readFileSync(join(here, '..', 'data', n), 'utf8'));
const D = {
  units: read('units.json'), bigrams: read('bigrams.json'), legal: read('legal.json'),
};
const cls = Object.fromEntries(D.units.map(u => [u.id, u.class]));
const chr = Object.fromEntries(D.units.map(u => [u.id, u.char]));
const by = k => D.units.filter(u => u.class === k).map(u => u.id);

const norm = p => {
  const z = Object.values(p).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v / z]));
};

/* Marginal unigram over decomposed units, used to build cluster frequencies. */
const UNI = (() => {
  const p = {}; for (const u of D.units) p[u.id] = 0;
  for (const row of Object.values(D.bigrams))
    for (const [u, v] of Object.entries(row)) p[u] += v;
  return norm(p);
})();

/* ── build the cluster inventory ──────────────────────────────────────────
 * consonant × {no sign, each vowel sign} × {plain, +anusvara}, plus bare
 * vowels, chillu, punctuation and controls. Conjuncts are omitted: including
 * all C+virama+C would add 1,296 more and only strengthens the conclusion.
 */
const CL = {};            // id -> {char, freq}
const NOSIGN = 0.42;      // share of consonants carrying no vowel sign

for (const c of by('C')) {
  CL[`${c}`] = { char: chr[c], freq: UNI[c] * NOSIGN };
  for (const s of by('S')) CL[`${c}+${s}`] = { char: chr[c] + chr[s], freq: UNI[c] * UNI[s] };
}
for (const c of by('C')) CL[`${c}+anu`] = { char: chr[c] + chr['x_anu'], freq: UNI[c] * UNI['x_anu'] };
for (const v of by('V')) CL[v] = { char: chr[v], freq: UNI[v] };
for (const k of [...by('CH'), ...by('SP'), ...by('CTL')]) CL[k] = { char: chr[k], freq: UNI[k] };

const IDS = Object.keys(CL);
const FREQ = norm(Object.fromEntries(IDS.map(i => [i, CL[i].freq])));

/* Legality between clusters. A cluster is a COMPLETE syllable, so almost
   anything may follow anything — which is the crux. */
const clusterClass = id =>
  by('SP').includes(id) ? 'SP' : by('CTL').includes(id) ? 'CTL'
  : by('CH').includes(id) ? 'CH' : 'AK';          // akshara or bare vowel
const CL_LEGAL = {};
for (const ctx of ['SP', 'AK', 'CH', 'CTL']) {
  CL_LEGAL[ctx] = IDS.filter(id => {
    const k = clusterClass(id);
    if (ctx === 'SP' && k === 'SP') return false;   // no double space
    if (ctx === 'SP' && k === 'CH') return false;   // a chillu cannot open a word
    if (ctx === 'CH' && k === 'CH') return false;   // nor follow another
    return true;
  });
}

const treeAll = () => buildTree(FREQ);
const treeLegal = ctx => buildTree(norm(
  Object.fromEntries(CL_LEGAL[ctx].map(i => [i, FREQ[i]]))));

function clusterCost(seq, treeFn) {
  let steps = 0, presses = 0, ctx = 'SP';
  for (const id of seq) {
    const cw = codeOf(treeFn(ctx), id);
    if (!cw) throw new Error(`unreachable cluster ${id} in ${ctx}`);
    steps += cw.steps; presses += cw.presses;
    ctx = clusterClass(id);
  }
  return { steps, presses };
}

/* നീ സുഖം ആണോ as clusters: 7 selections instead of 11 */
const SEQ = ['na+s_ii', 'p_sp', 'sa+s_u', 'kha+anu', 'p_sp', 'v_aa', 'nna+s_oo'];
for (const id of SEQ) if (!CL[id]) throw new Error(`missing cluster ${id}`);

console.log('\nIV4 — decomposed units vs whole akshara clusters');
console.log('നീ സുഖം ആണോ\n');
console.log(`  decomposed inventory:  ${D.units.length} units, 11 selections`);
console.log(`  cluster inventory:     ${IDS.length} units, ${SEQ.length} selections`);
console.log(`  rendered: ${SEQ.map(i => CL[i].char).join('')}\n`);

const noLegal = clusterCost(SEQ, treeAll);
const withLegal = clusterCost(SEQ, treeLegal);

console.log('  scheme                                        steps  presses');
console.log('  ' + '─'.repeat(58));
console.log(`  decomposed, row–column (ships today)             115       22`);
console.log(`  decomposed, bigram tree                          50       25`);
console.log(`  decomposed, bigram + legality (proposal)         50       25`);
console.log(`  cluster, frequency tree, no legality      ${String(noLegal.steps).padStart(9)}  ${String(noLegal.presses).padStart(7)}`);
console.log(`  cluster, frequency tree + legality        ${String(withLegal.steps).padStart(9)}  ${String(withLegal.presses).padStart(7)}`);

const mean = Object.values(CL_LEGAL).reduce((a, l) => a + l.length, 0) / 4;
console.log(`\n  mean legal set: ${mean.toFixed(0)} of ${IDS.length} clusters `
          + `(${(100 * mean / IDS.length).toFixed(1)}%)`);
console.log(`  legality saves ${noLegal.steps - withLegal.steps} steps`);

console.log(`
Why the caveat was wrong. A cluster is a COMPLETE syllable, so nearly every
cluster may legally follow nearly every other — the legal set is ${(100 * mean / IDS.length).toFixed(0)}% of the
inventory, against 64% for decomposed units. Moving to clusters makes legality
WEAKER, not stronger, because the constraint lived in the internal structure of
the akshara and clusters put that structure inside the unit.

So IV4 does not rescue the constraint. It closes the last route. The honest
contribution is the one finding 003 named: the akshara tax is real and
unmeasured, and legality is a free substitute for a corpus you do not have.
`);
