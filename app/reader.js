/* Reading a book with one switch.
 *
 * Someone who cannot hold a book or turn a page can still read, if the book
 * reads itself and they control the pace. That is the whole feature: load a
 * PDF, hear it a sentence at a time, and steer with the same two switches —
 * press to pause or resume, switch 2 to go back and hear it again.
 *
 * Going BACK matters more than going forward. Attention wanders, a carer
 * interrupts, a sentence is missed; forward happens on its own, so the scarce
 * control should be the one that recovers from a loss.
 *
 * This file is logic only — no DOM, no pdf.js, no speech — so the splitting
 * and position rules can be tested without a browser or a PDF.
 */

/** Longest chunk handed to the speech engine at once.
 *
 *  A 600-character sentence is unpausable: the switch cannot interrupt until
 *  the engine finishes, so "press to pause" stops being true. Long sentences
 *  are therefore broken at clause boundaries. */
export const MAX_CHUNK = 220;

/* Pace is the engine's speech rate. Slower than normal is the useful end:
   this is a listener who may be processing language with effort, not someone
   skimming. 1.0 is the engine's default. */
export const PACES = [
  { id: 'very-slow', label: 'Very slow', rate: 0.6 },
  { id: 'slow',      label: 'Slow',      rate: 0.8 },
  { id: 'normal',    label: 'Normal',    rate: 1.0 },
  { id: 'brisk',     label: 'Brisk',     rate: 1.25 },
  { id: 'fast',      label: 'Fast',      rate: 1.5 },
];

export function paceById(id) {
  return PACES.find(p => p.id === id) || PACES[2];
}

/**
 * Tidy text pulled out of a PDF.
 *
 * PDF extraction returns lines as they were laid out, not as they read: a
 * sentence is broken wherever the column ended, and words are split across
 * lines with a hyphen. Reading that aloud verbatim produces audible nonsense,
 * so the layout has to be undone before anything else happens.
 */
export function cleanPdfText(raw) {
  let s = String(raw || '');

  s = s.replace(/\r\n?/g, '\n');
  s = s.replace(/­/g, '');                      // soft hyphens
  /* A word split across a line break: "accessi-\nbility" -> "accessibility" */
  s = s.replace(/([A-Za-zഀ-ൿ])-\n([A-Za-zഀ-ൿ])/g, '$1$2');
  /* A single newline inside a paragraph is layout, not a break. Two or more
     is a real paragraph, so keep that distinction before collapsing. */
  s = s.replace(/\n{2,}/g, '\u0000');
  s = s.replace(/\n/g, ' ');
  s = s.replace(/\u0000/g, '\n\n');
  /* Must run BEFORE runs of spaces are collapsed: the gap width is the only
     clue left about where the words were. */
  s = unspaceLetters(s);

  s = s.replace(/[ \t ]{2,}/g, ' ');

  return s.trim();
}

/**
 * Undo letter-spaced headings.
 *
 * A heading set with letter-spacing extracts as "P R E S E N T E R", and a
 * speech engine reads that one letter at a time. It is the first line of many
 * documents, so it would be the first thing the listener hears.
 *
 * Inside such a run a single space is the letter-spacing and a wider gap is a
 * real word break, which is why this must happen before whitespace is
 * collapsed. Four single characters in a row is the threshold: "a b c" occurs
 * innocently, four in sequence effectively does not.
 *
 * The run must also START at a word boundary. Without that, "with a b c" is
 * read as a run beginning at the "h" and comes out as "withabc".
 *
 * KNOWN LIMIT: when the extractor gives single spaces BETWEEN the words too —
 * which happens because letter-spacing makes the inter-word gap no wider than
 * the inter-letter one — the word boundaries are genuinely gone and the whole
 * heading joins into one token. "PRESENTER'SGUIDE" is poor, but it is better
 * than a speech engine reading out eighteen separate letters. Body text is not
 * letter-spaced, so this costs headings only.
 */
export function unspaceLetters(text) {
  return String(text || '').replace(
    /(?<![^\s])(?:[^\s](?:[ \t]{1,2})){3,}[^\s](?![^\s])/g,
    run => run
      .split(/[ \t]{2,}/)                 // a wide gap was a word boundary
      .map(word => word.replace(/[ \t]/g, ''))
      .join(' '));
}


/** Break a long run of text at the least-bad place, preferring clause marks. */
function splitLong(chunk, max) {
  const out = [];
  let rest = chunk.trim();

  while (rest.length > max) {
    const window = rest.slice(0, max);
    /* Prefer a clause boundary, then any space; a mid-word cut is the last
       resort because it is audible. */
    let cut = Math.max(
      window.lastIndexOf('; '), window.lastIndexOf(', '),
      window.lastIndexOf(' — '), window.lastIndexOf(': '));
    if (cut < max * 0.4) cut = window.lastIndexOf(' ');
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Split into speakable pieces.
 *
 * Malayalam ends sentences with the ordinary full stop, and the danda (।)
 * appears in older and quoted text, so both count. A piece is what one press
 * can pause and one press of switch 2 can repeat.
 */
export function splitSentences(text, max = MAX_CHUNK) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  /* Keep the terminator attached: it carries the intonation the engine needs,
     and a sentence read without its question mark sounds wrong. */
  const rough = clean.match(/[^.!?।]+[.!?।]+(?:["'”’)\]]+)?|[^.!?।]+$/g) || [clean];

  const out = [];
  for (const piece of rough) {
    const t = piece.trim();
    if (!t) continue;
    if (t.length <= max) out.push(t);
    else out.push(...splitLong(t, max));
  }
  return out.filter(Boolean);
}

/** Build the readable book. Paragraphs are preserved as breaks between runs. */
export function makeBook(text, max = MAX_CHUNK) {
  const cleaned = cleanPdfText(text);
  const parts = [];
  for (const para of cleaned.split(/\n{2,}/)) {
    parts.push(...splitSentences(para, max));
  }
  return { pieces: parts, total: parts.length };
}

/** Keep a position inside the book, whatever is asked for. */
export function clampAt(book, i) {
  if (!book || !book.total) return 0;
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(book.total - 1, Math.round(i)));
}

/** How far through, as a whole percentage. */
export function progress(book, at) {
  if (!book || !book.total) return 0;
  return Math.round(((clampAt(book, at) + 1) / book.total) * 100);
}

/**
 * Roughly how long is left, in seconds.
 *
 * Deliberately crude — it is for "about twenty minutes left", not a countdown.
 * 2.6 words per second is ordinary speech; the pace rate scales it.
 */
export function remainingSeconds(book, at, rate = 1) {
  if (!book || !book.total) return 0;
  const words = book.pieces.slice(clampAt(book, at))
    .reduce((n, p) => n + p.split(/\s+/).length, 0);
  return Math.round(words / (2.6 * (rate || 1)));
}

/** "1 h 05 m" / "3 min" / "40 s" — read by a person, not parsed. */
export function humanTime(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  if (sec < 90) return `${Math.round(sec)} s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m`;
}
