# Wiring the switches

What you have: an **ESP32**, two **4-pin push buttons**, a **USB cable**, a **Mac**.
That is everything needed. No Arduino board, no resistors, no breadboard
strictly required.

---

## First: you do not need an Arduino

"Arduino" here is only the **software** that compiles code and sends it to a
board. The ESP32 *is* the board. Nothing else gets plugged in.

---

## The 4-pin button trap — read this before wiring anything

A 4-pin tactile button does **not** have four separate contacts. It has **two
pairs**, and each pair is **permanently joined inside the button**.

```
        1 ●───────● 2        1 and 2 are ALWAYS connected
          │  ╱╲   │
          │ (  )  │          pressing joins the top pair to the bottom pair
          │  ╲╱   │
        3 ●───────● 4        3 and 4 are ALWAYS connected
```

So:

- **Pins 1 and 2 together → permanently closed.** The ESP32 sees the button held
  down forever. The app scans away on its own and never stops.
- **Pins 1 and 3 (or 2 and 4, or diagonally) → a real switch.**

**Use diagonally opposite pins.** It is impossible to get wrong that way, and it
is the mistake almost everyone makes once.

> Not sure which pins are paired? Set a multimeter to continuity and touch two
> pins. If it beeps *without* pressing, those two are a pair — pick a different
> one. No multimeter: just use diagonal corners.

---

## The wiring

Two wires per button. That is all.

| Button | One corner → | Opposite corner → |
|---|---|---|
| **Switch 1 — select** | **GPIO 4** | **GND** |
| **Switch 2 — backspace** | **GPIO 5** | **GND** |

```
   ESP32                         Button 1 (select)
  ┌───────┐                      ┌─────────┐
  │ GPIO4 ├──────────────────────┤1       2│
  │       │                      │    ╱╲   │
  │  GND  ├──────────────────────┤3  ╲╱   4│     ← pins 1 and 3: DIAGONAL
  └───────┘                      └─────────┘

   Same again for button 2, but GPIO 5 instead of GPIO 4.
   Both buttons share the GND pin — the ESP32 has several, any will do.
```

**No resistors.** The firmware turns on the ESP32's internal pull-ups
(`INPUT_PULLUP`), which is what a resistor would otherwise be for.

**Polarity does not matter.** A button is not an LED; either corner can go to
GPIO and the other to GND.

---

## Flash it

Plug the ESP32 into the Mac with the USB cable, then:

```sh
./flash.sh
```

It installs anything missing, finds the board, uploads, and then shows the
serial output so you can test the buttons immediately.

### If it says "No ESP32 found"

In order of likelihood:

1. **The cable is charging-only.** This is the most common cause by a distance,
   and such cables look identical to data cables. Try another one.
2. **No light on the board** — no power at all.
3. **Missing driver.** Look at the small square chip near the USB socket:
   - **CH340** → `brew install --cask wch-ch34x-usb-serial-driver`, then reboot
   - **CP2102** → macOS already supports this

### If it stalls at "Connecting…"

Hold the **BOOT** button on the ESP32 until the upload starts, then release.
Some boards cannot reset themselves into flashing mode.

---

## Test before trusting it

The serial monitor opens automatically. You should see:

```
AksharaScan: advertising, 2 switches
```

Press each button. Each press should print **two** lines:

```
select down
select up
```

**Why two?** The firmware reports press *and* release separately, which is what
lets the app tell a tap from a hold. That is how holding switch 2 speaks the
sentence. A one-shot keystroke could not express it.

| What you see | Meaning |
|---|---|
| Nothing on press | Wrong pins — you likely used a pair that is already joined. Go diagonal |
| `down` and never `up` | A pair is permanently joined, or a wire is shorted to GND |
| Constant stream of lines | Contact bounce — raise `DEBOUNCE` in the sketch |
| `backspace` when you press select | GPIO 4 and 5 are swapped |

---

## Pair it with the tablet

**Settings → Bluetooth → AksharaScan Switch → Pair.** No PIN.

It appears as a **keyboard**, deliberately: the switches then work in every app
on the tablet, not only this one — exactly how a commercial AAC switch
interface behaves.

Then in the app: **Settings → Switch test.** One press must light **exactly
one** box — teal for switch 1, pink for switch 2. Two boxes from one press is
bounce, and a bouncing switch silently inflates every press count, which is the
number the whole project argues from.

---

## Later, for a real user

Add **3.5 mm mono jacks** — the AAC standard — wired **tip → GPIO, sleeve →
GND**. Someone with their own switch can then plug it straight in, which is the
difference between a demo and a device.
