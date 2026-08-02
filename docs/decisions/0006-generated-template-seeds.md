# 0006 — Templates are generated, not hand-written

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The seeded template library is ~26KB of SQL across three plans (2 gym, 1 food),
with days, exercises, food items, builds and prep tasks hanging off each. Hand
maintaining insert statements at that size means every edit is a chance to
mis-key a foreign key or drop a `sort` value, and none of it is reviewable.

## Decision

Templates are defined in `supabase/tools/gen_seed.py` and the migration is
generated: `npm run seed:gen`. Never hand-edit the generated migration. If the
template migration has **already been applied**, edit the generator and write a
**new** migration for the delta — `db push` tracks migrations by filename and
will not re-run one it has seen.

## Consequences

- Template content is reviewable as data rather than as SQL.
- Adds a Python dependency to the toolchain for one script. Accepted; it is
  developer-only and never runs in CI or on Vercel.
- The generator's output is deterministic, so regenerating and diffing is a
  meaningful check.
- Python bytecode from the generator is gitignored (commit `0606a86`).

## Alternatives considered

- **Seeding through the app** — templates would then depend on the app being
  deployed and on a signed-in user, and would be invisible to the SQL test
  harness.
- **A JSON file read at runtime** — moves reference data out of Postgres, so RLS
  and `clone_plan()` stop applying to it uniformly.
