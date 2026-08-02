import { createClient } from "@/lib/supabase/server";
import type { Day, Exercise, Program } from "@/lib/types";

const NIL = "00000000-0000-0000-0000-000000000000";

export type RawSet = {
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  done: boolean;
};

export type RawSession = {
  id: string;
  day_id: string;
  performed_on: string;
};

export type ProgramContext =
  | { redirect: "/login" | "/setup" }
  | {
      redirect?: undefined;
      userId: string;
      displayName: string;
      program: Program | null;
      days: Day[];
      exercises: Exercise[];
    };

/** Loads the signed-in user's profile, program, days and exercises. */
export async function loadProgram(): Promise<ProgramContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, program_id, program:programs(id, name, slug, owner_id)")
    .eq("id", user.id)
    .single();

  if (!profile?.program_id) return { redirect: "/setup" };

  const program = (
    Array.isArray(profile.program) ? profile.program[0] : profile.program
  ) as Program | null;

  const { data: days } = await supabase
    .from("days")
    .select("*")
    .eq("program_id", profile.program_id)
    .order("sort");

  const dayList = (days ?? []) as Day[];
  const dayIds = dayList.map((d) => d.id);

  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .in("day_id", dayIds.length ? dayIds : [NIL])
    .order("sort");

  return {
    userId: user.id,
    displayName: profile.display_name ?? "there",
    program,
    days: dayList,
    exercises: (exercises ?? []) as Exercise[],
  };
}

/** Loads all of the user's sessions (for the given days) and their set logs. */
export async function loadSessionsAndSets(
  userId: string,
  dayIds: string[]
): Promise<{ sessions: RawSession[]; sets: RawSet[] }> {
  const supabase = createClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, day_id, performed_on")
    .eq("user_id", userId)
    .in("day_id", dayIds.length ? dayIds : [NIL])
    .order("performed_on", { ascending: false });

  const sessionList = (sessions ?? []) as RawSession[];
  const sessionIds = sessionList.map((s) => s.id);

  const { data: sets } = await supabase
    .from("set_logs")
    .select("session_id, exercise_id, set_number, weight, reps, done")
    .in("session_id", sessionIds.length ? sessionIds : [NIL]);

  return { sessions: sessionList, sets: (sets ?? []) as RawSet[] };
}
