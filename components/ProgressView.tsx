"use client";

import { useState } from "react";
import type { Stats } from "@/lib/stats";

type Point = { date: string; weight: number };
type ExerciseOption = { id: string; name: string };

function shortDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

function LineChart({ points }: { points: Point[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-line bg-panel2 text-sm text-faint">
        Log some weights for this exercise to see a trend.
      </div>
    );
  }

  const W = 340;
  const H = 170;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 26;

  const weights = points.map((p) => p.weight);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (min === max) {
    min = Math.max(0, min - 5);
    max = max + 5;
  }
  const n = points.length;

  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (w: number) => padT + (1 - (w - min) / (max - min)) * (H - padT - padB);

  const line = points.map((p, i) => `${x(i)},${y(p.weight)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="weight over time">
      {/* horizontal grid + y labels */}
      {[max, (max + min) / 2, min].map((val, i) => {
        const yy = padT + (i / 2) * (H - padT - padB);
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#2a323f" strokeWidth={1} />
            <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="#6b7889">
              {Math.round(val)}
            </text>
          </g>
        );
      })}

      {/* area under line */}
      <polyline
        points={`${padL},${H - padB} ${line} ${W - padR},${H - padB}`}
        fill="#4fd08a"
        opacity={0.08}
      />
      {/* line */}
      <polyline points={line} fill="none" stroke="#4fd08a" strokeWidth={2.5}
        strokeLinejoin="round" strokeLinecap="round" />
      {/* dots */}
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.weight)} r={3} fill="#4fd08a" />
      ))}

      {/* x labels: first + last */}
      <text x={padL} y={H - 8} textAnchor="start" fontSize="9" fill="#6b7889">
        {shortDate(points[0].date)}
      </text>
      {n > 1 && (
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize="9" fill="#6b7889">
          {shortDate(points[n - 1].date)}
        </text>
      )}
    </svg>
  );
}

export default function ProgressView({
  stats,
  exercises,
  seriesByExercise,
  bests,
}: {
  stats: Stats;
  exercises: ExerciseOption[];
  seriesByExercise: Record<string, Point[]>;
  bests: { name: string; weight: number }[];
}) {
  const [selected, setSelected] = useState(exercises[0]?.id ?? "");
  const points = seriesByExercise[selected] ?? [];

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <BigStat label="Week streak" value={`${stats.streakWeeks}`} suffix="weeks" hot={stats.streakWeeks >= 2} />
        <BigStat label="This week" value={`${stats.thisWeek}`} suffix="workouts" />
        <BigStat label="All-time" value={`${stats.total}`} suffix="workouts" />
        <BigStat
          label="Last workout"
          value={stats.lastAgoDays == null ? "—" : stats.lastAgoDays === 0 ? "today" : `${stats.lastAgoDays}d`}
          suffix={stats.lastAgoDays == null ? "" : "ago"}
        />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-line bg-panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Weight over time</h2>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="max-w-[60%] truncate rounded-lg border border-line bg-panel2 px-2 py-1.5 text-sm text-ink"
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
        <LineChart points={points} />
        <p className="mt-1 text-center text-[11px] text-faint">
          Top set each session
        </p>
      </div>

      {/* PR board */}
      <div className="rounded-2xl border border-line bg-panel p-4">
        <h2 className="mb-3 text-sm font-semibold">🏆 Personal records</h2>
        {bests.length === 0 ? (
          <p className="text-sm text-faint">No weights logged yet.</p>
        ) : (
          <div className="divide-y divide-line/60">
            {bests.map((b) => (
              <div key={b.name} className="flex items-center justify-between py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted">{b.name}</span>
                <span className="flex-none font-semibold text-gold">{b.weight} lb</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  suffix,
  hot,
}: {
  label: string;
  value: string;
  suffix?: string;
  hot?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={"text-2xl font-bold " + (hot ? "text-gold" : "text-ink")}>
          {value}
        </span>
        {suffix && <span className="text-xs text-faint">{suffix}</span>}
      </div>
    </div>
  );
}
