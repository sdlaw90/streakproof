// Pure date/stat helpers — no DB access, easy to reason about.

/** Monday (as YYYY-MM-DD) of the ISO week containing `dateStr`. */
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const ms =
    new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / 86400000);
}

export type Stats = {
  thisWeek: number;
  total: number;
  streakWeeks: number;
  lastAgoDays: number | null;
};

/**
 * `workoutDates` = distinct dates (YYYY-MM-DD) on which the user completed
 * at least one set. `today` = YYYY-MM-DD.
 */
export function computeStats(workoutDates: string[], today: string): Stats {
  const uniq = Array.from(new Set(workoutDates)).sort(); // ascending
  const total = uniq.length;

  const thisMonday = mondayOf(today);
  const thisWeek = uniq.filter((d) => mondayOf(d) === thisMonday).length;

  // Set of week-Mondays that contain a workout.
  const weeks = new Set(uniq.map(mondayOf));

  // Count consecutive weeks back from the current week. If this week has no
  // workout yet, start counting from last week (so a mid-week gap doesn't zero it).
  let streak = 0;
  let cursor = thisMonday;
  if (!weeks.has(cursor)) {
    // step back one week to begin
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

  return { thisWeek, total, streakWeeks: streak, lastAgoDays };
}
