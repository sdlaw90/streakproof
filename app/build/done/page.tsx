import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Where the intake lands until the generator exists.
 *
 * Deliberately honest rather than a fake progress bar: the answers are stored,
 * nothing is being generated yet, and the useful next move is to start from a
 * template. Pretending otherwise would leave someone waiting for a plan that
 * isn't coming.
 */
export default async function BuildDonePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_gym_plan_id")
    .eq("id", user.id)
    .single<{ active_gym_plan_id: string | null }>();

  const hasPlan = !!profile?.active_gym_plan_id;

  return (
    <main className="mx-auto max-w-md px-5 py-12 text-center">
      <div className="text-5xl">✅</div>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Answers saved</h1>

      <p className="mt-3 text-sm text-muted">
        The plan generator isn&rsquo;t built yet — this is the honest version of
        that. Your answers are stored against your account, so when it lands
        you&rsquo;ll get a plan without filling anything in again.
      </p>

      <p className="mt-3 text-sm text-muted">
        In the meantime, start from one of the ready-made plans. You own your
        copy and can edit every day and exercise in it, which is most of the way
        to custom anyway.
      </p>

      <Link
        href="/setup"
        className="mt-6 block rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-3 font-bold text-bg"
      >
        Pick a starting plan
      </Link>

      {hasPlan && (
        <Link href="/" className="mt-3 block text-sm text-accent2">
          Back to home
        </Link>
      )}

      <Link href="/build" className="mt-3 block text-sm text-faint">
        Change my answers
      </Link>
    </main>
  );
}
