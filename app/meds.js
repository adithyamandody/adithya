/* Medicine reminders.
 *
 * The person this app is for often cannot reach a phone, dismiss an alarm, or
 * tell a carer that a dose is due. So the reminder has to arrive on the device
 * they already use, say itself out loud, and be answerable with the SAME two
 * switches as everything else. A reminder that needs a screen tap is a
 * reminder they do not have.
 *
 * This file is the logic only — no DOM, no timers, no storage — so the rules
 * about what is due and when can be tested without a browser or waiting for
 * real clock time to pass. app.js owns the screen.
 *
 * IMPORTANT, and stated in the UI as well: this is a reminder, not a medical
 * alarm. A web app cannot be relied on to fire when the tablet is asleep or
 * the app is closed. Nobody's medication should depend on it alone.
 */

/** "08:00" -> 480. Returns null for anything that is not a real time of day,
 *  because a typo must not silently become midnight. */
export function minutesOf(hhmm) {
  const m = /^\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** 480 -> "08:00" */
export function hhmmOf(mins) {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/**
 * Parse the medicine list. One per line:
 *
 *     Blood pressure 08:00, 20:00 # after food
 *
 * Name first, then one or more times, then an optional note after #. Written
 * as free text rather than a form because a carer types it once on a tablet,
 * and a form with repeating time fields is far worse to use there.
 */
export function parseMeds(text) {
  const out = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const hash = line.indexOf('#');
    const body = (hash === -1 ? line : line.slice(0, hash)).trim();
    const note = hash === -1 ? '' : line.slice(hash + 1).trim();

    /* Times are anything that looks like a clock time; the name is whatever
       is left once they are removed, so "Vitamin D3 09:00" keeps its D3. */
    const times = [];
    const name = body.replace(/\b\d{1,2}[:.]\d{2}\b/g, t => {
      const v = minutesOf(t);
      if (v !== null) { times.push(v); return ''; }
      return t;
    }).replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();

    if (!name || !times.length) continue;        // a line with no time is not a reminder
    out.push({ name, note, times: [...new Set(times)].sort((a, b) => a - b) });
  }
  return out;
}

/** The key under which a dose counts as taken: one medicine, one time, one day. */
export function doseKey(med, timeMin, dayStamp) {
  return `${dayStamp}|${med.name}|${timeMin}`;
}

/**
 * What is due right now and not yet taken.
 *
 * `grace` is how long a missed dose keeps asking. It defaults to 2 hours
 * rather than something short: this user may be asleep, or waiting for a carer,
 * and a reminder that gives up after ten minutes is worse than none because it
 * creates the impression a dose was never due.
 */
export function dueNow(meds, nowMin, taken, dayStamp, grace = 120) {
  const out = [];
  for (const med of meds) {
    for (const t of med.times) {
      const late = nowMin - t;
      if (late < 0 || late > grace) continue;
      if (taken && taken.has(doseKey(med, t, dayStamp))) continue;
      out.push({ med, time: t, lateMin: late });
    }
  }
  /* Most overdue first — if two are waiting, the older one matters more. */
  return out.sort((a, b) => b.lateMin - a.lateMin);
}

/** The next dose still to come today, for the "nothing due" screen. */
export function nextUp(meds, nowMin) {
  let best = null;
  for (const med of meds) {
    for (const t of med.times) {
      if (t <= nowMin) continue;
      if (!best || t < best.time) best = { med, time: t, inMin: t - nowMin };
    }
  }
  return best;
}

/** Everything scheduled today, in order, with its state. Used for the list. */
export function dayPlan(meds, nowMin, taken, dayStamp, grace = 120) {
  const rows = [];
  for (const med of meds) {
    for (const t of med.times) {
      const isTaken = !!(taken && taken.has(doseKey(med, t, dayStamp)));
      const late = nowMin - t;
      rows.push({
        med, time: t, taken: isTaken,
        state: isTaken ? 'taken'
             : late < 0 ? 'upcoming'
             : late <= grace ? 'due'
             : 'missed',
        lateMin: late,
      });
    }
  }
  return rows.sort((a, b) => a.time - b.time);
}

/** What to say out loud. Short, because it may be spoken repeatedly. */
export function spokenReminder(due) {
  if (!due) return '';
  return due.med.note ? `${due.med.name} — ${due.med.note}` : due.med.name;
}
