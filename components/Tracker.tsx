"use client";

import { useMemo, useState, useTransition } from "react";
import { saveSet } from "@/app/actions";
import BottomNav from "@/components/BottomNav";
import RestTimer from "@/components/RestTimer";
import type { DayView, Exercise } from "@/lib/types";
import type { Stats } from "@/lib/stats";

type LocalSet = { weight: string; reps: string; done: boolean };
type DayState = Record<string, LocalSet[]>; // exerciseId -> sets
type AllState = Record<string, DayState>; // dayId -> ...

function buildInitial(views: DayView[]): AllState {
  const state: AllState = {};
  for (const v of views) {
    const dayState: DayState = {};
    for (const ex of v.exercises) {
      const existing = v.todaySets[ex.id] ?? [];
      const rows: LocalSet[] = [];
      for (let i = 1; i <= Math.max(1, ex.sets); i++) {
        const found = existing.find((s) => s.set_number === i);
        rows.push({
          weight: found?.weight != null ? String(found.weight) : "",
          reps: found?.reps != null ? String(found.reps) : "",
          done: found?.done ?? false,
        });
      }
      dayState[ex.id] = rows;
    }
    state[v.day.id] = dayState;
  }
  return state;
}

export default function Tracker({
  displayName,
  programName,
  views,
  stats,
}: {
  displayName: string;
  programName: string;
  views: DayView[];
  stats: Stats;
}) {
  const [activeDayId, setActiveDayId] = useState(views[0]?.day.id ?? "");
  const [state, setState] = useState<AllState>(() => buildInitial(views));
  const [, startTransition] = useTransition();

  const active = useMemo(
    () => views.find((v) => v.day.id === activeDayId) ?? views[0],
    [views, activeDayId]
  );

  if (!active) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-muted">
        No program loaded. Add days &amp; exercises under Edit, or re-run seed.sql.
      </main>
    );
  }

  const dayState = state[active.day.id] ?? {};

  const totalSets = active.exercises.reduce(
    (n, ex) => n + (dayState[ex.id]?.length ?? 0),
    0
  );
  const doneSets = active.exercises.reduce(
    (n, ex) => n + (dayState[ex.id]?.filter((s) => s.done).length ?? 0),
    0
  );

  function mutate(exId: string, setIdx: number, patch: Partial<LocalSet>) {
    setState((prev) => {
      const day = { ...(prev[active.day.id] ?? {}) };
      const rows = [...(day[exId] ?? [])];
      rows[setIdx] = { ...rows[setIdx], ...patch };
      day[exId] = rows;
      return { ...prev, [active.day.id]: day };
    });
  }

  // Persist using EXPLICIT row values (never reads async state) to avoid stale reads.
  function persist(exId: string, setIdx: number, row: LocalSet) {
    const weight = row.weight.trim() === "" ? null : Number(row.weight);
    const reps = row.reps.trim() === "" ? null : Number(row.reps);
    startTransition(async () => {
      await saveSet({
        dayId: active.day.id,
        exerciseId: exId,
        setNumber: setIdx + 1,
        weight: weight != null && Number.isFinite(weight) ? weight : null,
        reps: reps != null && Number.isFinite(reps) ? reps : null,
        done: row.done,
      });
    });
  }

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Hey {displayName} 👋</h1>
            <p className="text-sm text-muted">{programName}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted">
              Sign out
            </button>
          </form>
        </header>

        <StatsBar stats={stats} />

        {/* Day tabs */}
        <div className="mb-4 mt-4 flex flex-wrap gap-2">
          {views.map((v) => {
            const isActive = v.day.id === active.day.id;
            return (
              <button
                key={v.day.id}
                onClick={() => setActiveDayId(v.day.id)}
                className={
                  "min-w-[92px] flex-1 rounded-xl border px-2 py-2.5 text-center transition " +
                  (isActive ? "border-accent bg-accent/10" : "border-line bg-panel")
                }
              >
                <div className="text-[11px] uppercase tracking-wide text-faint">
                  {v.day.key}
                </div>
                <div
                  className={
                    "text-sm font-bold " + (isActive ? "text-accent" : "text-ink")
                  }
                >
                  {v.day.title.replace(/^Day [A-Z] · /, "")}
                </div>
              </button>
            );
          })}
        </div>

        {/* Progress */}
        <div className="mb-1 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-line bg-panel2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent2 to-accent transition-all"
              style={{ width: (totalSets ? (doneSets / totalSets) * 100 : 0) + "%" }}
            />
          </div>
          <div className="w-16 text-right text-sm font-bold text-accent tabular-nums">
            {doneSets}/{totalSets}
          </div>
        </div>
        {active.day.subtitle && (
          <p className="mb-4 text-sm text-muted">{active.day.subtitle}</p>
        )}

        {/* Exercises */}
        <div className="space-y-2.5">
          {active.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              rows={dayState[ex.id] ?? []}
              last={active.lastSets[ex.id]}
              best={active.bestWeight[ex.id]}
              onChange={(idx, patch) => mutate(ex.id, idx, patch)}
              onCommit={(idx, row) => persist(ex.id, idx, row)}
            />
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-faint">
          Saved automatically · synced to your account
        </p>
      </main>

      <RestTimer />
      <BottomNav />
    </>
  );
}

function StatsBar({ stats }: { stats: Stats }) {
  const nudge =
    stats.lastAgoDays != null && stats.lastAgoDays >= 3 && stats.total > 0;
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Streak" value={`${stats.streakWeeks} wk`} hot={stats.streakWeeks >= 2} />
        <Stat label="This week" value={String(stats.thisWeek)} />
        <Stat label="All-time" value={String(stats.total)} />
      </div>
      {nudge && (
        <p className="mt-2 text-center text-xs text-gold">
          It&apos;s been {stats.lastAgoDays} days — never miss twice 💪
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3 py-2 text-center">
      <div className={"text-lg font-bold " + (hot ? "text-gold" : "text-ink")}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  rows,
  last,
  best,
  onChange,
  onCommit,
}: {
  exercise: Exercise;
  rows: LocalSet[];
  last?: DayView["lastSets"][string];
  best?: number;
  onChange: (idx: number, patch: Partial<LocalSet>) => void;
  onCommit: (idx: number, row: LocalSet) => void;
}) {
  const [open, setOpen] = useState(false);

  const doneCount = rows.filter((r) => r.done).length;
  const allDone = rows.length > 0 && doneCount === rows.length;

  const todayMax = rows.reduce((m, r) => {
    const w = Number(r.weight);
    return r.weight.trim() !== "" && Number.isFinite(w) && Number(r.reps) > 0
      ? Math.max(m, w)
      : m;
  }, 0);
  const isPR = best != null && todayMax > best;

  const lastLabel =
    last && last.length
      ? last
          .map((s) => (s.weight != null ? `${s.weight}×${s.reps ?? "?"}` : null))
          .filter(Boolean)
          .join(", ")
      : null;

  return (
    <div
      className={
        "overflow-hidden rounded-xl border bg-panel2 transition " +
        (allDone ? "border-accent bg-accent/5" : "border-line")
      }
    >
      <div className="flex items-center gap-3 px-3.5 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={"font-semibold " + (allDone ? "text-muted" : "text-ink")}>
              {exercise.name}
            </span>
            {isPR && (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                🏆 PR
              </span>
            )}
          </div>
          <div className="text-xs text-muted">
            {exercise.scheme}
            {best != null && <span className="text-faint"> · best {best}</span>}
          </div>
        </div>
        <span className="flex-none text-xs tabular-nums text-faint">
          {doneCount}/{rows.length}
        </span>
        {exercise.cue && (
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex-none rounded-md border border-line px-2 py-1 text-[11px] text-faint"
          >
            cue
          </button>
        )}
      </div>

      {open && exercise.cue && (
        <div className="px-3.5 pb-1 pt-2 text-[13px] text-muted">
          <span className="font-semibold text-ink">Form: </span>
          {exercise.cue}
        </div>
      )}

      {lastLabel && (
        <div className="px-3.5 pt-2 text-[11px] text-faint">last time: {lastLabel}</div>
      )}

      <div className="mt-1 divide-y divide-line/50 px-3.5 pb-3">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2 py-2">
            <span className="w-10 flex-none text-xs font-semibold uppercase text-faint">
              Set {idx + 1}
            </span>
            <input
              inputMode="decimal"
              value={row.weight}
              onChange={(e) => onChange(idx, { weight: e.target.value })}
              onBlur={() => onCommit(idx, row)}
              placeholder="lb"
              className="w-16 rounded-lg border border-line bg-panel px-2 py-1.5 text-center text-sm text-ink placeholder:text-faint"
            />
            <span className="text-faint">×</span>
            <input
              inputMode="numeric"
              value={row.reps}
              onChange={(e) => onChange(idx, { reps: e.target.value })}
              onBlur={() => onCommit(idx, row)}
              placeholder="reps"
              className="w-16 rounded-lg border border-line bg-panel px-2 py-1.5 text-center text-sm text-ink placeholder:text-faint"
            />
            <button
              onClick={() => {
                const next = { ...row, done: !row.done };
                onChange(idx, { done: next.done });
                onCommit(idx, next);
              }}
              aria-label="set done"
              className={
                "ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-lg border-2 text-sm font-black text-bg transition " +
                (row.done ? "border-accent bg-accent" : "border-faint")
              }
            >
              {row.done ? "✓" : ""}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
