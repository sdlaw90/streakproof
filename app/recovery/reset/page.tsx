import Link from "next/link";
import ResetForm from "./ResetForm";

export const dynamic = "force-dynamic";

/**
 * Signed-out password reset via security questions.
 *
 * Interim, and meant to be deleted: once transactional email exists this whole
 * route and the tables behind it should go, replaced by Supabase's own reset
 * link. See docs/decisions/0012.
 */
export default function ResetPage() {
  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Answer the security questions you set up and you can choose a new
        password.
      </p>

      <ResetForm />

      <Link href="/login" className="mt-4 block text-center text-sm text-faint">
        Back to sign in
      </Link>
    </main>
  );
}
