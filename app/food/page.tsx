import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import FoodToday, { orderComponents, type BuildView } from "@/components/FoodToday";
import { loadFood } from "@/lib/food";
import { longDate } from "@/lib/dates";
import { prepDueOn, suggestBuild } from "@/lib/suggest";
import { daysBetween } from "@/lib/stats";
import type { BuildItem, FoodItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FoodPage() {
  const ctx = await loadFood();
  if (ctx.redirect) redirect(ctx.redirect);

  const {
    today,
    plan,
    items,
    builds,
    buildItems,
    prepSessions,
    prepTasks,
    meals,
    prepLogs,
  } = ctx;

  const itemsById = new Map<string, FoodItem>(items.map((i) => [i.id, i]));
  const itemsByBuild = new Map<string, BuildItem[]>();
  for (const bi of buildItems) {
    const arr = itemsByBuild.get(bi.build_id) ?? [];
    arr.push(bi);
    itemsByBuild.set(bi.build_id, arr);
  }

  // Most recent date each build was eaten, for the rotation suggestion.
  const lastEaten: Record<string, string | undefined> = {};
  for (const m of meals) {
    if (!m.build_id) continue;
    const prev = lastEaten[m.build_id];
    if (!prev || m.eaten_on > prev) lastEaten[m.build_id] = m.eaten_on;
  }

  const toView = (b: (typeof builds)[number]): BuildView => ({
    build: b,
    components: orderComponents(itemsByBuild.get(b.id) ?? [], itemsById),
    lastAgoDays: lastEaten[b.id] ? daysBetween(lastEaten[b.id]!, today) : null,
  });

  const suggestion = suggestBuild(builds, lastEaten, today);
  const rotation = builds.filter((b) => !b.is_fallback).map(toView);
  const fallbacks = builds.filter((b) => b.is_fallback).map(toView);

  const buildTitles = new Map(builds.map((b) => [b.id, b.title]));
  const todaysMeals = meals
    .filter((m) => m.eaten_on === today)
    .map((m) => ({
      ...m,
      title: m.build_id ? (buildTitles.get(m.build_id) ?? "A meal") : (m.name ?? "A meal"),
    }));

  // The most urgent prep session decides what the banner says.
  const lastPrepBySession: Record<string, string | undefined> = {};
  for (const log of prepLogs) {
    const prev = lastPrepBySession[log.prep_session_id];
    if (!prev || log.performed_on > prev) {
      lastPrepBySession[log.prep_session_id] = log.performed_on;
    }
  }

  let prepNote: { href: string; label: string; tone: "due" | "quiet" } | null = null;
  for (const s of prepSessions) {
    const state = prepDueOn(s.weekday, today, lastPrepBySession[s.id]);
    const count = prepTasks.filter((t) => t.prep_session_id === s.id).length;
    if (state === "today" || state === "overdue") {
      prepNote = {
        href: `/food/prep?session=${s.key}`,
        label:
          state === "today"
            ? `${s.title} — ${count} things, ~${s.est_minutes ?? "?"} min`
            : `${s.title} is overdue — 20 minutes at the shop also counts`,
        tone: "due",
      };
      break;
    }
  }
  if (!prepNote && prepSessions.length) {
    prepNote = { href: "/food/prep", label: "Prep sessions", tone: "quiet" };
  }

  return (
    <>
      <main className="mx-auto max-w-2xl px-5 pt-5 pb-28">
        <header className="mb-5">
          <p className="text-sm text-faint">{longDate(today)}</p>
          <h1 className="text-2xl font-bold tracking-tight">Food</h1>
          <p className="mt-0.5 text-sm text-muted">{plan.name}</p>
        </header>

        <FoodToday
          suggestedId={suggestion?.buildId ?? null}
          rotation={rotation}
          fallbacks={fallbacks}
          todaysMeals={todaysMeals}
          prepNote={prepNote}
        />
      </main>

      <BottomNav />
    </>
  );
}
