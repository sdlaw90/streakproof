import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import type { Day, Exercise, Plan, PlanKind } from "@/lib/types";

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

export type PlanContext =
  | { redirect: "/login" | "/setup" }
  | {
      redirect?: undefined;
      userId: string;
      displayName: string;
      timezone: string;
      today: string;
      plan: Plan | null;
      days: Day[];
      exercises: Exercise[];
    };

type ProfileRow = {
  display_name: string | null;
  timezone: string | null;
  active_gym_plan_id: string | null;
  active_food_plan_id: string | null;
};

/**
 * Loads the signed-in user's profile plus their active plan of the given kind.
 *
 * v1 had a single profiles.program_id, so a user could only ever have one plan.
 * There are now two independent slots, which is what lets the food side exist
 * without competing with the gym side for the same column.
 */
export async function loadPlan(kind: PlanKind = "gym"): Promise<PlanContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone, active_gym_plan_id, active_food_plan_id")
    .eq("id", user.id)
    .single<ProfileRow>();

  const planId =
    kind === "gym" ? profile?.active_gym_plan_id : profile?.active_food_plan_id;
  if (!planId) return { redirect: "/setup" };

  const timezone = profile?.timezone || "UTC";

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single<Plan>();

  const { data: days } = await supabase
    .from("days")
    .select("*")
    .eq("plan_id", planId)
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
    displayName: profile?.display_name ?? "there",
    timezone,
    today: todayIn(timezone),
    plan: plan ?? null,
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
