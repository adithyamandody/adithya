/* AksharaScan — switch interface.
 *
 * Presents the ESP32 to the tablet as a Bluetooth HID keyboard. One button
 * press sends a spacebar. The app therefore needs ZERO Bluetooth code — it
 * just handles a keypress — and the switch works with every other app on the
 * tablet too, which is how real AAC switch interfaces (Blue2, Hook+) behave.
 *
 * Library: ESP32-BLE-Keyboard or HijelHID_BLEKeyboard (both NimBLE-based).
 * Android pairs with "Just Works" — no PIN.
 *
 * Wiring: button between GPIO4 and GND. No resistor; INPUT_PULLUP handles it.
 */
#include <BleKeyboard.h>

BleKeyboard ble("AksharaScan Switch", "AksharaScan", 100);

const int PIN      = 4;
const int DEBOUNCE = 25;   // ms. NOT optional — see note below.

bool     last  = HIGH;
uint32_t tLast = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIN, INPUT_PULLUP);
  ble.begin();
  Serial.println("AksharaScan switch: advertising");
}

void loop() {
  bool now = digitalRead(PIN);

  /* Debounce is load-bearing. A bouncing button registers three presses for
     one and silently corrupts every press count in the demo — and the press
     count IS the argument. Verify on the app's switch-test screen before
     trusting any number. */
  if (now != last && millis() - tLast > DEBOUNCE) {
    tLast = millis();
    last  = now;
    if (now == LOW) {
      if (ble.isConnected()) ble.write(' ');
      Serial.println("press");
    }
  }
}
