// The custom-build intake.
//
// Adapted from the questionnaire that was originally used by hand to build the
// two starting templates (kept at docs/intake-v1.html). Two deliberate changes
// from that version:
//
//   - "What should I call you?" is gone. The profile already has a name, and
//     asking again is the kind of small friction that ends a form.
//   - "How long have you got per session?" is new. The app estimates and
//     displays day durations (`days.est_minutes`), so a plan built without
//     knowing the user's time budget can't honour the one number it shows them.
//
// Stored as jsonb in `builder_profiles.data`, one row per user per kind. The
// shape lives here rather than in the database on purpose — intake questions
// change often, and every change would otherwise be a migration.

export type QuestionKind =
  | "single"
  | "multi"
  | "text"
  | "longtext"
  | "weights"
  | "image";

export type IntakeQuestion = {
  id: string;
  prompt: string;
  hint?: string;
  kind: QuestionKind;
  options?: string[];
  placeholder?: string;
  optional?: boolean;
};

export const INTAKE_VERSION = 2;

/** Sane bounds, in pounds. Anything outside these is a typo, not a person. */
export const WEIGHT_MIN_LB = 50;
export const WEIGHT_MAX_LB = 1000;

export const KG_PER_LB = 0.45359237;

export type WeightUnit = "lb" | "kg";

export function toPounds(value: number, unit: WeightUnit): number {
  return unit === "kg" ? value / KG_PER_LB : value;
}

export const GYM_INTAKE: IntakeQuestion[] = [
  {
    id: "goals",
    prompt: "What do you want out of the gym?",
    hint: "Pick all that apply — a combo is normal.",
    kind: "multi",
    options: [
      "Build strength & muscle",
      "Lose weight / get lean",
      "More energy & better mood",
      "General fitness / feel healthy",
    ],
  },
  {
    id: "days_per_week",
    prompt: "Realistically, how many days a week can you train?",
    hint: "Be honest rather than aspirational — the plan is built around this.",
    kind: "single",
    options: ["2 days", "3 days", "4 days", "5+ days"],
  },
  {
    id: "session_length",
    prompt: "How long have you got per session?",
    hint: "Including warm-up. The app shows an estimate on every day, so this is what makes that number honest.",
    kind: "single",
    options: ["30 minutes", "45 minutes", "60 minutes", "75+ minutes"],
  },
  {
    id: "schedule",
    prompt: "Which days and times are you free — and any regular commitments?",
    hint: 'e.g. "free most evenings except Tuesday soccer and Thursday game night; Saturday mornings open."',
    kind: "longtext",
    placeholder: "Your typical week...",
    optional: true,
  },
  {
    id: "experience",
    prompt: "Where are you starting from?",
    kind: "single",
    options: [
      "Total beginner — new to this",
      "Returning after a break",
      "Some experience, know the basics",
      "Experienced lifter",
    ],
  },
  {
    id: "gym_name",
    prompt: "Which gym?",
    hint: "Name the chain or the gym — LA Fitness, Planet Fitness, a local place. This matters a lot: equipment varies wildly.",
    kind: "text",
    placeholder: "Your gym's name",
    optional: true,
  },
  {
    id: "equipment",
    prompt: "How would you describe what you'll be working out with?",
    kind: "single",
    options: [
      "Full commercial gym (machines + free weights)",
      "Smaller gym — some machines & weights",
      "Dumbbells / home basics",
      "Bodyweight only",
    ],
  },
  {
    id: "equipment_notes",
    prompt: "Anything notable it has or is missing?",
    hint: 'e.g. "has a pool and a squat rack, no cable machine"',
    kind: "text",
    placeholder: "Optional — equipment details",
    optional: true,
  },
  {
    id: "injuries",
    prompt: "Any injuries, aches, or movements to avoid?",
    hint: 'Important for keeping you safe — be honest. "None" is a fine answer.',
    kind: "longtext",
    placeholder: "e.g. bad left knee, tweaky lower back, none...",
  },
  {
    id: "pool",
    prompt: "Do you have access to a pool?",
    hint: "A zero-impact day is the difference between a bad week and a missed week.",
    kind: "single",
    options: ["Yes", "No"],
  },
  {
    id: "weights",
    prompt: "Current and goal weight?",
    hint: "Both optional, and neither changes whether the plan works. They only help size the conditioning and the protein target.",
    kind: "weights",
    optional: true,
  },
  {
    id: "inspo_image",
    prompt: "Got a picture of the look you're after?",
    hint: "Optional. A physique you like, a photo of yourself from a while back, anything. Private to your account — nobody else can see it.",
    kind: "image",
    optional: true,
  },
  {
    id: "goal_note",
    prompt: "Any specific look or goal in mind?",
    hint: 'e.g. "want to look like I lift but still enjoy food", "run a 5K", "stronger for hiking".',
    kind: "longtext",
    placeholder: "Optional...",
    optional: true,
  },
  {
    id: "notes",
    prompt: "Anything else worth knowing?",
    kind: "longtext",
    placeholder: "Optional — anything at all...",
    optional: true,
  },
];

export type WeightAnswer = {
  current?: number;
  goal?: number;
  unit: WeightUnit;
};

export type ImageAnswer = {
  /** Storage path inside the private `intake` bucket: `<user_id>/<file>`. */
  path: string;
  filename: string;
};

export type IntakeAnswers = Record<
  string,
  string | string[] | WeightAnswer | ImageAnswer | undefined
>;

/**
 * Check the weights are plausible.
 *
 * Deliberately only a typo guard — it rejects impossible numbers and a goal
 * that's the wrong side of arithmetic, and nothing else. It is not the app's
 * business to tell someone their goal is wrong, and a fitness app that
 * editorialises about a number on a scale is one people delete. The place to
 * be careful is the *generator*: whatever it produces from these has a hard
 * floor on calories and no aggressive-cut presets. See STATEOFPLAY §6.
 */
export function validateWeights(w: WeightAnswer | undefined): string | null {
  if (!w) return null;
  const check = (v: number | undefined, label: string): string | null => {
    if (v == null) return null;
    if (!Number.isFinite(v) || v <= 0) return `${label} doesn't look like a number.`;
    const lb = toPounds(v, w.unit);
    if (lb < WEIGHT_MIN_LB || lb > WEIGHT_MAX_LB) {
      return `${label} looks like a typo — check the units.`;
    }
    return null;
  };
  return check(w.current, "Current weight") ?? check(w.goal, "Goal weight");
}

/** Which required questions are still unanswered. Empty means ready to submit. */
export function missingAnswers(
  questions: IntakeQuestion[],
  answers: IntakeAnswers
): string[] {
  return questions
    .filter((q) => {
      if (q.optional) return false;
      const a = answers[q.id];
      if (Array.isArray(a)) return a.length === 0;
      if (a && typeof a === "object") return false; // weights / image objects
      return !a || !String(a).trim();
    })
    .map((q) => q.id);
}
