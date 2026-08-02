import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chooseTemplate } from "./actions";
import type { Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Template picker.
 *
 * The order is imposed here rather than by name: broadest and least demanding
 * first. A six-day hypertrophy split is a bad default for someone who hasn't
 * trained in a year, and the first card is the one people pick.
 */
const ORDER = [
  "full-body-pool",
  "fat-loss-full-body",
  "bodyweight-anywhere",
  "upper-lower-no-barbell",
  "push-pull-legs-muscle",
];

/** One-line "who is this for", which the description alone doesn't convey. */
const FOR: Record<string, string> = {
  "full-body-pool": "Balanced · full gym",
  "fat-loss-full-body": "Lose weight · 3 days",
  "bodyweight-anywhere": "No equipment · anywhere",
  "upper-lower-no-barbell": "No barbells · 4 days",
  "push-pull-legs-muscle": "Build muscle · full gym",
};

export default async function SetupPage({
  searchParams,
}: {
  // Async since Next 15.
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: templates } = await supabase
    .from("plans")
    .select("*")
    .eq("is_template", true)
    .eq("kind", "gym")
    .order("name");

  const list = (templates as Plan[] | null) ?? [];
  const sorted = [...list].sort((a, b) => {
    const ai = ORDER.indexOf(a.slug ?? "");
    const bi = ORDER.indexOf(b.slug ?? "");
    // Anything not in ORDER sorts last rather than first.
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Pick a starting plan</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        You get your own copy — edit it however you like. Nothing here is shared
        with anyone else, and you can switch later.
      </p>

      {params?.error && (
        <p className="mb-4 rounded-xl border border-hot/40 bg-hot/10 px-3 py-2 text-sm text-hot">
          {params.error}
        </p>
      )}

      <div className="space-y-3">
        {sorted.map((t) => (
          <form key={t.id} action={chooseTemplate}>
            <input type="hidden" name="template_id" value={t.id} />
            <button
              type="submit"
              className="w-full rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-accent"
            >
              {t.slug && FOR[t.slug] && (
                <div className="mb-1.5 inline-block rounded-full bg-panel2 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                  {FOR[t.slug]}
                </div>
              )}
              <div className="font-semibold">{t.name}</div>
              {t.description && (
                <div className="mt-1 text-sm text-muted">{t.description}</div>
              )}
              <div className="mt-2 text-xs text-faint">Tap to start from this</div>
            </button>
          </form>
        ))}

        {!sorted.length && (
          <p className="rounded-xl border border-line bg-panel p-5 text-center text-sm text-muted">
            No templates found. Run <code>npm run db:push</code> against your
            Supabase project.
          </p>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-accent2/50 bg-accent2/5 p-5 text-center">
        <p className="font-semibold">
          Would you rather custom build your workout routine?
        </p>
        <p className="mt-1 text-sm text-muted">
          Answer a dozen questions about your gym, your week and your body, and
          the plan gets built around them.
        </p>
        <Link
          href="/build"
          className="mt-4 block rounded-xl border border-accent2 px-4 py-3 font-semibold text-accent2"
        >
          Build my own instead
        </Link>
      </div>
    </main>
  );
}
