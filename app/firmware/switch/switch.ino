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
 * Holding switch 2, or pressing both together, fires a configurable action in
 * the app (speak, write on the plotter, or both). That needs real key state, so
 * this sketch sends press/release rather than a one-shot keystroke.
 *
 * Wiring, per switch: one leg to the GPIO pin, the other to GND. No resistors —
 * INPUT_PULLUP provides them. 3.5 mm mono jacks are the AAC standard, so a user
 * can plug in their own switch: tip to GPIO, sleeve to GND.
 *
 * Library: ESP32-BLE-Keyboard or HijelHID_BLEKeyboard (both NimBLE).
 * Android pairs with "Just Works" — no PIN.
 */
#include <BleKeyboard.h>   // library: "ESP32 HID Keyboard" (Arduino Library Manager)

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
      /* press() / release() rather than write(). write() sends a keystroke
         and lets go immediately, so the tablet can never tell a tap from a
         hold, and can never see both switches down at once. Holding and
         chording are the only way to get a third command out of two switches,
         so the firmware has to expose the button's actual state. */
      if (ble.isConnected()) {
        if (now == LOW) ble.press(SW[i].key);
        else            ble.release(SW[i].key);
      }
      Serial.printf("%s %s\n", SW[i].name, now == LOW ? "down" : "up");
    }
  }
}
