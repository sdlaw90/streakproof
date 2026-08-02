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

  // Controlled, so a wrong answer doesn't wipe the other two.
  //
  // React 19 resets an uncontrolled form once its action completes. That's
  // usually what you want; here it means one typo costs the user all three
  // answers, and they only get five attempts an hour. Someone locked out of
  // their account is the last person who should be retyping things.
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [step, setStep] = useState(0);
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

  // ---- Step 2: the questions, one at a time ------------------------------
  //
  // All three are asked; two must be right. Presenting them one per screen is
  // purely presentational — nothing is checked until the whole set is
  // submitted, because per-question feedback would let each answer be attacked
  // on its own. See docs/decisions/0012.
  const total = questions.length;
  const q = questions[step];
  const filled = questions.filter(
    (x) => (answers[x.position] ?? "").trim().length > 0
  ).length;
  const canSubmit = filled >= 2;

  return (
    <form action={verifyAction} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
      <input type="hidden" name="email" value={email} />

      {/* Every answer stays in the payload, including the ones not on screen. */}
      {questions.map((x) => (
        <input
          key={x.position}
          type="hidden"
          name={`answer_${x.position}`}
          value={answers[x.position] ?? ""}
        />
      ))}

      <div className="flex items-center justify-between text-xs text-faint">
        <span>
          Question {step + 1} of {total}
        </span>
        <span>{filled} answered</span>
      </div>

      <div className="flex gap-1.5">
        {questions.map((x, i) => (
          <span
            key={x.position}
            className={
              "h-1 flex-1 rounded-full " +
              (i === step
                ? "bg-accent"
                : (answers[x.position] ?? "").trim()
                  ? "bg-accent/40"
                  : "bg-panel2")
            }
          />
        ))}
      </div>

      <label className="block">
        <span className="mb-2 block text-base font-semibold">{q.question}</span>
        <input
          type="text"
          autoComplete="off"
          autoFocus
          value={answers[q.position] ?? ""}
          onChange={(e) =>
            setAnswers((prev) => ({ ...prev, [q.position]: e.target.value }))
          }
          onKeyDown={(e) => {
            // Enter advances rather than submitting a half-filled form.
            if (e.key === "Enter" && step < total - 1) {
              e.preventDefault();
              setStep(step + 1);
            }
          }}
          className={FIELD}
        />
        <span className="mt-1.5 block text-xs text-faint">
          Can&rsquo;t remember this one? Leave it blank — you need two of three.
        </span>
      </label>

      {verifyState?.error && (
        <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
          {verifyState.error}
        </p>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted"
          >
            Back
          </button>
        )}

        {step < total - 1 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="flex-1 rounded-xl border border-accent2 px-4 py-3 font-semibold text-accent2"
          >
            Next
          </button>
        ) : (
          <div className="flex-1">
            <Submit label="Check my answers" />
          </div>
        )}
      </div>

      {step === total - 1 && !canSubmit && (
        <p className="text-center text-xs text-faint">
          Answer at least two of the three.
        </p>
      )}

      <p className="text-center text-xs text-faint">
        Five attempts an hour. Capitals and spacing don&rsquo;t matter.
      </p>
    </form>
  );
}
