"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  lookupRecoveryQuestions,
  resetWithToken,
  verifyAnswers,
  type ResetResult,
  type VerifyResult,
} from "../actions";
import { MIN_PASSWORD } from "@/lib/validate";

const FIELD =
  "w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-ink placeholder:text-faint";

type Question = { position: number; question: string };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-3 font-bold text-bg disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

/**
 * Three steps: email → questions → new password.
 *
 * The split matters. Asking for the answers and the password on one form means
 * you only learn the answers were wrong after choosing a password, which is the
 * wrong order for someone already locked out. Step two hands back a single-use
 * token that step three spends.
 */
export default function ResetForm() {
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [lookupPending, startLookup] = useTransition();

  const [verifyState, verifyAction] = useActionState<VerifyResult | null, FormData>(
    verifyAnswers,
    null
  );
  const [resetState, resetAction] = useActionState<ResetResult | null, FormData>(
    resetWithToken,
    null
  );

  // ---- Step 3: verified, choose a password -------------------------------
  if (verifyState?.ok && verifyState.token) {
    return (
      <form action={resetAction} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <input type="hidden" name="token" value={verifyState.token} />

        <div className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5">
          <p className="text-sm font-semibold text-accent">Answers matched.</p>
          <p className="mt-0.5 text-xs text-muted">
            Choose a new password. This expires in ten minutes.
          </p>
        </div>

        {verifyState.hint && (
          <div className="rounded-xl border border-line bg-panel2 px-3 py-2.5">
            <p className="text-xs font-semibold text-gold">Your hint</p>
            <p className="mt-0.5 text-sm text-muted">{verifyState.hint}</p>
            <Link href="/login" className="mt-1.5 inline-block text-xs text-accent2">
              Remembered it? Sign in instead
            </Link>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">New password</span>
          <input
            name="password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            placeholder={`At least ${MIN_PASSWORD} characters`}
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">
            Confirm new password
          </span>
          <input
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Type it again"
            className={FIELD}
          />
        </label>

        {resetState?.error && (
          <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
            {resetState.error}
          </p>
        )}

        <Submit label="Set new password" />
      </form>
    );
  }

  // ---- Step 1: which account? --------------------------------------------
  if (!questions) {
    return (
      <div className="space-y-3 rounded-2xl border border-line bg-panel p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">
            Email address
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={FIELD}
          />
        </label>

        <button
          type="button"
          disabled={!email || lookupPending}
          onClick={() =>
            startLookup(async () => {
              setQuestions(await lookupRecoveryQuestions(email));
            })
          }
          className="w-full rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-3 font-bold text-bg disabled:opacity-60"
        >
          {lookupPending ? "…" : "Continue"}
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    // Same message whether the account doesn't exist or never set questions up.
    return (
      <div className="rounded-2xl border border-line bg-panel p-5">
        <p className="text-sm text-muted">
          We can&rsquo;t reset that account this way — either it doesn&rsquo;t
          exist or it has no security questions set up.
        </p>
        <Link href="/login" className="mt-4 block text-sm text-accent2">
          Back to sign in
        </Link>
      </div>
    );
  }

  // ---- Step 2: the questions ---------------------------------------------
  return (
    <form action={verifyAction} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
      <input type="hidden" name="email" value={email} />

      {questions.map((q) => (
        <label key={q.position} className="block">
          <span className="mb-1 block text-sm font-semibold">{q.question}</span>
          <input
            name={`answer_${q.position}`}
            type="text"
            required
            autoComplete="off"
            className={FIELD}
          />
        </label>
      ))}

      {verifyState?.error && (
        <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
          {verifyState.error}
        </p>
      )}

      <Submit label="Check my answers" />

      <p className="text-center text-xs text-faint">
        Five attempts an hour. Capitals and spacing don&rsquo;t matter.
      </p>
    </form>
  );
}
