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

export type QuestionKind = "single" | "multi" | "text" | "longtext";

export type IntakeQuestion = {
  id: string;
  prompt: string;
  hint?: string;
  kind: QuestionKind;
  options?: string[];
  placeholder?: string;
  optional?: boolean;
};

export const INTAKE_VERSION = 1;

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

export type IntakeAnswers = Record<string, string | string[]>;

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
      return !a || !String(a).trim();
    })
    .map((q) => q.id);
}
