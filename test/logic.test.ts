import { computeStats } from "@/lib/stats";
import { sanitizeLogDate, todayIn, formatISODate } from "@/lib/dates";
import { greetingFor, suggestDay } from "@/lib/suggest";

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

console.log(fails === 0 ? "\nAll stats/date checks passed.\n" : `\n${fails} FAILED\n`);
process.exit(fails ? 1 : 0);
