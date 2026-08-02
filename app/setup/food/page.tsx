import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chooseFoodTemplate } from "@/app/food/actions";
import type { Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FoodSetupPage({
  searchParams,
}: {
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
    .eq("kind", "food")
    .order("name");

  const list = (templates as Plan[] | null) ?? [];

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Add a food plan</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Components, not meals. Batch a few things twice a week and assemble in
        five minutes — the sauce carries the variety, so nothing gets boring by
        Wednesday.
      </p>

      {params?.error && (
        <p className="mb-4 rounded-xl border border-hot/40 bg-hot/10 px-3 py-2 text-sm text-hot">
          {params.error}
        </p>
      )}

      <div className="space-y-3">
        {list.map((t) => (
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
              <div className="mt-2 text-xs text-faint">Tap to start from this</div>
            </button>
          </form>
        ))}

        {!list.length && (
          <p className="rounded-xl border border-line bg-panel p-5 text-center text-sm text-muted">
            No food templates found. Run <code>npm run db:push</code> against your
            Supabase project.
          </p>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-panel2 p-4 text-sm text-muted">
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
