import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Only ever import this from a server action or route handler, and only for the
 * two things that genuinely cannot be done as the user: setting a password for
 * someone who is signed out, and writing to tables with no client-facing
 * policy. If you find yourself reaching for it to make a query easier, that's
 * a policy problem, not a reason to escalate.
 *
 * SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_ prefix on purpose — that prefix
 * is what would put it in the client bundle.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — password recovery can't work without it."
    );
  }

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
