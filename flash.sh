#!/usr/bin/env bash
# Flash the AksharaScan switch firmware to an ESP32, from a Mac.
#
#     ./flash.sh
#
# You do NOT need an Arduino board. "Arduino" here is only the software that
# compiles and uploads; the ESP32 is the only board involved.
#
# Installs what is missing, finds the board, uploads, and then watches the
# serial output so you can press the buttons and see them register.

set -euo pipefail
cd "$(dirname "$0")"

FQBN="esp32:esp32:esp32"
SKETCH="app/firmware/switch"
BAUD=115200

say() { printf "\n\033[1m%s\033[0m\n" "$*"; }
ok()  { printf "  \033[32m✓\033[0m %s\n" "$*"; }
bad() { printf "  \033[31m✗\033[0m %s\n" "$*"; }

say "1. Tools"
if ! command -v arduino-cli >/dev/null; then
  echo "  installing arduino-cli…"
  brew install arduino-cli
fi
ok "arduino-cli $(arduino-cli version | awk '{print $2,$3}')"

if ! arduino-cli core list 2>/dev/null | grep -q "^esp32:esp32"; then
  echo "  installing the ESP32 core (a few minutes, once)…"
  arduino-cli config add board_manager.additional_urls \
    https://espressif.github.io/arduino-esp32/package_esp32_index.json >/dev/null 2>&1 || true
  arduino-cli core update-index >/dev/null
  arduino-cli core install esp32:esp32
fi
ok "ESP32 core"

if ! arduino-cli lib list 2>/dev/null | grep -qi "ESP32 HID Keyboard"; then
  arduino-cli lib install "ESP32 HID Keyboard" >/dev/null
fi
ok "BLE keyboard library"

say "2. Finding the board"
# CH340 boards appear as cu.usbserial / cu.wchusbserial, CP2102 as cu.SLAB_USBtoUART,
# native-USB chips (S2/S3/C3) as cu.usbmodem.
PORT="${1:-}"
if [ -z "$PORT" ]; then
  PORT=$(ls /dev/cu.usbserial-* /dev/cu.wchusbserial* /dev/cu.SLAB_USBtoUART* /dev/cu.usbmodem* 2>/dev/null | head -1 || true)
fi

if [ -z "$PORT" ]; then
  bad "No ESP32 found."
  cat <<'EOT'

  Check, in this order:

  1. Is it plugged in? The cable must carry DATA, not just power. Charging-only
     cables are the single most common cause and they look identical.
  2. Does a light come on? No light means no power.
  3. Still nothing: your board needs a USB-serial driver.
       CH340 chip  ->  brew install --cask wch-ch34x-usb-serial-driver
       CP2102 chip ->  macOS has this built in
     Reboot after installing, then run this again.

  Ports currently present:
EOT
  ls /dev/cu.* 2>/dev/null | sed 's/^/    /'
  exit 1
fi
ok "found $PORT"

say "3. Compiling"
arduino-cli compile --fqbn "$FQBN" "$SKETCH" 2>&1 | grep -E "Sketch uses|error" || true

say "4. Uploading"
echo "  If this stalls at 'Connecting…', hold the BOOT button on the ESP32"
echo "  until it starts, then let go."
arduino-cli upload -p "$PORT" --fqbn "$FQBN" "$SKETCH"
ok "uploaded"

say "5. Watching the serial output — press your buttons"
cat <<'EOT'
  Expect:  AksharaScan: advertising, 2 switches
  Then on each press:   select down / select up / backspace down / backspace up

  Nothing on a press means the wiring is wrong — on a 4-pin button, use pins
  DIAGONALLY opposite each other. Ctrl-C to stop.

EOT
arduino-cli monitor -p "$PORT" -c "baudrate=$BAUD"
