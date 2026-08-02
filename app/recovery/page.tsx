import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RecoveryForm from "./RecoveryForm";

export const dynamic = "force-dynamic";

/**
 * The recovery opt-in, shown once straight after signup and reachable later
 * from the account drawer.
 *
 * Skippable on purpose. Forcing this at signup is the kind of friction that
 * loses people at the exact moment they've decided to try the thing — and an
 * empty recovery is no worse than the status quo.
 */
export default async function RecoveryPage({
  searchParams,
}: {
  searchParams?: Promise<{ new?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const isNew = params?.new === "1";

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">
        {isNew ? "One last thing" : "Account recovery"}
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        There&rsquo;s no password reset email yet, so this is how you get back in
        if you forget. Both parts are optional — you can skip and set them up
        later from the account menu.
      </p>

      <RecoveryForm isNew={isNew} />
    </main>
  );
}
