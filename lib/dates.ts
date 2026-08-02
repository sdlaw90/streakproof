// Local-date helpers.
//
// v1 used `new Date().toISOString().slice(0,10)` everywhere, i.e. UTC. For an
// evening lifter in New York that writes the session under TOMORROW's date from
// 8pm onward, which quietly breaks streaks, "last time" and PR detection. Every
// date the app stores is now the user's LOCAL date, derived from
// profiles.timezone.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today (YYYY-MM-DD) in the given IANA timezone. */
export function todayIn(timeZone: string): string {
  return formatISODate(new Date(), timeZone);
}

/** Format a Date as YYYY-MM-DD in the given IANA timezone. */
export function formatISODate(d: Date, timeZone: string): string {
  try {
    // en-CA renders as YYYY-MM-DD, which is exactly the shape Postgres wants.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    // Bad/unknown timezone string — fall back to UTC rather than throwing.
    return d.toISOString().slice(0, 10);
  }
}

export function isISODate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_DATE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const ms =
    new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / 86400000);
}

/**
 * Clamp a client-supplied date to something loggable: a real date, not in the
 * future, not more than `maxPastDays` ago. Backfilling a missed Wednesday is
 * the point; rewriting history from 2019 is not.
 */
export function sanitizeLogDate(
  input: unknown,
  today: string,
  maxPastDays = 90
): string {
  if (!isISODate(input)) return today;
  const delta = daysBetween(input, today);
  if (delta < 0) return today; // future
  if (delta > maxPastDays) return today;
  return input;
}

/** The hour (0–23) right now in the given IANA timezone. */
export function hourIn(timeZone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        hour12: false,
      }).format(new Date())
    );
  } catch {
    return new Date().getUTCHours();
  }
}

/** "Sunday, 2 August" — the home screen's date line. */
export function longDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/** "Today" / "Yesterday" / "Wed, Aug 5" — for date pickers and history rows. */
export function humanDate(dateStr: string, today: string): string {
  const delta = daysBetween(dateStr, today);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
