import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { loadProgram, loadSessionsAndSets, type RawSet } from "@/lib/load";

export const dynamic = "force-dynamic";

function fmtDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function HistoryPage() {
  const ctx = await loadProgram();
  if (ctx.redirect) redirect(ctx.redirect);

  const { userId, days, exercises } = ctx;
  const dayIds = days.map((d) => d.id);
  const { sessions, sets } = await loadSessionsAndSets(userId, dayIds);

  const dayById = new Map(days.map((d) => [d.id, d]));
  const exById = new Map(exercises.map((e) => [e.id, e]));

  const setsBySession = new Map<string, RawSet[]>();
  for (const s of sets) {
    const arr = setsBySession.get(s.session_id) ?? [];
    arr.push(s);
    setsBySession.set(s.session_id, arr);
  }

  // Only show sessions that actually have logged sets.
  const withData = sessions.filter(
    (s) => (setsBySession.get(s.id) ?? []).length > 0
  );

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        <h1 className="mb-1 text-xl font-bold tracking-tight">History</h1>
        <p className="mb-5 text-sm text-muted">Every session you&apos;ve logged.</p>

        {withData.length === 0 && (
          <p className="rounded-xl border border-line bg-panel p-5 text-center text-sm text-muted">
            No sessions yet. Go log a workout and it&apos;ll show up here.
          </p>
        )}

        <div className="space-y-3">
          {withData.map((sess) => {
            const day = dayById.get(sess.day_id);
            const rows = setsBySession.get(sess.id) ?? [];
            const doneCount = rows.filter((r) => r.done).length;
            const volume = rows.reduce(
              (v, r) => v + (r.weight ?? 0) * (r.reps ?? 0),
              0
            );

            // Group sets by exercise, preserving program order.
            const byEx = new Map<string, RawSet[]>();
            for (const r of rows) {
              const arr = byEx.get(r.exercise_id) ?? [];
              arr.push(r);
              byEx.set(r.exercise_id, arr);
            }
            const orderedExIds = Array.from(byEx.keys()).sort(
              (a, b) => (exById.get(a)?.sort ?? 0) - (exById.get(b)?.sort ?? 0)
            );

            return (
              <div
                key={sess.id}
                className="rounded-2xl border border-line bg-panel p-4"
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <div className="font-semibold">{day?.title ?? "Workout"}</div>
                  <div className="text-xs text-faint">{fmtDate(sess.performed_on)}</div>
                </div>
                <div className="mb-3 flex gap-3 text-xs text-muted">
                  <span>{doneCount} sets done</span>
                  {volume > 0 && (
                    <span>· {Math.round(volume).toLocaleString()} lb volume</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {orderedExIds.map((exId) => {
                    const ex = exById.get(exId);
                    const logged = (byEx.get(exId) ?? [])
                      .sort((a, b) => a.set_number - b.set_number)
                      .filter((r) => r.weight != null || r.reps != null || r.done);
                    if (!logged.length) return null;
                    return (
                      <div key={exId} className="flex gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-muted">
                          {ex?.name ?? "Exercise"}
                        </span>
                        <span className="flex-none text-right text-ink">
                          {logged
                            .map((r) =>
                              r.weight != null
                                ? `${r.weight}×${r.reps ?? "?"}`
                                : r.done
                                ? "✓"
                                : ""
                            )
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
