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

/* ═══════════════════════ the scan clock ═══════════════════
 * The live scanner. `now` and `schedule` are injectable so the state machine
 * can be driven deterministically in node (test/session.test.mjs) — the live
 * counters and the offline simulate() must agree exactly, or the counter on
 * the demo table is lying relative to the numbers in the paper.
 *
 * Timing uses now() deltas, never setInterval: that drifts under load, and a
 * drifting scan period both harms the user (who times their press to the
 * rhythm) and corrupts the measurement.
 */
export class ScanSession {
  constructor({ mode, period, data, context, onFrame, onEmit, now, schedule }) {
    this.mode = mode;
    this.period = period;
    this.D = data;
    this.ctx = context || (() => 'SP');
    this.onFrame = onFrame || (() => {});
    this.onEmit = onEmit || (() => {});
    this.now = now || (() => (typeof performance !== 'undefined'
      ? performance.now() : Date.now()));
    this.schedule = schedule || (typeof requestAnimationFrame !== 'undefined'
      ? requestAnimationFrame.bind(globalThis)
      : (fn => setTimeout(fn, 16)));
    this.presses = 0;
    this.steps = 0;
    this.t0 = this.now();
    this.pressed = false;
    this.running = false;
  }

  press() { this.pressed = true; }
  stop() { this.running = false; }

  begin() {
    this.running = true;
    if (this.mode === 'B') {
      this.node = treeFor(this.D, this.ctx());
      if (!this.node) { this.running = false; return; }
      if (this.node.unit) { this.running = false; this.onEmit(this.node.unit); return; }
    } else {
      this.order = this.D.grid.order;
      this.cols = this.D.grid.cols;
      this.rows = Math.ceil(this.order.length / this.cols);
      this.phase = 'row';
      this.r = 0;
      this.c = 0;
    }
    this._step();
  }

  _step() {
    this.steps++;
    this.tStep = this.now();
    this.onFrame(this.frame());
    this.schedule(() => this._tick());
  }

  _tick() {
    if (!this.running) return;
    if (this.pressed) {
      this.pressed = false;
      this.presses++;
      this._advance(true);
    } else if (this.now() - this.tStep >= this.period) {
      this._advance(false);
    } else {
      this.schedule(() => this._tick());
    }
  }

  _advance(tookIt) {
    if (this.mode === 'B') {
      this.node = tookIt ? this.node.hi : this.node.lo;
      if (this.node.unit) { this.running = false; this.onEmit(this.node.unit); return; }
      this._step();
      return;
    }
    if (this.phase === 'row') {
      if (tookIt) { this.phase = 'col'; this.c = 0; }
      else this.r = (this.r + 1) % this.rows;
      this._step();
      return;
    }
    if (tookIt) {
      const id = this.order[this.r * this.cols + this.c];
      this.running = false;
      if (id) this.onEmit(id);
      return;
    }
    this.c++;
    if (this.c >= this.cols || this.r * this.cols + this.c >= this.order.length) {
      this.c = 0;
      this.phase = 'row';            // fell off the end of the row
    }
    this._step();
  }

  frame() {
    if (this.mode === 'B') {
      return { mode: 'B', live: leaves(this.node), hot: leaves(this.node.hi) };
    }
    return {
      mode: 'A', order: this.order, cols: this.cols,
      phase: this.phase, r: this.r, c: this.c,
    };
  }
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
