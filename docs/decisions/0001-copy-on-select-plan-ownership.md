# 0001 — Copy-on-select plan ownership

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

v1 modelled a program as shared mutable reference data with a single owner:
`profiles.program_id` was one column, and the first user to pick a program had
their `owner_id` written onto it permanently. Nobody else could then use that
program, and editing it would have edited it for everyone.

Two things this made impossible, both of them roadmap-critical: a user holding
**two** plans at once (which is the entire food side), and any number of users
starting from the **same** template.

## Decision

A plan is either a **template** (`owner_id is null`, `is_template`) or a plan a
user **owns**. Selecting a template calls `clone_plan()`, which deep-copies the
plan and its children, sets `owner_id` to the caller, activates it on the
profile, and returns the new plan id. Nothing is ever claimed. `profiles` holds
one active plan **per `kind`** — `active_gym_plan_id`, `active_food_plan_id`.

## Consequences

- Editing your plan can never affect anyone else's, so the plan editor needs no
  ownership branch — RLS's `owns_plan` covers it.
- The AI builder becomes architecturally cheap: a generated plan is just another
  producer of the shape a template already has, inserted through the same path a
  clone uses.
- `clone_plan()` is now load-bearing and has a specific, quiet failure mode:
  copied `build_items` still pointing at the **template's** `food_items` rather
  than the new copies. The SQL harness asserts against exactly this.
- Templates are duplicated per user, so a template fix does not propagate to
  people who already cloned it. Accepted — that's the same trade as any
  copy-on-write, and a plan silently changing under a user would violate
  "no decisions at the point of need".

**Do not reintroduce shared mutable reference data.** That is the specific
mistake this replaced.

## Alternatives considered

- **Shared programs with a fork button** — same as v1 plus a workaround; leaves
  the "who can edit this" question live forever.
- **Templates as JSON blobs rather than rows** — cheap to clone, but then the
  editor, the estimator and RLS all need a second code path.
