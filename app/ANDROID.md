# Building the Android app

The app is the same tested web code wrapped by Capacitor — no rewrite, and the
scan engine in `app/scan.js` is the one covered by the 37 tests.

## Build

```sh
npm install          # once
npm test             # 37 tests — run this before every build
npm run apk          # → android/app/build/outputs/apk/debug/app-debug.apk
npm run install      # adb install to a connected tablet
```

`npm run apk` copies the web assets into `www/`, syncs them into the native
project and runs Gradle.

## Installing on the tablet without a cable

Download the APK from the repository's Releases page on the tablet itself, then
open it. Android will ask you to allow installation from that browser the first
time.

## What the native layer adds

| Setting | Why |
|---|---|
| `screenOrientation="sensorLandscape"` | The scan grid wants the width |
| `keepScreenOn` + `FLAG_KEEP_SCREEN_ON` | **An AAC user cannot tap to wake a sleeping tablet.** The switch is their only movement |
| Immersive sticky mode | A stray tap on a system bar ends a demo |
| **No `INTERNET` permission** | Everything runs on device. The scan trees are built at runtime from bundled JSON and speech uses the system TTS. An AAC device that needs a network is one that fails at a fair |

## The switches

Two switches, one ESP32, paired as a Bluetooth HID keyboard
(`app/firmware/switch/switch.ino`):

| Switch | GPIO | Sends | Does |
|---|---|---|---|
| 1 | 4 | `SPACE` | **Select** — "yes, my letter is in this group" |
| 2 | 5 | `BACKSPACE` | **Undo** — delete the last unit |

### A third command from two switches

| Gesture | Does |
|---|---|
| Tap switch 2 | Delete the last unit |
| **Hold switch 2** (0.9 s) | The configured action |
| **Both switches together** | The same action |

The action is set in Settings: speak it aloud, write it on the plotter, both, or
nothing.

Two routes to the same command, on purpose. Pressing two switches at once is
genuinely hard with impaired motor control, so the hold must work alone; and some
people find a sustained hold harder than a quick chord, so that works too.

The firmware sends `press()`/`release()` rather than a one-shot keystroke —
without real key state the tablet cannot tell a tap from a hold, or see both
switches down at once.

**Select fires on key down and is never delayed**, because the scan rhythm
depends on it and waiting to see whether a press becomes a hold would add latency
to every selection. Backspace fires on key *up*, which is what makes the hold
detectable at all.

Wiring per switch: one leg to the GPIO pin, the other to GND. No resistors —
`INPUT_PULLUP` handles that. Use 3.5 mm mono jacks (the AAC standard) so a user
can plug in their own switch: tip to GPIO, sleeve to GND.

Because these are ordinary key events, **any** commercial switch interface that
emits space and backspace will drive the app, and both switches work in every
other app on the tablet. Without hardware, the keyboard and the touchscreen do
the same job, which is how you demo it on a laptop.

Backspace deliberately does not wait for the current scan to finish — someone
reaching for undo should never have to sit through a selection first.

## JDK note

Capacitor needs JDK 21; macOS here has 17. `android/gradle.properties` pins
`org.gradle.java.home` to the JetBrains Runtime that ships inside Android
Studio, so no separate JDK install is required. If Android Studio moves, update
that one line.

## Voice

The device voice is the default and the fallback for everything. It works
offline, which is why it stays the fallback: a person who cannot talk losing
their voice because WiFi dropped is not an acceptable failure.

Cloud voices are an optional upgrade, set per language in Settings:

| Provider | Malayalam | English | Note |
|---|---|---|---|
| Device | ✓ | ✓ | Offline. No key, no cost |
| Google Cloud TTS | ✓ | ✓ | `ml-IN-Wavenet-C`. Cheapest per character |
| ElevenLabs | ✓ | ✓ | Most natural; multilingual model |
| **Deepgram Aura** | ✗ | ✓ | **No Malayalam voice exists.** English layer only |

**Every cloud clip is cached in IndexedDB.** A phrase is fetched once and plays
from the device forever after — instantly, offline, at no further cost. The
network is needed to *learn* a sentence, never to *say* one again.

So after setting a key, press **Prepare phrases for offline** in Settings. That
renders every quick phrase once. From then on the urgent utterances work with
the network off, which is the only state worth designing for.

Routing is by script, not by preference: Malayalam text never goes to a provider
with no Malayalam voice, whatever the dropdown says. A test pins that, because
the failure would be a device that sounds confidently wrong.

⚠️ API keys live on the device and are readable by anyone who can open its
browser tools. Use a key restricted to text-to-speech with a spending cap.

## Before a fair

1. `npm test` — 37 tests must pass.
2. Install the Malayalam TTS voice: Settings → Accessibility → Text-to-speech →
   Google TTS → install Malayalam. **Then turn on aeroplane mode and check it
   still speaks.**
3. Rehearse the full demo with the tablet in aeroplane mode for twenty minutes.
   KITE venues commonly have no WiFi, and a demo that needs one scores zero.
