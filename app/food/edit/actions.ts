"use server";

import { createClient } from "@/lib/supabase/server";
import type { FoodRole } from "@/lib/types";

/** Same shape as the gym editor's result — see ADR 0007. */
export type EditResult = { ok: boolean; error?: string };

const OK: EditResult = { ok: true };

function fail(message: string | undefined, fallback: string): EditResult {
  return { ok: false, error: message ?? fallback };
}

/**
 * Ownership is enforced by RLS (`owns_plan`), not here.
 *
 * Every write below runs as the user, so a plan they don't own simply matches
 * zero rows. These functions don't re-check it — a second, hand-written check
 * is one more thing that can disagree with the policy.
 */
async function client() {
  return await createClient();
}

// ---------------------------------------------------------------------------
// Food items — the pantry
// ---------------------------------------------------------------------------

export async function addFoodItem(
  planId: string,
  role: FoodRole
): Promise<EditResult> {
  const supabase = await client();

  const { data: last } = await supabase
    .from("food_items")
    .select("sort")
    .eq("plan_id", planId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort: number }>();

  const { error } = await supabase.from("food_items").insert({
    plan_id: planId,
    name: "New item",
    role,
    sort: (last?.sort ?? 0) + 1,
  });

  return error ? fail(error.message, "Couldn't add that item.") : OK;
}

export async function updateFoodItem(
  itemId: string,
  patch: {
    name?: string;
    role?: FoodRole;
    batch_cooked?: boolean;
    shelf_life_days?: number | null;
  }
): Promise<EditResult> {
  const supabase = await client();

  const clean: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) return fail(undefined, "An item needs a name.");
    clean.name = name.slice(0, 120);
  }
  if (patch.role !== undefined) clean.role = patch.role;
  if (patch.batch_cooked !== undefined) clean.batch_cooked = patch.batch_cooked;
  if (patch.shelf_life_days !== undefined) {
    const d = patch.shelf_life_days;
    // The column's check constraint is 0–365; reject before Postgres has to.
    if (d != null && (!Number.isFinite(d) || d < 0 || d > 365)) {
      return fail(undefined, "Shelf life should be between 0 and 365 days.");
    }
    clean.shelf_life_days = d;
  }
  if (!Object.keys(clean).length) return OK;

  const { error } = await supabase.from("food_items").update(clean).eq("id", itemId);
  return error ? fail(error.message, "Couldn't save that item.") : OK;
}

export async function deleteFoodItem(itemId: string): Promise<EditResult> {
  const supabase = await client();
  // build_items cascade, so removing an item removes it from every build.
  const { error } = await supabase.from("food_items").delete().eq("id", itemId);
  return error ? fail(error.message, "Couldn't delete that item.") : OK;
}

// ---------------------------------------------------------------------------
// Builds — the bowls
// ---------------------------------------------------------------------------

export async function addBuild(planId: string): Promise<EditResult> {
  const supabase = await client();

  const { data: existing } = await supabase
    .from("builds")
    .select("key, sort")
    .eq("plan_id", planId)
    .order("sort", { ascending: false });

  const rows = (existing ?? []) as { key: string; sort: number }[];
  const used = new Set(rows.map((r) => r.key));

  // Keys are unique per plan and shown to the user, so walk the alphabet
  // rather than generating something ugly.
  let key = "";
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (!used.has(c)) {
      key = c;
      break;
    }
  }
  if (!key) return fail(undefined, "That's a lot of bowls. Delete one first.");

  const { error } = await supabase.from("builds").insert({
    plan_id: planId,
    key,
    title: "New bowl",
    est_minutes: 6,
    sort: (rows[0]?.sort ?? 0) + 1,
  });

  return error ? fail(error.message, "Couldn't add that bowl.") : OK;
}

export async function updateBuild(
  buildId: string,
  patch: {
    title?: string;
    subtitle?: string | null;
    est_minutes?: number | null;
    is_fallback?: boolean;
  }
): Promise<EditResult> {
  const supabase = await client();

  const clean: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) return fail(undefined, "A bowl needs a name.");
    clean.title = title.slice(0, 120);
  }
  if (patch.subtitle !== undefined) {
    clean.subtitle = patch.subtitle?.trim().slice(0, 200) || null;
  }
  if (patch.est_minutes !== undefined) {
    const m = patch.est_minutes;
    if (m != null && (!Number.isFinite(m) || m < 0 || m > 600)) {
      return fail(undefined, "Minutes should be between 0 and 600.");
    }
    clean.est_minutes = m;
  }
  if (patch.is_fallback !== undefined) clean.is_fallback = patch.is_fallback;
  if (!Object.keys(clean).length) return OK;

  const { error } = await supabase.from("builds").update(clean).eq("id", buildId);
  return error ? fail(error.message, "Couldn't save that bowl.") : OK;
}

export async function deleteBuild(buildId: string): Promise<EditResult> {
  const supabase = await client();
  const { error } = await supabase.from("builds").delete().eq("id", buildId);
  return error ? fail(error.message, "Couldn't delete that bowl.") : OK;
}

/** Add or remove one component from a build. */
export async function toggleBuildItem(
  buildId: string,
  foodItemId: string,
  include: boolean
): Promise<EditResult> {
  const supabase = await client();

  if (!include) {
    const { error } = await supabase
      .from("build_items")
      .delete()
      .eq("build_id", buildId)
      .eq("food_item_id", foodItemId);
    return error ? fail(error.message, "Couldn't remove that component.") : OK;
  }

  const { data: last } = await supabase
    .from("build_items")
    .select("sort")
    .eq("build_id", buildId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort: number }>();

  const { error } = await supabase.from("build_items").insert({
    build_id: buildId,
    food_item_id: foodItemId,
    sort: (last?.sort ?? 0) + 1,
  });

  // A duplicate is the unique constraint doing its job, not a failure worth
  // showing — the component is already in the build, which is what was wanted.
  if (error && !error.message.includes("duplicate")) {
    return fail(error.message, "Couldn't add that component.");
  }
  return OK;
}

// ---------------------------------------------------------------------------
// Prep sessions
// ---------------------------------------------------------------------------

export async function updatePrepSession(
  sessionId: string,
  patch: { title?: string; weekday?: number | null; est_minutes?: number | null }
): Promise<EditResult> {
  const supabase = await client();

  const clean: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) return fail(undefined, "A prep session needs a name.");
    clean.title = title.slice(0, 120);
  }
  if (patch.weekday !== undefined) {
    const w = patch.weekday;
    if (w != null && (!Number.isInteger(w) || w < 0 || w > 6)) {
      return fail(undefined, "That isn't a day of the week.");
    }
    clean.weekday = w;
  }
  if (patch.est_minutes !== undefined) clean.est_minutes = patch.est_minutes;
  if (!Object.keys(clean).length) return OK;

  const { error } = await supabase
    .from("prep_sessions")
    .update(clean)
    .eq("id", sessionId);
  return error ? fail(error.message, "Couldn't save that session.") : OK;
}

export async function addPrepTask(sessionId: string): Promise<EditResult> {
  const supabase = await client();

  const { data: last } = await supabase
    .from("prep_tasks")
    .select("sort")
    .eq("prep_session_id", sessionId)
    .order("sort", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort: number }>();

  const { error } = await supabase.from("prep_tasks").insert({
    prep_session_id: sessionId,
    text: "New step",
    sort: (last?.sort ?? 0) + 1,
  });

  return error ? fail(error.message, "Couldn't add that step.") : OK;
}

export async function updatePrepTask(
  taskId: string,
  text: string
): Promise<EditResult> {
  const supabase = await client();
  const clean = text.trim();
  if (!clean) return fail(undefined, "A step needs some text.");

  const { error } = await supabase
    .from("prep_tasks")
    .update({ text: clean.slice(0, 300) })
    .eq("id", taskId);
  return error ? fail(error.message, "Couldn't save that step.") : OK;
}

export async function deletePrepTask(taskId: string): Promise<EditResult> {
  const supabase = await client();
  const { error } = await supabase.from("prep_tasks").delete().eq("id", taskId);
  return error ? fail(error.message, "Couldn't delete that step.") : OK;
}
