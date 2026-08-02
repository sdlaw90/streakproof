"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MIN_PASSWORD,
  SECURITY_QUESTION_COUNT,
  validateRecovery,
} from "@/lib/validate";

export type RecoveryResult = { ok: boolean; error?: string };

/** Save the hint and/or the three answers. Called by the signed-in opt-in screen. */
export async function saveRecovery(
  _prev: unknown,
  formData: FormData
): Promise<RecoveryResult> {
  const hint = String(formData.get("hint") || "").trim();

  const questions: { question: string; answer: string }[] = [];
  for (let i = 1; i <= SECURITY_QUESTION_COUNT; i++) {
    questions.push({
      question: String(formData.get(`question_${i}`) || "").trim(),
      answer: String(formData.get(`answer_${i}`) || "").trim(),
    });
  }

  const problem = validateRecovery({ hint, questions });
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (hint) {
    const { error } = await supabase
      .from("profiles")
      .update({ password_hint: hint })
      .eq("id", user.id);
    if (error) return { ok: false, error: error.message };
  }

  const answered = questions.filter((q) => q.question && q.answer);
  if (answered.length === SECURITY_QUESTION_COUNT) {
    // Hashing happens in Postgres (pgcrypto), so a plaintext answer never
    // reaches a table and never sits in a JS variable longer than this call.
    const { error } = await supabase.rpc("set_security_answers", {
      p_questions: answered.map((q) => q.question),
      p_answers: answered.map((q) => q.answer),
    });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** The questions to ask someone who's locked out. Empty means "we can't help". */
export async function lookupRecoveryQuestions(
  email: string
): Promise<{ position: number; question: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("recovery_questions_for", {
    p_email: email,
  });
  return (data ?? []) as { position: number; question: string }[];
}

export type ResetResult = { ok: boolean; error?: string; hint?: string | null };

/**
 * Verify the answers and set a new password.
 *
 * The verification, the rate limit and the attempt log all live in
 * `verify_recovery_answers` in Postgres, so none of them can be skipped by
 * calling this differently. This function's only privilege is the last step:
 * setting a password for a user who is, by definition, not signed in.
 */
export async function resetWithAnswers(
  _prev: unknown,
  formData: FormData
): Promise<ResetResult> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm_password") || "");

  const answers: string[] = [];
  for (let i = 1; i <= SECURITY_QUESTION_COUNT; i++) {
    answers.push(String(formData.get(`answer_${i}`) || "").trim());
  }

  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  if (password !== confirm) {
    return { ok: false, error: "The two passwords don't match." };
  }
  if (answers.some((a) => a.length < 2)) {
    return { ok: false, error: "Answer all three questions." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_recovery_answers", {
    p_email: email,
    p_answers: answers,
  });

  if (error) {
    // The rate limiter raises rather than returning, so this is the path a
    // locked-out attacker hits. Surface it verbatim; it's not sensitive.
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as { user_id: string; hint: string | null }[];
  if (!rows.length) {
    // Deliberately identical for "wrong answers", "no questions set up" and
    // "no such account". Distinguishing them would turn this into an
    // account-existence oracle.
    return { ok: false, error: "Those answers don't match. Check and try again." };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(
    rows[0].user_id,
    { password }
  );
  if (updateError) return { ok: false, error: updateError.message };

  redirect("/login?reset=1");
}

/** Skip the opt-in. Exists so the button is a real form submit, not a link. */
export async function skipRecovery() {
  redirect("/");
}
