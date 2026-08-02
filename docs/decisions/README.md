# Architecture decision records

Short records of *why* a choice was made, so it doesn't get relitigated or —
worse — silently reversed by someone who only sees the code.

**Write one when a decision is expensive to reverse and non-obvious from the
code.** That's roughly: schema shape, ownership and permission models, anything
about how dates or timezones are handled, platform configuration that isn't in
the repo, and any place where the obvious approach was rejected for a reason.

**Don't write one for** things the code already says plainly, style preferences
(those go in `CLAUDE.md`), or product principles (also `CLAUDE.md` — the
principles are constraints on decisions, not decisions themselves).

## Process

1. Copy `0000-template.md` to `NNNN-short-title.md`, next number, no gaps.
2. Statuses are `Proposed` → `Accepted`, then later `Superseded by NNNN` or
   `Deprecated`. **Never edit an accepted ADR's decision.** Write a new one and
   link both ways; the record of a wrong turn is worth as much as the record of
   the right one.
3. Link the ADR from the `CHANGELOG.md` entry that ships it.

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](0001-copy-on-select-plan-ownership.md) | Copy-on-select plan ownership | Accepted |
| [0002](0002-local-dates-not-utc.md) | Store the user's local date, never UTC | Accepted |
| [0003](0003-separate-food-tables.md) | The food side gets its own tables | Accepted |
| [0004](0004-tracking-mode-overlay.md) | Calorie tracking is an overlay, not a fork | Accepted |
| [0005](0005-vercel-framework-preset.md) | Vercel Framework Preset must be `Next.js` | Accepted |
| [0006](0006-generated-template-seeds.md) | Templates are generated, not hand-written | Accepted |
| [0007](0007-server-actions-return-result.md) | Server actions return `{ ok, error }` | Accepted |
| [0008](0008-migrations-over-pasted-sql.md) | Migrations, not pasted SQL | Accepted |
| [0009](0009-never-miss-twice-median-gap.md) | "Never miss twice" uses the user's own median gap | Accepted |
| [0010](0010-home-is-a-summary.md) | Home is a summary; the day is suggested, not scheduled | Accepted |
| [0011](0011-bottom-nav-plus-account-drawer.md) | Bottom nav for destinations, drawer for account | Accepted |

ADRs 0001–0009 were written on 2 Aug 2026, after the fact, from
`STATEOFPLAY.md` and `docs/V2-CODE-CHANGES.md`. The decisions are real and are
reflected in the shipped code; the *dates* on them are all the same day because
the whole of v2 was.
