export type Program = {
  id: string;
  slug: string;
  name: string;
  owner_id: string | null;
};

export type Day = {
  id: string;
  program_id: string;
  key: string;
  title: string;
  subtitle: string | null;
  sort: number;
};

export type Exercise = {
  id: string;
  day_id: string;
  name: string;
  scheme: string | null;
  cue: string | null;
  sets: number;
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
  todaySets: Record<string, SetLog[]>; // exercise_id -> sets logged today
  lastSets: Record<string, SetLog[]>; // exercise_id -> sets from previous session
  bestWeight: Record<string, number>; // exercise_id -> all-time best weight (excl. today)
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
