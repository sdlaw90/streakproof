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

/**
 * Which bowl to make next.
 *
 * Same shape as suggestDay(), same reason: the base stays constant and the
 * sauce carries the variety, so what you want is whichever flavour you've gone
 * longest without — not a fixed schedule. Five identical Tupperwares is the
 * failure mode the whole food side exists to avoid (docs/MEAL-FRAMEWORK.md §3).
 *
 * Fallback builds are excluded. The four-minute meal and the grab-and-go shelf
 * are a floor you drop to, never something the app tells you to cook.
 */
export function suggestBuild(
  builds: { id: string; sort: number; is_fallback: boolean }[],
  lastEatenByBuildId: Record<string, string | undefined>,
  today: string
): { buildId: string; lastAgoDays: number | null } | null {
  const rotation = builds
    .filter((b) => !b.is_fallback)
    .sort((a, b) => a.sort - b.sort);
  if (!rotation.length) return null;

  const never = rotation.find((b) => !lastEatenByBuildId[b.id]);
  if (never) return { buildId: never.id, lastAgoDays: null };

  let best = rotation[0];
  let bestAgo = daysBetween(lastEatenByBuildId[best.id]!, today);
  for (const b of rotation.slice(1)) {
    const ago = daysBetween(lastEatenByBuildId[b.id]!, today);
    if (ago > bestAgo) {
      best = b;
      bestAgo = ago;
    }
  }
  return { buildId: best.id, lastAgoDays: bestAgo };
}

/**
 * Is a prep session due?
 *
 * Prep days ARE weekday-bound, unlike workout days — batch cooking is stapled
 * to a specific evening because that's what makes it happen at all
 * (docs/MEAL-FRAMEWORK.md §4). But missing one must not mean waiting a week:
 * a session stays due until it's done or the next one comes round.
 */
export function prepDueOn(
  weekday: number | null,
  today: string,
  lastDoneOn: string | undefined
): "today" | "overdue" | "done" | "upcoming" {
  if (weekday == null) return "upcoming";

  const todayDow = new Date(today + "T00:00:00Z").getUTCDay();
  const isToday = todayDow === weekday;

  if (lastDoneOn) {
    const ago = daysBetween(lastDoneOn, today);
    if (ago === 0) return "done";
    // Done within the last six days means this week's is covered.
    if (ago < 6 && !isToday) return "upcoming";
  }

  if (isToday) return "today";

  // How many days since that weekday last came round?
  const since = (todayDow - weekday + 7) % 7;
  if (!lastDoneOn) return since > 0 ? "overdue" : "upcoming";
  return daysBetween(lastDoneOn, today) > since ? "overdue" : "upcoming";
}
