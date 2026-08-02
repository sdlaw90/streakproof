"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeLogDate, todayIn } from "@/lib/dates";

export type FoodResult = { ok: boolean; error?: string };

/** The signed-in user plus their local today. */
async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, active_food_plan_id")
    .eq("id", user.id)
    .single<{ timezone: string | null; active_food_plan_id: string | null }>();

  const timezone = profile?.timezone || "UTC";
  return {
    supabase,
    userId: user.id,
    planId: profile?.active_food_plan_id ?? null,
    today: todayIn(timezone),
  };
}

/**
 * Log a meal.
 *
 * `name` without a build is deliberate and first-class: the noon breakfast
 * burritos are not a failure to be hidden from, they're data about what
 * actually gets eaten (docs/MEAL-FRAMEWORK.md §5). The schema's check
 * constraint requires one or the other, never neither.
 */
export async function logMeal(input: {
  buildId?: string;
  name?: string;
  eatenOn?: string;
}): Promise<FoodResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const name = input.name?.trim();
  if (!input.buildId && !name) {
    return { ok: false, error: "Nothing to log." };
  }

  const eatenOn = sanitizeLogDate(input.eatenOn, ctx.today);

  const { error } = await ctx.supabase.from("meal_logs").insert({
    user_id: ctx.userId,
    plan_id: ctx.planId,
    build_id: input.buildId ?? null,
    name: input.buildId ? null : name,
    eaten_on: eatenOn,
    eaten_at: new Date().toISOString(),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/food");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteMeal(id: string): Promise<FoodResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const { error } = await ctx.supabase
    .from("meal_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", ctx.userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/food");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Tick or untick one prep task.
 *
 * Stored as an array on a single row per (user, session, date) rather than a
 * row per task, because the interesting unit is "did Sunday's prep happen",
 * and a half-finished session is normal rather than exceptional.
 */
export async function togglePrepTask(input: {
  prepSessionId: string;
  taskId: string;
  done: boolean;
  performedOn?: string;
}): Promise<FoodResult> {
  const ctx = await context();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const performedOn = sanitizeLogDate(input.performedOn, ctx.today);

  const { data: existing } = await ctx.supabase
    .from("prep_logs")
    .select("id, completed_task_ids")
    .eq("user_id", ctx.userId)
    .eq("prep_session_id", input.prepSessionId)
    .eq("performed_on", performedOn)
    .maybeSingle<{ id: string; completed_task_ids: string[] }>();

  const current = new Set(existing?.completed_task_ids ?? []);
  if (input.done) current.add(input.taskId);
  else current.delete(input.taskId);
  const next = [...current];

  const { error } = existing
    ? await ctx.supabase
        .from("prep_logs")
        .update({ completed_task_ids: next })
        .eq("id", existing.id)
    : await ctx.supabase.from("prep_logs").insert({
        user_id: ctx.userId,
        prep_session_id: input.prepSessionId,
        performed_on: performedOn,
        completed_task_ids: next,
      });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/food/prep");
  revalidatePath("/food");
  return { ok: true };
}

/** Start from a food template. Same clone_plan path the gym side uses. */
export async function chooseFoodTemplate(formData: FormData) {
  const templateId = String(formData.get("template_id") || "");
  if (!templateId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("clone_plan", {
    p_source_id: templateId,
    p_name: null,
    p_activate: true,
  });

  if (error) {
    redirect(`/setup/food?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/food");
}
