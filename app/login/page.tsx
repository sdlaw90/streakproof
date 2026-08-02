"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { login, signup } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-gradient-to-r from-accent2 to-accent px-4 py-3 font-bold text-bg disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loginState, loginAction] = useFormState(login, null as null | { error: string });
  const [signupState, signupAction] = useFormState(signup, null as null | { error: string });

  const state = mode === "signin" ? loginState : signupState;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <div className="text-4xl">🏋️</div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Gym Tracker</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "signin" ? "Sign in to your plan" : "Create your account"}
        </p>
      </div>

      <form
        action={mode === "signin" ? loginAction : signupAction}
        className="space-y-3 rounded-2xl border border-line bg-panel p-5 shadow-xl"
      >
        {mode === "signup" && (
          <input
            name="display_name"
            type="text"
            placeholder="Your name"
            className="w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-ink placeholder:text-faint"
          />
        )}
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          className="w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-ink placeholder:text-faint"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password"
          className="w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-ink placeholder:text-faint"
        />

        {state?.error && (
          <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot">{state.error}</p>
        )}

        <SubmitButton label={mode === "signin" ? "Sign in" : "Create account"} />
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 text-center text-sm text-accent2"
      >
        {mode === "signin"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
