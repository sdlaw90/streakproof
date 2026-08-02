// A fixed list of security questions, rather than free text.
//
// Free text is worse than it looks: people write questions whose answers are on
// their public profile, or whose answers change (favourite band), or that are
// really just the password again. A curated list at least keeps the answers
// stable and off a LinkedIn page.
//
// The bar each of these has to clear: the answer doesn't change over time, it
// isn't in any public record, and the user will phrase it the same way in five
// years. Mother's maiden name fails all three and is deliberately absent.

export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What street did you live on when you were ten?",
  "What was the make and model of your first car?",
  "What was your childhood nickname?",
  "What was the name of your first manager?",
  "What food did you refuse to eat as a child?",
  "Where were you when the year 2000 started?",
  "What was the first concert you paid for yourself?",
  "What is the name of a teacher who annoyed you?",
  "What was the first video game you finished?",
] as const;

export type SecurityQuestion = (typeof SECURITY_QUESTIONS)[number];
