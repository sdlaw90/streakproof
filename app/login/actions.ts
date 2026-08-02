"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
// One rule set, checked in the browser and again here, so the two can't drift.
import { validateSignup } from "@/lib/validate";

export type AuthResult = { error: string } | null;

export async function login(_prev: unknown, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Validation lives here, not only in the browser.
 *
 * The client-side checks in the form exist to fail fast and warn before submit;
 * these are the ones that actually hold, because a server action is a public
 * endpoint and nothing stops a caller skipping the form entirely.
 */
export async function signup(_prev: unknown, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm_password") || "");
  const displayName = String(formData.get("display_name") || "").trim();

  const problem = validateSignup({ displayName, password, confirm });
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

  if (error) return { error: error.message };

  // If email confirmation is OFF (recommended for this app), a session comes
  // back immediately and we can go straight to the recovery opt-in.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/recovery?new=1");
  }

  return {
    error:
      "Account created. Check your email to confirm, then sign in. " +
      "(Tip: disable 'Confirm email' in Supabase → Authentication → Sign In / Providers to skip this.)",
  };
}
