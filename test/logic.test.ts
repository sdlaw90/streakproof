import { computeStats } from "@/lib/stats";
import { sanitizeLogDate, todayIn, formatISODate } from "@/lib/dates";
import { greetingFor, suggestDay, suggestBuild, prepDueOn } from "@/lib/suggest";
import { validateSignup, validateRecovery, normalizeAnswer } from "@/lib/validate";
import { GYM_INTAKE, missingAnswers, validateWeights, toPounds } from "@/lib/intake";
import { dueReviews, timeReview, stalledReview, adherenceReview, type ReviewInputs } from "@/lib/review";

let fails = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) console.log("  ok    " + name);
  else { fails++; console.log("  FAIL  " + name + (extra ? "  " + extra : "")); }
}

console.log("\nnever-miss-twice nudge:");
// Trains every 2 days. 3 days off = at risk.
const frequent = ["2026-07-20","2026-07-22","2026-07-24","2026-07-26","2026-07-28"];
const a = computeStats(frequent, "2026-07-31");
check("frequent lifter, 3 days off -> nudged", a.atRisk === true, JSON.stringify(a));

// Trains weekly. 3 days off is normal — v1 nagged here, which was wrong.
const weekly = ["2026-07-03","2026-07-10","2026-07-17","2026-07-24"];
const b = computeStats(weekly, "2026-07-27");
check("weekly lifter, 3 days off -> NOT nudged", b.atRisk === false, JSON.stringify(b));
check("weekly lifter typical gap is 7", b.typicalGapDays === 7, String(b.typicalGapDays));

const c = computeStats(frequent, "2026-07-28");
check("trained today -> no nudge", c.nudge === null, JSON.stringify(c));

const d = computeStats([], "2026-07-31");
check("no history -> first-one nudge", d.nudge !== null && d.total === 0);

console.log("\nstreaks:");
check("consecutive weeks counted", computeStats(
  ["2026-07-13","2026-07-20","2026-07-27"], "2026-07-31").streakWeeks === 3);
check("this week counted", computeStats(
  ["2026-07-27","2026-07-29"], "2026-07-31").thisWeek === 2);

console.log("\nlocal dates (the v1 UTC bug):");
// 9pm in New York on Aug 2 is 01:00 UTC on Aug 3.
const evening = new Date("2026-08-03T01:00:00Z");
check("9pm NY logs as Aug 2, not Aug 3",
  formatISODate(evening, "America/New_York") === "2026-08-02",
  formatISODate(evening, "America/New_York"));
check("same instant is Aug 3 in UTC",
  formatISODate(evening, "UTC") === "2026-08-03");
check("bad timezone falls back, does not throw",
  formatISODate(evening, "Not/AZone").length === 10);

console.log("\nbackfill date guard:");
check("future date rejected", sanitizeLogDate("2026-12-01","2026-07-31") === "2026-07-31");
check("yesterday allowed",   sanitizeLogDate("2026-07-30","2026-07-31") === "2026-07-30");
check("120 days ago rejected", sanitizeLogDate("2026-04-01","2026-07-31") === "2026-07-31");
check("garbage rejected", sanitizeLogDate("'; drop table --","2026-07-31") === "2026-07-31");
check("non-date rejected", sanitizeLogDate("2026-02-30","2026-07-31") === "2026-07-31");
check("undefined -> today", sanitizeLogDate(undefined,"2026-07-31") === "2026-07-31");

console.log("\nday rotation suggestion:");
const mkDay = (key: string, sort: number) => ({
  id: "day-" + key, plan_id: "p", key, title: key, subtitle: null, sort, est_minutes: 40,
});
const rotation = [mkDay("A", 0), mkDay("B", 1), mkDay("C", 2)];

check("nothing done -> first day in sort order",
  suggestDay(rotation, {}, "2026-07-31")?.day.key === "A");
check("nothing done -> reason is never-done",
  suggestDay(rotation, {}, "2026-07-31")?.reason === "never-done");
check("one day unlogged wins over an old one",
  suggestDay(rotation, { "day-A": "2026-07-01", "day-B": "2026-07-30" }, "2026-07-31")
    ?.day.key === "C");
check("all done -> longest since",
  suggestDay(rotation,
    { "day-A": "2026-07-29", "day-B": "2026-07-20", "day-C": "2026-07-30" },
    "2026-07-31")?.day.key === "B");
check("tie broken by sort order",
  suggestDay(rotation,
    { "day-A": "2026-07-25", "day-B": "2026-07-25", "day-C": "2026-07-25" },
    "2026-07-31")?.day.key === "A");
check("lastAgoDays reported", suggestDay(rotation,
  { "day-A": "2026-07-29", "day-B": "2026-07-20", "day-C": "2026-07-30" },
  "2026-07-31")?.lastAgoDays === 11);
check("empty plan -> null", suggestDay([], {}, "2026-07-31") === null);

console.log("\ngreeting:");
check("6am -> morning", greetingFor(6) === "Good morning");
check("noon -> afternoon", greetingFor(12) === "Good afternoon");
check("6pm -> evening", greetingFor(18) === "Good evening");
check("1am counts as evening, not morning", greetingFor(1) === "Good evening");

console.log("\nbuild rotation:");
const mkBuild = (id: string, sort: number, fb = false) => ({ id, sort, is_fallback: fb });
const bowls = [mkBuild("A", 1), mkBuild("B", 2), mkBuild("C", 3), mkBuild("FALLBACK", 9, true)];

check("nothing eaten -> first bowl", suggestBuild(bowls, {}, "2026-07-31")?.buildId === "A");
check("fallbacks are never suggested",
  suggestBuild([mkBuild("FALLBACK", 9, true), mkBuild("A", 1)], {}, "2026-07-31")?.buildId === "A");
check("only fallbacks -> nothing to suggest",
  suggestBuild([mkBuild("FALLBACK", 9, true)], {}, "2026-07-31") === null);
check("longest since wins",
  suggestBuild(bowls, { A: "2026-07-30", B: "2026-07-20", C: "2026-07-29" }, "2026-07-31")
    ?.buildId === "B");
check("an untouched bowl beats an old one",
  suggestBuild(bowls, { A: "2026-07-01", B: "2026-07-02" }, "2026-07-31")?.buildId === "C");
check("a fallback eaten recently doesn't change the rotation",
  suggestBuild(bowls, { A: "2026-07-30", B: "2026-07-20", C: "2026-07-29", FALLBACK: "2026-07-31" },
    "2026-07-31")?.buildId === "B");

console.log("\nprep sessions:");
// 2026-08-02 is a Sunday.
check("prep day is today", prepDueOn(0, "2026-08-02", undefined) === "today");
check("done today reads as done", prepDueOn(0, "2026-08-02", "2026-08-02") === "done");
check("never done and the day has passed -> overdue",
  prepDueOn(0, "2026-08-04", undefined) === "overdue");
check("done this week -> upcoming, not overdue",
  prepDueOn(0, "2026-08-04", "2026-08-02") === "upcoming");
check("done last week and the day has passed -> overdue",
  prepDueOn(0, "2026-08-04", "2026-07-26") === "overdue");
check("no weekday set -> upcoming", prepDueOn(null, "2026-08-04", undefined) === "upcoming");

console.log("\nsignup validation:");
check("short password rejected",
  validateSignup({ displayName: "Sean", password: "short", confirm: "short" }) !== null);
check("mismatch rejected",
  validateSignup({ displayName: "Sean", password: "longenough1", confirm: "longenough2" }) !== null);
check("one-character name rejected",
  validateSignup({ displayName: "S", password: "longenough1", confirm: "longenough1" }) !== null);
check("whitespace-only name rejected",
  validateSignup({ displayName: "   ", password: "longenough1", confirm: "longenough1" }) !== null);
check("valid signup passes",
  validateSignup({ displayName: "Sean", password: "longenough1", confirm: "longenough1" }) === null);

console.log("\nrecovery validation:");
const q3 = (a: string, b: string, c: string) => [
  { question: "Q1", answer: a }, { question: "Q2", answer: b }, { question: "Q3", answer: c },
];
check("empty everything is rejected, not silently saved",
  validateRecovery({ hint: "", questions: q3("", "", "") }) !== null);
check("hint alone is fine",
  validateRecovery({ hint: "the usual one", questions: q3("", "", "") }) === null);
check("all three answers is fine",
  validateRecovery({ hint: "", questions: q3("Fluffy", "Oak Lane", "Sprout") }) === null);
check("two of three rejected",
  validateRecovery({ hint: "", questions: q3("Fluffy", "Oak Lane", "") }) !== null);
check("duplicate questions rejected", validateRecovery({
  hint: "", questions: [
    { question: "Q1", answer: "a1" }, { question: "Q1", answer: "a2" }, { question: "Q3", answer: "a3" },
  ],
}) !== null);
check("over-long hint rejected",
  validateRecovery({ hint: "x".repeat(201), questions: q3("", "", "") }) !== null);

console.log("\nanswer normalisation (case/space must not lock anyone out):");
check("case ignored", normalizeAnswer("  FLUFFY ") === "fluffy");
check("inner whitespace collapsed", normalizeAnswer("Oak   Lane") === "oak lane");
check("already-normal is unchanged", normalizeAnswer("sprout") === "sprout");

console.log("\nintake:");
check("empty intake lists every required question",
  missingAnswers(GYM_INTAKE, {}).length === GYM_INTAKE.filter((q) => !q.optional).length);
check("optional questions are never required",
  missingAnswers(GYM_INTAKE, {}).every((id) => !GYM_INTAKE.find((q) => q.id === id)?.optional));
check("an empty multi-select still counts as missing",
  missingAnswers(GYM_INTAKE, { goals: [] }).includes("goals"));
check("session length is asked (the gap in the v1 intake)",
  GYM_INTAKE.some((q) => q.id === "session_length"));
check("name is not asked twice",
  !GYM_INTAKE.some((q) => q.id === "name"));
check("weights and inspo image are both optional",
  ["weights", "inspo_image"].every((id) => GYM_INTAKE.find((q) => q.id === id)?.optional));
check("an object answer doesn't read as unanswered",
  !missingAnswers(GYM_INTAKE, { weights: { current: 200, unit: "lb" } }).includes("weights"));

console.log("\nweights:");
check("nothing entered is valid", validateWeights(undefined) === null);
check("empty-but-present is valid", validateWeights({ unit: "lb" }) === null);
check("normal pounds accepted", validateWeights({ current: 210, goal: 185, unit: "lb" }) === null);
check("normal kilos accepted", validateWeights({ current: 95, goal: 84, unit: "kg" }) === null);
check("kg entered while lb selected is caught",
  validateWeights({ current: 4, unit: "lb" }) !== null);
check("absurdly high rejected", validateWeights({ current: 4000, unit: "lb" }) !== null);
check("zero rejected", validateWeights({ current: 0, unit: "lb" }) !== null);
check("negative rejected", validateWeights({ goal: -10, unit: "lb" }) !== null);
check("NaN rejected", validateWeights({ current: Number.NaN, unit: "lb" }) !== null);
check("a goal above current is allowed — people bulk",
  validateWeights({ current: 150, goal: 175, unit: "lb" }) === null);
check("90kg is inside the pound bounds once converted",
  validateWeights({ current: 90, unit: "kg" }) === null);
check("kg conversion is right", Math.round(toPounds(100, "kg")) === 220);
check("lb passes through", toPounds(180, "lb") === 180);

console.log("\nplan reviews:");
const base: ReviewInputs = {
  today: "2026-08-02",
  startedOn: "2026-07-01",
  lastReviewedOn: null,
  reviewAfterWeeks: 8,
  workoutDates: [],
  typicalGapDays: 3,
  topSetsByExercise: {},
};
const withDates = (n: number, from = "2026-07-01") =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(from + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i * 2);
    return d.toISOString().slice(0, 10);
  });

check("a young plan is not due on time",
  timeReview({ ...base, startedOn: "2026-07-01", reviewAfterWeeks: 8 }) === null);
check("an old plan is due",
  timeReview({ ...base, startedOn: "2026-01-01", reviewAfterWeeks: 8 })?.reason === "time");
check("last review resets the clock",
  timeReview({ ...base, startedOn: "2026-01-01", lastReviewedOn: "2026-07-20", reviewAfterWeeks: 8 }) === null);
check("no start date -> no time review",
  timeReview({ ...base, startedOn: null, lastReviewedOn: null }) === null);

const flat = { name: "Squat", weights: [100, 100, 100, 100] };
const rising = { name: "Bench", weights: [60, 62.5, 65, 67.5] };
const falling = { name: "Row", weights: [80, 80, 75, 75] };

check("one flat lift is not a stall — plateaus are normal",
  stalledReview({ ...base, topSetsByExercise: { a: flat, b: rising } }) === null);
check("two flat lifts is a stall",
  stalledReview({ ...base, topSetsByExercise: { a: flat, b: falling } })?.reason === "stalled");
check("rising lifts never stall",
  stalledReview({ ...base, topSetsByExercise: { a: rising, b: { ...rising, name: "OHP" } } }) === null);
check("too little history to judge a stall",
  stalledReview({ ...base, topSetsByExercise: {
    a: { name: "Squat", weights: [100, 100] }, b: { name: "Row", weights: [80, 80] },
  } }) === null);

check("a brand new plan is never judged on adherence",
  adherenceReview({ ...base, startedOn: "2026-07-28", workoutDates: [] }) === null);
check("training far less than planned fires",
  adherenceReview({ ...base, startedOn: "2026-06-01", workoutDates: ["2026-06-10", "2026-07-15"] })
    ?.reason === "adherence");
check("training as planned does not fire",
  adherenceReview({ ...base, startedOn: "2026-06-01", workoutDates: withDates(28, "2026-06-01") }) === null);
check("training MORE than planned never fires",
  adherenceReview({ ...base, startedOn: "2026-06-01", workoutDates: withDates(40, "2026-06-01") }) === null);

check("a healthy new plan raises nothing at all",
  dueReviews({ ...base, workoutDates: withDates(12), topSetsByExercise: { a: rising } }).length === 0);
check("stall is listed before time",
  dueReviews({ ...base, startedOn: "2026-01-01", topSetsByExercise: { a: flat, b: falling } })[0]
    ?.reason === "stalled");
check("season is never auto-raised",
  !dueReviews({ ...base, startedOn: "2026-01-01" }).some((r) => r.reason === "season"));

console.log(fails === 0 ? "\nAll stats/date checks passed.\n" : `\n${fails} FAILED\n`);
process.exit(fails ? 1 : 0);
