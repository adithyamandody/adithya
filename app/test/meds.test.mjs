/* Tests for medicine reminders.  node app/test/meds.test.mjs
 *
 * These matter more than most tests in this project. Everything else here
 * costs someone time if it is wrong; this one can cause a missed dose. So the
 * rules are tested against a fixed clock rather than the real one, and the
 * awkward cases — a typo'd time, a dose taken yesterday, a reminder that
 * should still be asking hours later — are pinned explicitly.
 */
import {
  minutesOf, hhmmOf, parseMeds, doseKey, dueNow, nextUp, dayPlan, spokenReminder,
} from '../meds.js';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};
const eq = (a, b, m = '') => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, m) => { if (!c) throw new Error(m); };

const DAY = '2026-10-07';

console.log('\nreading the clock\n');

t('times parse to minutes', () => {
  eq(minutesOf('08:00'), 480);
  eq(minutesOf('00:00'), 0);
  eq(minutesOf('23:59'), 1439);
  eq(minutesOf('8:05'), 485, 'a single-digit hour is normal to type:');
  eq(minutesOf('08.00'), 480, 'a full stop is a common way to write it:');
});

/* A typo must not quietly become midnight — that would schedule a dose at the
   wrong end of the day and look deliberate. */
t('impossible times are rejected, not rounded', () => {
  eq(minutesOf('25:00'), null);
  eq(minutesOf('08:75'), null);
  eq(minutesOf('abc'), null);
  eq(minutesOf(''), null);
  eq(minutesOf(null), null);
});

t('minutes format back to a readable time', () => {
  eq(hhmmOf(480), '08:00');
  eq(hhmmOf(0), '00:00');
  eq(hhmmOf(1439), '23:59');
});

console.log('\nreading the medicine list\n');

t('a simple line parses', () => {
  const m = parseMeds('Morning tablet 08:00');
  eq(m.length, 1);
  eq(m[0].name, 'Morning tablet');
  eq(m[0].times.length, 1);
  eq(m[0].times[0], 480);
});

t('several times on one line', () => {
  const m = parseMeds('Blood pressure 08:00, 20:00');
  eq(m[0].times.length, 2);
  eq(m[0].times[0], 480);
  eq(m[0].times[1], 1200);
  eq(m[0].name, 'Blood pressure', 'the comma must not end up in the name:');
});

t('a note after # is kept and not treated as the name', () => {
  const m = parseMeds('Vitamin D 09:00 # after food');
  eq(m[0].note, 'after food');
  eq(m[0].name, 'Vitamin D');
});

/* "Vitamin D3" must keep its 3. The time-stripping regex has to be careful. */
t('digits in a medicine name survive', () => {
  const m = parseMeds('Vitamin D3 09:00');
  eq(m[0].name, 'Vitamin D3');
  eq(m[0].times[0], 540);
});

t('blank lines, comment lines and junk are skipped', () => {
  const m = parseMeds('\n\n# a comment\nReal one 07:00\n   \n');
  eq(m.length, 1);
  eq(m[0].name, 'Real one');
});

/* A line with no time cannot remind anybody, so it must not become a silent
   entry that never fires. */
t('a line with no time is dropped', () => {
  eq(parseMeds('Just some text with no time').length, 0);
  eq(parseMeds('Paracetamol 25:00').length, 0, 'an invalid time leaves no time at all:');
});

t('a duplicated time is not scheduled twice', () => {
  const m = parseMeds('Thing 08:00, 08:00');
  eq(m.length, 1);
  eq(m[0].times.length, 1, 'the same time listed twice is still one dose:');
  eq(m[0].times[0], 480);
});

t('times come out in order however they were typed', () => {
  eq(parseMeds('Thing 20:00, 08:00')[0].times.join(','), '480,1200');
});

t('Malayalam names are fine', () => {
  const m = parseMeds('രാവിലത്തെ ഗുളിക 08:00');
  eq(m[0].name, 'രാവിലത്തെ ഗുളിക');
  eq(m[0].times[0], 480);
});

console.log('\nwhat is due\n');

const MEDS = parseMeds('Morning 08:00\nEvening 20:00\nTwice 08:00, 20:00');

t('nothing is due before the first dose', () => {
  eq(dueNow(MEDS, 7 * 60, new Set(), DAY).length, 0);
});

t('a dose is due at its time', () => {
  const d = dueNow(MEDS, 480, new Set(), DAY);
  eq(d.length, 2, 'Morning and Twice are both at 08:00');
});

/* The point of a long grace window: this user may be asleep or waiting for
   help, and a reminder that gives up quickly implies no dose was due. */
t('a dose keeps asking for two hours', () => {
  eq(dueNow(MEDS, 480 + 119, new Set(), DAY).length, 2, 'still asking at 1h59m');
  eq(dueNow(MEDS, 480 + 121, new Set(), DAY).length, 0, 'given up after the grace window');
});

t('a taken dose stops asking', () => {
  const taken = new Set([doseKey({ name: 'Morning' }, 480, DAY)]);
  const d = dueNow(MEDS, 480, taken, DAY);
  eq(d.length, 1);
  eq(d[0].med.name, 'Twice', 'only the untaken one should remain');
});

/* Taken-ness is per day, so yesterday's tick must not suppress today's dose. */
t("yesterday's dose does not count as today's", () => {
  const taken = new Set([doseKey({ name: 'Morning' }, 480, '2026-10-06')]);
  eq(dueNow(MEDS, 480, taken, DAY).length, 2, 'a dose taken yesterday must not silence today');
});

t('the most overdue comes first', () => {
  const m = parseMeds('Early 08:00\nLate 09:00');
  const d = dueNow(m, 9 * 60 + 30, new Set(), DAY);
  eq(d[0].med.name, 'Early');
  eq(d[0].lateMin, 90);
});

t('taking one dose of a twice-daily does not take the other', () => {
  const m = parseMeds('Twice 08:00, 20:00');
  const taken = new Set([doseKey(m[0], 480, DAY)]);
  eq(dueNow(m, 480, taken, DAY).length, 0, 'morning is done');
  eq(dueNow(m, 1200, taken, DAY).length, 1, 'evening must still fire');
});

console.log('\nthe rest of the day\n');

t('the next dose is reported when nothing is due', () => {
  const n = nextUp(MEDS, 7 * 60);
  eq(n.time, 480);
  eq(n.inMin, 60);
});

t('after the last dose there is no next', () => {
  eq(nextUp(MEDS, 23 * 60), null);
});

t('the day plan is ordered and labelled', () => {
  const rows = dayPlan(MEDS, 9 * 60, new Set(), DAY);
  eq(rows.length, 4);
  eq(rows[0].time, 480);
  eq(rows[0].state, 'due', 'an hour late is still inside the grace window');
  eq(rows[rows.length - 1].state, 'upcoming');
});

t('a dose past its grace window reads as missed, not due', () => {
  const rows = dayPlan(MEDS, 11 * 60, new Set(), DAY);
  eq(rows[0].state, 'missed');
});

t('a taken dose reads as taken whatever the time', () => {
  const taken = new Set([doseKey({ name: 'Morning' }, 480, DAY)]);
  const rows = dayPlan(MEDS, 23 * 60, taken, DAY);
  eq(rows.find(r => r.med.name === 'Morning').state, 'taken');
});

console.log('\nwhat it says out loud\n');

t('the spoken reminder includes the note when there is one', () => {
  const m = parseMeds('Vitamin D 09:00 # after food');
  eq(spokenReminder({ med: m[0] }), 'Vitamin D — after food');
});

t('and is just the name when there is not', () => {
  eq(spokenReminder({ med: { name: 'Morning', note: '' } }), 'Morning');
});

t('nothing due says nothing', () => {
  eq(spokenReminder(null), '');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
