/* AksharaScan — two-switch interface.
 *
 *   SWITCH 1  →  GPIO4  →  sends SPACE      select  ("yes, it is in this group")
 *   SWITCH 2  →  GPIO5  →  sends BACKSPACE  undo    (delete the last unit)
 *
 * The ESP32 presents itself to the tablet as a Bluetooth HID keyboard, so the
 * app needs no Bluetooth code at all — it just handles key events. That also
 * means any commercial switch interface emitting these two keys will drive the
 * app, and the switches work in every other app on the tablet. This is how real
 * AAC switch interfaces (Blue2, Hook+) behave.
 *
 * Wiring, per switch: one leg to the GPIO pin, the other to GND. No resistors —
 * INPUT_PULLUP provides them. 3.5 mm mono jacks are the AAC standard, so a user
 * can plug in their own switch: tip to GPIO, sleeve to GND.
 *
 * Library: ESP32-BLE-Keyboard or HijelHID_BLEKeyboard (both NimBLE).
 * Android pairs with "Just Works" — no PIN.
 */
#include <BleKeyboard.h>

BleKeyboard ble("AksharaScan Switch", "AksharaScan", 100);

struct Switch {
  const uint8_t pin;
  const uint8_t key;        // what it sends
  const char*   name;       // for the serial log
  bool          last;
  uint32_t      tLast;
};

/* 25 ms debounce is load-bearing, not a nicety. A bouncing contact registers
   three presses for one and silently corrupts every count in the demo — and the
   press count IS the argument being made. Verify on the app's switch-test screen
   before trusting any number. */
const uint16_t DEBOUNCE = 25;

Switch SW[] = {
  { 4, ' ',            "select",    HIGH, 0 },
  { 5, KEY_BACKSPACE,  "backspace", HIGH, 0 },
};
const uint8_t N = sizeof(SW) / sizeof(SW[0]);

void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < N; i++) pinMode(SW[i].pin, INPUT_PULLUP);
  ble.begin();
  Serial.println("AksharaScan: advertising, 2 switches");
}

void loop() {
  for (uint8_t i = 0; i < N; i++) {
    bool now = digitalRead(SW[i].pin);
    if (now != SW[i].last && millis() - SW[i].tLast > DEBOUNCE) {
      SW[i].tLast = millis();
      SW[i].last  = now;
      if (now == LOW) {                     // pressed (pull-up: LOW = closed)
        if (ble.isConnected()) ble.write(SW[i].key);
        Serial.println(SW[i].name);
      }
    }
  }
}
