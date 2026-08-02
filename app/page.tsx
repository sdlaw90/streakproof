import { redirect } from "next/navigation";
import Tracker from "@/components/Tracker";
import { loadPlan, loadSessionsAndSets, type RawSet } from "@/lib/load";
import { computeStats } from "@/lib/stats";
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

export default async function Home({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const ctx = await loadPlan("gym");
  if (ctx.redirect) redirect(ctx.redirect);

  const { userId, displayName, timezone, today, plan, days, exercises } = ctx;

  // ?date=YYYY-MM-DD fills in a session you forgot to log. Defaults to the
  // user's local today.
  const activeDate = sanitizeLogDate(searchParams?.date, today);

  const dayIds = days.map((d) => d.id);
  const { sessions, sets } = await loadSessionsAndSets(userId, dayIds);

  // Group sets by session.
  const setsBySession = new Map<string, RawSet[]>();
  for (const s of sets) {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  }

  // Workout dates (any completed set) for streak/stat math.
  const doneDates: string[] = [];
  for (const sess of sessions) {
    const rows = setsBySession.get(sess.id) ?? [];
    if (rows.some((r) => r.done)) doneDates.push(sess.performed_on);
  }
  const stats = computeStats(doneDates, today);

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
    <Tracker
      displayName={displayName}
      planName={plan?.name ?? "Your plan"}
      views={views}
      stats={stats}
      today={today}
      activeDate={activeDate}
      serverTimezone={timezone}
    />
  );
}
