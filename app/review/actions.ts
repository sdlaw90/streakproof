"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/review";

export type ReviewResult = { ok: boolean; error?: string };

/**
 * Record a due review, if it isn't already open.
 *
 * The unique partial index `plan_reviews_open_idx` guarantees at most one
 * pending row per (plan, reason), so nagging can't stack up. A conflict here is
 * the normal case, not an error — it means we already asked.
 */
export async function recordReviews(
  planId: string,
  reviews: Review[],
  dueOn: string
): Promise<ReviewResult> {
  if (!reviews.length) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("plan_reviews").upsert(
    reviews.map((r) => ({
      plan_id: planId,
      user_id: user.id,
      reason: r.reason,
      detail: { ...r.detail, message: r.message },
      due_on: dueOn,
      status: "pending",
    })),
    { onConflict: "plan_id,reason", ignoreDuplicates: true }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Dismiss a review.
 *
 * Dismissal is permanent for that (plan, reason) until something resolves it —
 * the partial index only covers `pending` rows, so a dismissed review frees the
 * slot and the same check can fire again later if it's still true. That's
 * deliberate: dismissing "you've stalled" shouldn't silence it forever, but it
 * should stop it appearing every time you open the app this week.
 */
export async function dismissReview(id: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("plan_reviews")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/review");
  return { ok: true };
}

/**
 * Mark a review as acted on and reset the plan's review clock.
 *
 * `last_reviewed_on` is what stops the time check firing again immediately —
 * without it, "I've looked at it, it's fine" would re-prompt tomorrow.
 */
export async function actOnReview(
  id: string,
  planId: string,
  today: string
): Promise<ReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("plan_reviews")
    .update({ status: "acted", resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  const { error: planError } = await supabase
    .from("plans")
    .update({ last_reviewed_on: today })
    .eq("id", planId);

  if (planError) return { ok: false, error: planError.message };

  revalidatePath("/");
  revalidatePath("/review");
  return { ok: true };
}
