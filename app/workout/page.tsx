import { redirect } from "next/navigation";
import Tracker from "@/components/Tracker";
import { loadPlan, loadSessionsAndSets, type RawSet } from "@/lib/load";
import { sanitizeLogDate } from "@/lib/dates";
import type { DayView, SetLog } from "@/lib/types";

export const dynamic = "force-dynamic";

function toSetLogs(rows: RawSet[]): SetLog[] {
  return rows
    .map((r) => ({
      set_number: r.set_number,
      weight: r.weight,
      reps: r.reps,
      done: r.done,
    }))
    .sort((a, b) => a.set_number - b.set_number);
}

/**
 * The set logger. This was `/` until the home screen became a summary — landing
 * straight on a workout meant the first thing the app ever showed you was a
 * grid of empty inputs, which is the opposite of "no decisions at the point of
 * need". Home now suggests a day and links here.
 */
export default async function WorkoutPage({
  searchParams,
}: {
  // Async since Next 15 — a page can start rendering before the request's
  // search params are known.
  searchParams?: Promise<{ date?: string; day?: string }>;
}) {
  const ctx = await loadPlan("gym");
  if (ctx.redirect) redirect(ctx.redirect);

  const { userId, timezone, today, days, exercises } = ctx;

  // ?date=YYYY-MM-DD fills in a session you forgot to log. Defaults to the
  // user's local today.
  const params = await searchParams;
  const activeDate = sanitizeLogDate(params?.date, today);

  // ?day=A opens a specific day — that's how the home screen hands off its
  // suggestion. An unknown key falls back to the first day rather than erroring.
  const requestedDay = days.find((d) => d.key === params?.day);

  const dayIds = days.map((d) => d.id);
  const { sessions, sets } = await loadSessionsAndSets(userId, dayIds);

  // Group sets by session.
  const setsBySession = new Map<string, RawSet[]>();
  for (const s of sets) {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  }

  const views: DayView[] = days.map((day) => {
    const daySessions = sessions.filter((s) => s.day_id === day.id);
    const activeSession = daySessions.find((s) => s.performed_on === activeDate);
    // "Last time" is the most recent session BEFORE the one being edited, not
    // merely a different one — otherwise backfilling shows you the future.
    const lastSession = daySessions
      .filter((s) => s.performed_on < activeDate)
      .sort((a, b) => (a.performed_on < b.performed_on ? 1 : -1))[0];

    const todaySets: Record<string, SetLog[]> = {};
    const lastSets: Record<string, SetLog[]> = {};
    const bestWeight: Record<string, number> = {};

    const dayExercises = exercises.filter((e) => e.day_id === day.id);

    for (const ex of dayExercises) {
      if (activeSession) {
        const rows = (setsBySession.get(activeSession.id) ?? []).filter(
          (r) => r.exercise_id === ex.id
        );
        if (rows.length) todaySets[ex.id] = toSetLogs(rows);
      }
      if (lastSession) {
        const rows = (setsBySession.get(lastSession.id) ?? []).filter(
          (r) => r.exercise_id === ex.id
        );
        if (rows.length) lastSets[ex.id] = toSetLogs(rows);
      }
      // Best weight excluding the session being edited, so a new PR lights up.
      let best = 0;
      for (const sess of daySessions) {
        if (sess.performed_on === activeDate) continue;
        for (const r of setsBySession.get(sess.id) ?? []) {
          if (r.exercise_id === ex.id && r.weight != null && (r.reps ?? 0) > 0) {
            best = Math.max(best, r.weight);
          }
        }
      }
      if (best > 0) bestWeight[ex.id] = best;
    }

    return { day, exercises: dayExercises, todaySets, lastSets, bestWeight };
  });

  return (
    // key={activeDate} forces a remount when the date changes. Tracker seeds its
    // local set state in a useState initializer, which only runs on mount — a
    // client-side nav to ?date=… lands on the same route in the same tree
    // position, so React keeps the instance and the previous date's typed values
    // stay on screen, then get written to the newly selected date on blur.
    <Tracker
      key={activeDate}
      views={views}
      today={today}
      activeDate={activeDate}
      serverTimezone={timezone}
      initialDayId={requestedDay?.id}
    />
  );
}
