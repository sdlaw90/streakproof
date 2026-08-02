# 0009 — "Never miss twice" uses the user's own median gap

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

v1 rendered a static gold line when `lastAgoDays >= 3`, against a
week-granularity streak. For someone training four times a week that's a useful
nudge. For someone training once a week it fires every single week, for doing
exactly what they planned to do — which is the shaming mechanic the product
exists to avoid.

"Never miss twice" is the best rule in the underlying plan, and the app barely
implemented it.

## Decision

The check compares the current gap against the **user's own median gap**,
computed from `sessions`. A fixed threshold is never used.

## Consequences

- The nudge scales with whatever the user actually does, including as that
  changes over a season, without any setting to configure — which is itself the
  point: no decisions at the point of need.
- Needs enough history to have a median. New users get no nudge until there is
  one, which is correct — nagging someone in week one is how this fails.
- The logic is a pure function beside `lib/stats.ts` with no DB access, unit
  tested without a database, along with the rest of the streak logic.

This is the concrete implementation of the **forgiveness, not streaks**
principle in `CLAUDE.md`. Any mechanic that shames a gap is a bug, and a fixed
threshold is one.

## Alternatives considered

- **A user-set training frequency** — a decision asked of the user, and it goes
  stale the moment life changes. The data already answers the question.
- **A fixed threshold per plan** — better than global, still wrong for the same
  person in a busy month.
