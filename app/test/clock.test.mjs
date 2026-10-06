/* Tests for the scanning clock.  node app/test/clock.test.mjs
 *
 * The bug these exist to prevent: "elapsed" once read wall-clock since page
 * load, so it counted time while the scanner was paused and nothing could
 * reset it. Two judges in a row saw the second one's sentence timed from the
 * first one's start. Press count and time-to-sentence are the numbers this
 * project asks a judge to compare, so a clock that drifts upward on its own
 * discredits the comparison.
 *
 * Time is injected, so these are exact rather than timing-dependent.
 */
import { makeClock } from '../clock.js';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};
const eq = (a, b, m = '') => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, m) => { if (!c) throw new Error(m); };

/** A clock whose "now" we move by hand. */
function fake() {
  let now = 1000;                  // not zero, so a missing baseline shows up
  const c = makeClock(() => now);
  return { c, tick: ms => { now += ms; }, at: () => now };
}

console.log('\nthe clock counts scanning, not waiting\n');

t('a fresh clock reads zero', () => {
  const { c } = fake();
  eq(c.ms(), 0);
  eq(c.running, false);
});

t('time does not pass before the first run', () => {
  const { c, tick } = fake();
  tick(5000);
  eq(c.ms(), 0, 'idle at the start screen must not accrue:');
});

t('time passes while running', () => {
  const { c, tick } = fake();
  c.run(); tick(1500);
  eq(c.ms(), 1500);
});

/* The reported bug, pinned down. */
t('time does NOT pass while held', () => {
  const { c, tick } = fake();
  c.run(); tick(1000);
  c.hold();
  tick(60000);                     // a minute of someone thinking
  eq(c.ms(), 1000, 'paused time leaked into the total:');
});

t('runs accumulate across pauses', () => {
  const { c, tick } = fake();
  c.run(); tick(400); c.hold();
  tick(9999);
  c.run(); tick(600); c.hold();
  eq(c.ms(), 1000, 'two 400+600 bursts should total exactly 1000:');
});

/* startScan() fires once per selection, so run() lands repeatedly while
   already running. It must not restart the interval and lose the elapsed
   part, nor double-count it. */
t('run() is idempotent', () => {
  const { c, tick } = fake();
  c.run(); tick(500);
  c.run(); tick(500);
  eq(c.ms(), 1000, 'a second run() must not reset or double the interval:');
});

/* pause() can arrive after a session already ended of its own accord. */
t('hold() is idempotent', () => {
  const { c, tick } = fake();
  c.run(); tick(300);
  c.hold(); c.hold(); c.hold();
  tick(5000);
  eq(c.ms(), 300, 'repeated hold() must not bank the interval twice:');
});

t('zero() resets a held clock', () => {
  const { c, tick } = fake();
  c.run(); tick(2000); c.hold();
  c.zero();
  eq(c.ms(), 0);
  eq(c.running, false);
});

/* Restart is pressed mid-sentence, so the clock is usually still running. */
t('zero() resets a RUNNING clock and does not resume it', () => {
  const { c, tick } = fake();
  c.run(); tick(2000);
  c.zero();
  eq(c.ms(), 0, 'restart left time on the clock:');
  eq(c.running, false, 'restart must leave it stopped, waiting for a press:');
  tick(3000);
  eq(c.ms(), 0, 'a zeroed clock must not keep counting:');
});

t('it can run again after zero()', () => {
  const { c, tick } = fake();
  c.run(); tick(2000); c.zero();
  c.run(); tick(250);
  eq(c.ms(), 250);
});

t('two clocks are independent', () => {
  const a = fake(), b = fake();
  a.c.run(); a.tick(100);
  eq(b.c.ms(), 0, 'state leaked between instances:');
});

t('elapsed never decreases while running', () => {
  const { c, tick } = fake();
  c.run();
  let last = c.ms();
  for (let i = 0; i < 20; i++) { tick(50); const n = c.ms(); ok(n >= last, 'went backwards'); last = n; }
  eq(last, 1000);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
