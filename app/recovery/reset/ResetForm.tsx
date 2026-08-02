"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { lookupRecoveryQuestions, resetWithAnswers, type ResetResult } from "../actions";
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

export default function ResetForm() {
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [lookupPending, startLookup] = useTransition();
  const [state, action] = useActionState<ResetResult | null, FormData>(
    resetWithAnswers,
    null
  );

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
    // Telling them apart would make this a way to test whether an email has an
    // account here.
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

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
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

      <div className="border-t border-line pt-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">
            New password
          </span>
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
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted">
            Confirm new password
          </span>
          <input
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            className={FIELD}
          />
        </label>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
          {state.error}
        </p>
      )}

      <Submit label="Set new password" />

      <p className="text-center text-xs text-faint">
        Five attempts an hour. Capitals and spacing don&rsquo;t matter.
      </p>
    </form>
  );
}
