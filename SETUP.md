# Setting up the tablet

Forty minutes, in order. Steps 1–4 need no hardware; do them first, because if
the tablet has no Malayalam voice nothing else matters.

---

## 1. Install the app

Two ways. **Pick one.**

### The app (recommended — landscape locked, screen never sleeps)

On the **tablet itself**, open:

> **https://github.com/adithyamandody/adithya/releases/latest**

Download `AksharaScan.apk` and tap it. Android will ask once to allow installs
from your browser — allow it, then tap the file again in Downloads.

### Or the web version (nothing to install)

Open **https://aksharascan-adithyamandodys-projects.vercel.app** in Chrome, then
**⋮ → Add to Home screen**. It runs offline after the first load.

The APK is better for the fair: it locks to landscape, keeps the screen awake,
and hides the system bars so a stray tap cannot end the demo.

---

## 2. Install the Malayalam voice ← do not skip

**Settings → Accessibility → Text-to-speech output → Google Text-to-speech →
Install voice data → Malayalam**

Then **turn on aeroplane mode and make it speak.** If it goes silent offline,
the voice did not install and no amount of app work fixes it.

Some tablets hide this under *Settings → System → Languages & input → Text-to-speech*.

---

## 3. Open the app and take the tour

Six steps, about five minutes: press, wait, one letter, your name, your age,
send it. It ends by saving his introduction as a quick phrase, so from then on
it costs three presses instead of four minutes.

If he has not used it before, **do this before touching the hardware.** The
scanning idea is the thing to learn; the switch is just a nicer button.

---

## 4. Rehearse offline

Aeroplane mode on. Use it for twenty minutes. Type, speak, backspace, switch
layers.

Fair venues commonly have no WiFi and **a demo that needs a network scores
zero**. Better to find that out now.

---

## 5. Flash the ESP32

On the laptop, in the **Arduino IDE**:

1. **Boards:** Tools → Board → Boards Manager → install **esp32** (Espressif)
2. **Library:** Tools → Manage Libraries → install **ESP32 BLE Keyboard**
3. Open `app/firmware/switch/switch.ino` from this repo
4. Select your board (usually *ESP32 Dev Module*) and the port
5. Upload

Open the Serial Monitor at **115200**. It should print
`AksharaScan: advertising, 2 switches`.

> The sketch sends `press()`/`release()`, not a one-shot keystroke. Without real
> key state the tablet cannot tell a tap from a hold, so **holds and chords will
> not work on an older sketch.** If you flashed before 5 October, reflash.

---

## 6. Wire the switches

| Switch | ESP32 pin | Other leg | Sends |
|---|---|---|---|
| 1 — select | **GPIO 4** | GND | `SPACE` |
| 2 — backspace | **GPIO 5** | GND | `BACKSPACE` |

No resistors. `INPUT_PULLUP` handles that.

Use **3.5 mm mono jacks** — the AAC standard — so a real user can plug in their
own switch: **tip → GPIO, sleeve → GND**.

---

## 7. Pair it

On the tablet: **Settings → Bluetooth → AksharaScan Switch → Pair.**

No PIN; it pairs with "Just Works". It appears as a **keyboard**, which is the
point — the switches then work in every app on the tablet, not only this one.

---

## 8. Check the wiring before trusting any number

In the app: **Settings → Switch test.**

- Switch 1 should light a **teal** box
- Switch 2 should light a **pink** box

**One press must light exactly one box.** Two boxes from one press means the
contact is bouncing — increase `DEBOUNCE` in the sketch and reflash. A bouncing
switch silently inflates every press count, and **the press count is the whole
argument the project makes**.

Pink when you expect teal means the pins are swapped.

---

## 9. Set it up for him

**Settings → Quick phrases.** The seeded list is generic; replace it with *his*
phrases. Eight or so covers most of a day, and each costs about three presses:

```
ഞാൻ ആദിത്യ, എനിക്ക് 25 വയസ്സ്
അതെ
ഇല്ല
നന്ദി
സഹായം
വേദന
വെള്ളം
ഒന്ന് നിൽക്കൂ
```

**Settings → Scan speed.** Starts at 2000 ms. Lower it as he gets faster — the
control is on the main screen, so it can be changed mid-sentence.

**Settings → Hold switch 2, or press both.** Choose what the gesture does:
speak, write on the plotter, or both.

---

## If something is wrong

| Symptom | Cause |
|---|---|
| Types on its own | Old build. Install the latest APK |
| Fixes do not appear | Old service worker. Chrome → ⋮ → Settings → Site settings → clear data, or reinstall the APK |
| Silent | No Malayalam voice — step 2 |
| Switch does nothing | Not paired, or the ESP32 is not powered. Serial Monitor should print `down`/`up` on each press |
| Holds do nothing | Firmware older than 5 Oct. Reflash |
| Two boxes per press | Contact bounce — raise `DEBOUNCE` |
| Scan feels too fast | Speed control, top-left of the compose screen |

---

## The thirty seconds that matter at the table

Hand them the switch and say:

> *It asks you yes or no. Press for yes. **Wait** for no.*

Then let them type their own name. The press counter does the rest.

Waiting being an answer is the one thing nobody guesses — say it first, before
anything about scan trees or Malayalam.
