# Wiring the switches

What you have: an **ESP32**, two **4-pin push buttons**, a **USB cable**, and a
computer (**Mac or Windows**). That is everything needed. No Arduino board, no
resistors, no breadboard strictly required.

---

## How the pieces actually connect

```
   laptop ──USB (5 V power)──> ESP32 ──Bluetooth HID──> tablet (runs the app)
```

The laptop is only a **power supply and a flashing tool**. Switch presses never
go through it — they travel over Bluetooth straight to the tablet.

Two consequences worth knowing:

- **The firmware stays in the ESP32's flash across power cycles.** Once flashed,
  any 5 V source will do: a laptop port, a phone charger, a USB power bank. For
  the fair table a power bank is the better answer — one less thing to boot.
- **Pair the ESP32 with the tablet only.** A BLE HID device bonds to one host,
  and you do not want a laptop grabbing it mid-demo. Plugging into a laptop for
  power creates no pairing, so that is safe.

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

## The second trap: four pins that cannot work

**GPIO 34, 35, 36 and 39 are input-only and have no internal pull-up.**
`INPUT_PULLUP` silently does nothing on them, so the pin floats and reads
whatever noise is nearby — it looks like a button mashing itself. Button 2 was
wired to GPIO 35 here and logged 269 phantom transitions before anyone touched
it. No amount of rewiring fixes it; the pin is the problem.

Safe pins for a switch: **4, 5, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27,
32, 33**. Avoid 0, 2, 12 and 15 as well — they are strapping pins and can stop
the board booting. GPIO 4 and 5 below are chosen from the safe list.

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

Plug the ESP32 into the computer with the USB cable, then:

```sh
./flash.sh        # macOS or Linux
```

```powershell
.\flash.ps1       # Windows
```

Either one installs anything missing, finds the board, uploads, and then shows
the serial output so you can test the buttons immediately.

You only need this to flash the board the **first** time, or after the sketch
changes. To merely use the switches, the ESP32 needs nothing but 5 V.

### If it says "No ESP32 found"

In order of likelihood:

1. **The cable is charging-only.** This is the most common cause by a distance,
   and such cables look identical to data cables. Try another one.
2. **No light on the board** — no power at all.
3. **Missing driver.** Look at the small square chip near the USB socket:
   - **CH340**, macOS → `brew install --cask wch-ch34x-usb-serial-driver`, reboot
   - **CH340**, Windows → [CH341SER from WCH](https://www.wch-ic.com/downloads/CH341SER_EXE.html)
   - **CP2102** → macOS supports this already; Windows wants Silicon Labs' VCP driver

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
| `down` at boot, untouched | Same thing: the button is wired across a joined pair |
| Lines with nobody pressing | You are on GPIO 34/35/36/39. Move to a safe pin — see above |
| Constant stream of lines | Contact bounce — raise `DEBOUNCE` in the sketch |
| `backspace` when you press select | GPIO 4 and 5 are swapped |

### When a switch does nothing and you cannot tell why

A pin at rest looks **identical** whether the button is correctly wired and
unpressed or not connected at all. Static inspection cannot separate those two,
so do not try — flash the pin finder, which watches every usable GPIO at once:

```sh
arduino-cli compile --fqbn esp32:esp32:esp32 app/firmware/pinfinder
arduino-cli upload -p /dev/cu.usbserial-0001 --fqbn esp32:esp32:esp32 app/firmware/pinfinder
```

At boot it lists any pin already LOW — each one is stuck closed. Then press a
button: whichever pin prints is where that button really is. Reflash
`app/firmware/switch` when you are done.

> **Use one serial reader at a time.** Two processes on the same port each get an
> arbitrary slice of the bytes, which produces torn, miscounted lines — and an
> upload will fail with *"port is busy"*. `pkill -f "arduino-cli monitor"` first.

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
