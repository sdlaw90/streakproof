"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GYM_INTAKE, INTAKE_VERSION, missingAnswers, type IntakeAnswers } from "@/lib/intake";

export type IntakeResult = { ok: boolean; error?: string };

/**
 * Save the intake to builder_profiles.
 *
 * This does not build a plan yet — the generator doesn't exist. Storing the
 * intake anyway is the point of the table: the same answers will drive
 * generation, regeneration and the review flow, and throwing them away would
 * mean asking twice.
 */
export async function saveIntake(
  _prev: unknown,
  formData: FormData
): Promise<IntakeResult> {
  const answers: IntakeAnswers = {};

  for (const q of GYM_INTAKE) {
    if (q.kind === "multi") {
      answers[q.id] = formData.getAll(q.id).map(String).filter(Boolean);
    } else {
      answers[q.id] = String(formData.get(q.id) || "").trim();
    }
  }

  const missing = missingAnswers(GYM_INTAKE, answers);
  if (missing.length) {
    return { ok: false, error: `Still needs an answer: ${missing.length} question${missing.length === 1 ? "" : "s"}.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("builder_profiles").upsert(
    {
      user_id: user.id,
      kind: "gym",
      data: { version: INTAKE_VERSION, answers },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kind" }
  );

  if (error) return { ok: false, error: error.message };

  redirect("/build/done");
}
