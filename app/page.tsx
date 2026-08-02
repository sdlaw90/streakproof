import Link from "next/link";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import UserDrawer from "@/components/UserDrawer";
import { createClient } from "@/lib/supabase/server";
import { hourIn, longDate } from "@/lib/dates";
import { loadFoodSummary, loadPlan, loadSessionsAndSets } from "@/lib/load";
import { computeStats } from "@/lib/stats";
import { greetingFor, suggestDay } from "@/lib/suggest";

export const dynamic = "force-dynamic";

/**
 * Home is a summary, not a workout.
 *
 * It used to render the set logger directly, so opening the app meant being
 * handed a grid of empty inputs before being told anything — the exact
 * "decision at the point of need" the product exists to remove. Home now
 * answers: what day is it, what's today's session, what's the food situation,
 * and how am I doing. The logger lives at /workout.
 */
export default async function Home() {
  const ctx = await loadPlan("gym");
  if (ctx.redirect) redirect(ctx.redirect);

  const { userId, displayName, timezone, today, plan, days, exercises } = ctx;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dayIds = days.map((d) => d.id);
  const { sessions, sets } = await loadSessionsAndSets(userId, dayIds);
  const food = await loadFoodSummary();

  // A session counts as done only if something was actually checked off.
  const doneSessionIds = new Set(
    sets.filter((s) => s.done).map((s) => s.session_id)
  );
  const doneSessions = sessions.filter((s) => doneSessionIds.has(s.id));

  const stats = computeStats(
    doneSessions.map((s) => s.performed_on),
    today
  );

  // Most recent completed date per day, for the rotation suggestion.
  const lastDoneByDayId: Record<string, string | undefined> = {};
  for (const s of doneSessions) {
    const prev = lastDoneByDayId[s.day_id];
    if (!prev || s.performed_on > prev) lastDoneByDayId[s.day_id] = s.performed_on;
  }

  const suggestion = suggestDay(days, lastDoneByDayId, today);
  const suggested = suggestion?.day;
  const suggestedCount = suggested
    ? exercises.filter((e) => e.day_id === suggested.id).length
    : 0;
  const trainedToday = doneSessions.some((s) => s.performed_on === today);

  const greeting = greetingFor(hourIn(timezone));
  // The food side is a rotation too (A/B/C/D), with TWO floor tiers rather than
  // one: the four-minute meal and the grab-and-go shelf. Both carry
  // `is_fallback` — see docs/MEAL-FRAMEWORK.md §7.
  const fallbackBuilds = food.builds.filter((b) => b.is_fallback);
  const regularBuilds = food.builds.filter((b) => !b.is_fallback);

  return (
    <>
      <main className="mx-auto max-w-2xl px-5 pt-5 pb-28">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-faint">{longDate(today)}</p>
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {greeting}, {displayName}
            </h1>
          </div>
          <UserDrawer
            displayName={displayName}
            email={user?.email ?? null}
            timezone={timezone}
            planName={plan?.name ?? null}
          />
        </header>

        {stats.nudge && (
          <p className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
            {stats.nudge}
          </p>
        )}

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-6 mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
          Today&rsquo;s workout
        </h2>

        {suggested ? (
          <div className="rounded-2xl border border-line bg-panel p-5">
            {trainedToday ? (
              <p className="mb-3 inline-block rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
                ✓ Already trained today
              </p>
            ) : (
              <p className="mb-3 inline-block rounded-full bg-panel2 px-2.5 py-1 text-xs font-semibold text-muted">
                {suggestion?.reason === "never-done"
                  ? "Start here"
                  : suggestion?.lastAgoDays === 1
                    ? "Last done yesterday"
                    : `Last done ${suggestion?.lastAgoDays} days ago`}
              </p>
            )}

            <p className="text-lg font-semibold">{suggested.title}</p>
            {suggested.subtitle && (
              <p className="mt-0.5 text-sm text-muted">{suggested.subtitle}</p>
            )}

            <p className="mt-2 text-sm text-faint">
              {suggestedCount} {suggestedCount === 1 ? "exercise" : "exercises"}
              {suggested.est_minutes ? ` · ~${suggested.est_minutes} min` : ""}
            </p>

            <Link
              href={`/workout?day=${encodeURIComponent(suggested.key)}`}
              className="mt-4 block rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-3 text-center font-bold text-bg"
            >
              {trainedToday ? "Open today's session" : "Start this session"}
            </Link>

            <Link
              href="/workout"
              className="mt-2 block text-center text-sm text-accent2"
            >
              Pick a different day
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-panel p-5 text-sm text-muted">
            No days in this plan yet.{" "}
            <Link href="/program" className="text-accent2">
              Add some under Edit
            </Link>
            .
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-6 mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
          Today&rsquo;s food
        </h2>

        {food.plan ? (
          <div className="rounded-2xl border border-line bg-panel p-5">
            <p className="text-lg font-semibold">{food.plan.name}</p>
            {regularBuilds.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {regularBuilds.map((b) => (
                  <li key={b.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-accent">•</span>
                    <span>{b.title}</span>
                    {b.est_minutes && (
                      <span className="text-faint">~{b.est_minutes} min</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {fallbackBuilds.length > 0 && (
              <div className="mt-4 rounded-xl border border-line bg-panel2 px-3 py-2.5">
                <p className="text-xs font-semibold text-gold">
                  Nothing prepped? Still on plan:
                </p>
                <ul className="mt-1.5 space-y-1">
                  {fallbackBuilds.map((b) => (
                    <li key={b.id} className="flex items-baseline gap-2 text-sm">
                      <span className="text-muted">{b.title}</span>
                      {b.est_minutes && (
                        <span className="text-faint">~{b.est_minutes} min</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-xs text-faint">
              Meal logging isn&rsquo;t built yet — this is the plan, not a tracker.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-panel/60 p-5">
            <p className="text-sm text-muted">
              No food plan yet. The gym side works on its own — add food when
              you want it, not because the app is nagging.
            </p>
            <Link
              href="/setup"
              className="mt-3 inline-block text-sm font-semibold text-accent2"
            >
              Browse food plans
            </Link>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        <h2 className="mt-6 mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
          How it&rsquo;s going
        </h2>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="This week" value={stats.thisWeek} />
          <Stat
            label={stats.streakWeeks === 1 ? "Week running" : "Weeks running"}
            value={stats.streakWeeks}
          />
          <Stat label="Sessions" value={stats.total} />
        </div>

        <Link
          href="/progress"
          className="mt-3 block text-center text-sm text-accent2"
        >
          See progress
        </Link>
      </main>

      <BottomNav />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-3 py-4 text-center">
      <div className="text-2xl font-bold text-accent">{value}</div>
      <div className="mt-0.5 text-[11px] text-faint">{label}</div>
    </div>
  );
}
