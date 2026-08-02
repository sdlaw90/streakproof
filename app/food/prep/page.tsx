import Link from "next/link";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PrepChecklist, { type PrepView } from "@/components/PrepChecklist";
import { loadFood } from "@/lib/food";
import { prepDueOn } from "@/lib/suggest";

export const dynamic = "force-dynamic";

export default async function PrepPage() {
  const ctx = await loadFood();
  if (ctx.redirect) redirect(ctx.redirect);

  const { today, prepSessions, prepTasks, prepLogs } = ctx;

  const lastBySession: Record<string, string | undefined> = {};
  for (const log of prepLogs) {
    const prev = lastBySession[log.prep_session_id];
    if (!prev || log.performed_on > prev) {
      lastBySession[log.prep_session_id] = log.performed_on;
    }
  }

  const todaysLogs = new Map(
    prepLogs
      .filter((l) => l.performed_on === today)
      .map((l) => [l.prep_session_id, l.completed_task_ids])
  );

  const sessions: PrepView[] = prepSessions.map((s) => ({
    id: s.id,
    key: s.key,
    title: s.title,
    estMinutes: s.est_minutes,
    state: prepDueOn(s.weekday, today, lastBySession[s.id]),
    tasks: prepTasks
      .filter((t) => t.prep_session_id === s.id)
      .map((t) => ({ id: t.id, text: t.text })),
    doneTaskIds: todaysLogs.get(s.id) ?? [],
  }));

  return (
    <>
      <main className="mx-auto max-w-2xl px-5 pt-5 pb-28">
        <header className="mb-5 flex items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Prep</h1>
            <p className="mt-0.5 text-sm text-muted">
              Two short sessions beat one Sunday marathon.
            </p>
          </div>
          <Link href="/food" className="shrink-0 text-sm text-accent2">
            Food
          </Link>
        </header>

        {sessions.length ? (
          <PrepChecklist sessions={sessions} />
        ) : (
          <p className="rounded-2xl border border-line bg-panel p-5 text-sm text-muted">
            This plan has no prep sessions.
          </p>
        )}

        <p className="mt-6 rounded-2xl border border-line bg-panel2 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-gold">Missed one?</span> Don&rsquo;t
          wait for next week — twenty minutes at the shop buying pre-cooked
          components does the same job.
        </p>
      </main>

      <BottomNav />
    </>
  );
}
