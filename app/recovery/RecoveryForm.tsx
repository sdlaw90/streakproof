"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { saveRecovery, type RecoveryResult } from "./actions";
import { SECURITY_QUESTIONS } from "@/lib/questions";
import { SECURITY_QUESTION_COUNT } from "@/lib/validate";

const FIELD =
  "w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-ink placeholder:text-faint";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-3 font-bold text-bg disabled:opacity-60"
    >
      {pending ? "…" : "Save recovery details"}
    </button>
  );
}

export default function RecoveryForm({ isNew }: { isNew: boolean }) {
  const router = useRouter();
  const [state, action] = useActionState<RecoveryResult | null, FormData>(
    saveRecovery,
    null
  );
  const [wantQuestions, setWantQuestions] = useState(false);

  // Default each dropdown to a different question so the "pick three different
  // ones" rule is satisfied without the user having to think about it.
  const [picked, setPicked] = useState<string[]>(
    SECURITY_QUESTIONS.slice(0, SECURITY_QUESTION_COUNT) as unknown as string[]
  );

  if (state?.ok) {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/10 p-5 text-center">
        <p className="font-semibold text-accent">Saved.</p>
        <p className="mt-1 text-sm text-muted">
          You can change these any time from the account menu.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 w-full rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-3 font-bold text-bg"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <>
      <form action={action} className="space-y-4 rounded-2xl border border-line bg-panel p-5">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Password hint</span>
          <span className="mb-2 block text-xs text-faint">
            Something that jogs your memory but wouldn&rsquo;t help a stranger. Not
            the password itself.
          </span>
          <input
            name="hint"
            type="text"
            maxLength={200}
            placeholder="e.g. the usual one, but angrier"
            className={FIELD}
          />
        </label>

        <div className="border-t border-line pt-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={wantQuestions}
              onChange={(e) => setWantQuestions(e.target.checked)}
              className="mt-1 size-4 accent-accent"
            />
            <span>
              <span className="block text-sm font-semibold">
                Also set security questions
              </span>
              <span className="block text-xs text-faint">
                Three questions. Answering all three lets you reset your password
                without email.
              </span>
            </span>
          </label>
        </div>

        {wantQuestions && (
          <div className="space-y-4">
            {Array.from({ length: SECURITY_QUESTION_COUNT }, (_, idx) => {
              const i = idx + 1;
              const others = picked.filter((_, j) => j !== idx);
              return (
                <div key={i} className="rounded-xl border border-line bg-panel2 p-3">
                  <select
                    name={`question_${i}`}
                    value={picked[idx]}
                    onChange={(e) => {
                      const next = [...picked];
                      next[idx] = e.target.value;
                      setPicked(next);
                    }}
                    className="w-full rounded-lg border border-line bg-panel px-2 py-2 text-sm text-ink"
                  >
                    {SECURITY_QUESTIONS.filter(
                      (q) => q === picked[idx] || !others.includes(q)
                    ).map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                  <input
                    name={`answer_${i}`}
                    type="text"
                    autoComplete="off"
                    placeholder="Your answer"
                    className={FIELD + " mt-2"}
                  />
                </div>
              );
            })}
            <p className="text-xs text-faint">
              Capitals and extra spaces don&rsquo;t matter. Answers are hashed, so
              nobody — including us — can read them back.
            </p>
          </div>
        )}

        {state?.error && (
          <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
            {state.error}
          </p>
        )}

        <Save />
      </form>

      <button
        onClick={() => router.push(isNew ? "/setup" : "/")}
        className="mt-4 w-full text-center text-sm text-faint"
      >
        {isNew ? "Skip for now" : "Back"}
      </button>
    </>
  );
}
