"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteMeal, logMeal } from "@/app/food/actions";
import type { Build, BuildItem, FoodItem } from "@/lib/types";
import type { MealLog } from "@/lib/food";

export type BuildView = {
  build: Build;
  components: { name: string; role: string; note: string | null }[];
  lastAgoDays: number | null;
};

const ROLE_ORDER = ["base", "protein", "veg", "sauce", "extra"];

function Card({
  view,
  suggested,
  onLog,
  busy,
}: {
  view: BuildView;
  suggested?: boolean;
  onLog: () => void;
  busy: boolean;
}) {
  const { build } = view;
  return (
    <div
      className={
        "rounded-2xl border p-4 " +
        (suggested ? "border-accent/50 bg-panel" : "border-line bg-panel")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {suggested && (
            <span className="mb-1.5 inline-block rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
              {view.lastAgoDays == null
                ? "Not tried yet"
                : `Last had it ${view.lastAgoDays} ${view.lastAgoDays === 1 ? "day" : "days"} ago`}
            </span>
          )}
          <p className="font-semibold">{build.title}</p>
          {build.subtitle && (
            <p className="mt-0.5 text-sm text-muted">{build.subtitle}</p>
          )}
        </div>
        {build.est_minutes != null && (
          <span className="shrink-0 rounded-lg bg-panel2 px-2 py-1 text-xs text-faint">
            ~{build.est_minutes} min
          </span>
        )}
      </div>

      {view.components.length > 0 && (
        <p className="mt-2 text-sm text-faint">
          {view.components.map((c) => c.name).join(" · ")}
        </p>
      )}

      <button
        onClick={onLog}
        disabled={busy}
        className={
          "mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60 " +
          (suggested
            ? "bg-linear-to-r from-accent2 to-accent text-bg"
            : "border border-line text-accent2")
        }
      >
        {busy ? "…" : "I ate this"}
      </button>
    </div>
  );
}

export default function FoodToday({
  suggestedId,
  rotation,
  fallbacks,
  todaysMeals,
  prepNote,
}: {
  suggestedId: string | null;
  rotation: BuildView[];
  fallbacks: BuildView[];
  todaysMeals: (MealLog & { title: string })[];
  prepNote: { href: string; label: string; tone: "due" | "quiet" } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, id: string) => {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setBusyId(null);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  };

  const suggested = rotation.find((v) => v.build.id === suggestedId);
  const rest = rotation.filter((v) => v.build.id !== suggestedId);

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
          {error}
        </p>
      )}

      {prepNote && (
        <Link
          href={prepNote.href}
          className={
            "block rounded-2xl border px-4 py-3 text-sm font-semibold " +
            (prepNote.tone === "due"
              ? "border-gold/40 bg-gold/10 text-gold"
              : "border-line bg-panel text-muted")
          }
        >
          {prepNote.label} →
        </Link>
      )}

      {todaysMeals.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
            Eaten today
          </h2>
          <ul className="space-y-2">
            {todaysMeals.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5"
              >
                <span className="text-accent">✓</span>
                <span className="flex-1 text-sm">{m.title}</span>
                <button
                  onClick={() => run(() => deleteMeal(m.id), m.id)}
                  disabled={pending}
                  className="text-xs text-faint transition hover:text-hot"
                >
                  undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {suggested && (
        <section>
          <h2 className="mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
            Make this
          </h2>
          <Card
            view={suggested}
            suggested
            busy={busyId === suggested.build.id}
            onLog={() =>
              run(() => logMeal({ buildId: suggested.build.id }), suggested.build.id)
            }
          />
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
            Or one of these
          </h2>
          <div className="space-y-3">
            {rest.map((v) => (
              <Card
                key={v.build.id}
                view={v}
                busy={busyId === v.build.id}
                onLog={() => run(() => logMeal({ buildId: v.build.id }), v.build.id)}
              />
            ))}
          </div>
        </section>
      )}

      {fallbacks.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-bold tracking-wider text-gold uppercase">
            Nothing prepped
          </h2>
          <p className="mb-3 text-sm text-muted">
            These count. They&rsquo;re part of the plan, not a failure of it.
          </p>
          <div className="space-y-3">
            {fallbacks.map((v) => (
              <Card
                key={v.build.id}
                view={v}
                busy={busyId === v.build.id}
                onLog={() => run(() => logMeal({ buildId: v.build.id }), v.build.id)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
          Ate something else
        </h2>
        <p className="mb-3 text-sm text-muted">
          Log it by name. Nothing here is a cheat — knowing what you actually eat
          is the whole point.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Breakfast burritos, pho, Bolay…"
            className="w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-ink placeholder:text-faint"
          />
          <button
            onClick={() => {
              const name = freeText.trim();
              if (!name) return;
              run(async () => {
                const res = await logMeal({ name });
                if (res.ok) setFreeText("");
                return res;
              }, "free");
            }}
            disabled={pending || !freeText.trim()}
            className="shrink-0 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-accent2 disabled:opacity-40"
          >
            {busyId === "free" ? "…" : "Log"}
          </button>
        </div>
      </section>
    </div>
  );
}

/** Order a build's components the way you'd actually assemble the bowl. */
export function orderComponents(
  items: BuildItem[],
  byId: Map<string, FoodItem>
): { name: string; role: string; note: string | null }[] {
  return items
    .map((bi) => {
      const item = byId.get(bi.food_item_id);
      return item
        ? { name: item.name, role: item.role as string, note: bi.note }
        : null;
    })
    .filter((x): x is { name: string; role: string; note: string | null } => !!x)
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
}
