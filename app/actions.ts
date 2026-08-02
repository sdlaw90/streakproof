"use server";

import { createClient } from "@/lib/supabase/server";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function ensureTodaySession(dayId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not signed in" as const, sessionId: null };

  const { data: session, error } = await supabase
    .from("sessions")
    .upsert(
      { user_id: user.id, day_id: dayId, performed_on: todayUTC() },
      { onConflict: "user_id,day_id,performed_on" }
    )
    .select("id")
    .single();

  if (error || !session) return { supabase, error: error?.message ?? "No session", sessionId: null };
  return { supabase, error: null, sessionId: session.id as string };
}

/** Save one set (weight / reps / done) for an exercise in today's session. */
export async function saveSet(input: {
  dayId: string;
  exerciseId: string;
  setNumber: number;
  weight?: number | null;
  reps?: number | null;
  done?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, error, sessionId } = await ensureTodaySession(input.dayId);
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
