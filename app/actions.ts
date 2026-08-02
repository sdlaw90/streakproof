"use server";

import { createClient } from "@/lib/supabase/server";
import { sanitizeLogDate, todayIn } from "@/lib/dates";

/**
 * The user's local "today". v1 used UTC here, which meant an evening lift in
 * Eastern time got filed under tomorrow's date.
 */
async function userToday(
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single<{ timezone: string | null }>();
  return todayIn(data?.timezone || "UTC");
}

async function ensureSession(dayId: string, performedOn?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not signed in" as const, sessionId: null };

  const today = await userToday(supabase, user.id);
  // Never trust a client-supplied date: no future dates, nothing older than
  // 90 days. Backfilling a missed Wednesday is the point; rewriting 2019 isn't.
  const date = sanitizeLogDate(performedOn, today);

  const { data: session, error } = await supabase
    .from("sessions")
    .upsert(
      { user_id: user.id, day_id: dayId, performed_on: date },
      { onConflict: "user_id,day_id,performed_on" }
    )
    .select("id")
    .single();

  if (error || !session) {
    return { supabase, error: error?.message ?? "No session", sessionId: null };
  }
  return { supabase, error: null, sessionId: session.id as string };
}

export type SaveResult = { ok: boolean; error?: string };

/** Save one set (weight / reps / done) for an exercise on a given date. */
export async function saveSet(input: {
  dayId: string;
  exerciseId: string;
  setNumber: number;
  performedOn?: string;
  weight?: number | null;
  reps?: number | null;
  done?: boolean;
}): Promise<SaveResult> {
  const { supabase, error, sessionId } = await ensureSession(
    input.dayId,
    input.performedOn
  );
  if (error || !sessionId) return { ok: false, error: error ?? "No session" };

  const payload: Record<string, unknown> = {
    session_id: sessionId,
    exercise_id: input.exerciseId,
    set_number: input.setNumber,
    updated_at: new Date().toISOString(),
  };
  if (input.weight !== undefined) payload.weight = input.weight;
  if (input.reps !== undefined) payload.reps = input.reps;
  if (input.done !== undefined) payload.done = input.done;

  const { error: e } = await supabase
    .from("set_logs")
    .upsert(payload, { onConflict: "session_id,exercise_id,set_number" });

  if (e) return { ok: false, error: e.message };
  return { ok: true };
}

/**
 * Remove a set row. Needed now that set counts are variable — v1 rendered
 * exactly `exercises.sets` rows, so there was nowhere to put a fourth set on a
 * good day.
 */
export async function deleteSet(input: {
  dayId: string;
  exerciseId: string;
  setNumber: number;
  performedOn?: string;
}): Promise<SaveResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const today = await userToday(supabase, user.id);
  const date = sanitizeLogDate(input.performedOn, today);

  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("day_id", input.dayId)
    .eq("performed_on", date)
    .maybeSingle();
  if (!session) return { ok: true }; // nothing logged that day, nothing to delete

  const { error } = await supabase
    .from("set_logs")
    .delete()
    .eq("session_id", session.id)
    .eq("exercise_id", input.exerciseId)
    .eq("set_number", input.setNumber);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Store the browser's timezone, so server-side dates match the user's day. */
export async function saveTimezone(timezone: string): Promise<SaveResult> {
  if (!/^[A-Za-z_+\-/]{3,64}$/.test(timezone)) {
    return { ok: false, error: "Invalid timezone" };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
