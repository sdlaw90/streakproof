// Which day should today be?
//
// Days are a ROTATION (A / B / C / Pool), deliberately not bound to weekdays —
// a plan that says "legs on Tuesday" is broken by one missed Tuesday, which is
// exactly the failure mode this app exists to avoid. So nothing is scheduled;
// the app just picks the day you're most due for.
//
// Pure functions, no DB access — same reason lib/stats.ts is pure.

import type { Day } from "@/lib/types";
import { daysBetween } from "@/lib/dates";

export type Suggestion = {
  day: Day;
  /** Days since this one was last done, or null if never. */
  lastAgoDays: number | null;
  /** Why this day came up — drives the copy on the home card. */
  reason: "never-done" | "most-due";
};

/**
 * Pick the day the user is most due for.
 *
 * A day never done wins outright (so a fresh plan starts at day one, in sort
 * order). Otherwise it's whichever day was done longest ago, ties broken by
 * `sort` so the rotation stays in its intended order.
 *
 * `lastDoneByDayId` maps day id -> the most recent date that day was performed,
 * or is simply missing for days never done.
 */
export function suggestDay(
  days: Day[],
  lastDoneByDayId: Record<string, string | undefined>,
  today: string
): Suggestion | null {
  if (!days.length) return null;

  const ordered = [...days].sort((a, b) => a.sort - b.sort);

  const never = ordered.find((d) => !lastDoneByDayId[d.id]);
  if (never) return { day: never, lastAgoDays: null, reason: "never-done" };

  let best = ordered[0];
  let bestAgo = daysBetween(lastDoneByDayId[best.id]!, today);
  for (const d of ordered.slice(1)) {
    const ago = daysBetween(lastDoneByDayId[d.id]!, today);
    // Strictly greater, so an earlier `sort` wins a tie.
    if (ago > bestAgo) {
      best = d;
      bestAgo = ago;
    }
  }
  return { day: best, lastAgoDays: bestAgo, reason: "most-due" };
}

/**
 * "Good morning" / "Good afternoon" / "Good evening", by local hour.
 *
 * Split at 12 and 18. Anything before 5am counts as evening — someone logging
 * a 1am session has not started a new morning.
 */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}
