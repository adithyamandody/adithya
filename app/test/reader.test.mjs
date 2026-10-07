/* Tests for the one-switch book reader.  node app/test/reader.test.mjs
 *
 * The rules worth pinning are about what a single press can control. If a
 * chunk is too long the switch cannot interrupt it, and "press to pause"
 * quietly stops being true — which is the kind of failure a listener cannot
 * report.
 */
import {
  cleanPdfText, splitSentences, makeBook, clampAt, progress,
  remainingSeconds, humanTime, paceById, PACES, MAX_CHUNK, unspaceLetters,
} from '../reader.js';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ok   ${name}`); }
  catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};
const eq = (a, b, m = '') => {
  if (a !== b) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, m) => { if (!c) throw new Error(m); };

console.log('\nundoing PDF layout\n');

/* A PDF breaks lines where the column ended, not where the sentence did.
   Read aloud verbatim that is audible nonsense. */
t('single newlines inside a paragraph become spaces', () => {
  eq(cleanPdfText('the quick brown\nfox jumps'), 'the quick brown fox jumps');
});

t('blank lines survive as paragraph breaks', () => {
  eq(cleanPdfText('one line\n\nsecond para'), 'one line\n\nsecond para');
});

t('a word hyphenated across a line break is rejoined', () => {
  eq(cleanPdfText('accessi-\nbility matters'), 'accessibility matters');
});

t('Malayalam split across a line break is rejoined too', () => {
  eq(cleanPdfText('മല-\nയാളം'), 'മലയാളം');
});

/* A real hyphenated word at a line end must not be glued into one word when
   it is two — but we cannot know, so the common case (soft wrap) wins. This
   test documents the choice rather than claiming it is always right. */
t('runs of spaces collapse', () => {
  eq(cleanPdfText('too    many     spaces'), 'too many spaces');
});

t('empty input does not throw', () => {
  eq(cleanPdfText(''), '');
  eq(cleanPdfText(null), '');
});

/* Found by opening a real PDF: a heading set with letter-spacing extracts as
   "P R E S E N T E R", which a speech engine reads one letter at a time. It is
   the first line of many documents, so it is the first thing a listener hears. */
t('a letter-spaced heading is rejoined', () => {
  eq(unspaceLetters("P R E S E N T E R ' S  G U I D E"), "PRESENTER'S GUIDE");
  eq(unspaceLetters('A K S H A R A  S C A N'), 'AKSHARA SCAN');
});

t('a wide gap inside the run stays a word break', () => {
  eq(unspaceLetters('S E C T I O N  O N E begins'), 'SECTION ONE begins');
});

/* The first version matched mid-word and turned "with a b c" into "withabc",
   so the run has to start at a word boundary. */
t('ordinary prose with short words is left alone', () => {
  eq(unspaceLetters('normal sentence with a b c in it'), 'normal sentence with a b c in it');
  eq(unspaceLetters('the cat sat on a b c mat'), 'the cat sat on a b c mat');
  eq(unspaceLetters('ordinary text here'), 'ordinary text here');
});

t('cleanPdfText applies it', () => {
  ok(!cleanPdfText('T I T L E  H E R E\n\nbody text').startsWith('T I'),
     'the heading was left letter-spaced');
});

console.log('\nsplitting into speakable pieces\n');

t('sentences split on full stops', () => {
  const s = splitSentences('One thing. Two things. Three.');
  eq(s.length, 3);
  eq(s[0], 'One thing.');
});

t('the terminator stays attached', () => {
  const s = splitSentences('Is it this? Yes!');
  eq(s[0], 'Is it this?', 'a question read without its mark sounds wrong');
  eq(s[1], 'Yes!');
});

t('a trailing fragment with no full stop is still read', () => {
  const s = splitSentences('Complete. And then unfinished');
  eq(s.length, 2);
  eq(s[1], 'And then unfinished', 'the last line of a book often has no stop');
});

t('Malayalam sentences split', () => {
  const s = splitSentences('ഞാൻ ആദിത്യ. എനിക്ക് വയസ്സ് ഇരുപത്.');
  eq(s.length, 2);
  ok(s[0].startsWith('ഞാൻ'), 'got ' + s[0]);
});

t('the danda counts as a sentence end', () => {
  eq(splitSentences('ഒന്ന്। രണ്ട്।').length, 2);
});

/* The load-bearing one: if a chunk exceeds the limit, the switch cannot
   interrupt it and pause stops working. */
t('no piece is longer than the limit', () => {
  const long = 'word '.repeat(300);
  for (const p of splitSentences(long)) {
    ok(p.length <= MAX_CHUNK, `a piece was ${p.length} chars — unpausable`);
  }
});

t('a long sentence breaks at a clause mark, not mid-word', () => {
  const src =
    'This is a very long sentence that keeps going, and going, and going, '
    + 'and it carries on well past any reasonable length, so it must be cut, '
    + 'but it should be cut somewhere sensible rather than in the middle of a word, '
    + 'because a cut inside a word is audible and makes the reader sound broken, '
    + 'which is exactly the thing this whole feature is supposed to avoid.';
  ok(src.length > MAX_CHUNK, `the test sentence must exceed ${MAX_CHUNK}, it is ${src.length}`);

  const s = splitSentences(src);
  ok(s.length > 1, `should have been split, got ${s.length}`);
  for (const p of s) ok(p.length <= MAX_CHUNK, `piece too long: ${p.length}`);

  /* Rejoining the pieces must give the words back unbroken — that is what
     "not mid-word" actually means. */
  const rejoined = s.join(' ').replace(/\s+/g, ' ');
  eq(rejoined, src.replace(/\s+/g, ' '), 'words were lost or broken by the cut:');
});

t('empty text makes no pieces', () => {
  eq(splitSentences('').length, 0);
  eq(splitSentences('   ').length, 0);
});

console.log('\nthe book\n');

const BOOK = makeBook('First para, first sentence. Second one here.\n\nNew paragraph now.');

t('a book counts its pieces', () => {
  eq(BOOK.total, 3);
  eq(BOOK.pieces.length, 3);
});

t('paragraphs do not merge into one sentence', () => {
  ok(!BOOK.pieces.some(p => p.includes('here. New')), 'paragraph break was lost');
});

console.log('\nwhere we are\n');

t('position is clamped to the book', () => {
  eq(clampAt(BOOK, -5), 0, 'before the start');
  eq(clampAt(BOOK, 99), 2, 'past the end');
  eq(clampAt(BOOK, 1), 1);
});

t('a nonsense position does not escape', () => {
  eq(clampAt(BOOK, NaN), 0);
  eq(clampAt(BOOK, undefined), 0);
  eq(clampAt({ pieces: [], total: 0 }, 3), 0, 'an empty book has no position');
});

t('progress reaches 100 only at the last piece', () => {
  eq(progress(BOOK, 0), 33);
  eq(progress(BOOK, 2), 100);
  eq(progress({ pieces: [], total: 0 }, 0), 0);
});

t('time remaining shrinks as you go', () => {
  const a = remainingSeconds(BOOK, 0), b = remainingSeconds(BOOK, 2);
  ok(b < a, `expected less left at the end: ${a} then ${b}`);
});

t('a faster pace means less time left', () => {
  ok(remainingSeconds(BOOK, 0, 1.5) < remainingSeconds(BOOK, 0, 0.6));
});

t('times read as words, not seconds', () => {
  eq(humanTime(40), '40 s');
  eq(humanTime(600), '10 min');
  eq(humanTime(3900), '1 h 05 m');
  eq(humanTime(0), '—');
  eq(humanTime(NaN), '—');
});

console.log('\npace\n');

t('every pace has a label and a usable rate', () => {
  for (const p of PACES) {
    ok(p.label && p.id, 'a pace is missing its label');
    ok(p.rate > 0.3 && p.rate <= 2, `${p.id} rate ${p.rate} is outside what engines accept`);
  }
});

/* Slow is the useful end here: this is a listener processing language with
   effort, not someone skimming. */
t('slower-than-normal options exist', () => {
  ok(PACES.filter(p => p.rate < 1).length >= 2, 'need more than one slow setting');
});

t('an unknown pace falls back to normal rather than breaking', () => {
  eq(paceById('nonsense').rate, 1.0);
  eq(paceById(undefined).id, 'normal');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
