"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actOnReview, dismissReview } from "@/app/review/actions";

export type OpenReview = {
  id: string;
  reason: string;
  message: string;
  planId: string;
};

const HEADLINE: Record<string, string> = {
  time: "This block has run its length",
  stalled: "A few lifts have gone flat",
  adherence: "The plan and your week don't match",
  season: "Your season changed",
  manual: "You asked for a review",
};

/**
 * A review prompt.
 *
 * Deliberately quiet: one card, two plain options, and dismissing is a
 * first-class choice rather than a hidden ✕. The whole product falls apart if
 * the app starts feeling like something that judges you, and a prompt you can't
 * easily say no to is exactly that.
 */
export default function ReviewCard({
  review,
  today,
}: {
  review: OpenReview;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn().catch((e: unknown) => ({
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
      }));
      if (res.ok) {
        setGone(true);
        router.refresh();
      } else {
        setError(res.error ?? "That didn't save.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-accent2/40 bg-accent2/5 p-4">
      <p className="text-sm font-bold text-accent2">
        {HEADLINE[review.reason] ?? "Worth a look"}
      </p>
      <p className="mt-1 text-sm text-muted">{review.message}</p>

      {error && (
        <p className="mt-3 rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/build"
          onClick={() => run(() => actOnReview(review.id, review.planId, today))}
          className="rounded-xl border border-accent2 px-4 py-2 text-sm font-semibold text-accent2"
        >
          Build a new one
        </Link>
        <Link
          href="/program"
          onClick={() => run(() => actOnReview(review.id, review.planId, today))}
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted"
        >
          Tweak this one
        </Link>
        <button
          onClick={() => run(() => dismissReview(review.id))}
          disabled={pending}
          className="rounded-xl px-4 py-2 text-sm text-faint disabled:opacity-50"
        >
          It&rsquo;s fine as it is
        </button>
      </div>
    </div>
  );
}
