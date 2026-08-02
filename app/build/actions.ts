"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  GYM_INTAKE,
  INTAKE_VERSION,
  missingAnswers,
  validateWeights,
  type ImageAnswer,
  type IntakeAnswers,
  type WeightAnswer,
} from "@/lib/intake";

/** Parse a JSON blob from a hidden field without trusting a word of it. */
function parseJsonField<T>(raw: FormDataEntryValue | null): T | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
}

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
    } else if (q.kind === "weights" || q.kind === "image") {
      continue; // objects, handled below
    } else {
      answers[q.id] = String(formData.get(q.id) || "").trim();
    }
  }

  const weights = parseJsonField<WeightAnswer>(formData.get("weights_json"));
  if (weights) {
    const problem = validateWeights(weights);
    if (problem) return { ok: false, error: problem };
    // Only keep it if something was actually filled in — a bare unit is noise.
    if (weights.current != null || weights.goal != null) {
      answers.weights = {
        current: weights.current,
        goal: weights.goal,
        unit: weights.unit === "kg" ? "kg" : "lb",
      };
    }
  }

  const image = parseJsonField<ImageAnswer>(formData.get("image_json"));
  if (image?.path) {
    const {
      data: { user: imageUser },
    } = await (await createClient()).auth.getUser();
    // The path is client-supplied, so re-check it points inside this user's own
    // folder. Storage RLS would refuse the write anyway; this stops a bogus path
    // being recorded against the intake in the first place.
    if (imageUser && image.path.startsWith(`${imageUser.id}/`)) {
      answers.inspo_image = {
        path: image.path,
        filename: String(image.filename ?? "").slice(0, 200),
      };
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
