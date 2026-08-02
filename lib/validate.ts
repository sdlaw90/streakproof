// Form rules, shared between the browser and the server action.
//
// The client copy exists to fail fast; the server copy is the one that holds,
// because a server action is a public endpoint and nothing stops a caller
// skipping the form. Keeping both in one pure module is what stops them
// drifting apart — and makes them unit testable without a browser or a DB.

/** Shortest password we accept. Supabase's own floor is 6; this is stricter. */
export const MIN_PASSWORD = 8;

export const MIN_NAME = 2;
export const MAX_NAME = 40;

/** How many security questions the recovery opt-in asks for. */
export const SECURITY_QUESTION_COUNT = 3;

/** Shortest security answer we accept — one character is not an answer. */
export const MIN_ANSWER = 2;

export type SignupInput = {
  displayName: string;
  password: string;
  confirm: string;
};

/** Returns a human-readable problem, or null when the input is fine. */
export function validateSignup({
  displayName,
  password,
  confirm,
}: SignupInput): string | null {
  const name = displayName.trim();
  if (name.length < MIN_NAME) {
    return "Give us a name to call you — two characters or more.";
  }
  if (name.length > MAX_NAME) {
    return `That name is a bit long. ${MAX_NAME} characters or fewer.`;
  }
  if (password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters.`;
  }
  if (password !== confirm) {
    return "The two passwords don't match.";
  }
  return null;
}

export type RecoveryInput = {
  hint: string;
  questions: { question: string; answer: string }[];
};

/**
 * The recovery opt-in is skippable, so "nothing filled in" is valid and means
 * skip. What isn't valid is a half-filled form — three questions or none,
 * because two answers can't be checked against a rule that expects three.
 */
export function validateRecovery({ hint, questions }: RecoveryInput): string | null {
  const answered = questions.filter(
    (q) => q.question.trim() && q.answer.trim().length >= MIN_ANSWER
  );

  if (hint.length > 200) {
    return "Keep the hint under 200 characters.";
  }
  if (answered.length === 0) {
    return hint.trim() ? null : "Add a hint or answer the questions — or skip.";
  }
  if (answered.length !== SECURITY_QUESTION_COUNT) {
    return `Answer all ${SECURITY_QUESTION_COUNT} questions, or none of them.`;
  }
  const seen = new Set(answered.map((q) => q.question.trim().toLowerCase()));
  if (seen.size !== answered.length) {
    return "Pick three different questions.";
  }
  return null;
}

/**
 * Normalise a security answer before hashing or comparing.
 *
 * Case and surrounding whitespace must not matter — "Fluffy" and "fluffy " are
 * the same answer, and someone locked out of their account because of a capital
 * letter is a support problem with no support channel. Internal whitespace is
 * collapsed for the same reason.
 */
export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, " ");
}
