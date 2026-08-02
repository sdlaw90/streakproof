import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import IntakeForm from "./IntakeForm";

export const dynamic = "force-dynamic";

export default async function BuildPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Build your own</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        About two minutes. Your answers are saved to your account and drive the
        plan — and any later rebuild of it, so you never fill this in twice.
      </p>

      <IntakeForm />

      <Link href="/setup" className="mt-6 block text-center text-sm text-faint">
        Back to the ready-made plans
      </Link>
    </main>
  );
}
