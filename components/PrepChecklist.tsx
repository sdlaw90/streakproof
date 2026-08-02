"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { togglePrepTask } from "@/app/food/actions";

export type PrepView = {
  id: string;
  key: string;
  title: string;
  estMinutes: number | null;
  state: "today" | "overdue" | "done" | "upcoming";
  tasks: { id: string; text: string }[];
  doneTaskIds: string[];
};

const STATE_LABEL: Record<PrepView["state"], string> = {
  today: "Today",
  overdue: "Overdue",
  done: "Done today",
  upcoming: "Coming up",
};

const STATE_STYLE: Record<PrepView["state"], string> = {
  today: "bg-gold/15 text-gold",
  overdue: "bg-hot/15 text-hot",
  done: "bg-accent/15 text-accent",
  upcoming: "bg-panel2 text-faint",
};

export default function PrepChecklist({ sessions }: { sessions: PrepView[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Optimistic so a tick is instant on gym wifi. The server action still
  // decides; a failure surfaces below rather than silently reverting.
  const [done, setDone] = useOptimistic(
    Object.fromEntries(sessions.map((s) => [s.id, s.doneTaskIds])) as Record<
      string,
      string[]
    >
  );

  function toggle(sessionId: string, taskId: string) {
    const current = done[sessionId] ?? [];
    const isDone = current.includes(taskId);
    setError(null);

    startTransition(async () => {
      setDone({
        ...done,
        [sessionId]: isDone
          ? current.filter((t) => t !== taskId)
          : [...current, taskId],
      });
      const res = await togglePrepTask({
        prepSessionId: sessionId,
        taskId,
        done: !isDone,
      });
      if (!res.ok) setError(res.error ?? "That didn't save.");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
          {error}
        </p>
      )}

      {sessions.map((s) => {
        const doneIds = new Set(done[s.id] ?? []);
        const complete = s.tasks.length > 0 && doneIds.size >= s.tasks.length;

        return (
          <section
            key={s.id}
            className="overflow-hidden rounded-2xl border border-line bg-panel"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.title}</p>
                <p className="text-xs text-faint">
                  {doneIds.size} of {s.tasks.length}
                  {s.estMinutes != null && ` · ~${s.estMinutes} min`}
                </p>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                  STATE_STYLE[complete ? "done" : s.state]
                }
              >
                {complete ? "Done" : STATE_LABEL[s.state]}
              </span>
            </div>

            <ul>
              {s.tasks.map((t) => {
                const isDone = doneIds.has(t.id);
                return (
                  <li key={t.id} className="border-b border-line last:border-0">
                    <button
                      onClick={() => toggle(s.id, t.id)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-panel2"
                    >
                      <span
                        className={
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border text-xs " +
                          (isDone
                            ? "border-accent bg-accent text-bg"
                            : "border-line bg-panel2")
                        }
                      >
                        {isDone ? "✓" : ""}
                      </span>
                      <span
                        className={
                          "text-sm " + (isDone ? "text-faint line-through" : "text-ink")
                        }
                      >
                        {t.text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {complete && (
              <p className="px-4 py-3 text-sm text-accent">
                That&rsquo;s the week handled. 🎉
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
