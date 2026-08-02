// "Should you build a new plan?" — the checks that decide when to ask.
//
// Pure functions, no DB access, same as lib/stats.ts and lib/suggest.ts. These
// are the easiest thing in the app to get subtly wrong and the easiest to test,
// which is exactly why they don't touch Supabase.
//
// The bar for firing one of these is high on purpose. A plan that nags is a
// plan you delete, and "forgiveness, not streaks" applies to the app's own
// prompts as much as to a missed Wednesday. Every check here has to answer
// "would a reasonable coach actually raise this?" — not "is this technically
// true".

import { daysBetween } from "@/lib/dates";

export type ReviewReason = "time" | "stalled" | "adherence" | "season" | "manual";

export type Review = {
  reason: ReviewReason;
  /** Copy for the prompt. Written as an observation, never an instruction. */
  message: string;
  /** Stored in plan_reviews.detail — the evidence, so we can explain later. */
  detail: Record<string, unknown>;
};

export type ReviewInputs = {
  today: string;
  /** plans.started_on, or the plan's creation date. */
  startedOn: string | null;
  /** plans.last_reviewed_on. */
  lastReviewedOn: string | null;
  /** plans.review_after_weeks. */
  reviewAfterWeeks: number;
  /** Dates a session was completed, ascending, most recent last. */
  workoutDates: string[];
  /** The user's own median gap, from computeStats(). */
  typicalGapDays: number;
  /** Per exercise: the top weight logged in each session, oldest first. */
  topSetsByExercise: Record<string, { name: string; weights: number[] }>;
};

/** Sessions a week the plan implies, used to judge adherence. */
export const SESSIONS_PER_WEEK_ASSUMED = 3;

/** How many sessions at a flat top set before it counts as stalled. */
export const STALL_SESSIONS = 4;

/** Don't judge adherence until there's this much history to judge. */
export const ADHERENCE_MIN_DAYS = 28;

/**
 * The block has run its length.
 *
 * Uses the same arithmetic as review_due_on() in Postgres, deliberately: the
 * app and the database must agree on when a plan is due, or the prompt appears
 * and disappears depending on which one you asked.
 */
export function timeReview(i: ReviewInputs): Review | null {
  const from = i.lastReviewedOn ?? i.startedOn;
  if (!from) return null;

  const dueIn = i.reviewAfterWeeks * 7 - daysBetween(from, i.today);
  if (dueIn > 0) return null;

  const weeks = Math.floor(daysBetween(from, i.today) / 7);
  return {
    reason: "time",
    message: `You've been on this plan ${weeks} weeks. Worth a look at whether it still fits.`,
    detail: { weeks, since: from, reviewAfterWeeks: i.reviewAfterWeeks },
  };
}

/**
 * A top set that hasn't moved.
 *
 * Only fires on a lift with a genuinely flat *or falling* top set across the
 * last STALL_SESSIONS sessions. Deliberately not "hasn't hit a PR" — PRs get
 * rarer the longer you train, and treating that as failure is how a plan starts
 * lying to an intermediate lifter.
 *
 * Requires at least two exercises to be stalled before firing. One lift
 * plateauing is normal and often intentional; three at once is the plan.
 */
export function stalledReview(i: ReviewInputs): Review | null {
  const stalled: { name: string; weight: number }[] = [];

  for (const { name, weights } of Object.values(i.topSetsByExercise)) {
    if (weights.length < STALL_SESSIONS) continue;
    const recent = weights.slice(-STALL_SESSIONS);
    const best = Math.max(...recent);
    // Flat or falling: nothing in the window beat the first entry.
    if (best <= recent[0]) stalled.push({ name, weight: recent[0] });
  }

  if (stalled.length < 2) return null;

  const names = stalled.map((s) => s.name);
  return {
    reason: "stalled",
    message:
      names.length === 2
        ? `${names[0]} and ${names[1]} haven't moved in ${STALL_SESSIONS} sessions.`
        : `${names.length} lifts haven't moved in ${STALL_SESSIONS} sessions.`,
    detail: { sessions: STALL_SESSIONS, exercises: stalled },
  };
}

/**
 * Training far less than the plan assumes.
 *
 * The honest framing: this is the plan being wrong about the user's life, not
 * the user failing the plan. A three-day plan someone does once a week should
 * become a one-day plan, and the message says so.
 *
 * Never fires on a new plan — under four weeks of history there's nothing to
 * conclude — and never on someone doing *more* than planned.
 */
export function adherenceReview(i: ReviewInputs): Review | null {
  const from = i.startedOn;
  if (!from) return null;

  const days = daysBetween(from, i.today);
  if (days < ADHERENCE_MIN_DAYS) return null;

  const weeks = days / 7;
  const expected = weeks * SESSIONS_PER_WEEK_ASSUMED;
  const actual = i.workoutDates.filter((d) => d >= from).length;
  if (expected <= 0) return null;

  const ratio = actual / expected;
  if (ratio >= 0.6) return null;

  const perWeek = Math.round((actual / weeks) * 10) / 10;
  return {
    reason: "adherence",
    message: `You're training about ${perWeek}× a week. A plan built for that would fit better than this one.`,
    detail: { actual, expected: Math.round(expected), perWeek, sinceDays: days },
  };
}

/**
 * Every check that currently applies, most actionable first.
 *
 * `season` is deliberately absent: nothing in the schema knows when a sport
 * season starts or ends, so firing it would be guessing. It stays a valid
 * `reason` for a manually created review until there's real signal.
 */
export function dueReviews(i: ReviewInputs): Review[] {
  return [stalledReview(i), adherenceReview(i), timeReview(i)].filter(
    (r): r is Review => r !== null
  );
}
