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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, timezone, active_gym_plan_id, active_food_plan_id")
    .eq("id", user.id)
    .single<ProfileRow>();

  // A profile we can't read is a broken session, not a user without a plan.
  //
  // These two used to be indistinguishable: the error was discarded, `profile`
  // came back null, and the null plan id bounced the user to /setup — which
  // reads as "you have no plan" when the truth is "we couldn't tell". An
  // expired JWT that still satisfies getUser() produces exactly this, and the
  // user ends up staring at a template picker instead of a sign-in form.
  //
  // Same principle as ADR 0007, on the read side: never let a failure
  // impersonate a legitimate empty state.
  if (profileError || !profile) {
    console.error(
      "loadPlan: could not read profile for",
      user.id,
      profileError?.message ?? "no row returned"
    );
    return { redirect: "/login" };
  }

  const planId =
    kind === "gym" ? profile.active_gym_plan_id : profile.active_food_plan_id;
  if (!planId) return { redirect: "/setup" };

  const timezone = profile.timezone || "UTC";

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
    displayName: profile.display_name ?? "there",
    timezone,
    today: todayIn(timezone),
    plan: plan ?? null,
    days: dayList,
    exercises: (exercises ?? []) as Exercise[],
  };
}

export type BuildSummary = {
  id: string;
  key: string;
  title: string;
  subtitle: string | null;
  is_fallback: boolean;
  est_minutes: number | null;
};

export type FoodSummary = {
  plan: Plan | null;
  builds: BuildSummary[];
};

/**
 * The food side, for the home screen only.
 *
 * Unlike loadPlan() this never redirects: not having a food plan is a normal
 * state the home screen renders honestly, not a reason to bounce someone off
 * the page. A user with a gym plan and no food plan is expected.
 */
export async function loadFoodSummary(): Promise<FoodSummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { plan: null, builds: [] };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_food_plan_id")
    .eq("id", user.id)
    .single<{ active_food_plan_id: string | null }>();

  if (profileError) {
    // Home renders "no food plan yet" either way, but a swallowed error here
    // would make a real fault look like a normal empty state.
    console.error("loadFoodSummary: could not read profile:", profileError.message);
    return { plan: null, builds: [] };
  }

  const planId = profile?.active_food_plan_id;
  if (!planId) return { plan: null, builds: [] };

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single<Plan>();

  const { data: builds } = await supabase
    .from("builds")
    .select("id, key, title, subtitle, is_fallback, est_minutes")
    .eq("plan_id", planId)
    .order("sort");

  return { plan: plan ?? null, builds: (builds ?? []) as BuildSummary[] };
}

/** Loads all of the user's sessions (for the given days) and their set logs. */
export async function loadSessionsAndSets(
  userId: string,
  dayIds: string[]
): Promise<{ sessions: RawSession[]; sets: RawSet[] }> {
  const supabase = await createClient();

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
