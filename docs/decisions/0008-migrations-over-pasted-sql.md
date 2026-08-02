# 0008 — Migrations, not pasted SQL

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The v2 schema was first handed over as four SQL files to be pasted into the
Supabase web console by hand. They were skipped entirely, and reasonably so — a
multi-step manual ritual with no record of what ran is not a deliverable, it's
homework.

Downstream, this also meant nothing could verify the schema: `verify:db` twice
reported success against a database with no schema loaded.

## Decision

Schema changes are **new migration files** in `supabase/migrations/`, named
`<timestamp>_<description>.sql`, applied with `npm run db:push`. Every new table
gets its RLS policies **in the same migration**. Never edit a migration that has
been applied — `db push` tracks them by filename and won't re-run it.

Schema changes are verified against real Postgres before handover:
`supabase/tools/test/` applies `migrations/*.sql` in filename order, exactly as
`db push` does, against a stub of Supabase's auth schema, then runs assertions.
The stub is test-only and lives **outside** `migrations/` so `db push` never
sees it.

## Consequences

- The schema is reproducible from the repo, and `supabase/config.toml` is
  committed so `supabase link` works without `init` (commit `0f0e8ae`).
- Migrations are append-only, so a mistake costs a follow-up migration rather
  than an edit. That's the point.
- A GitHub Action running `db push` on merge to `main` is the obvious next step;
  the secrets are already set.

The broader rule this encodes: **hand off runnable things, not instructions.**
And its companion — **verification that can't fail isn't verification.** The
harness exists because `verify:db` was more confident than correct, twice.

## Alternatives considered

- **The Supabase web console as source of truth** — no history, no review, no
  local test, and no way to stand up a second environment.
- **A single `schema.sql` reapplied on change** — fine until there is data.
  There is data.
