import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ProgressView from "@/components/ProgressView";
import { loadProgram, loadSessionsAndSets, type RawSet } from "@/lib/load";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProgressPage() {
  const ctx = await loadProgram();
  if (ctx.redirect) redirect(ctx.redirect);

  const { userId, days, exercises } = ctx;
  const dayIds = days.map((d) => d.id);
  const { sessions, sets } = await loadSessionsAndSets(userId, dayIds);

  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const setsBySession = new Map<string, RawSet[]>();
  for (const s of sets) {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  }

  // Stats from workout dates (any done set).
  const doneDates: string[] = [];
  for (const sess of sessions) {
    if ((setsBySession.get(sess.id) ?? []).some((r) => r.done)) {
      doneDates.push(sess.performed_on);
    }
  }
  const stats = computeStats(doneDates, todayUTC());

  // Per-exercise series: top weight per session date.
  // topByExerciseDate[exId][date] = max weight
  const topMap = new Map<string, Map<string, number>>();
  const bestMap = new Map<string, number>();

  for (const s of sets) {
    if (s.weight == null || (s.reps ?? 0) <= 0) continue;
    const sess = sessionById.get(s.session_id);
    if (!sess) continue;
    const date = sess.performed_on;

    let dateMap = topMap.get(s.exercise_id);
    if (!dateMap) {
      dateMap = new Map();
      topMap.set(s.exercise_id, dateMap);
    }
    dateMap.set(date, Math.max(dateMap.get(date) ?? 0, s.weight));
    bestMap.set(s.exercise_id, Math.max(bestMap.get(s.exercise_id) ?? 0, s.weight));
  }

  const exById = new Map(exercises.map((e) => [e.id, e]));

  // Only offer exercises that have data, ordered by program order.
  const exerciseOptions = exercises
    .filter((e) => topMap.has(e.id))
    .map((e) => ({ id: e.id, name: e.name }));

  const seriesByExercise: Record<string, { date: string; weight: number }[]> = {};
  for (const [exId, dateMap] of topMap.entries()) {
    seriesByExercise[exId] = Array.from(dateMap.entries())
      .map(([date, weight]) => ({ date, weight }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  const bests = Array.from(bestMap.entries())
    .map(([exId, weight]) => ({ name: exById.get(exId)?.name ?? "Exercise", weight }))
    .sort((a, b) => b.weight - a.weight);

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        <h1 className="mb-1 text-xl font-bold tracking-tight">Progress</h1>
        <p className="mb-5 text-sm text-muted">Your streaks, records, and trends.</p>
        <ProgressView
          stats={stats}
          exercises={exerciseOptions}
          seriesByExercise={seriesByExercise}
          bests={bests}
        />
      </main>
      <BottomNav />
    </>
  );
}
