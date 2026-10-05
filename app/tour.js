/* First-run tour.
 *
 * Six steps, each teaching exactly one mechanic, and ending with something the
 * person keeps: their own introduction, saved as a quick phrase and spoken or
 * written out.
 *
 * The design rule throughout: nothing here may require a finger. Every step is
 * completable with the switch alone, because the person this is built for has
 * nothing else. Where a step needs a "done" signal, a DONE key is injected into
 * the scan rather than a button being put on screen.
 */

export const STEPS = [
  {
    id: 'press',
    title: 'Press once',
    body: 'A group of letters lights up teal. That is the computer asking '
        + '"is your letter in here?"<br><br>Press the switch now — it does not '
        + 'matter which letters are showing. Just feel the press.',
    hint: 'Press the switch',
    done: s => s.presses >= 1,
  },
  {
    id: 'wait',
    title: 'Now do nothing',
    body: 'Waiting is the other answer. If your letter is <em>not</em> in the '
        + 'teal group, you sit still and the bar runs out for you.<br><br>'
        + 'Let the bar empty twice without pressing.',
    hint: 'Do not press — let the bar run out',
    done: s => s.waits >= 2,
  },
  {
    id: 'letter',
    title: 'Type one letter',
    body: 'Now aim for something. Press only when <b class="t">ക</b> is in the '
        + 'teal group, and wait when it is not.',
    target: 'ക',
    hint: 'Press only when ക is teal',
    done: s => s.text.includes('ക'),
  },
  {
    id: 'name',
    title: 'Type your name',
    body: 'Your turn, unguided. Type your name in Malayalam.<br><br>'
        + 'If you make a mistake, tap switch 2 to delete. When you are finished, '
        + 'choose the <b>DONE</b> key.',
    free: true,
    hint: 'Type your name, then choose DONE',
    done: s => s.doneKey && s.text.trim().length > 0,
    keep: 'name',
  },
  {
    id: 'age',
    title: 'Type your age',
    body: 'Letters cannot say a number, so there is a second layer. Choose the '
        + '<b>123</b> key, type your age, then <b>DONE</b>.<br><br>'
        + 'A space brings you back to letters on its own.',
    free: true,
    numbers: true,
    hint: 'Choose 123, type your age, then DONE',
    done: s => s.doneKey && /\d/.test(s.text),
    keep: 'age',
  },
  {
    id: 'send',
    title: 'Send it',
    body: 'Here is your sentence. Two switches give a third command: '
        + '<b>hold switch 2</b>, or <b>press both together</b>, and it is spoken '
        + 'aloud — or written on the plotter, whichever you set.<br><br>'
        + 'Try it now.',
    hint: 'Hold switch 2, or press both switches',
    done: s => s.sent,
  },
];

export function sentenceFor(name, age) {
  const n = (name || '').trim();
  const a = (age || '').trim();
  if (!n) return '';
  return a ? `ഞാൻ ${n}, എനിക്ക് ${a} വയസ്സ്` : `ഞാൻ ${n}`;
}

export function makeState() {
  return { i: 0, presses: 0, waits: 0, doneKey: false, sent: false,
           text: '', kept: {} };
}

export function step(state) { return STEPS[state.i] || null; }
export function isLast(state) { return state.i >= STEPS.length - 1; }
