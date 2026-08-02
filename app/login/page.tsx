"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { login, signup, type AuthResult } from "./actions";
import { MIN_PASSWORD, validateSignup } from "@/lib/validate";

const FIELD =
  "w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-ink placeholder:text-faint";

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-3 font-bold text-bg disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  // useFormState was renamed useActionState in React 19; the old import still
  // works but is deprecated and warns.
  const [loginState, loginAction] = useActionState<AuthResult, FormData>(login, null);
  const [signupState, signupAction] = useActionState<AuthResult, FormData>(signup, null);

  // Local mirrors, only so the form can warn before submitting. The server
  // action re-checks all of this — see lib/validate.ts.
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const isSignup = mode === "signup";
  const serverError = (isSignup ? signupState : loginState)?.error ?? null;

  // Only nag once they've actually typed a confirmation.
  const localProblem =
    isSignup && confirm ? validateSignup({ displayName, password, confirm }) : null;
  const mismatch = isSignup && confirm.length > 0 && password !== confirm;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <div className="text-4xl">🏋️</div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Streakproof</h1>
        <p className="mt-1 text-sm text-muted">
          {isSignup ? "Create your account" : "Sign in to your plan"}
        </p>
      </div>

      <form
        action={isSignup ? signupAction : loginAction}
        className="space-y-3 rounded-2xl border border-line bg-panel p-5 shadow-xl"
      >
        {isSignup && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">
              Name or username
            </span>
            <input
              name="display_name"
              type="text"
              required
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="What should we call you?"
              className={FIELD}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">
            Email address
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={isSignup ? MIN_PASSWORD : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            onChange={isSignup ? (e) => setPassword(e.target.value) : undefined}
            placeholder={
              isSignup ? `At least ${MIN_PASSWORD} characters` : "Your password"
            }
            className={FIELD}
          />
        </label>

        {isSignup && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">
              Confirm password
            </span>
            <input
              name="confirm_password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
              className={
                FIELD + (mismatch ? " border-hot" : confirm ? " border-accent" : "")
              }
              aria-invalid={mismatch || undefined}
            />
          </label>
        )}

        {(serverError || localProblem) && (
          <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
            {serverError ?? localProblem}
          </p>
        )}

        <SubmitButton
          label={isSignup ? "Create account" : "Sign in"}
          disabled={!!localProblem}
        />
      </form>

      <button
        onClick={() => setMode(isSignup ? "signin" : "signup")}
        className="mt-4 text-center text-sm text-accent2"
      >
        {isSignup ? "Already have an account? Sign in" : "Need an account? Create one"}
      </button>

      {!isSignup && (
        <a href="/recovery/reset" className="mt-3 text-center text-sm text-faint">
          Forgotten your password?
        </a>
      )}
    </main>
  );
}
