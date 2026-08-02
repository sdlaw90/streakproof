# 0007 — Server actions return `{ ok, error }`

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The same bug shipped twice. `persist()` in `Tracker.tsx` awaited `saveSet`
inside a transition and discarded the result; `app/program/actions.ts` returned
void and threw away the Supabase error. In both cases a failed write left the
value on screen looking saved.

This app is used on gym wifi. A write failing is the expected case, not the
exceptional one, and the failure mode — data that looks saved and isn't — is the
worst one available, because the user has no reason to retry.

## Decision

Every server action returns `{ ok, error }` and every caller surfaces the
failure. Never swallow a write error.

When surfacing a failure, **do not** call `router.refresh()`. Refreshing
replaces the inputs with the server's unchanged values and destroys exactly what
the user just typed — turning a recoverable failure into lost work.

## Consequences

- Each write surface needs a visible unsaved/retry state. `Tracker` does this
  per row; `ProgramEditor` shows a Retry banner.
- Slightly more ceremony at every call site, permanently.
- A related client-side trap, worth naming here because it has the same
  symptom of "the UI is lying about the data": a client component seeding state
  from props in a `useState` initializer needs a `key` tied to whatever the
  props are keyed on. Same-route navigation (`?date=…`) keeps the instance
  alive, the initializer never re-runs, and the component shows stale data —
  which is what `<Tracker key={activeDate}>` exists to prevent.

## Alternatives considered

- **Throwing and catching at a boundary** — Next's error boundaries unmount the
  form, which loses the typed values, which is the thing being protected.
- **Optimistic UI with background retry** — better UX eventually, but it needs a
  queue and conflict handling. Not worth it for two users.
