import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import type {
  Build,
  BuildItem,
  FoodItem,
  Plan,
  PrepSession,
  PrepTask,
} from "@/lib/types";

const NIL = "00000000-0000-0000-0000-000000000000";

export type MealLog = {
  id: string;
  build_id: string | null;
  name: string | null;
  eaten_on: string;
  servings: number;
};

export type PrepLog = {
  id: string;
  prep_session_id: string;
  performed_on: string;
  completed_task_ids: string[];
};

export type FoodContext =
  | { redirect: "/login" | "/setup/food" }
  | {
      redirect?: undefined;
      userId: string;
      timezone: string;
      today: string;
      plan: Plan;
      items: FoodItem[];
      builds: Build[];
      buildItems: BuildItem[];
      prepSessions: PrepSession[];
      prepTasks: PrepTask[];
      meals: MealLog[];
      prepLogs: PrepLog[];
    };

/**
 * Everything the food screens need, in one round of queries.
 *
 * Mirrors loadPlan() deliberately, including the "an unreadable profile is a
 * broken session, not an empty state" rule — see lib/load.ts for why that
 * distinction cost an afternoon.
 */
export async function loadFood(): Promise<FoodContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { redirect: "/login" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("timezone, active_food_plan_id")
    .eq("id", user.id)
    .single<{ timezone: string | null; active_food_plan_id: string | null }>();

  if (profileError || !profile) {
    console.error(
      "loadFood: could not read profile for",
      user.id,
      profileError?.message ?? "no row returned"
    );
    return { redirect: "/login" };
  }

  const planId = profile.active_food_plan_id;
  if (!planId) return { redirect: "/setup/food" };

  const timezone = profile.timezone || "UTC";
  const today = todayIn(timezone);

  const { data: plan } = await supabase
    .from("plans")
    .select("*")
    .eq("id", planId)
    .single<Plan>();
  if (!plan) return { redirect: "/setup/food" };

  const [{ data: items }, { data: builds }, { data: prepSessions }] =
    await Promise.all([
      supabase.from("food_items").select("*").eq("plan_id", planId).order("sort"),
      supabase.from("builds").select("*").eq("plan_id", planId).order("sort"),
      supabase
        .from("prep_sessions")
        .select("*")
        .eq("plan_id", planId)
        .order("sort"),
    ]);

  const buildList = (builds ?? []) as Build[];
  const prepList = (prepSessions ?? []) as PrepSession[];

  const [{ data: buildItems }, { data: prepTasks }, { data: meals }, { data: prepLogs }] =
    await Promise.all([
      supabase
        .from("build_items")
        .select("*")
        .in("build_id", buildList.length ? buildList.map((b) => b.id) : [NIL])
        .order("sort"),
      supabase
        .from("prep_tasks")
        .select("*")
        .in(
          "prep_session_id",
          prepList.length ? prepList.map((p) => p.id) : [NIL]
        )
        .order("sort"),
      supabase
        .from("meal_logs")
        .select("id, build_id, name, eaten_on, servings")
        .eq("user_id", user.id)
        .order("eaten_on", { ascending: false })
        .limit(200),
      supabase
        .from("prep_logs")
        .select("id, prep_session_id, performed_on, completed_task_ids")
        .eq("user_id", user.id)
        .order("performed_on", { ascending: false })
        .limit(50),
    ]);

  return {
    userId: user.id,
    timezone,
    today,
    plan,
    items: (items ?? []) as FoodItem[],
    builds: buildList,
    buildItems: (buildItems ?? []) as BuildItem[],
    prepSessions: prepList,
    prepTasks: (prepTasks ?? []) as PrepTask[],
    meals: (meals ?? []) as MealLog[],
    prepLogs: (prepLogs ?? []) as PrepLog[],
  };
}
