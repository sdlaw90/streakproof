import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chooseProgram } from "./actions";
import type { Program } from "@/lib/types";

export default async function SetupPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: programs } = await supabase
    .from("programs")
    .select("*")
    .order("name");

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Pick your program</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Choose the plan that's yours. You can only change this from here for now.
      </p>

      <div className="space-y-3">
        {(programs as Program[] | null)?.map((p) => (
          <form key={p.id} action={chooseProgram}>
            <input type="hidden" name="program_id" value={p.id} />
            <button
              type="submit"
              className="w-full rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-accent"
            >
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-faint">Tap to select</div>
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
