/* Tests for the live scan state machine.  node app/test/session.test.mjs
 *
 * The one that matters: the LIVE counters must agree exactly with the OFFLINE
 * simulate(). If they ever diverge, the press counter on the demo table is
 * telling a judge a different number from the one in the paper.
 *
 * The session is driven with an injected clock and a synchronous scheduler, so
 * these run in milliseconds and are fully deterministic.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ScanSession, treeFor, leaves, codeOf, simulate, classOf } from '../scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = n => JSON.parse(readFileSync(join(here, '..', 'data', n), 'utf8'));
const D = {
  units: read('units.json'), bigrams: read('bigrams.json'),
  legal: read('legal.json'), grid: read('gridA.json'),
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

/** Drive a session to completion. `wants` decides whether to press on each
 *  frame. Returns what was emitted plus the counters. */
function drive({ mode, ctx = 'SP', wants, period = 800, maxFrames = 400, extra, only }) {
  let clock = 0;
  const queue = [];
  let emitted = null, idled = false;
  const frames = [];

  const s = new ScanSession({
    mode, period, data: D, extra, only,
    context: () => ctx,
    onFrame: f => frames.push(f),
    onEmit: id => { emitted = id; },
    onIdle: () => { idled = true; },
    now: () => clock,
    schedule: fn => queue.push(fn),
  });
  s.begin();

  let n = 0;
  while (queue.length && emitted === null && !idled && n++ < maxFrames) {
    // Decide before the tick whether this highlighted frame is the one we want
    const f = frames[frames.length - 1];
    if (f && wants(f)) s.press();
    else clock += period;                 // let it time out
    queue.shift()();
  }
  return { emitted, idled, presses: s.presses, steps: s.steps, frames, session: s };
}

console.log('\nmode B — constrained tree');

/* Reported from the live app: three letters appeared with nobody touching
   anything. Walking the all-wait path is not a selection — it means the user
   is not there. */
t('doing nothing types NOTHING — it idles', () => {
  const r = drive({ mode: 'B', wants: () => false });
  ok(r.idled, 'did not report idling');
  eq(r.emitted, null, 'emitted a unit with zero presses');
  eq(r.presses, 0, 'presses');
});

/* The fix that makes the idle guard safe: an explicit pause sits at the end of
   the all-wait path, so no real letter is sacrificed to it. */
t('the all-wait path ends on PAUSE in every context', () => {
  for (const ctx of Object.keys(D.legal)) {
    let n = treeFor(D, ctx);
    while (n && !n.unit) n = n.lo;
    eq(n.unit, 'ctl_pause', `${ctx} all-wait path:`);
  }
});

t('no letter is made untypeable by the pause graft', () => {
  for (const ctx of Object.keys(D.legal)) {
    const tree = treeFor(D, ctx);
    for (const id of D.legal[ctx]) ok(codeOf(tree, id), `${ctx} lost ${id}`);
  }
});

t('mode A also idles instead of typing, after two full passes', () => {
  const r = drive({ mode: 'A', wants: () => false, maxFrames: 400 });
  ok(r.idled, 'row-column did not idle');
  eq(r.emitted, null, 'row-column typed something unprompted');
});

/* The guard was dead from the second letter onward: app.js carries the press
   TOTAL across sessions, and idled() tested that total, so it was never zero
   again. Only the pause graft was catching idling. Five deploys did not notice.
   This pins the contract: a carried-over total must not suppress idling. */
t('idling is detected even after earlier selections', () => {
  const s = new ScanSession({
    mode: 'B', period: 800, data: D, context: () => 'SP',
    now: () => 0, schedule: () => {},
  });
  s.presses = 17;            // as app.js does, for the on-screen counter
  s.selPresses = 0;          // but this selection has had none
  ok(s.idled(), 'a carried-over total suppressed the idle guard');
  s.selPresses = 1;
  ok(!s.idled(), 'one press in this selection still counted as idle');
});

t('selPresses counts only the current selection', () => {
  const r = drive({ mode: 'B', wants: f => f.hot.includes('ka') });
  eq(r.emitted, 'ka');
  eq(r.session.selPresses, r.session.presses, 'fresh session: both agree');
  ok(r.session.selPresses >= 1);
});

t('one press is enough to make a real selection', () => {
  const r = drive({ mode: 'B', wants: f => f.hot.includes('ka') });
  eq(r.emitted, 'ka');
  ok(r.presses >= 1, 'a selection must cost at least one press');
});

t('an illegal unit can never be emitted, whatever you press', () => {
  for (const ctx of Object.keys(D.legal)) {
    const legal = new Set(D.legal[ctx]);
    for (const style of [() => true, () => false, (() => { let i = 0; return () => i++ % 2 === 0; })()]) {
      const r = drive({ mode: 'B', ctx, wants: style });
      // null is a valid outcome now: zero presses means the user is not there
      ok(r.emitted === null || legal.has(r.emitted),
         `${ctx} emitted illegal ${r.emitted}`);
    }
  }
});

t('targeting a unit emits exactly that unit', () => {
  for (const target of ['ka', 'na', 'v_aa', 'ctl_undo']) {    // all legal after a space
    const r = drive({ mode: 'B', wants: f => f.hot.includes(target) });
    eq(r.emitted, target, `target ${target}:`);
  }
});

t('every legal unit in every context is reachable by targeting it', () => {
  for (const ctx of Object.keys(D.legal)) {
    for (const target of D.legal[ctx]) {
      const r = drive({ mode: 'B', ctx, wants: f => f.hot.includes(target) });
      eq(r.emitted, target, `${ctx} → ${target}:`);
    }
  }
});

t('undo and clear stay reachable from every context', () => {
  for (const ctx of Object.keys(D.legal)) {
    for (const c of ['ctl_undo', 'ctl_clear']) {
      ok(D.legal[ctx].includes(c), `${c} unreachable from ${ctx} — the user would be stuck`);
      const r = drive({ mode: 'B', ctx, wants: f => f.hot.includes(c) });
      eq(r.emitted, c, `${ctx} → ${c}:`);
    }
  }
});

/* The real structural rule at a word boundary: a DEPENDENT mark has nothing to
   attach to, so none may open a word.

   This replaces an earlier assertion that SP→SP is illegal. That was an
   artifact of the class scheme, not a fact about Malayalam: SP lumps space and
   punctuation together, so "space after space" is really "space after a full
   stop", which is perfectly ordinary. Measured data said so immediately. */
t('no dependent mark may follow a space — nothing to attach to', () => {
  const cls = Object.fromEntries(D.units.map(u => [u.id, u.class]));
  for (const id of D.legal.SP)
    ok(!['S', 'VIR', 'ANU', 'CH'].includes(cls[id]),
       `SP→${cls[id]} (${id}) should be illegal`);
  ok(D.legal.C.includes('p_sp'), 'a space must be typable after a consonant');
});

t('LIVE counters equal OFFLINE codeOf() — the invariant that matters', () => {
  const tree = treeFor(D, 'SP');
  for (const target of D.legal.SP) {
    const live = drive({ mode: 'B', wants: f => f.hot.includes(target) });
    const off = codeOf(tree, target);
    eq(live.steps, off.steps, `${target} steps:`);
    eq(live.presses, off.presses, `${target} presses:`);
  }
});

t('every frame highlights a strict subset of what is still live', () => {
  const r = drive({ mode: 'B', wants: f => f.hot.includes('na') });
  for (const f of r.frames) {
    ok(f.hot.length > 0, 'empty highlight');
    ok(f.hot.length < f.live.length || f.live.length === 1, 'highlight is not a subset');
    const live = new Set(f.live);
    for (const h of f.hot) ok(live.has(h), `${h} highlighted but not live`);
  }
});

t('the live set shrinks monotonically', () => {
  const r = drive({ mode: 'B', wants: f => f.hot.includes('ka') });
  for (let i = 1; i < r.frames.length; i++) {
    ok(r.frames[i].live.length < r.frames[i - 1].live.length,
       `frame ${i}: ${r.frames[i - 1].live.length} → ${r.frames[i].live.length}`);
  }
});

t('stop() halts the machine', () => {
  let clock = 0; const queue = [];
  const s = new ScanSession({
    mode: 'B', period: 800, data: D, context: () => 'SP',
    now: () => clock, schedule: fn => queue.push(fn),
  });
  s.begin();
  const at = s.steps;
  s.stop();
  clock += 10000;
  while (queue.length) queue.shift()();
  eq(s.steps, at, 'steps advanced after stop');
});

/* A switch user has no finger to tap the 123 button with. Every mode switch
   must be reachable BY SCANNING, from wherever they happen to be — including
   part-way through a word, which was a trap before. */
console.log('\nthe number layer, reached by switch alone');

t('the 123 key is reachable from every context, including mid-word', () => {
  for (const ctx of Object.keys(D.legal)) {
    const r = drive({ mode: 'B', ctx, wants: f => f.hot.includes('ctl_123'),
                      extra: { ctl_123: 0.05 } });
    eq(r.emitted, 'ctl_123', `${ctx}:`);
    ok(r.steps <= 7, `${ctx} took ${r.steps} steps to reach numbers`);
  }
});

t('escaping the layer is cheaper than anything inside it', () => {
  const digits = D.units.filter(u => u.class === 'NUM').map(u => u.id);
  const only = [...digits, 'p_sp', 'ctl_undo', 'ctl_abc'];
  const r = drive({ mode: 'B', ctx: 'NUM', only, extra: { ctl_abc: 0.30 },
                    wants: f => f.hot.includes('ctl_abc') });
  eq(r.emitted, 'ctl_abc');
  const tree = treeFor(D, 'NUM', { ctl_abc: 0.30 }, only);
  const worst = Math.max(...digits.map(d => codeOf(tree, d)?.steps ?? 0));
  ok(r.steps < worst,
     `exit ${r.steps} steps vs worst digit ${worst} — a mode you cannot leave`);
});

t('every digit is reachable inside the layer', () => {
  const digits = D.units.filter(u => u.class === 'NUM').map(u => u.id);
  const only = [...digits, 'p_sp', 'ctl_undo', 'ctl_abc'];
  for (const d of digits) {
    const r = drive({ mode: 'B', ctx: 'NUM', only, wants: f => f.hot.includes(d) });
    eq(r.emitted, d, `digit ${d}:`);
  }
});

console.log('\nmode A — row–column baseline');

t('always costs exactly 2 presses', () => {
  const r = drive({
    mode: 'A',
    wants: f => f.phase === 'row'
      ? Math.floor(D.grid.order.indexOf('ka') / f.cols) === f.r
      : D.grid.order.indexOf('ka') % f.cols === f.c,
  });
  eq(r.emitted, 'ka');
  eq(r.presses, 2);
});

t('LIVE steps equal the (row+1)+(col+1) formula used offline', () => {
  for (const target of ['v_a', 'ka', 'na', 's_oo', 'p_sp', 'ctl_clear']) {
    const i = D.grid.order.indexOf(target);
    const row = Math.floor(i / D.grid.cols), col = i % D.grid.cols;
    const r = drive({
      mode: 'A',
      wants: f => f.phase === 'row' ? f.r === row : f.c === col,
    });
    eq(r.emitted, target, `${target} emitted:`);
    eq(r.steps, (row + 1) + (col + 1), `${target} steps:`);
  }
});

t('the row scan wraps around instead of running off the end', () => {
  const r = drive({ mode: 'A', wants: () => false, maxFrames: 60 });
  const rows = r.frames.filter(f => f.phase === 'row').map(f => f.r);
  ok(rows.includes(0) && Math.max(...rows) === Math.ceil(D.grid.order.length / D.grid.cols) - 1,
     `rows seen: ${[...new Set(rows)].join(',')}`);
  ok(rows.lastIndexOf(0) > rows.indexOf(0), 'never wrapped back to row 0');
});

console.log('\nwhole sentence — live vs offline');

t('driving the full sample sentence reproduces simulate() exactly', () => {
  const SAMPLE = ['na', 's_ii', 'p_sp', 'sa', 's_u', 'kha', 'x_anu',
                  'p_sp', 'v_aa', 'nna', 's_oo'];
  for (const mode of ['A', 'B']) {
    let ctx = 'SP', steps = 0, presses = 0;
    for (const target of SAMPLE) {
      const i = D.grid.order.indexOf(target);
      const row = Math.floor(i / D.grid.cols), col = i % D.grid.cols;
      const r = drive({
        mode, ctx,
        wants: f => mode === 'B'
          ? f.hot.includes(target)
          : (f.phase === 'row' ? f.r === row : f.c === col),
      });
      eq(r.emitted, target, `${mode}/${target}:`);
      steps += r.steps; presses += r.presses;
      ctx = classOf(D, target);
    }
    const off = simulate(D, SAMPLE, mode);
    eq(steps, off.steps, `${mode} total steps:`);
    eq(presses, off.presses, `${mode} total presses:`);
  }
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
