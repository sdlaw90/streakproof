export type PlanKind = "gym" | "food";
export type TrackingMode = "none" | "protein" | "full";

export type Plan = {
  id: string;
  owner_id: string | null;
  is_template: boolean;
  kind: PlanKind;
  slug: string | null;
  name: string;
  description: string | null;
  source: "template" | "ai" | "manual";
  template_id: string | null;
  visibility: "private" | "unlisted" | "public";
  tracking_mode: TrackingMode;
  started_on: string | null;
  review_after_weeks: number;
  last_reviewed_on: string | null;
  archived_at: string | null;
};

export type Day = {
  id: string;
  plan_id: string;
  key: string;
  title: string;
  subtitle: string | null;
  sort: number;
  est_minutes: number | null;
};

export type Exercise = {
  id: string;
  day_id: string;
  name: string;
  scheme: string | null;
  cue: string | null;
  sets: number;
  work_seconds: number;
  rest_seconds: number;
  optional: boolean;
  sort: number;
};

export type SetLog = {
  set_number: number;
  weight: number | null;
  reps: number | null;
  done: boolean;
};

// Everything the Tracker needs for one day.
export type DayView = {
  day: Day;
  exercises: Exercise[];
  todaySets: Record<string, SetLog[]>; // exercise_id -> sets logged on the active date
  lastSets: Record<string, SetLog[]>; // exercise_id -> sets from the previous session
  bestWeight: Record<string, number>; // exercise_id -> all-time best (excl. active date)
};

export type SessionSummary = {
  id: string;
  day_id: string;
  day_title: string;
  day_key: string;
  performed_on: string;
  totalSets: number;
  doneSets: number;
  volume: number; // sum of weight*reps
};

// ---------------------------------------------------------------------------
// Food side. Not rendered anywhere yet — typed now so the loaders and the AI
// builder end up writing against the same shapes.
// ---------------------------------------------------------------------------

export type FoodRole = "protein" | "base" | "veg" | "sauce" | "extra";

export type FoodItem = {
  id: string;
  plan_id: string;
  name: string;
  role: FoodRole;
  unit: string;
  serving_qty: number;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  nutrition_source: "manual" | "usda" | "off" | "ai" | null;
  external_id: string | null;
  batch_cooked: boolean;
  shelf_life_days: number | null;
  sort: number;
};

export type Build = {
  id: string;
  plan_id: string;
  key: string;
  title: string;
  subtitle: string | null;
  is_fallback: boolean;
  est_minutes: number | null;
  sort: number;
};

export type BuildItem = {
  id: string;
  build_id: string;
  food_item_id: string;
  qty: number;
  note: string | null;
  sort: number;
};

export type PrepSession = {
  id: string;
  plan_id: string;
  key: string;
  title: string;
  weekday: number | null;
  est_minutes: number | null;
  sort: number;
};

export type PrepTask = {
  id: string;
  prep_session_id: string;
  text: string;
  food_item_id: string | null;
  sort: number;
};

export type PlanReview = {
  id: string;
  plan_id: string;
  user_id: string;
  reason: "time" | "stalled" | "adherence" | "season" | "manual";
  detail: Record<string, unknown>;
  due_on: string;
  status: "pending" | "dismissed" | "acted";
};
