"use client";

/**
 * Right-edge account drawer, modelled on SquirreLingo's NavDrawer.
 *
 * Differences from that original, all deliberate:
 * - The panel stays MOUNTED and slides via `translate-x`, so it animates out as
 *   well as in. SquirreLingo conditionally mounts, which gives it no exit.
 * - Adds the modal semantics that one is missing: `role="dialog"`,
 *   `aria-modal`, focus moved in on open and restored to the trigger on close,
 *   and a body scroll lock.
 * - Navigation lives in BottomNav, not here. This drawer is account + plan
 *   editing only — see docs/decisions/0010.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  label: string;
  hint?: string;
  icon: string;
  href?: string;
  soon?: boolean;
};

const PLAN_ITEMS: Item[] = [
  { label: "Edit your plan", hint: "Days, exercises, timing", icon: "⚙️", href: "/program" },
  { label: "Switch plan", hint: "Start from a different template", icon: "🔁", href: "/setup" },
  { label: "Food plan", hint: "Coming soon", icon: "🥗", soon: true },
];

function initialOf(name: string): string {
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

export default function UserDrawer({
  displayName,
  email,
  timezone,
  planName,
}: {
  displayName: string;
  email: string | null;
  timezone: string;
  planName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Put focus back where it came from, or the drawer strands the keyboard.
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    // Scroll lock. Restoring the exact previous value matters — the home page
    // may itself have set it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  // Close before navigating, so returning via the back button doesn't land on
  // an open drawer.
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open account menu"
        aria-expanded={open}
        className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-panel2 text-sm font-bold text-accent transition hover:border-accent"
      >
        {initialOf(displayName)}
      </button>

      {/* Scrim. Kept mounted so it can fade; pointer-events off when closed. */}
      <div
        onClick={close}
        aria-hidden="true"
        className={
          // z-50 / z-[60] deliberately: BottomNav is z-40, and at equal z-index
          // DOM order wins — the nav renders after <main>, so a z-40 scrim left
          // the tab bar undimmed and clickable underneath the open drawer.
          "fixed inset-0 z-50 bg-black/70 transition-opacity duration-200 motion-reduce:transition-none " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
        tabIndex={-1}
        className={
          "fixed inset-y-0 right-0 z-[60] flex w-[min(360px,88vw)] flex-col border-l border-line bg-panel shadow-[-8px_0_30px_rgba(0,0,0,0.45)] outline-none transition-transform duration-200 ease-out motion-reduce:transition-none " +
          (open ? "translate-x-0" : "translate-x-full")
        }
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-panel2 text-sm font-bold text-accent">
              {initialOf(displayName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{displayName}</span>
              {email && (
                <span className="block truncate text-xs text-faint">{email}</span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close account menu"
            className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-panel2 text-muted transition hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
            Plan
          </p>
          {planName && (
            <p className="mb-3 truncate text-sm text-muted">{planName}</p>
          )}
          <div className="flex flex-col gap-1">
            {PLAN_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.soon}
                onClick={() => item.href && go(item.href)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-panel2 disabled:opacity-45 disabled:hover:bg-transparent"
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  {item.hint && (
                    <span className="block text-xs text-faint">{item.hint}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="my-4 h-px bg-line" />

          <p className="mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
            Account
          </p>
          <dl className="mb-4 space-y-1 px-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-faint">Time zone</dt>
              <dd className="truncate text-muted">{timezone}</dd>
            </div>
          </dl>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full rounded-xl border border-line px-3 py-3 text-sm font-semibold text-hot transition hover:border-hot"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </>
  );
}
