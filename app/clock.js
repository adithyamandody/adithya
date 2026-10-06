/* Scanning time, as opposed to wall-clock time.
 *
 * The claim this project makes is a press count and a time-to-sentence. A
 * timer that keeps running while the user thinks — or while a tablet sits
 * paused through a lunch break — inflates the one number a judge is asked to
 * compare against the baseline. A number that drifts upward on its own is
 * worse than no number at all, so this accumulates only the intervals when
 * the scanner was actually running.
 *
 * `now` is injected so the behaviour can be tested without waiting for real
 * time to pass; app.js passes performance.now.
 */
export function makeClock(now) {
  let active = 0;        // milliseconds banked from completed runs
  let since = null;      // when the current run began, or null while held

  return {
    /* Idempotent: startScan() fires once per selection, and a second call
       must not restart the interval and lose what came before. */
    run() { if (since === null) since = now(); },

    /* Also idempotent — pause() can arrive after the session already ended. */
    hold() {
      if (since === null) return;
      active += now() - since;
      since = null;
    },

    ms() { return active + (since === null ? 0 : now() - since); },

    zero() { active = 0; since = null; },

    get running() { return since !== null; },
  };
}
