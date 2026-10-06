/* AksharaScan — single-switch Malayalam text entry.
 *
 * Two scanning modes over one clock:
 *   A  row–column over a fixed grid        — what ships on Android today
 *   B  context-conditional Huffman tree,
 *      constrained to legal successors     — the contribution
 *
 * Every number shown anywhere comes from one ScanSession instance. Nothing
 * else increments a counter. See app/PLAN.md §4.
 */
'use strict';

import { ScanSession, simulate, decompose } from './scan.js';
import { makeClock } from './clock.js';
import { STEPS, sentenceFor, makeState, step as tourStep, isLast } from './tour.js';
import { PROVIDERS, say, scriptOf, routeFor, cacheStats, cacheClear } from './voice.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const D = { units: [], byId: {}, bigrams: {}, legal: {}, grid: null };
const clock = makeClock(() => performance.now());
const S = {
  buf: [],            // array of unit objects
  mode: 'B',
  period: 2000,   // start slow; the on-screen + button speeds it up
  audio: true,
  tap: true,
  server: '',
  session: null,
  paused: false,
  lastPressAt: 0,
  practice: null,   // {ids, i, word} the guide's target
  predict: true,    // word prediction (BUILD.md C5)
  layer: 'ml',      // 'ml' | 'num' | 'eng'
  action: 'speak',  // what a hold / chord does
  voiceFor: { ml: 'system', en: 'system' },
  keys: {},
};

/* ══════════════════════════ data ══════════════════════════ */

async function loadData() {
  const [units, bigrams, legal, grid] = await Promise.all(
    ['units', 'bigrams', 'legal', 'gridA'].map(n =>
      fetch(`data/${n}.json`).then(r => {
        if (!r.ok) throw new Error(`data/${n}.json → ${r.status}`);
        return r.json();
      }))
  );
  D.units = units;
  try {                                   // built by sim/build_model.py
    const r = await fetch('data/words.json');
    if (r.ok) D.words = await r.json();
  } catch (_) { /* hand-estimated model has none; the seed list covers it */ }
  D.bigrams = bigrams;
  D.legal = legal;
  D.grid = grid;
  for (const u of units) D.byId[u.id] = u;
}

/** Context = class of the last unit in the buffer. */
function context() {
  if (!S.buf.length) return 'SP';
  const c = S.buf[S.buf.length - 1].class;
  return D.legal[c] ? c : 'SP';
}

/* ═══════════════════════ compose view ═════════════════════ */

function startScan() {
  if (S.session) S.session.stop();
  const prev = S.session;
  const sess = new ScanSession({
    mode: S.mode,
    period: S.period,
    data: D,
    context,
    extra: candidates(),
    only: layerUnits(S.layer, context()),
    onFrame: paintScan,
    onEmit: commit,
    onIdle: maybePause,
  });
  sess.presses = prev ? prev.presses : 0;     // running total, for display
  sess.steps = prev ? prev.steps : 0;
  sess.selPresses = 0;                        // never carried: it gates idling
  S.session = sess;
  clock.run();
  sess.begin();
}

const IDLE_RUNS_BEFORE_PAUSE = 2;

/* Nobody pressed for a whole traversal. One is not enough to stop on — at
   2000 ms that is about ten seconds, which is just someone thinking. Give it
   two before pausing, then wait for a press. */
function maybePause() {
  if (S.tour) { S.tour.waits++; tourProgress(); startScan(); return; }
  S.idleRuns = (S.idleRuns || 0) + 1;
  if (S.idleRuns < IDLE_RUNS_BEFORE_PAUSE) { startScan(); return; }
  pause(true);
}

/* Nobody pressed: stop, do not type, and say so. */
function pause(afterIdle) {
  S.paused = true;
  S.idleRuns = 0;
  clock.hold();
  if (S.session) S.session.stop();   // a paused scanner must not keep stepping
  $('#ask-text').innerHTML = afterIdle ? 'Paused — no input for a while.' : 'Ready when you are.';
  $('#ask-keys').innerHTML = '<b>press</b> to start';
  $('#scan').innerHTML = '<p class="idlemsg">Waiting for you. '
    + 'Nothing is typed while you do nothing.</p>';
}

function setLayer(name) {
  S.layer = LAYERS[name] ? name : 'ml';
  S.idleRuns = 0;
  const k = $('#numkey');
  if (k) {
    k.textContent = S.layer === 'ml' ? '123  numbers'
                  : S.layer === 'num' ? 'ABC  english' : '⇦  malayalam';
    k.classList.toggle('on', S.layer !== 'ml');
  }
  startScan();
}

/* The visible button cycles, for whoever is holding the tablet. The switch user
   reaches every layer through the scan instead — a button they cannot press is
   not a feature. */
function cycleLayer() {
  setLayer(S.layer === 'ml' ? 'num' : S.layer === 'num' ? 'eng' : 'ml');
}

function commit(unitId) {
  if (unitId === 'ctl_done') {
    if (S.tour) { S.tour.doneKey = true; tourProgress(); }
    return;
  }
  if (unitId.startsWith('p:')) {          // a quick phrase: say it now
    const phrase = unitId.slice(2);
    S.buf = [];
    for (const ch of [...phrase]) {
      const unit = D.units.find(x => x.char === ch);
      if (unit) S.buf.push(unit);
    }
    S.idleRuns = 0;
    paintText(); paintStats();
    speak();                              // urgency is the whole point
    startScan();
    return;
  }
  if (unitId.startsWith('w:')) {         // a whole-word completion
    const word = unitId.slice(2);
    const pre = partial();
    for (let i = 0; i < [...pre].length; i++) S.buf.pop();   // drop the prefix
    for (const ch of [...word]) {
      const unit = D.units.find(x => x.char === ch);
      if (unit) S.buf.push(unit);
    }
    learnWord(word);
    learnPair(lastWord(), word);
    S.idleRuns = 0;
    tick(); paintText(); paintStats(); startScan();
    return;
  }
  const u = D.byId[unitId];
  if (!u) return;
  if (u.id === 'ctl_pause') { maybePause(); return; }
  if (u.id === 'ctl_123') { setLayer('num'); return; }
  if (u.id === 'ctl_eng') { setLayer('eng'); return; }
  if (u.id === 'ctl_ml') { setLayer('ml'); return; }
  /* A space ends a number. Returning to letters unasked saves the user from
     having to find the exit at all in the common case. */
  /* A space ends a number or an English word. Coming home unasked means the
     return key never has to be found in the common case. */
  if (S.layer !== 'ml' && u.class === 'SP') {
    S.buf.push(u);
    paintText(); paintStats();
    setLayer('ml');
    return;
  }
  if (u.id === 'ctl_undo') S.buf.pop();
  else if (u.id === 'ctl_clear') S.buf = [];
  else {
    if (u.class === 'SP') { const w = partial(); learnWord(w); learnPair(lastWord(), w); }
    S.buf.push(u);
  }
  S.idleRuns = 0;
  const want = practiceTarget();
  if (want && u.id === want.id) S.practice.i++;
  tick();
  paintText();
  paintStats();
  if (S.tour) tourProgress();
  startScan();
}

function text() { return S.buf.map(u => u.char).join(''); }

function paintText() {
  const el = $('#text');
  el.innerHTML = S.buf.length
    ? `${escapeHtml(text())}<span class="cursor"></span>`
    : '<span class="hint">Press <kbd>space</kbd>, tap, or use the switch</span>';
}

/* The step clock, drawn. Without this the scan feels arbitrary: you cannot see
   that not-pressing is an answer on a deadline. */
function paintTimer() {
  const bar = $('#timer i');
  const s = S.session;
  if (!bar) return;
  if (!s || !s.running || s.tStep == null) { bar.style.transform = 'scaleX(1)'; }
  else {
    const left = 1 - Math.min(1, (performance.now() - s.tStep) / s.period);
    bar.style.transform = `scaleX(${left.toFixed(3)})`;
  }
  requestAnimationFrame(paintTimer);
}
requestAnimationFrame(paintTimer);

/* ── guided practice ─────────────────────────────────────────────────────
   "I don't know how to work this" is answered best by being told, each step,
   what the right move is. Works on a whole WORD, because the thing people
   actually want to type first is their own name — and a name is where the
   hard parts live: vowel signs and the virama that joins ത + യ into ത്യ. */
function startPractice(word) {
  const ids = word ? decompose(D, word) : null;
  if (ids && ids.length) S.practice = { ids, i: 0, word };
  else {
    const pick = ['ka', 'na', 'ma', 'ta', 'v_a', 'pa', 'ya', 'ra'];
    const id = pick[Math.floor(Math.random() * pick.length)];
    S.practice = { ids: [id], i: 0, word: D.byId[id].char };
  }
  S.buf = [];
  S.idleRuns = 0;
  paintText();
  show('compose');
  startScan();
}

function practiceTarget() {
  const p = S.practice;
  return p && p.i < p.ids.length ? D.byId[p.ids[p.i]] : null;
}

function paintPractice(f) {
  const el = $('#practice');
  const p = S.practice;
  if (!p) { el.hidden = true; return; }
  el.hidden = false;

  if (p.i >= p.ids.length) {
    el.innerHTML = `<span>✓ You typed <b class="t">${escapeHtml(p.word)}</b> `
                 + 'with one button.</span>';
    return;
  }
  const t = D.byId[p.ids[p.i]];
  const done = p.ids.slice(0, p.i).map(id => D.byId[id].char).join('');
  const inGroup = f && f.mode === 'B' && f.hot.includes(t.id);
  const label = t.class === 'VIR' ? ' <small>(the join)</small>'
              : t.class === 'S' ? ' <small>(vowel sign)</small>' : '';
  el.innerHTML =
    `<span>${escapeHtml(p.word)} &nbsp;·&nbsp; next:</span>`
    + `<span class="t">${escapeHtml(t.class === 'S' || t.class === 'VIR'
        ? DOTTED + t.char : t.char)}</span>${label}`
    + `<span class="verdict">${inGroup
        ? '<span class="yes">in the teal group → PRESS</span>'
        : '<span class="no">not in the teal group → wait</span>'}</span>`;
}

function paintScan(f) {
  paintPractice(f);
  const el = $('#scan');
  if (f.mode === 'B') {
    el.className = '';
    const hot = new Set(f.hot);
    el.innerHTML = f.live.map(id => chip(id, hot.has(id) ? 'hot' : 'live')).join('');
    return;
  }
  el.className = 'rowmode';
  let html = '';
  for (let r = 0; r < Math.ceil(f.order.length / f.cols); r++) {
    const rowHot = f.phase === 'row' ? r === f.r : r === f.r;
    html += `<div class="gridrow${rowHot ? ' hot' : ''}">`;
    for (let c = 0; c < f.cols; c++) {
      const id = f.order[r * f.cols + c];
      if (!id) break;
      const hot = f.phase === 'col' && r === f.r && c === f.c;
      html += chip(id, hot ? 'hot' : (rowHot ? 'live' : ''));
    }
    html += '</div>';
  }
  el.innerHTML = html;
}

/* Vowel signs and the virama are COMBINING marks: alone they render as an
   invisible speck or a bare accent, so on a key they are unfindable. Reported
   from the live app — a user could not type ത്യ because the ് joining the two
   letters was not visible as a key.

   Fix: put them on a dotted circle (U+25CC), which is what Unicode charts,
   font viewers and every Indic keyboard do. ് becomes ◌്, ി becomes ◌ി. */
const COMBINING = new Set(['S', 'VIR']);
const DOTTED = '\u25CC';

const LAYER_KEYS = {
  ctl_123: ['123', 'numbers'],
  ctl_eng: ['ABC', 'english'],
  ctl_ml: ['⇦', 'malayalam'],
  ctl_done: ['✓', 'done'],
};

function chip(id, cls) {
  if (LAYER_KEYS[id]) {
    const [glyph, label] = LAYER_KEYS[id];
    return `<div class="u layer ${cls}">${escapeHtml(glyph)}<small>${label}</small></div>`;
  }
  if (id.startsWith('p:'))
    return `<div class="u phrase ${cls}">${escapeHtml(id.slice(2))}<small>say it</small></div>`;
  if (id.startsWith('w:'))
    return `<div class="u word ${cls}">${escapeHtml(id.slice(2))}</div>`;
  const u = D.byId[id];
  if (!u) return '';
  const ctl = u.class === 'CTL' ? ' ctl' : '';
  let ch = u.char;
  if (u.id === 'p_sp') ch = '␣';
  else if (COMBINING.has(u.class)) ch = DOTTED + u.char;

  /* The virama is not a letter at all — it joins the next consonant to this
     one to form a koottaksharam. Nobody guesses that from a floating mark. */
  if (u.id === 'x_vir')
    return `<div class="u ${cls} join" title="joins this letter to the next">`
         + `${escapeHtml(ch)}<small>join</small></div>`;

  if (u.id === 'ctl_pause')
    return `<div class="u ${cls} ctl pause" title="wait here to pause">`
         + `${escapeHtml(ch)}<small>pause</small></div>`;
  return `<div class="u ${cls}${ctl}">${escapeHtml(ch)}</div>`;
}

function paintStats() {
  const s = S.session;
  if (!s) return;
  $('#s-press').textContent = s.presses;
  $('#s-step').textContent = s.steps;
  $('#s-time').textContent = (clock.ms() / 1000).toFixed(1) + 's';
  $('#s-mode').textContent = S.mode;
}
setInterval(paintStats, 100);          // display only — never drives the scan

/* ═══════════════════════ input ════════════════════════════ */

function doPress() {
  const now = performance.now();
  const gap = now - S.lastPressAt;
  S.lastPressAt = now;
  logSwitch(gap);
  if ($('#settings').classList.contains('on')) return;   // test view: no scanning
  if (S.tour) S.tour.presses++;
  if (S.session && S.session.running) { S.session.press(); return; }
  if (S.paused) {
    S.paused = false;
    $('#ask-text').innerHTML = 'Is your letter in the <b class="teal">teal</b> group?';
    $('#ask-keys').innerHTML = '<b>press</b> = yes &nbsp;·&nbsp; <b>wait</b> = no';
  }
  startScan();
}

/* Two switches, two keys.
 *   switch 1 -> SPACE      select   (the scan answer: "yes, it is in here")
 *   switch 2 -> BACKSPACE  undo     (delete the last unit)
 * Both arrive as ordinary key events because the ESP32 pairs as a Bluetooth
 * HID keyboard, so nothing here is specific to our hardware — any commercial
 * switch interface that emits these keys works too. */
/* ── a third command from two switches ───────────────────────────────────
 * Holding switch 2, or holding both at once, fires a configurable action —
 * speak it, write it on the plotter, or both.
 *
 * Two routes on purpose. Pressing two switches simultaneously is genuinely
 * hard with impaired motor control, so a long hold on one switch must work on
 * its own; and some users find a hold harder than a chord, so both exist.
 *
 * Select fires on key DOWN and must never be delayed — the scan rhythm depends
 * on it, and waiting to see whether a press becomes a hold would add latency to
 * every single selection. Backspace has no such constraint, so it fires on key
 * UP, which is what makes a long hold detectable at all.
 */
const HOLD_MS = 900;
const down = { space: 0, bksp: 0 };
let holdTimer = null, chordFired = false;

function isSelect(e) { return e.code === 'Space' || e.key === ' ' || e.key === 'Enter'; }
function isBksp(e) { return e.key === 'Backspace' || e.key === 'Delete'; }

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT'
      || e.target.tagName === 'TEXTAREA') return;

  if (isSelect(e)) {
    e.preventDefault();
    if (e.repeat) return;
    down.space = performance.now();
    if (down.bksp) { fireChord(); return; }     // both held: chord
    doPress();                                   // never delayed
    return;
  }

  if (isBksp(e)) {
    e.preventDefault();                          // or the browser navigates back
    if (e.repeat) return;
    down.bksp = performance.now();
    if (down.space) { fireChord(); return; }
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { chordFired = true; fireAction('hold'); }, HOLD_MS);
  }
});

addEventListener('keyup', e => {
  if (isSelect(e)) { down.space = 0; return; }
  if (isBksp(e)) {
    const held = performance.now() - down.bksp;
    down.bksp = 0;
    clearTimeout(holdTimer);
    if (chordFired) { chordFired = false; return; }   // the hold already acted
    if (held < HOLD_MS) doBackspace();                // a tap: delete one unit
  }
});

function fireChord() {
  clearTimeout(holdTimer);
  chordFired = true;
  fireAction('both switches');
}

/* What the gesture does is the user's choice, because the right answer differs
   per person and per device: speech if they have a voice, the plotter if they
   need something on paper, both if they are being understood by someone across
   a room AND signing a form. */
function fireAction(how) {
  if (S.tour) { S.tour.sent = true; }
  const act = S.action || 'speak';
  if (!S.buf.length) { flash(`${how}: nothing to send yet`); return; }
  if (act === 'none') { flash(`${how}: no action set`); return; }
  if (act === 'speak' || act === 'both') speak();
  if (act === 'write' || act === 'both') write();
  if (S.tour) tourProgress();
  flash(`${how} → ${act === 'both' ? 'spoken and written' : act === 'write' ? 'sent to the plotter' : 'spoken'}`);
}

function flash(msg) {
  const el = $('#flash');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(flash.t);
  flash.t = setTimeout(() => el.classList.remove('on'), 2200);
}
addEventListener('pointerdown', e => {
  if (!S.tap) return;
  if (e.target.closest('button,select,input,nav')) return;
  doPress();
});

/* Switch 2. Deliberately NOT routed through doPress(): backspace must work
   whether the scanner is running, paused, or mid-selection — a user reaching
   for undo should never have to wait for a scan to finish first. */
function doBackspace() {
  S.lastBkspAt = performance.now();
  logSwitch(null, 'backspace');
  if (S.session && S.session.running) S.session.stop();
  backspace();
  if (S.paused) { $('#scan').innerHTML = ''; S.paused = false; }
  startScan();
}

/* audible tick — WebAudio, so there is no asset to fail to load */
let ac = null;
function tick() {
  if (!S.audio) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.14, ac.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.09);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.1);
  } catch (_) { /* audio is a nicety, never a dependency */ }
}

/* ═══════════════════════ output view ══════════════════════ */

function voiceSettings() {
  return { voiceFor: S.voiceFor || {}, keys: S.keys || {} };
}

async function speak() {
  const t = text();
  if (!t) return status('Nothing to speak.');
  const r = await say(t, voiceSettings());
  if (!r.ok) return status(`Could not speak: ${r.why}`);
  if (r.fellBack) status(`Cloud voice failed (${r.why}) — used the device voice instead.`);
  else if (r.cached) status('Spoken (from cache, no network used).');
  else status(`Spoken via ${PROVIDERS[r.provider].name}.`
    + (r.level === 'experimental'
        ? ' ⚠️ Malayalam is unofficial on this provider — judge the result yourself.'
        : ''));
}

/* Render every quick phrase once and cache it, so the urgent things play
   instantly and offline from then on. This is the whole point of allowing a
   network at all: it is used to LEARN a phrase, never to say one. */
async function prefetchPhrases() {
  const list = phrases();
  const btn = $('#prefetch');
  let done = 0, failed = 0, skipped = 0;
  for (const p of list) {
    btn.textContent = `Preparing ${done + failed + skipped + 1} of ${list.length}…`;
    const r = await say(p, voiceSettings(), { prefetch: true });
    if (r.prefetch) skipped++;
    else if (r.ok) done++;
    else failed++;
  }
  const n = await cacheStats();
  btn.textContent = 'Prepare phrases for offline';
  $('#cache-note').textContent =
    `${done} rendered, ${failed} failed, ${skipped} on the device voice. `
    + `${n} clips cached — these now play with no network.`;
}

/* Look before you plot. A bad plot costs ninety seconds and a sheet of paper,
   and shaping errors are obvious on screen but invisible in G-code. */
async function preview() {
  const t = text();
  if (!t) return status('Nothing to preview.');
  if (!S.server) return status('No plotter server set — Settings → Plotter server.');
  status('Rendering…');
  try {
    const r = await fetch(S.server.replace(/\/$/, '') + '/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t }),
    });
    if (!r.ok) return status(`Server said ${r.status}.`);
    const img = $('#out-preview');
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(await r.blob());
    img.hidden = false;
    status('This is exactly what the pen will draw.');
  } catch (e) {
    status(`Could not reach the plotter (${e.message}). Speech is unaffected.`);
  }
}

async function write() {
  const t = text();
  if (!t) return status('Nothing to write.');
  if (!S.server) return status('No plotter server set — Settings → Plotter server.');
  status('Sending to plotter…');
  try {
    const r = await fetch(S.server.replace(/\/$/, '') + '/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return status(j.error ? `Plotter: ${j.error}` : `Server said ${r.status}.`);
    status(j.dryRun
      ? `Dry run: ${j.contours} contours, ${j.widthMm}mm wide, ${j.travelMm}mm of pen travel. Nothing was printed.`
      : `Plotting — ${j.travelMm}mm of pen travel. Do not touch the bed.`);
  } catch (e) {
    status(`Could not reach the plotter (${e.message}). The rest of the demo is unaffected.`);
  }
}

const status = m => { $('#out-status').textContent = m; };

/* ═══════════════════════ compare view ═════════════════════
 * Simulated over the same unit sequence with the same clock — identical code
 * path, so the only difference is the scanning method.
 */

const SAMPLE = ['na', 's_ii', 'p_sp', 'sa', 's_u', 'kha', 'x_anu',
                'p_sp', 'v_aa', 'nna', 's_oo'];

function runCompare(ids) {
  if (!ids.length) return;
  $('#cmp-target').textContent = ids.map(i => D.byId[i] ? D.byId[i].char : '').join('');
  const a = simulate(D, ids, 'A'), b = simulate(D, ids, 'B');
  const c3b = simulate(D, ids, 'C3b');
  const sec = n => (n * S.period / 1000).toFixed(1) + 's';
  $('#a-press').textContent = a.presses; $('#a-step').textContent = a.steps;
  $('#b-press').textContent = b.presses; $('#b-step').textContent = b.steps;
  $('#a-time').textContent = sec(a.steps); $('#b-time').textContent = sec(b.steps);
  const x = a.steps / Math.max(b.steps, 1);
  const gain = 100 * (c3b.steps - b.steps) / Math.max(c3b.steps, 1);
  const saved = (a.steps - b.steps) * S.period / 1000;
  $('#cmp-verdict').innerHTML =
    `<b>${x.toFixed(1)}×</b> fewer scan steps — ${saved.toFixed(0)} seconds saved `
    + `on ${ids.length} selections, at ${S.period} ms per step.`
    + `<br><span style="font-size:14px;color:var(--dim)">vs an unconstrained context tree (C3b, the research baseline): `
    + `${gain >= 0 ? '−' : '+'}${Math.abs(gain).toFixed(1)}% steps — <b>this</b> is the number BUILD.md cares about.</span>`;
}

/* ═══════════════════════ switch test ══════════════════════ */

let testN = 0;
function logSwitch(gap, which = 'select') {
  $('#link').className = 'pill ok';
  $('#link').textContent = which === 'backspace' ? 'switch 2: backspace' : 'switch 1: select';
  if (!$('#settings').classList.contains('on')) return;
  if (which === 'backspace') {
    const i = document.createElement('i');
    i.className = 'on bk';
    $('#test-lamp').appendChild(i);
    $('#test-out').textContent = 'switch 2 (backspace) registered — this is the undo switch.';
    return;
  }
  const bounce = gap < 60 && testN > 0;      // two presses <60ms apart = bounce
  const i = document.createElement('i');
  i.className = bounce ? 'bounce' : 'on';
  $('#test-lamp').appendChild(i);
  testN++;
  $('#test-out').textContent = bounce
    ? `⚠️ ${testN} presses — last gap ${gap.toFixed(0)} ms. That is a bounce. `
      + 'Increase the firmware debounce before trusting any count.'
    : `${testN} presses${testN > 1 ? `, last gap ${gap.toFixed(0)} ms` : ''} — clean.`;
}

/* ═══════════════════════ shell ════════════════════════════ */

const escapeHtml = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function show(name) {
  $$('.view').forEach(v => v.classList.toggle('on', v.id === name));
  $$('#bar nav button').forEach(b => b.classList.toggle('on', b.dataset.view === name));
  if (name === 'output') $('#out-text').textContent = text() || '—';
  if (name === 'compare' && !$('#cmp-target').textContent) runCompare(SAMPLE);
}

function wire() {
  $$('#bar nav button').forEach(b => b.onclick = () => show(b.dataset.view));
  $('[data-act=speak]').onclick = speak;
  $('[data-act=preview]').onclick = preview;
  $('[data-act=write]').onclick = write;
  $('[data-act=edit]').onclick = () => show('compose');
  $('[data-act=clear]').onclick = () => { clearAll(); show('compose'); };
  $('#cmp-run').onclick = () => runCompare(SAMPLE);
  $('#cmp-typed').onclick = () => runCompare(S.buf.map(u => u.id));
  $('#slower').onclick = () => nudgeSpeed(+1);   // + index = longer period
  $('#faster').onclick = () => nudgeSpeed(-1);
  $('#numkey').onclick = cycleLayer;
  $('#bksp').onclick = backspace;
  $('#clr').onclick = clearAll;
  $('#help-open').onclick = () => $('#help').classList.add('on');
  $('#help-go').onclick = () => { $('#help').classList.remove('on'); seen(); pause(); };
  $('#help-practice').onclick = () => { $('#help').classList.remove('on'); seen(); startTour(); };
  $('#guide').onclick = () => startPractice($('#word').value.trim());
  $('#tour-start').onclick = startTour;
  $('#phrases').value = phrases().join('\n');
  $('#save-phrases').onclick = () => {
    const list = $('#phrases').value.split('\n').map(x => x.trim()).filter(Boolean);
    savePhrases(list);
    $('#save-phrases').textContent = `Saved ${list.length}`;
    setTimeout(() => { $('#save-phrases').textContent = 'Save phrases'; }, 1600);
    startScan();
  };
  $('#reset-phrases').onclick = () => {
    savePhrases(SEED_PHRASES);
    $('#phrases').value = SEED_PHRASES.join('\n');
    startScan();
  };
  $('#test-reset').onclick = () => { testN = 0; $('#test-lamp').innerHTML = ''; $('#test-out').textContent = 'no presses yet'; };

  $('#set-period').onchange = e => setSpeed(+e.target.value);
  $('#set-mode').onchange = e => { S.mode = e.target.value; save(); startScan(); };
  $('#set-audio').onchange = e => { S.audio = e.target.checked; save(); };
  $('#set-tap').onchange = e => { S.tap = e.target.checked; save(); };
  $('#voice-ml').onchange = e => { S.voiceFor = { ...S.voiceFor, ml: e.target.value }; save(); };
  $('#voice-en').onchange = e => { S.voiceFor = { ...S.voiceFor, en: e.target.value }; save(); };
  for (const id of ['google', 'deepgram', 'elevenlabs', 'groq', 'grok'])
    $(`#key-${id}`).oninput = e => { S.keys = { ...S.keys, [id]: e.target.value.trim() }; save(); };
  $('#prefetch').onclick = prefetchPhrases;
  $('#cache-clear').onclick = async () => {
    await cacheClear();
    $('#cache-note').textContent = 'Cache cleared — clips will be fetched again.';
  };
  $('#set-action').onchange = e => { S.action = e.target.value; save(); };
  $('#set-predict').onchange = e => { S.predict = e.target.checked; save(); startScan(); };
  $('#forget').onclick = () => {
    try { localStorage.removeItem('aksharascan-words'); } catch (_) {}
    $('#forget').textContent = 'Forgotten';
    startScan();
  };
  $('#set-server').oninput = e => { S.server = e.target.value.trim(); save(); };
}

function seen() {
  try { localStorage.setItem('aksharascan-seen', '1'); } catch (_) {}
}
function firstRun() {
  try { return !localStorage.getItem('aksharascan-seen'); } catch (_) { return true; }
}

/* Down to 400 ms for someone practised, out to 6000 for someone who is not —
   or who is tired, or newly injured. Scan speed is the single setting most
   likely to make the difference between a usable device and an abandoned
   one, so the slow end matters more than the fast end. */
const SPEEDS = [400, 600, 800, 1200, 1500, 2000, 2500, 3000, 4000, 5000, 6000];

/* ── word prediction (BUILD.md condition C5) ─────────────────────────────
 * 17 units for "എന്റെ പേര് ആദിത്യ" is 77 scan steps — two and a half minutes.
 * Letter-by-letter does not make sentences practical, which is why Intel's
 * single biggest win for Stephen Hawking was prediction, not a better tree.
 *
 * Seeded with common words, then it learns whatever gets typed. The learned
 * half matters most: a person says their own name far more often than any
 * word in a general corpus, and no general lexicon will ever contain it.
 */
const SEED_WORDS = [
  'ഞാൻ', 'നീ', 'എന്റെ', 'പേര്', 'ആണ്', 'അതെ', 'ഇല്ല',
  'നന്ദി', 'സുഖം', 'വെള്ളം', 'വേണം', 'എവിടെ',
];
const MAX_CANDIDATES = 5;

/* ── quick phrases ───────────────────────────────────────────────────────
 * The thing a single-switch user needs most is not a faster alphabet. It is
 * that urgent things are instant. "Pain" or "help" costing thirty seconds is
 * the difference between a device that gets used and one that gets abandoned.
 *
 * Phrases are offered only at the START of an utterance, where they make
 * sense, and they take a large share of the probability mass there — so they
 * land one or two presses deep. Selecting one speaks it immediately.
 *
 * The seed list is deliberately short and generic. The real list is personal,
 * which is why it is editable and stored per device.
 */
const SEED_PHRASES = [
  'അതെ', 'ഇല്ല', 'ശരി', 'നന്ദി',
  'സഹായം', 'വേദന', 'വെള്ളം', 'മതി',
];
const PHRASE_MASS = 0.42;        // at utterance start, phrases dominate

/* ── the number layer ────────────────────────────────────────────────────
 * Digits are rare in prose, so the tree buries them: the first digit of a
 * number costs ~9 steps against ~4 for a common letter. Switching to a
 * digits-only layer makes every digit ~3 steps and, more importantly, puts
 * them somewhere predictable. This is the "123" key. */
/* Three layers. A boolean does not extend, so this is an enum: 'ml' is the
 * default Malayalam alphabet, 'num' the digits, 'eng' the Latin letters.
 *
 * Each non-default layer carries a cheap way home. Leaving a mode you entered
 * by accident is the most urgent thing a switch user can want, so the return
 * key is always cheaper than anything it competes with. */
const LAYERS = {
  num: { cls: 'NUM', key: 'ctl_123', label: '123  numbers' },
  eng: { cls: 'LAT', key: 'ctl_eng', label: 'ABC  english' },
};
const LAYERED = new Set(Object.values(LAYERS).map(l => l.cls));

function layerUnits(name, ctx) {
  const spec = LAYERS[name];
  if (spec) {
    /* An explicit layer is an exact set: every member reachable, however rare
       in the corpus. The user chose this mode, so "F is uncommon" is no reason
       to make F untypeable. */
    const members = D.units.filter(u => u.class === spec.cls).map(u => u.id);
    return members.length ? [...members, 'p_sp', 'ctl_undo', 'ctl_ml'] : null;
  }

  /* The DEFAULT layer must be restricted too, and this is easy to miss. The
     corpus is Malayalam Wikipedia, which is full of inline English and digits,
     so the learned legal sets contain them — and the base alphabet arrived at
     100 keys instead of ~47, with B, n, P and 9 sitting among the Malayalam.
     Every Malayalam letter paid for symbols that have their own layer.
     A layer is only a layer if its contents are NOT also in the main set. */
  /* The default layer is a FILTER on what is legal here, not a replacement —
     dropping legality would discard the one mechanism the project is about. */
  const legal = D.legal[ctx] || D.legal.SP;
  return legal.filter(id => !LAYERED.has((D.byId[id] || {}).class));
}
const WORD_MASS = 0.34;        // share of probability words take from letters

function phrases() {
  try {
    const own = JSON.parse(localStorage.getItem('aksharascan-phrases') || 'null');
    if (Array.isArray(own)) return own;
  } catch (_) {}
  return SEED_PHRASES;
}

function savePhrases(list) {
  try { localStorage.setItem('aksharascan-phrases', JSON.stringify(list)); } catch (_) {}
}

function lexicon() {
  let learned = [];
  try { learned = JSON.parse(localStorage.getItem('aksharascan-words') || '[]'); }
  catch (_) {}
  /* Order matters: what this person typed, then what the corpus says is
     common, then the seeds. A personal lexicon beats a general one for AAC —
     no corpus contains someone's own name. */
  return [...new Set([...learned, ...(D.words || []), ...SEED_WORDS])];
}

function learnWord(w) {
  if (!w || [...w].length < 2) return;
  try {
    const prev = JSON.parse(localStorage.getItem('aksharascan-words') || '[]');
    const next = [w, ...prev.filter(x => x !== w)].slice(0, 200);   // recency first
    localStorage.setItem('aksharascan-words', JSON.stringify(next));
  } catch (_) {}
}

/** The partial word currently being typed — everything since the last space. */
function partial() {
  const out = [];
  for (let i = S.buf.length - 1; i >= 0; i--) {
    if (S.buf[i].class === 'SP') break;
    out.unshift(S.buf[i].char);
  }
  return out.join('');
}

/** Words that followed this one before — next-word prediction, learned. */
function nextWords(prev) {
  try {
    const pairs = JSON.parse(localStorage.getItem('aksharascan-pairs') || '{}');
    return pairs[prev] || [];
  } catch (_) { return []; }
}

function learnPair(prev, next) {
  if (!prev || !next) return;
  try {
    const pairs = JSON.parse(localStorage.getItem('aksharascan-pairs') || '{}');
    const list = pairs[prev] || [];
    pairs[prev] = [next, ...list.filter(w => w !== next)].slice(0, 8);
    localStorage.setItem('aksharascan-pairs', JSON.stringify(pairs));
  } catch (_) {}
}

/** The last completed word, for next-word prediction. */
function lastWord() {
  const done = [];
  let seenSpace = false;
  for (let i = S.buf.length - 1; i >= 0; i--) {
    if (S.buf[i].class === 'SP') { if (seenSpace) break; seenSpace = true; continue; }
    if (seenSpace) done.unshift(S.buf[i].char);
  }
  return done.join('');
}

/** Everything the tree should offer beyond letters: {unitId: weight}. */
function candidates() {
  const out = {};

  if (S.tour) {
    const st = tourStep(S.tour);
    if (st && st.free) {
      out.ctl_done = DONE_KEY_MASS;
      if (S.layer !== 'ml') return { ctl_ml: HOME_KEY_MASS, ctl_done: DONE_KEY_MASS };
      if (st.numbers) out.ctl_123 = 0.12;
      return out;
    }
    if (S.layer !== 'ml') return { ctl_ml: HOME_KEY_MASS };
    return null;                     // early steps: letters only, no clutter
  }

  /* Inside a layer the only thing that matters is getting out again. */
  if (S.layer !== 'ml') return { ctl_ml: HOME_KEY_MASS };

  /* The 123 key is offered in EVERY context. Restricting it to word boundaries
     meant a user part-way through a word could not reach numbers at all
     without backspacing out — a trap, and one only reachable by a switch user
     since there is no finger to tap the button with. */
  out.ctl_123 = NUM_KEY_MASS;
  out.ctl_eng = ENG_KEY_MASS;

  if (!S.predict) return out;

  // start of an utterance: offer phrases, and nothing is half-typed
  if (!S.buf.length) {
    const ph = phrases().slice(0, 8);
    if (ph.length) {
      const each = PHRASE_MASS / ph.length;
      for (const p of ph) out[`p:${p}`] = each;
    }
    return out;
  }

  const pre = partial();

  // just finished a word: offer what usually follows it
  if (!pre) {
    const nx = nextWords(lastWord()).slice(0, MAX_CANDIDATES);
    if (nx.length) {
      const each = WORD_MASS / nx.length;
      for (const w of nx) out[`w:${w}`] = each;
    }
    return out;
  }

  // mid-word: complete it
  const hits = lexicon().filter(w => w.startsWith(pre) && w !== pre).slice(0, MAX_CANDIDATES);
  if (hits.length) {
    const each = WORD_MASS / hits.length;
    for (const w of hits) out[`w:${w}`] = each;
  }
  return out;
}

/* Reaching the number layer must itself be cheap, or the layer solves nothing.
   And LEAVING it must be cheaper still: escaping a mode you entered by accident
   is the most urgent thing a switch user can want to do. */
const NUM_KEY_MASS = 0.05;
const ENG_KEY_MASS = 0.04;
const HOME_KEY_MASS = 0.30;
const DONE_KEY_MASS = 0.22;      // the tour's "I have finished typing" key

/* ── the tour ────────────────────────────────────────────────────────────
 * Nothing in here may require a finger. Where a step needs the person to say
 * "I am done", a DONE key goes into the SCAN rather than a button onto the
 * screen — the user this is built for has no other way to answer.
 */
function tourOn() { return !!S.tour; }

function startTour() {
  S.tour = makeState();
  S.buf = [];
  S.practice = null;
  S.layer = 'ml';
  $('#practice').hidden = true;
  $('#help').classList.remove('on');
  show('compose');
  paintText();
  paintTour();
  startScan();
}

function endTour(completed) {
  const t = S.tour;
  S.tour = null;
  $('#tour').hidden = true;
  seen();
  if (completed && t) {
    const line = sentenceFor(t.kept.name, t.kept.age);
    if (line) {
      const list = [...new Set([line, ...phrases()])];
      savePhrases(list);
      $('#phrases') && ($('#phrases').value = list.join('\n'));
      flash('Saved as a quick phrase — 3 presses from now on');
    }
  }
  startScan();
}

/** Advance when the current step's condition is met. */
function tourProgress() {
  const t = S.tour;
  if (!t) return;
  const st = tourStep(t);
  if (!st) return;
  t.text = text();
  if (!st.done(t)) { paintTour(); return; }

  if (st.keep) t.kept[st.keep] = text().trim();
  if (st.free && st.keep) learnWord(text().trim());

  if (isLast(t)) { endTour(true); return; }
  t.i++;
  t.presses = 0; t.waits = 0; t.doneKey = false; t.sent = false;
  /* The name and age steps each start from a blank line; the earlier steps
     leave their practice letters behind, which would otherwise end up inside
     the person's own name. */
  if (tourStep(t).free || tourStep(t).target) S.buf = [];
  if (tourStep(t).id === 'send') S.buf = decompose(D, sentenceFor(t.kept.name, t.kept.age))
    .map(id => D.byId[id]).filter(Boolean);
  S.layer = 'ml';
  paintText();
  paintTour();
  startScan();
}

function paintTour() {
  const t = S.tour;
  const el = $('#tour');
  if (!t) { el.hidden = true; return; }
  const st = tourStep(t);
  if (!st) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML =
    `<div class="head"><span class="n">Step ${t.i + 1} of ${STEPS.length}</span>`
    + `<span class="dots">${STEPS.map((_, i) =>
        `<i class="${i < t.i ? 'done' : i === t.i ? 'now' : ''}"></i>`).join('')}</span>`
    + `<button id="tour-skip">Skip</button></div>`
    + `<h3>${st.title}</h3><p>${st.body}</p>`
    + `<p class="hint">${st.hint}</p>`;
  $('#tour-skip').onclick = () => endTour(false);
}

function setSpeed(ms) {
  S.period = ms;
  $('#speed').textContent = `${ms} ms`;
  const sel = $('#set-period');
  if (sel && [...sel.options].some(o => +o.value === ms)) sel.value = ms;
  save();
  if (!S.paused) startScan();          // apply immediately, mid-sentence
}

function nudgeSpeed(dir) {
  const i = SPEEDS.indexOf(S.period);
  const j = Math.min(SPEEDS.length - 1, Math.max(0, (i < 0 ? 5 : i) + dir));
  setSpeed(SPEEDS[j]);
}

/* Backspace and clear, reachable by hand. They also exist inside the scan tree
   for a genuine one-switch user — these are for whoever is holding the tablet. */
function backspace() {
  if (!S.buf.length) return;
  S.buf.pop();
  paintText();
  if (!S.paused) startScan();          // the context changed, so rebuild the tree
}

/* Start over. Clearing the sentence but keeping the counters was the wrong
   split: between two judges at a fair the text is the least of it, and the
   second person inherited the first one's press count and timer. There was no
   way at all to zero those, so the numbers only ever grew. This resets the
   whole attempt and waits for a press, rather than scanning at nobody. */
function clearAll() {
  S.buf = [];
  S.practice = null;
  $('#practice').hidden = true;
  clock.zero();
  if (S.session) { S.session.presses = 0; S.session.steps = 0; }
  paintText();
  paintStats();
  pause();
}

function save() {
  try {
    localStorage.setItem('aksharascan', JSON.stringify(
      { mode: S.mode, period: S.period, audio: S.audio, tap: S.tap,
        predict: S.predict, action: S.action, server: S.server,
        voiceFor: S.voiceFor, keys: S.keys }));
  } catch (_) { /* private mode — settings just will not persist */ }
}

function restore() {
  try {
    Object.assign(S, JSON.parse(localStorage.getItem('aksharascan') || '{}'));
  } catch (_) { /* ignore */ }
  $('#set-period').value = S.period;
  $('#speed').textContent = `${S.period} ms`;
  $('#set-mode').value = S.mode;
  $('#set-audio').checked = S.audio;
  $('#set-tap').checked = S.tap;
  $('#set-predict').checked = S.predict !== false;
  $('#set-action').value = S.action || 'speak';
  $('#voice-ml').value = (S.voiceFor || {}).ml || 'system';
  $('#voice-en').value = (S.voiceFor || {}).en || 'system';
  for (const id of ['google', 'deepgram', 'elevenlabs', 'groq', 'grok'])
    $(`#key-${id}`).value = (S.keys || {})[id] || '';
  cacheStats().then(n => {
    if (n) $('#cache-note').textContent = `${n} clips cached — these play with no network.`;
  });
  $('#set-server').value = S.server || '';
}

(async function main() {
  try {
    await loadData();
  } catch (e) {
    $('#scan').innerHTML =
      `<p class="muted">Could not load data: ${escapeHtml(e.message)}<br>`
      + `Run <code>python3 sim/export_data.py</code>, then serve this folder over `
      + `http (not file://).</p>`;
    return;
  }
  restore();
  wire();
  paintText();
  if (firstRun()) $('#help').classList.add('on');
  else $('#help').classList.remove('on');
  pause();                      // idle until the first press; never type unprompted
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      /* A device that already holds an old worker gets the new one on the next
         activation; reload once so it is actually running the new code rather
         than the version it first installed. */
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
      reg.update().catch(() => {});
    }).catch(() => { /* offline is a bonus, never a dependency */ });
  }
  if ('speechSynthesis' in window) speechSynthesis.getVoices();   // warm the list
})();
