"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteSet, saveSet, saveTimezone } from "@/app/actions";
import BottomNav from "@/components/BottomNav";
import RestTimer from "@/components/RestTimer";
import { addDays, daysBetween, humanDate } from "@/lib/dates";
import type { DayView, Exercise } from "@/lib/types";

type LocalSet = { weight: string; reps: string; done: boolean };
type DayState = Record<string, LocalSet[]>; // exerciseId -> sets
type AllState = Record<string, DayState>; // dayId -> ...
type SaveState = "saving" | "saved" | "error";

const MAX_BACKFILL_DAYS = 90;

function buildInitial(views: DayView[]): AllState {
  const state: AllState = {};
  for (const v of views) {
    const dayState: DayState = {};
    for (const ex of v.exercises) {
      const existing = v.todaySets[ex.id] ?? [];
      // Render at least `ex.sets` rows, but never fewer than what's already
      // logged — v1 capped at ex.sets and silently hid extra sets.
      const loggedMax = existing.reduce((m, s) => Math.max(m, s.set_number), 0);
      const rowCount = Math.max(1, ex.sets, loggedMax);
      const rows: LocalSet[] = [];
      for (let i = 1; i <= rowCount; i++) {
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
  views,
  today,
  activeDate,
  serverTimezone,
  initialDayId,
}: {
  views: DayView[];
  today: string;
  activeDate: string;
  serverTimezone: string;
  /** Which day tab to open on — the home screen's suggestion, via ?day=. */
  initialDayId?: string;
}) {
  const router = useRouter();
  const [activeDayId, setActiveDayId] = useState(
    initialDayId ?? views[0]?.day.id ?? ""
  );
  const [state, setState] = useState<AllState>(() => buildInitial(views));
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  // Pending writes that failed, keyed the same way as saveStates, so "retry
  // all" can replay them without the user re-typing anything.
  const failedRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const [failedCount, setFailedCount] = useState(0);

  // Server-side dates come from profiles.timezone. If the browser disagrees,
  // fix it once and reload — otherwise "today" is wrong for everything.
  useEffect(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz && browserTz !== serverTimezone) {
      saveTimezone(browserTz).then((r) => {
        if (r.ok) router.refresh();
      });
    }
  }, [serverTimezone, router]);

  const active = useMemo(
    () => views.find((v) => v.day.id === activeDayId) ?? views[0],
    [views, activeDayId]
  );

  const isBackfill = activeDate !== today;

  const markSaved = useCallback((key: string, ok: boolean) => {
    setSaveStates((prev) => ({ ...prev, [key]: ok ? "saved" : "error" }));
    if (ok) {
      // Clear the "saved" tick after a moment so the UI stays quiet.
      setTimeout(
        () =>
          setSaveStates((prev) => {
            if (prev[key] !== "saved") return prev;
            const next = { ...prev };
            delete next[key];
            return next;
          }),
        1500
      );
    }
  }, []);

  if (!active) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-12 text-muted">
        No plan loaded. Add days &amp; exercises under Edit, or re-run the seed.
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

  /**
   * Persist using EXPLICIT row values (never reads async state) to avoid stale
   * reads. v1 fired this into a transition and discarded the result, so a
   * failed write on bad gym wifi vanished without a trace.
   */
  function persist(exId: string, setIdx: number, row: LocalSet) {
    const key = `${exId}:${setIdx}`;
    const weight = row.weight.trim() === "" ? null : Number(row.weight);
    const reps = row.reps.trim() === "" ? null : Number(row.reps);

    const attempt = async () => {
      setSaveStates((prev) => ({ ...prev, [key]: "saving" }));
      const res = await saveSet({
        dayId: active.day.id,
        exerciseId: exId,
        setNumber: setIdx + 1,
        performedOn: activeDate,
        weight: weight != null && Number.isFinite(weight) ? weight : null,
        reps: reps != null && Number.isFinite(reps) ? reps : null,
        done: row.done,
      }).catch((e: unknown) => ({
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
      }));

      if (res.ok) {
        failedRef.current.delete(key);
        setFailedCount(failedRef.current.size);
      } else {
        failedRef.current.set(key, attempt);
        setFailedCount(failedRef.current.size);
      }
      markSaved(key, res.ok);
    };

    void attempt();
  }

  function addSet(exId: string) {
    setState((prev) => {
      const day = { ...(prev[active.day.id] ?? {}) };
      const rows = [...(day[exId] ?? [])];
      const last = rows[rows.length - 1];
      // Prefill from the previous set — you're usually doing the same weight.
      rows.push({ weight: last?.weight ?? "", reps: "", done: false });
      day[exId] = rows;
      return { ...prev, [active.day.id]: day };
    });
  }

  function removeSet(exId: string) {
    const rows = dayState[exId] ?? [];
    if (rows.length <= 1) return;
    const setNumber = rows.length;
    setState((prev) => {
      const day = { ...(prev[active.day.id] ?? {}) };
      day[exId] = (day[exId] ?? []).slice(0, -1);
      return { ...prev, [active.day.id]: day };
    });
    void deleteSet({
      dayId: active.day.id,
      exerciseId: exId,
      setNumber,
      performedOn: activeDate,
    });
  }

  async function retryAll() {
    const attempts = Array.from(failedRef.current.values());
    await Promise.all(attempts.map((fn) => fn()));
  }

  function goToDate(date: string) {
    router.push(date === today ? "/" : `/?date=${date}`);
  }

  const backDays = daysBetween(activeDate, today);

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        {/*
          No greeting, stats row or sign-out here any more. Home carries the
          greeting, the nudge and the stats; the drawer carries sign-out. This
          screen does one thing: log the session. See docs/decisions/0010.
        */}
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h1 className="truncate text-lg font-bold tracking-tight">
            {active.day.title}
          </h1>
          <Link href="/" className="shrink-0 text-sm text-accent2">
            Home
          </Link>
        </header>

        {/* Date picker — lets you fill in a session you forgot to log. */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToDate(addDays(activeDate, -1))}
            disabled={backDays >= MAX_BACKFILL_DAYS}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-muted disabled:opacity-40"
            aria-label="Previous day"
          >
            ‹
          </button>
          <div
            className={
              "flex-1 rounded-lg border px-3 py-1.5 text-center text-sm font-semibold " +
              (isBackfill
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-line bg-panel text-ink")
            }
          >
            {humanDate(activeDate, today)}
            {isBackfill && <span className="ml-2 text-xs font-normal">· filling in</span>}
          </div>
          <button
            onClick={() => goToDate(addDays(activeDate, 1))}
            disabled={!isBackfill}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-muted disabled:opacity-40"
            aria-label="Next day"
          >
            ›
          </button>
          {isBackfill && (
            <button
              onClick={() => goToDate(today)}
              className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs text-muted"
            >
              Today
            </button>
          )}
        </div>

        {failedCount > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-hot/40 bg-hot/10 px-3 py-2.5 text-sm">
            <span className="flex-1 text-hot">
              {failedCount} {failedCount === 1 ? "set" : "sets"} didn&apos;t save.
            </span>
            <button
              onClick={retryAll}
              className="rounded-lg border border-hot/50 px-3 py-1 text-xs font-semibold text-hot"
            >
              Retry
            </button>
          </div>
        )}

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
                {v.day.est_minutes != null && (
                  <div className="text-[10px] text-faint">~{v.day.est_minutes} min</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Progress */}
        <div className="mb-1 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-line bg-panel2">
            <div
              className="h-full rounded-full bg-linear-to-r from-accent2 to-accent transition-all"
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
              saveStates={saveStates}
              onChange={(idx, patch) => mutate(ex.id, idx, patch)}
              onCommit={(idx, row) => persist(ex.id, idx, row)}
              onAddSet={() => addSet(ex.id)}
              onRemoveSet={() => removeSet(ex.id)}
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


function ExerciseCard({
  exercise,
  rows,
  last,
  best,
  saveStates,
  onChange,
  onCommit,
  onAddSet,
  onRemoveSet,
}: {
  exercise: Exercise;
  rows: LocalSet[];
  last?: DayView["lastSets"][string];
  best?: number;
  saveStates: Record<string, SaveState>;
  onChange: (idx: number, patch: Partial<LocalSet>) => void;
  onCommit: (idx: number, row: LocalSet) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
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
            {exercise.optional && (
              <span className="rounded-full bg-faint/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-faint">
                optional
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

      <div className="mt-1 divide-y divide-line/50 px-3.5">
        {rows.map((row, idx) => {
          const status = saveStates[`${exercise.id}:${idx}`];
          return (
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
              <span className="w-4 flex-none text-center text-xs">
                {status === "saving" && <span className="text-faint">·</span>}
                {status === "saved" && <span className="text-accent">✓</span>}
                {status === "error" && (
                  <span className="text-hot" title="Not saved">
                    !
                  </span>
                )}
              </span>
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
          );
        })}
      </div>

      <div className="flex gap-2 px-3.5 pb-3 pt-2">
        <button
          onClick={onAddSet}
          className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-muted"
        >
          + add set
        </button>
        {rows.length > 1 && (
          <button
            onClick={onRemoveSet}
            className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-faint"
          >
            − remove
          </button>
        )}
      </div>
    </div>
  );
}
