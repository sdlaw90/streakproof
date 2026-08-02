"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  addDay,
  addExercise,
  deleteDay,
  deleteExercise,
  moveDay,
  moveExercise,
  updateDay,
  updateExercise,
} from "@/app/program/actions";
import type { Day, Exercise } from "@/lib/types";

export default function ProgramEditor({
  canEdit,
  programId,
  programName,
  days,
  exercisesByDay,
}: {
  canEdit: boolean;
  programId: string;
  programName: string;
  days: Day[];
  exercisesByDay: Record<string, Exercise[]>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  if (!canEdit) {
    return (
      <div className="rounded-xl border border-line bg-panel p-5 text-sm text-muted">
        This program isn&apos;t owned by your account, so it&apos;s read-only here.
      </div>
    );
  }

  return (
    <div className={"space-y-4 " + (pending ? "opacity-70" : "")}>
      <p className="text-sm text-muted">
        Editing <span className="font-semibold text-ink">{programName}</span>. Changes
        save automatically and show up on your Today tab.
      </p>

      {days.map((day, di) => {
        const exs = exercisesByDay[day.id] ?? [];
        return (
          <div key={day.id} className="rounded-2xl border border-line bg-panel p-4">
            {/* Day header controls */}
            <div className="mb-3 flex items-center gap-2">
              <input
                defaultValue={day.key}
                onBlur={(e) => run(() => updateDay(day.id, { key: e.target.value }))}
                className="w-16 rounded-lg border border-line bg-panel2 px-2 py-1.5 text-center text-xs font-bold uppercase text-accent"
                aria-label="day key"
              />
              <input
                defaultValue={day.title}
                onBlur={(e) => run(() => updateDay(day.id, { title: e.target.value }))}
                className="flex-1 rounded-lg border border-line bg-panel2 px-2 py-1.5 text-sm font-semibold text-ink"
                aria-label="day title"
              />
              <button
                onClick={() => run(() => moveDay(day.id, "up"))}
                disabled={di === 0}
                className="rounded-md border border-line px-2 py-1 text-xs text-muted disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => run(() => moveDay(day.id, "down"))}
                disabled={di === days.length - 1}
                className="rounded-md border border-line px-2 py-1 text-xs text-muted disabled:opacity-30"
              >
                ↓
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${day.title}" and its exercises?`))
                    run(() => deleteDay(day.id));
                }}
                className="rounded-md border border-hot/40 px-2 py-1 text-xs text-hot"
              >
                ✕
              </button>
            </div>

            <input
              defaultValue={day.subtitle ?? ""}
              onBlur={(e) =>
                run(() => updateDay(day.id, { subtitle: e.target.value || null }))
              }
              placeholder="Subtitle (optional)"
              className="mb-3 w-full rounded-lg border border-line bg-panel2 px-2 py-1.5 text-xs text-muted placeholder:text-faint"
            />

            {/* Exercises */}
            <div className="space-y-3">
              {exs.map((ex, ei) => (
                <div key={ex.id} className="rounded-xl border border-line bg-panel2 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      defaultValue={ex.name}
                      onBlur={(e) =>
                        run(() => updateExercise(ex.id, { name: e.target.value }))
                      }
                      className="flex-1 rounded-lg border border-line bg-panel px-2 py-1.5 text-sm font-semibold text-ink"
                      aria-label="exercise name"
                    />
                    <button
                      onClick={() => run(() => moveExercise(ex.id, "up"))}
                      disabled={ei === 0}
                      className="rounded-md border border-line px-2 py-1 text-xs text-muted disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => run(() => moveExercise(ex.id, "down"))}
                      disabled={ei === exs.length - 1}
                      className="rounded-md border border-line px-2 py-1 text-xs text-muted disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => run(() => deleteExercise(ex.id))}
                      className="rounded-md border border-hot/40 px-2 py-1 text-xs text-hot"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mb-2 flex gap-2">
                    <input
                      defaultValue={ex.scheme ?? ""}
                      onBlur={(e) =>
                        run(() => updateExercise(ex.id, { scheme: e.target.value }))
                      }
                      placeholder="3 × 8–10 · legs"
                      className="flex-1 rounded-lg border border-line bg-panel px-2 py-1.5 text-xs text-muted"
                      aria-label="scheme"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] uppercase text-faint">sets</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        defaultValue={ex.sets}
                        onBlur={(e) =>
                          run(() =>
                            updateExercise(ex.id, { sets: Number(e.target.value) })
                          )
                        }
                        className="w-14 rounded-lg border border-line bg-panel px-2 py-1.5 text-center text-sm text-ink"
                        aria-label="sets"
                      />
                    </div>
                  </div>

                  <textarea
                    defaultValue={ex.cue ?? ""}
                    onBlur={(e) =>
                      run(() => updateExercise(ex.id, { cue: e.target.value || null }))
                    }
                    placeholder="Form cue (optional)"
                    className="min-h-[52px] w-full rounded-lg border border-line bg-panel px-2 py-1.5 text-xs text-muted placeholder:text-faint"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => run(() => addExercise(day.id))}
              className="mt-3 w-full rounded-lg border border-dashed border-line py-2 text-sm text-accent2"
            >
              + Add exercise
            </button>
          </div>
        );
      })}

      <button
        onClick={() => run(() => addDay(programId))}
        className="w-full rounded-2xl border border-dashed border-line py-3 text-sm font-semibold text-accent2"
      >
        + Add day
      </button>
    </div>
  );
}
