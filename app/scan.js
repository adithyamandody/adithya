/* AksharaScan — the algorithm, with no DOM in it.
 *
 * Kept free of browser APIs on purpose so it can be unit-tested in node
 * (see test/scan.test.mjs). app.js imports from here; nothing here imports
 * from app.js.
 */

/** Huffman tree over {unitId: probability}. `hi` is the heavier child and is
 *  the one highlighted first, so a press takes it. */
export function buildTree(probs) {
  let nodes = Object.entries(probs).map(([u, p]) => ({ p, unit: u }));
  if (!nodes.length) return null;
  if (nodes.length === 1) return nodes[0];
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.p - b.p);
    const lo = nodes.shift(), hi = nodes.shift();
    nodes.push({ p: lo.p + hi.p, lo, hi });
  }
  return nodes[0];
}

/** The tree for one context: restricted to legal successors, renormalised.
 *  The restriction is the contribution — everything else is Roark 2013. */
export function treeFor(D, ctx) {
  const allowed = D.legal[ctx] || D.legal.SP;
  const row = D.bigrams[ctx] || D.bigrams.SP;
  const probs = {};
  let z = 0;
  for (const u of allowed) { const p = row[u] ?? 1e-6; probs[u] = p; z += p; }
  for (const u of allowed) probs[u] /= z;
  return buildTree(probs);
}

/** Unconstrained tree for the same context — the C3b control (Roark-style:
 *  context-conditional, no hard legality). Used to show what the constraint
 *  is actually worth, which is the number BUILD.md cares about. */
export function treeForUnconstrained(D, ctx) {
  const row = D.bigrams[ctx] || D.bigrams.SP;
  const probs = {};
  let z = 0;
  for (const u of D.units.map(x => x.id)) {
    const p = row[u] ?? 1e-6; probs[u] = p; z += p;
  }
  for (const u in probs) probs[u] /= z;
  return buildTree(probs);
}

export function leaves(node, out = []) {
  if (!node) return out;
  if (node.unit) out.push(node.unit);
  else { leaves(node.hi, out); leaves(node.lo, out); }
  return out;
}

/** Codeword for one unit: steps = tree depth, presses = times we take `hi`. */
export function codeOf(tree, id) {
  let node = tree, steps = 0, presses = 0;
  const guard = 256;
  while (node && !node.unit && steps < guard) {
    steps++;
    if (leaves(node.hi).includes(id)) { presses++; node = node.hi; }
    else node = node.lo;
  }
  return node && node.unit === id ? { steps, presses } : null;
}

export function classOf(D, id) {
  const u = D.units.find(x => x.id === id);
  return u ? u.class : 'SP';
}

/** Count presses and scan steps for a unit sequence under one method.
 *  mode: 'A' row–column | 'B' constrained tree | 'C3b' unconstrained tree */
export function simulate(D, ids, mode) {
  let presses = 0, steps = 0, ctx = 'SP', missing = 0;
  for (const id of ids) {
    if (mode === 'A') {
      const i = D.grid.order.indexOf(id);
      if (i < 0) { missing++; continue; }
      const r = Math.floor(i / D.grid.cols), c = i % D.grid.cols;
      steps += (r + 1) + (c + 1);      // reach the row, then the cell
      presses += 2;
    } else {
      const tree = mode === 'B' ? treeFor(D, ctx) : treeForUnconstrained(D, ctx);
      const cw = codeOf(tree, id);
      if (!cw) { missing++; ctx = classOf(D, id); continue; }
      steps += cw.steps;
      presses += cw.presses;
    }
    ctx = classOf(D, id);
  }
  return { presses, steps, missing };
}

/** Decompose a Malayalam string into unit ids, longest-match first. */
export function decompose(D, text) {
  const byChar = {};
  for (const u of D.units) if (u.char) byChar[u.char] = u.id;
  const out = [];
  for (const ch of [...text]) {
    if (byChar[ch]) out.push(byChar[ch]);
    else if (ch === ' ') out.push('p_sp');
  }
  return out;
}
