import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chooseFoodTemplate } from "@/app/food/actions";
import FoodIntakeForm from "./FoodIntakeForm";
import { allergenLabels, flagAllergens, type FoodIntake } from "@/lib/food-intake";
import type { FoodItem, Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Food setup: taste and allergies first, plans second.
 *
 * The old version opened on a single template card, which asked the user to
 * accept a rotation of someone else's four flavours before the app had asked
 * them anything. Cuisines decide what the sauces should be, and an allergy has
 * to be known before a plan is offered, not after.
 */
export default async function FoodSetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; edit?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: builder } = await supabase
    .from("builder_profiles")
    .select("data")
    .eq("user_id", user.id)
    .eq("kind", "food")
    .maybeSingle<{ data: FoodIntake }>();

  const intake = builder?.data ?? null;
  const showIntake = !intake?.cuisines?.length || params?.edit === "1";

  if (showIntake) {
    return (
      <main className="mx-auto max-w-md px-5 py-12">
        <h1 className="text-2xl font-bold tracking-tight">Set up food</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          Two questions. Components, not meals — you batch a few things twice a
          week and assemble in five minutes, and the sauce is what keeps it from
          getting boring.
        </p>

        <FoodIntakeForm initial={intake} />

        <Link href="/" className="mt-6 block text-center text-sm text-faint">
          Not now
        </Link>
      </main>
    );
  }

  const { data: templates } = await supabase
    .from("plans")
    .select("*")
    .eq("is_template", true)
    .eq("kind", "food")
    .order("name");

  const list = (templates as Plan[] | null) ?? [];

  // Flag pantry items in each template whose names look like a declared
  // allergen, so a plan's problems are visible before it's chosen.
  const { data: allItems } = await supabase
    .from("food_items")
    .select("id, plan_id, name")
    .in("plan_id", list.length ? list.map((t) => t.id) : ["00000000-0000-0000-0000-000000000000"]);

  const flaggedByPlan = new Map<string, { name: string; allergens: string[] }[]>();
  for (const item of (allItems ?? []) as Pick<FoodItem, "id" | "plan_id" | "name">[]) {
    const hits = flagAllergens(item.name, intake.allergens ?? []);
    if (!hits.length) continue;
    const arr = flaggedByPlan.get(item.plan_id) ?? [];
    arr.push({ name: item.name, allergens: hits });
    flaggedByPlan.set(item.plan_id, arr);
  }

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Pick a starting plan</h1>
      <p className="mb-4 mt-1 text-sm text-muted">
        You get your own copy — swap anything you don&rsquo;t want. Nothing here
        is fixed.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        {(intake.cuisines ?? []).length > 0 && (
          <span className="rounded-full bg-panel2 px-2.5 py-1 text-muted">
            {intake.cuisines.length} cuisine
            {intake.cuisines.length === 1 ? "" : "s"} picked
          </span>
        )}
        {(intake.allergens ?? []).length > 0 && (
          <span className="rounded-full bg-hot/15 px-2.5 py-1 font-semibold text-hot">
            Avoiding {allergenLabels(intake.allergens).join(", ").toLowerCase()}
          </span>
        )}
        <Link href="/setup/food?edit=1" className="text-accent2">
          Change
        </Link>
      </div>

      {params?.error && (
        <p className="mb-4 rounded-xl border border-hot/40 bg-hot/10 px-3 py-2 text-sm text-hot">
          {params.error}
        </p>
      )}

      <div className="space-y-3">
        {list.map((t) => {
          const flagged = flaggedByPlan.get(t.id) ?? [];
          return (
            <form key={t.id} action={chooseFoodTemplate}>
              <input type="hidden" name="template_id" value={t.id} />
              <button
                type="submit"
                className="w-full rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-accent"
              >
                <div className="font-semibold">{t.name}</div>
                {t.description && (
                  <div className="mt-1 text-sm text-muted">{t.description}</div>
                )}

                {flagged.length > 0 && (
                  <div className="mt-3 rounded-xl border border-hot/40 bg-hot/10 px-3 py-2">
                    <p className="text-xs font-bold text-hot">
                      {flagged.length} ingredient{flagged.length === 1 ? "" : "s"} to
                      check
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {flagged.map((f) => f.name).join(", ")}
                    </p>
                    <p className="mt-1 text-xs text-faint">
                      Swap or delete them in the editor after you start.
                    </p>
                  </div>
                )}

                <div className="mt-2 text-xs text-faint">Tap to start from this</div>
              </button>
            </form>
          );
        })}

        {!list.length && (
          <p className="rounded-xl border border-line bg-panel p-5 text-center text-sm text-muted">
            No food templates found. Run <code>npm run db:push</code> against your
            Supabase project.
          </p>
        )}
      </div>

      {(intake.allergens ?? []).length > 0 && (
        <p className="mt-6 rounded-2xl border border-hot/40 bg-hot/10 px-4 py-3 text-xs text-hot">
          <span className="font-bold">Check these yourself.</span> Flags come from
          matching words in an ingredient&rsquo;s name. They can&rsquo;t read a
          label, they will miss things, and they are not a safety check.
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-line bg-panel2 p-4 text-sm text-muted">
        <p className="font-semibold text-ink">No numbers by default.</p>
        <p className="mt-1">
          Protein and veg get added first, then you eat what you want. Calorie
          tracking is an option you can turn on later, not the point.
        </p>
      </div>

      <Link href="/" className="mt-6 block text-center text-sm text-faint">
        Not now
      </Link>
    </main>
  );
}
