/* Pin finder — wiring diagnostic. Flash this instead of ../switch when a
 * switch does nothing and you cannot tell why. HARDWARE.md explains when.
 *
 * Watches every safe GPIO with its pull-up on and reports any pin that goes
 * LOW. Press a button and it names the pin the button is ACTUALLY wired to,
 * rather than the pin we assumed.
 *
 * Needed because a pin with nothing attached reads exactly the same as a
 * correctly wired, unpressed button: both idle HIGH. Silence cannot tell them
 * apart, so this makes the button announce its own pin.
 *
 * Reading the output:
 *   - a pin listed LOW at boot is stuck closed — on a 4-pin button that means
 *     both wires sit on an internally joined pair, so go diagonal
 *   - GPIO 34/35/36/39 are input-only with NO internal pull-up, so they float
 *     and chatter whatever you do. Ignore them here, and never wire a switch
 *     to one. This cost an afternoon.
 *
 * Flash the real firmware again when done.
 */
/* Now including 0 and 2 (strapping pins, but they do have pull-ups) and the
   input-only pins 34-39. Those last six are the silent trap: they have NO
   internal pull-up, so a button wired there floats and can never be read
   reliably no matter what the code does. Watching them at least reveals a
   button that landed on one. */
const uint8_t PINS[] = {0,2,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33,
                        34,35,36,39};
const uint8_t N = sizeof(PINS);
bool last[N];

void setup() {
  Serial.begin(115200);
  delay(300);
  for (uint8_t i = 0; i < N; i++) {
    // 34-39 are input-only and have no pull-up to enable
    pinMode(PINS[i], PINS[i] >= 34 ? INPUT : INPUT_PULLUP);
    last[i] = HIGH;
  }
  Serial.println();
  Serial.println("PIN FINDER ready — press a button now.");
  Serial.print("watching GPIO:");
  for (uint8_t i = 0; i < N; i++) { Serial.print(' '); Serial.print(PINS[i]); }
  Serial.println();

  delay(200);
  Serial.print("LOW at rest (should be none):");
  bool any = false;
  for (uint8_t i = 0; i < N; i++)
    if (digitalRead(PINS[i]) == LOW) { Serial.print(" GPIO"); Serial.print(PINS[i]); any = true; }
  Serial.println(any ? "" : " none");
}

void loop() {
  for (uint8_t i = 0; i < N; i++) {
    bool now = digitalRead(PINS[i]);
    if (now != last[i]) {
      last[i] = now;
      Serial.print("GPIO");
      Serial.print(PINS[i]);
      Serial.println(now == LOW ? " PRESSED" : " released");
      delay(20);
    }
  }
}
