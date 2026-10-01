# AksharaScan App — Build Plan

**Decided.** This document is the spec; it no longer weighs options.

**Hardware:** tablet · 2× ESP32 · 2-pin push button · 3D printer → pen plotter
**Deliverable:** an offline tablet app that lets someone compose Malayalam with one button, hear it spoken, and have a machine write it on paper.

---

## 0. The decisions, stated once

| Question | Decision | Why |
|---|---|---|
| Framework | **PWA** — plain HTML/CSS/JS, installed to the home screen | He knows web basics; save-and-refresh beats rebuild over four weeks of exams |
| Build tooling | **None.** No npm, no bundler, no Node | A bundler is a thing that breaks the night before a fair |
| Button → tablet | **ESP32 as a BLE HID keyboard**, sends spacebar | Zero Bluetooth code in the app. Real AAC switches are HID devices |
| Printer → tablet | **Second ESP32**, separate path | The bonus must never be able to break the critical path |
| Malayalam shaping | **Python on the laptop**, not on-device | Conjuncts need HarfBuzz; the ESP32 cannot do this |
| Scan timing | `requestAnimationFrame` + `performance.now()` | `setInterval` drifts; drift corrupts both the user and the measurement |

**If any of this has to change, change it before phase 2, not after.**

---

## 1. Architecture

```
  ESP32 #1                 Tablet (PWA)                 Laptop                Printer
 ┌─────────┐   BLE HID    ┌────────────┐   WiFi/HTTP   ┌──────────┐  USB    ┌─────────┐
 │ button  │ ──spacebar─> │ scan tree  │ ───JSON────>  │  Python  │ ──G───> │ + pen   │
 └─────────┘              │ TTS speaks │               │  shaper  │  code   │  mount  │
                          └────────────┘               └──────────┘         └─────────┘
 └──────────── CRITICAL PATH ───────────┘               └──────── BONUS ──────────────┘
```

**The rule:** button → scan → speak must survive the printer, laptop, WiFi and every line of G-code failing at once. Nothing on the bonus path shares a device, a connection or a code path with the critical path.

---

## 2. Folder layout

```
app/
├── PLAN.md               ← this file
├── index.html            single page, four views
├── app.js                scan engine + tree builder + UI
├── style.css
├── sw.js                 service worker (offline)
├── manifest.json         installable to home screen
├── data/
│   ├── units.json        the symbol inventory
│   ├── bigrams.json      P(unit | previous class)
│   ├── legal.json        which units may follow which   ← the contribution
│   └── gridA.json        the baseline row–column layout
├── firmware/
│   ├── switch/           ESP32 #1 — BLE HID keyboard
│   └── plotter/          ESP32 #2 — serial bridge
└── server/
    ├── shape.py          Malayalam → paths → G-code
    └── serve.py          Flask: POST /write
```

---

## 3. Data contract

Exported by the Python simulator. **The app must not contain a precomputed tree** — it builds trees at runtime, so when a judge asks "is it really computing this?" the answer is yes.

```jsonc
// units.json — the inventory
[ { "id": "ka", "char": "ക", "class": "C" },
  { "id": "aa", "char": "ാ", "class": "S" },
  { "id": "sp", "char": " ",  "class": "SP" },
  { "id": "undo", "char": "⌫", "class": "CTL" } ]

// classes: V vowel · C consonant · S vowel-sign · VIR virama
//          ANU anusvara · CH chillu · SP space/punct · CTL control

// bigrams.json — P(unit | previous class), rows sum to 1
{ "C":  { "aa": 0.11, "i": 0.08, "ka": 0.02, ... },
  "SP": { "ka": 0.05, "na": 0.04, ... } }

// legal.json — the hard constraint
{ "C":   ["aa","i","ii","u","vir","anu","sp", ...],
  "VIR": ["ka","kha","ga", ...],
  "S":   ["ka","kha", ...,"sp"] }
```

`undo` and `clear` live **inside** the tree. With one switch there is nowhere else to put them — this is a design constraint, not an oversight, and it is worth saying out loud to a judge.

---

## 4. The scan engine (the heart — get this right)

Two modes, same clock. Every number in the demo comes from here, so it is the one place to be pedantic.

```js
// ---- tree construction: rebuilt after every selection in Mode B ----
function buildTree(probs) {
  let nodes = Object.entries(probs).map(([u, p]) => ({ p, unit: u }));
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.p - b.p);            // n ≈ 70, sort is fine
    const a = nodes.shift(), b = nodes.shift();
    nodes.push({ p: a.p + b.p, lo: a, hi: b }); // hi = heavier = highlighted first
  }
  return nodes[0];
}

function treeFor(prevClass) {
  const allowed = LEGAL[prevClass];                       // ← the constraint
  const row = BIGRAMS[prevClass];
  const probs = {}; let z = 0;
  for (const u of allowed) { probs[u] = row[u] ?? 1e-6; z += probs[u]; }
  for (const u of allowed) probs[u] /= z;                 // renormalise
  return buildTree(probs);
}

// ---- the clock: one source of truth for timing ----
class Scanner {
  constructor(periodMs, onHighlight, onEmit) {
    this.period = periodMs;
    this.onHighlight = onHighlight;
    this.onEmit = onEmit;
    this.pressed = false;
    this.presses = 0;
    this.steps = 0;
  }
  press() { this.pressed = true; }                        // called by keydown

  start(node) {
    this.node = node;
    this.t0 = performance.now();
    this.onHighlight(this.node.hi);                       // show the heavy branch
    requestAnimationFrame(this.tick.bind(this));
  }

  tick(now) {
    if (this.pressed) {                                   // press = take highlighted
      this.pressed = false;
      this.presses++;
      this.advance(this.node.hi);
    } else if (now - this.t0 >= this.period) {            // timeout = take the other
      this.advance(this.node.lo);
    } else {
      requestAnimationFrame(this.tick.bind(this));
    }
  }

  advance(next) {
    this.steps++;
    if (next.unit) { this.onEmit(next.unit); return; }    // leaf
    this.node = next;
    this.t0 = performance.now();
    this.onHighlight(this.node.hi);
    requestAnimationFrame(this.tick.bind(this));
  }
}
```

**Mode A (baseline)** is a plain row–column scan over `gridA.json`: step through rows one period each, press selects a row, then step through that row's cells, press selects a cell. **It must be an honest baseline** — no secret optimisation, and label it on screen as what actually ships on Android today.

**Three rules that protect the numbers:**
1. `performance.now()` deltas only. Never `setInterval`.
2. One `Scanner` instance owns `presses` and `steps`. Nothing else increments them.
3. The on-screen counter reads straight off that instance — never a separate tally that can drift out of sync.

---

## 5. Views

**① Compose** — composed text large at top; current highlighted group below; audible tick per step (so a blind visitor gets the same demo); `UNDO`/`CLEAR` reachable in the tree.

**② Approve & output** — the composed text, then a scannable row: **SPEAK · WRITE · EDIT · CLEAR**.
```js
const u = new SpeechSynthesisUtterance(text);
u.lang = 'ml-IN';
speechSynthesis.speak(u);
```
*Approve before writing* — never let the plotter run on an unapproved string. A sheet of paper and ninety seconds of plotting is an expensive mistake in front of a judge.

**③ Settings** — scan period (500/800/1200/2000 ms) · mode A/B · audio on-off · **switch test** showing each press registering with its latency and bounce count.

**④ Compare — the judge-facing view.** Same target sentence, both modes, side by side: presses, steps, elapsed time, live. **This is the science made visible and it is what wins Sasthrolsavam.** Build it properly, not last.

---

## 6. ESP32 #1 — the switch

```cpp
#include <BleKeyboard.h>
BleKeyboard ble("AksharaScan Switch", "AksharaScan", 100);

const int PIN = 4;                  // button → GPIO4, other leg → GND
bool last = HIGH;
uint32_t tLast = 0;

void setup() {
  pinMode(PIN, INPUT_PULLUP);       // no external resistor
  ble.begin();
}

void loop() {
  bool now = digitalRead(PIN);
  if (now != last && millis() - tLast > 25) {    // 25 ms debounce — not optional
    tLast = millis();
    last = now;
    if (now == LOW && ble.isConnected()) ble.write(' ');
  }
}
```

Library: `HijelHID_BLEKeyboard` or `ESP32-BLE-Keyboard` (both NimBLE). Android pairs with "Just Works" — no PIN.

**Debounce is load-bearing.** A bouncing button registers three presses for one and silently corrupts every number in the comparison. Verify on the switch-test view before trusting anything.

Also bind a **tap anywhere on screen** as a parallel input. If BLE drops mid-demo, the demo continues.

---

## 7. The plotter

### Mechanical
- Pen holder replaces the hotend — printed bracket or binder clip + zip ties. **Spring-loaded**, so bed warp doesn't change pen pressure.
- Pen up/down via small Z moves: `Z0` down, `Z5` up.
- **Leave the thermistor and heater connected and never command heat.** Marlin's thermal runaway protection is mandatory and the disable option was removed deliberately after house fires. Do not patch it out. Unheated with the thermistor attached, it reads ambient and never trips — the check only runs when heating is commanded.
- Tape the paper down. A sheet that shifts ruins a ninety-second plot.

### Pipeline (`server/shape.py`)
```
Malayalam string
  → uharfbuzz       shape: conjuncts, reordering, ligatures   ← the hard part
  → fontTools pens  glyph outlines → paths
  → transform       scale to mm, lay out the line
  → vpype           optimise, cut pen travel
  → G-code          Z up/down + G1
  → pyserial        stream to printer
```

Font: **Manjari** (proper Malayalam OpenType shaping). `svg-text2path` already does the shaping→paths half if you'd rather not write it.

**The catch, accepted up front:** a normal TTF gives letter *outlines*, so the pen traces boundaries and you get hollow letters. Single-stroke Malayalam fonts essentially do not exist, and hatch-filling is 3–5× slower. **Take the outline look** — it is legible and reads as deliberate. Revisit only if there's time to spare, which there won't be.

**Always render the shaped output to PNG and look at it before sending anything to the printer.** Garbage shaping is obvious on screen and invisible in G-code.

### `server/serve.py`
~40 lines of Flask: `POST /write {"text": "..."}` → shape → G-code → stream → return progress. The tablet joins the laptop's hotspot; no internet needed, which matters because KITE venues commonly have none.

---

## 8. Build order

Each phase ends with something demonstrable. **Do not start a phase until the previous one survives a full rehearsal.**

| # | Definition of done |
|---|---|
| **0** | Malayalam TTS voice installed; tablet speaks a Malayalam sentence **with aeroplane mode on** |
| **1** | ESP32 switch types a space into any text field on the tablet |
| **2** | PWA scans a hardcoded 10-symbol list; press selects; text appears |
| **3** | Real `units`/`bigrams`/`legal` loaded; Mode A and Mode B both run end to end |
| **4** | Views ②–④ done, including the compare view and the switch test |
| **5** | Service worker; installed to home screen; **full rehearsal, WiFi off, 20 minutes, no crash** |
| | **◆ The Sasthrolsavam demo is complete and safe at the end of phase 5.** |
| **6** | Pen mount fitted; printer draws "ABC" from hand-written G-code |
| **7** | `shape.py` turns a Malayalam string into G-code that produces legible text on paper |
| **8** | WRITE button → laptop → printer, end to end |

**Phases 0–5 are the project. Phases 6–8 are the bonus.** If the plotter isn't working the week before the fair, cut it without regret — by then the core has been rehearsed a dozen times, which is worth far more.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| **No Malayalam TTS voice on the tablet** | Phase 0, before any code. Fallback: prerecorded clips per akshara |
| **Button bounce inflates the counts** | 25 ms firmware debounce; verify on the switch-test view |
| **Scan timing drifts** | `requestAnimationFrame` + `performance.now()`; one Scanner owns the counters |
| **BLE drops mid-demo** | Auto-reconnect + screen tap as a parallel input |
| **Plotter code breaks the app** | Separate ESP32, separate connection; WRITE fails to a toast |
| **Malayalam shaping produces garbage** | Render to PNG and eyeball before any G-code |
| **No WiFi at the venue** | Laptop hotspot; PWA fully offline for everything but WRITE |
| **Pen dries mid-plot** | Spares. Cheap insurance |

---

## 10. To buy

| Item | ₹ |
|---|---|
| Second ESP32 | 400 |
| Spring + pen-holder stock | 200 |
| Fine-tip gel pens, 0.5 mm, several | 150 |
| A4/A5 paper, masking tape | 100 |

Everything else is on hand or free.

---

## 11. Open question

**Did the IRIS submission go in on 30 September?** The deadline was 3 October. If yes, this app is polish for Sasthrolsavam district (October) and state (November) — a comfortable four to eight weeks for all eleven phases. If it was missed, Sasthrolsavam is the whole game, and **view ④ becomes the most important screen in the project.**
