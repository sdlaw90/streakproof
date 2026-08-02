"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Every action here returns { ok, error } and the caller surfaces failures.
 *
 * These used to return void and discard the Supabase error, so an edit that
 * failed — expired session, RLS denial, dropped connection — looked exactly
 * like one that worked: the input kept the typed value and nothing was saved.
 * That's the same silent-write bug that was fixed in the set logger; the plan
 * editor just hadn't caught up.
 */
export type EditResult = { ok: boolean; error?: string };

const OK: EditResult = { ok: true };

function fail(message: string | undefined, fallback: string): EditResult {
  return { ok: false, error: message ?? fallback };
}

async function client() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate() {
  revalidatePath("/program");
  revalidatePath("/");
}

// ---------------- Days ----------------

export async function addDay(planId: string): Promise<EditResult> {
  const { supabase, user } = await client();
  if (!user) return fail(undefined, "Not signed in");

  const { data: existing, error: readErr } = await supabase
    .from("days")
    .select("key, sort")
    .eq("plan_id", planId)
    .order("sort", { ascending: false })
    .limit(1);
  if (readErr) return fail(readErr.message, "Could not read days");

  const nextSort = (existing?.[0]?.sort ?? 0) + 1;

  const { error } = await supabase.from("days").insert({
    plan_id: planId,
    key: `D${nextSort}`,
    title: "New day",
    subtitle: null,
    sort: nextSort,
  });
  if (error) return fail(error.message, "Could not add day");

  revalidate();
  return OK;
}

export async function updateDay(
  dayId: string,
  patch: { key?: string; title?: string; subtitle?: string | null }
): Promise<EditResult> {
  const { supabase, user } = await client();
  if (!user) return fail(undefined, "Not signed in");

  const { error } = await supabase.from("days").update(patch).eq("id", dayId);
  if (error) return fail(error.message, "Could not save day");

  revalidate();
  return OK;
}

export async function deleteDay(dayId: string): Promise<EditResult> {
  const { supabase, user } = await client();
  if (!user) return fail(undefined, "Not signed in");

  const { error } = await supabase.from("days").delete().eq("id", dayId);
  if (error) return fail(error.message, "Could not delete day");

  revalidate();
  return OK;
}

export async function moveDay(
  dayId: string,
  dir: "up" | "down"
): Promise<EditResult> {
  const { supabase, user } = await client();
  if (!user) return fail(undefined, "Not signed in");

  const { data: day, error: dayErr } = await supabase
    .from("days")
    .select("id, plan_id, sort")
    .eq("id", dayId)
    .single();
  if (dayErr || !day) return fail(dayErr?.message, "Day not found");

  const { data: siblings, error: sibErr } = await supabase
    .from("days")
    .select("id, sort")
    .eq("plan_id", day.plan_id)
    .order("sort");
  if (sibErr || !siblings) return fail(sibErr?.message, "Could not read days");

  const idx = siblings.findIndex((s) => s.id === dayId);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  // Already at the end — not an error, just nothing to do.
  if (swapIdx < 0 || swapIdx >= siblings.length) return OK;

  const a = siblings[idx];
  const b = siblings[swapIdx];
  const { error: e1 } = await supabase
    .from("days")
    .update({ sort: b.sort })
    .eq("id", a.id);
  if (e1) return fail(e1.message, "Could not reorder days");

  const { error: e2 } = await supabase
    .from("days")
    .update({ sort: a.sort })
    .eq("id", b.id);
  if (e2) return fail(e2.message, "Could not reorder days");

  revalidate();
  return OK;
}

// ---------------- Exercises ----------------

export async function addExercise(dayId: string): Promise<EditResult> {
  const { supabase, user } = await client();
  if (!user) return fail(undefined, "Not signed in");

  const { data: existing, error: readErr } = await supabase
    .from("exercises")
    .select("sort")
    .eq("day_id", dayId)
    .order("sort", { ascending: false })
    .limit(1);
  if (readErr) return fail(readErr.message, "Could not read exercises");

  const nextSort = (existing?.[0]?.sort ?? 0) + 1;

  const { error } = await supabase.from("exercises").insert({
    day_id: dayId,
    name: `New exercise ${nextSort}`,
    scheme: "3 × 10",
    cue: null,
    sets: 3,
    work_seconds: 45,
    rest_seconds: 90,
    optional: false,
    sort: nextSort,
  });
  if (error) return fail(error.message, "Could not add exercise");

  await refreshEstimatesForDay(dayId);
  revalidate();
  return OK;
}

export async function updateExercise(
  exId: string,
  patch: {
    name?: string;
    scheme?: string | null;
    cue?: string | null;
    sets?: number;
    work_seconds?: number;
    rest_seconds?: number;
    optional?: boolean;
  }
): Promise<EditResult> {
  const { supabase, user } = await client();
  if (!user) return fail(undefined, "Not signed in");

  // Mirror the CHECK constraints so a bad value fails here rather than as an
  // opaque Postgres error.
  if (patch.sets != null) {
    patch.sets = Math.max(1, Math.min(20, Math.round(patch.sets)));
  }
  if (patch.work_seconds != null) {
    patch.work_seconds = Math.max(5, Math.min(600, Math.round(patch.work_seconds)));
  }
  if (patch.rest_seconds != null) {
    patch.rest_seconds = Math.max(0, Math.min(600, Math.round(patch.rest_seconds)));
  }

  const { error } = await supabase
    .from("exercises")
    .update(patch)
    .eq("id", exId);
  if (error) return fail(error.message, "Could not save exercise");

  // Anything touching sets/work/rest changes the day's duration estimate.
  if (
    patch.sets != null ||
    patch.work_seconds != null ||
    patch.rest_seconds != null
  ) {
    const { data: ex } = await supabase
      .from("exercises")
      .select("day_id")
      .eq("id", exId)
      .single();
    if (ex?.day_id) await refreshEstimatesForDay(ex.day_id);
  }

  revalidate();
  return OK;
}

export async function deleteExercise(exId: string): Promise<EditResult> {
  const { supabase, user } = await client();
  if (!user) return fail(undefined, "Not signed in");

  const { data: ex } = await supabase
    .from("exercises")
    .select("day_id")
    .eq("id", exId)
    .single();

  const { error } = await supabase.from("exercises").delete().eq("id", exId);
  if (error) return fail(error.message, "Could not delete exercise");

  if (ex?.day_id) await refreshEstimatesForDay(ex.day_id);
  revalidate();
  return OK;
}

/**
 * Recompute days.est_minutes for the plan this day belongs to.
 *
 * Deliberately not surfaced: a stale "~48 min" label is cosmetic, and failing
 * the user's edit because the estimate didn't refresh would be worse than the
 * stale label. The next successful edit recomputes it.
 */
async function refreshEstimatesForDay(dayId: string) {
  const { supabase } = await client();
  const { data: day } = await supabase
    .from("days")
    .select("plan_id")
    .eq("id", dayId)
    .single();
  if (day?.plan_id) {
    await supabase.rpc("refresh_plan_estimates", { p_plan_id: day.plan_id });
  }
}

export async function moveExercise(
  exId: string,
  dir: "up" | "down"
): Promise<EditResult> {
  const { supabase, user } = await client();
  if (!user) return fail(undefined, "Not signed in");

  const { data: ex, error: exErr } = await supabase
    .from("exercises")
    .select("id, day_id, sort")
    .eq("id", exId)
    .single();
  if (exErr || !ex) return fail(exErr?.message, "Exercise not found");

  const { data: siblings, error: sibErr } = await supabase
    .from("exercises")
    .select("id, sort")
    .eq("day_id", ex.day_id)
    .order("sort");
  if (sibErr || !siblings)
    return fail(sibErr?.message, "Could not read exercises");

  const idx = siblings.findIndex((s) => s.id === exId);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return OK;

  const a = siblings[idx];
  const b = siblings[swapIdx];
  const { error: e1 } = await supabase
    .from("exercises")
    .update({ sort: b.sort })
    .eq("id", a.id);
  if (e1) return fail(e1.message, "Could not reorder exercises");

  const { error: e2 } = await supabase
    .from("exercises")
    .update({ sort: a.sort })
    .eq("id", b.id);
  if (e2) return fail(e2.message, "Could not reorder exercises");

  revalidate();
  return OK;
}
