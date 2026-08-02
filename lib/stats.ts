// Pure date/stat helpers — no DB access, easy to reason about and to test.

import { daysBetween } from "@/lib/dates";

export { daysBetween };

/** Monday (as YYYY-MM-DD) of the ISO week containing `dateStr`. */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export type Stats = {
  thisWeek: number;
  total: number;
  streakWeeks: number;
  lastAgoDays: number | null;
  /** Typical gap between sessions, in days — the user's own rhythm. */
  typicalGapDays: number;
  /** True when the user is one miss away from the pattern breaking. */
  atRisk: boolean;
  /** Copy to show, or null when there's nothing worth saying. */
  nudge: string | null;
};

/** Median, rounded. Returns `fallback` for an empty list. */
function median(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const m =
    s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  return Math.max(1, Math.round(m));
}

/**
 * "Never miss twice" — the best rule in the plan, and in v1 it was a static
 * line of text whenever the last workout was 3+ days ago, regardless of how
 * often the user actually trains.
 *
 * The honest version compares against the user's OWN rhythm: if you normally
 * train every 2 days and it's been 3, you're one skip away from the pattern
 * breaking, and that's the moment worth a nudge. Someone training once a week
 * shouldn't be nagged on day 3.
 */
export function computeStats(workoutDates: string[], today: string): Stats {
  const uniq = Array.from(new Set(workoutDates)).sort(); // ascending
  const total = uniq.length;

  const thisMonday = mondayOf(today);
  const thisWeek = uniq.filter((d) => mondayOf(d) === thisMonday).length;

  // Set of week-Mondays that contain a workout.
  const weeks = new Set(uniq.map(mondayOf));

  // Consecutive weeks back from the current one. If this week has no workout
  // yet, start from last week so a mid-week gap doesn't zero the streak.
  let streak = 0;
  let cursor = thisMonday;
  if (!weeks.has(cursor)) {
    const d = new Date(cursor + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    cursor = d.toISOString().slice(0, 10);
  }
  while (weeks.has(cursor)) {
    streak++;
    const d = new Date(cursor + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    cursor = d.toISOString().slice(0, 10);
  }

  const last = uniq.length ? uniq[uniq.length - 1] : null;
  const lastAgoDays = last ? daysBetween(last, today) : null;

  // Gaps between the last ~10 sessions describe the user's actual cadence.
  const recent = uniq.slice(-10);
  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    gaps.push(daysBetween(recent[i - 1], recent[i]));
  }
  const typicalGapDays = median(gaps, 3);

  const atRisk =
    lastAgoDays != null && total > 0 && lastAgoDays > typicalGapDays;

  let nudge: string | null = null;
  if (total === 0) {
    nudge = "First one is the whole game. Pick a day, check one box.";
  } else if (lastAgoDays === 0) {
    nudge = null; // already trained today; say nothing
  } else if (atRisk) {
    nudge = `It's been ${lastAgoDays} ${
      lastAgoDays === 1 ? "day" : "days"
    } — missing once is fine. Don't miss twice 💪`;
  }

  return {
    thisWeek,
    total,
    streakWeeks: streak,
    lastAgoDays,
    typicalGapDays,
    atRisk,
    nudge,
  };
}
