import { redirect } from "next/navigation";
import Tracker from "@/components/Tracker";
import { loadProgram, loadSessionsAndSets, type RawSet } from "@/lib/load";
import { computeStats } from "@/lib/stats";
import type { DayView, SetLog } from "@/lib/types";

export const dynamic = "force-dynamic";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

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

export default async function Home() {
  const ctx = await loadProgram();
  if (ctx.redirect) redirect(ctx.redirect);

  const { userId, displayName, program, days, exercises } = ctx;
  const dayIds = days.map((d) => d.id);
  const { sessions, sets } = await loadSessionsAndSets(userId, dayIds);

  const today = todayUTC();

  // Group sets by session.
  const setsBySession = new Map<string, RawSet[]>();
  for (const s of sets) {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  }

  // All-time best weight per exercise (across every session, incl. today).
  const bestAll: Record<string, number> = {};
  for (const s of sets) {
    if (s.weight != null && (s.reps ?? 0) > 0) {
      bestAll[s.exercise_id] = Math.max(bestAll[s.exercise_id] ?? 0, s.weight);
    }
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
    const todaySession = daySessions.find((s) => s.performed_on === today);
    const lastSession = daySessions.find((s) => s.performed_on !== today);

    const todaySets: Record<string, SetLog[]> = {};
    const lastSets: Record<string, SetLog[]> = {};
    const bestWeight: Record<string, number> = {};

    const dayExercises = exercises.filter((e) => e.day_id === day.id);

    for (const ex of dayExercises) {
      if (todaySession) {
        const rows = (setsBySession.get(todaySession.id) ?? []).filter(
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
      // Best weight excluding today's session so a new PR today lights up.
      let best = 0;
      for (const sess of daySessions) {
        if (sess.performed_on === today) continue;
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
      programName={program?.name ?? "Your program"}
      views={views}
      stats={stats}
    />
  );
}
