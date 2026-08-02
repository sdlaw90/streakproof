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

export type VerifyResult = {
  ok: boolean;
  error?: string;
  /** Shown before the password form — it may be all they needed. */
  hint?: string | null;
  /** Single-use, ten minutes. Proves step one was passed. */
  token?: string;
};

/**
 * Step one: check the answers.
 *
 * The verification, the rate limit, the attempt log and the token minting all
 * live in `verify_recovery_answers` in Postgres, so none of them can be skipped
 * by calling this differently.
 */
export async function verifyAnswers(
  _prev: unknown,
  formData: FormData
): Promise<VerifyResult> {
  const email = String(formData.get("email") || "").trim();

  const answers: string[] = [];
  for (let i = 1; i <= SECURITY_QUESTION_COUNT; i++) {
    answers.push(String(formData.get(`answer_${i}`) || "").trim());
  }
  // Two of three must be answered; a blank third is allowed and counts as
  // wrong. Postgres enforces the same rule — this is the fast rejection.
  if (answers.filter((a) => a.length >= 2).length < 2) {
    return { ok: false, error: "Answer at least two of the three questions." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_recovery_answers", {
    p_email: email,
    p_answers: answers,
  });

  if (error) {
    // The rate limiter raises rather than returning, so this is the path a
    // locked-out attacker hits. Not sensitive; surface it verbatim.
    return { ok: false, error: error.message };
  }

  const rows = (data ?? []) as { user_id: string; hint: string | null; token: string }[];
  if (!rows.length) {
    // Deliberately identical for "wrong answers", "no questions set up" and
    // "no such account" — distinguishing them would make this an
    // account-existence oracle.
    return { ok: false, error: "Those answers don't match. Check and try again." };
  }

  return { ok: true, hint: rows[0].hint, token: rows[0].token };
}

export type ResetResult = { ok: boolean; error?: string };

/**
 * Step two: set the password.
 *
 * The token is the only thing authorising this, and Postgres burns it as it
 * hands back the user id, so a replay gets null. This function's one privilege
 * is the last step — setting a password for a user who is, by definition, not
 * signed in.
 */
export async function resetWithToken(
  _prev: unknown,
  formData: FormData
): Promise<ResetResult> {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm_password") || "");

  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  if (password !== confirm) {
    return { ok: false, error: "The two passwords don't match." };
  }
  if (!token) {
    return { ok: false, error: "That reset has expired. Start again." };
  }

  const supabase = await createClient();
  const { data: userId, error } = await supabase.rpc("redeem_recovery_token", {
    p_token: token,
  });

  if (error) return { ok: false, error: error.message };
  if (!userId) {
    return {
      ok: false,
      error: "That reset link has expired or already been used. Start again.",
    };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(
    String(userId),
    { password }
  );
  if (updateError) return { ok: false, error: updateError.message };

  redirect("/login?reset=1");
}
