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

import { ScanSession, simulate } from './scan.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const D = { units: [], byId: {}, bigrams: {}, legal: {}, grid: null };
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
  practice: null,   // {id, char} the unit the guide is asking for
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
    onFrame: paintScan,
    onEmit: commit,
    onIdle: pause,
  });
  sess.presses = prev ? prev.presses : 0;     // counters persist across units
  sess.steps = prev ? prev.steps : 0;
  sess.t0 = prev ? prev.t0 : performance.now();
  S.session = sess;
  sess.begin();
}

/* Nobody pressed: stop, do not type, and say so. */
function pause() {
  S.paused = true;
  $('#ask-text').innerHTML = 'Paused — nothing was pressed.';
  $('#ask-keys').innerHTML = '<b>press</b> to start again';
  $('#scan').innerHTML = '<p class="idlemsg">Waiting for you. '
    + 'Nothing is typed while you do nothing.</p>';
}

function commit(unitId) {
  const u = D.byId[unitId];
  if (!u) return;
  if (u.id === 'ctl_pause') { pause(); return; }
  if (u.id === 'ctl_undo') S.buf.pop();
  else if (u.id === 'ctl_clear') S.buf = [];
  else S.buf.push(u);
  if (S.practice && u.id === S.practice.id) {
    S.practice = null;
    $('#practice').innerHTML = '<span>✓ That is it — you typed it with one button.</span>';
  }
  tick();
  paintText();
  paintStats();
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
   what the right move is — with a target you can actually aim at. */
function startPractice() {
  const pick = ['ka', 'na', 'ma', 'ta', 'v_a', 'pa', 'ya', 'ra'];
  const id = pick[Math.floor(Math.random() * pick.length)];
  S.practice = D.byId[id];
  S.buf = [];
  paintText();
  show('compose');
  startScan();
}

function paintPractice(f) {
  const el = $('#practice');
  if (!S.practice) { el.hidden = true; return; }
  el.hidden = false;
  const inGroup = f && f.mode === 'B' && f.hot.includes(S.practice.id);
  el.innerHTML =
    `<span>Type this:</span><span class="t">${escapeHtml(S.practice.char)}</span>`
    + `<span class="verdict">${inGroup
        ? '<span class="yes">It is in the teal group → PRESS</span>'
        : '<span class="no">Not in the teal group → wait, do nothing</span>'}</span>`;
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

function chip(id, cls) {
  const u = D.byId[id];
  if (!u) return '';
  const ctl = u.class === 'CTL' ? ' ctl' : '';
  const ch = u.id === 'p_sp' ? '␣' : u.char;
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
  $('#s-time').textContent = ((performance.now() - s.t0) / 1000).toFixed(1) + 's';
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
  if (S.session && S.session.running) { S.session.press(); return; }
  if (S.paused) {
    S.paused = false;
    $('#ask-text').innerHTML = 'Is your letter in the <b class="teal">teal</b> group?';
    $('#ask-keys').innerHTML = '<b>press</b> = yes &nbsp;·&nbsp; <b>wait</b> = no';
  }
  startScan();
}

addEventListener('keydown', e => {
  if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    e.preventDefault();
    doPress();
  }
});
addEventListener('pointerdown', e => {
  if (!S.tap) return;
  if (e.target.closest('button,select,input,nav')) return;
  doPress();
});

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

function speak() {
  const t = text();
  if (!t) return status('Nothing to speak.');
  if (!('speechSynthesis' in window)) return status('No speech synthesis on this device.');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = 'ml-IN';
  const ml = speechSynthesis.getVoices().find(v => /^ml/i.test(v.lang));
  if (ml) u.voice = ml;
  else status('⚠️ No Malayalam voice installed — Settings → Accessibility → '
            + 'Text-to-speech → install Malayalam. Falling back to default voice.');
  u.onend = () => { if (ml) status('Spoken.'); };
  speechSynthesis.speak(u);
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
    status(r.ok ? 'Plotting — do not touch the bed.' : `Server said ${r.status}.`);
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
function logSwitch(gap) {
  $('#link').className = 'pill ok';
  $('#link').textContent = 'switch: connected';
  if (!$('#settings').classList.contains('on')) return;
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
  $('[data-act=write]').onclick = write;
  $('[data-act=edit]').onclick = () => show('compose');
  $('[data-act=clear]').onclick = () => { clearAll(); show('compose'); };
  $('#cmp-run').onclick = () => runCompare(SAMPLE);
  $('#cmp-typed').onclick = () => runCompare(S.buf.map(u => u.id));
  $('#slower').onclick = () => nudgeSpeed(+1);   // + index = longer period
  $('#faster').onclick = () => nudgeSpeed(-1);
  $('#bksp').onclick = backspace;
  $('#clr').onclick = clearAll;
  $('#help-open').onclick = () => $('#help').classList.add('on');
  $('#help-go').onclick = () => { $('#help').classList.remove('on'); seen(); pause(); };
  $('#help-practice').onclick = () => { $('#help').classList.remove('on'); seen(); startPractice(); };
  $('#test-reset').onclick = () => { testN = 0; $('#test-lamp').innerHTML = ''; $('#test-out').textContent = 'no presses yet'; };

  $('#set-period').onchange = e => setSpeed(+e.target.value);
  $('#set-mode').onchange = e => { S.mode = e.target.value; save(); startScan(); };
  $('#set-audio').onchange = e => { S.audio = e.target.checked; save(); };
  $('#set-tap').onchange = e => { S.tap = e.target.checked; save(); };
  $('#set-server').oninput = e => { S.server = e.target.value.trim(); save(); };
}

function seen() {
  try { localStorage.setItem('aksharascan-seen', '1'); } catch (_) {}
}
function firstRun() {
  try { return !localStorage.getItem('aksharascan-seen'); } catch (_) { return true; }
}

const SPEEDS = [400, 600, 800, 1200, 1500, 2000, 2500, 3000];

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

function clearAll() {
  S.buf = [];
  S.practice = null;
  $('#practice').hidden = true;
  paintText();
  if (!S.paused) startScan();
}

function save() {
  try {
    localStorage.setItem('aksharascan', JSON.stringify(
      { mode: S.mode, period: S.period, audio: S.audio, tap: S.tap, server: S.server }));
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
