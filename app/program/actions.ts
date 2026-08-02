"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function client() {
  const supabase = createClient();
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

export async function addDay(planId: string) {
  const { supabase } = await client();
  const { data: existing } = await supabase
    .from("days")
    .select("key, sort")
    .eq("plan_id", planId)
    .order("sort", { ascending: false })
    .limit(1);
  const nextSort = (existing?.[0]?.sort ?? 0) + 1;

  await supabase.from("days").insert({
    plan_id: planId,
    key: `D${nextSort}`,
    title: "New day",
    subtitle: null,
    sort: nextSort,
  });
  revalidate();
}

export async function updateDay(
  dayId: string,
  patch: { key?: string; title?: string; subtitle?: string | null }
) {
  const { supabase } = await client();
  await supabase.from("days").update(patch).eq("id", dayId);
  revalidate();
}

export async function deleteDay(dayId: string) {
  const { supabase } = await client();
  await supabase.from("days").delete().eq("id", dayId);
  revalidate();
}

export async function moveDay(dayId: string, dir: "up" | "down") {
  const { supabase } = await client();
  const { data: day } = await supabase
    .from("days")
    .select("id, plan_id, sort")
    .eq("id", dayId)
    .single();
  if (!day) return;

  const { data: siblings } = await supabase
    .from("days")
    .select("id, sort")
    .eq("plan_id", day.plan_id)
    .order("sort");
  if (!siblings) return;

  const idx = siblings.findIndex((s) => s.id === dayId);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;

  const a = siblings[idx];
  const b = siblings[swapIdx];
  await supabase.from("days").update({ sort: b.sort }).eq("id", a.id);
  await supabase.from("days").update({ sort: a.sort }).eq("id", b.id);
  revalidate();
}

// ---------------- Exercises ----------------

export async function addExercise(dayId: string) {
  const { supabase } = await client();
  const { data: existing } = await supabase
    .from("exercises")
    .select("sort")
    .eq("day_id", dayId)
    .order("sort", { ascending: false })
    .limit(1);
  const nextSort = (existing?.[0]?.sort ?? 0) + 1;

  await supabase.from("exercises").insert({
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
  await refreshEstimatesForDay(dayId);
  revalidate();
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
) {
  const { supabase } = await client();
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
  await supabase.from("exercises").update(patch).eq("id", exId);

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
}

export async function deleteExercise(exId: string) {
  const { supabase } = await client();
  const { data: ex } = await supabase
    .from("exercises")
    .select("day_id")
    .eq("id", exId)
    .single();
  await supabase.from("exercises").delete().eq("id", exId);
  if (ex?.day_id) await refreshEstimatesForDay(ex.day_id);
  revalidate();
}

/** Recompute days.est_minutes for the plan this day belongs to. */
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

export async function moveExercise(exId: string, dir: "up" | "down") {
  const { supabase } = await client();
  const { data: ex } = await supabase
    .from("exercises")
    .select("id, day_id, sort")
    .eq("id", exId)
    .single();
  if (!ex) return;

  const { data: siblings } = await supabase
    .from("exercises")
    .select("id, sort")
    .eq("day_id", ex.day_id)
    .order("sort");
  if (!siblings) return;

  const idx = siblings.findIndex((s) => s.id === exId);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;

  const a = siblings[idx];
  const b = siblings[swapIdx];
  await supabase.from("exercises").update({ sort: b.sort }).eq("id", a.id);
  await supabase.from("exercises").update({ sort: a.sort }).eq("id", b.id);
  revalidate();
}
