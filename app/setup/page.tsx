import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chooseTemplate } from "./actions";
import type { Plan } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
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

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Pick a starting plan</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        You get your own copy — edit it however you like. Nothing here is shared
        with anyone else.
      </p>

      {searchParams?.error && (
        <p className="mb-4 rounded-xl border border-hot/40 bg-hot/10 px-3 py-2 text-sm text-hot">
          {searchParams.error}
        </p>
      )}

      <div className="space-y-3">
        {(templates as Plan[] | null)?.map((t) => (
          <form key={t.id} action={chooseTemplate}>
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

        {!templates?.length && (
          <p className="rounded-xl border border-line bg-panel p-5 text-center text-sm text-muted">
            No templates found. Run <code>supabase/v2/04_seed.sql</code> in the
            Supabase SQL editor.
          </p>
        )}
      </div>
    </main>
  );
}
