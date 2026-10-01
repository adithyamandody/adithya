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

## The switch

The ESP32 pairs as a Bluetooth HID keyboard and sends a spacebar
(`app/firmware/switch/switch.ino`). The app treats that exactly like a key
press, so it also works with any commercial switch interface — and with the
tablet's own screen, which is how you demo it without hardware.

## JDK note

Capacitor needs JDK 21; macOS here has 17. `android/gradle.properties` pins
`org.gradle.java.home` to the JetBrains Runtime that ships inside Android
Studio, so no separate JDK install is required. If Android Studio moves, update
that one line.

## Before a fair

1. `npm test` — 37 tests must pass.
2. Install the Malayalam TTS voice: Settings → Accessibility → Text-to-speech →
   Google TTS → install Malayalam. **Then turn on aeroplane mode and check it
   still speaks.**
3. Rehearse the full demo with the tablet in aeroplane mode for twenty minutes.
   KITE venues commonly have no WiFi, and a demo that needs one scores zero.
