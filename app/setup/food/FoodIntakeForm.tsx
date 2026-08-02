"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFoodIntake } from "@/app/food/actions";
import {
  ALLERGENS,
  CUISINES,
  emptyFoodIntake,
  validateFoodIntake,
  type FoodIntake,
} from "@/lib/food-intake";

const FIELD =
  "w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-ink placeholder:text-faint";

export default function FoodIntakeForm({
  initial,
  onDone,
}: {
  initial: FoodIntake | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1>(0);
  const [intake, setIntake] = useState<FoodIntake>(initial ?? emptyFoodIntake());

  const toggle = (key: "cuisines" | "allergens", id: string) =>
    setIntake((prev) => ({
      ...prev,
      [key]: prev[key].includes(id)
        ? prev[key].filter((x) => x !== id)
        : [...prev[key], id],
    }));

  const problem = validateFoodIntake(intake);

  function save() {
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    start(async () => {
      const res = await saveFoodIntake(intake);
      if (!res.ok) setError(res.error ?? "That didn't save.");
      else {
        onDone?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {[0, 1].map((i) => (
          <span
            key={i}
            className={
              "h-1 flex-1 rounded-full " + (i <= step ? "bg-accent" : "bg-panel2")
            }
          />
        ))}
      </div>

      {step === 0 && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-semibold">What do you actually like eating?</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Pick as many as you want. The base stays boring on purpose — these
            decide the sauces, and the sauce is what stops it getting old.
          </p>

          <div className="space-y-2">
            {CUISINES.map((c) => {
              const on = intake.cuisines.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle("cuisines", c.id)}
                  className={
                    "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition " +
                    (on
                      ? "border-accent bg-accent/10"
                      : "border-line bg-panel2 hover:border-faint")
                  }
                >
                  <span
                    className={
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border text-xs " +
                      (on ? "border-accent bg-accent text-bg" : "border-line")
                    }
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{c.label}</span>
                    <span className="block text-xs text-faint">{c.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-semibold">
              Anything you want written in by name?
            </span>
            <span className="mb-2 block text-xs text-faint">
              Real cheese, white rice not brown, ranch, the pizza after dodgeball.
              If it&rsquo;s what gets the vegetables eaten, it belongs in the plan.
            </span>
            <textarea
              rows={2}
              value={intake.favouritesNote}
              maxLength={500}
              onChange={(e) =>
                setIntake((p) => ({ ...p, favouritesNote: e.target.value }))
              }
              placeholder="Optional…"
              className={FIELD}
            />
          </label>

          <button
            onClick={() => setStep(1)}
            disabled={!intake.cuisines.length}
            className="mt-4 w-full rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-3 font-bold text-bg disabled:opacity-50"
          >
            Next
          </button>
          {!intake.cuisines.length && (
            <p className="mt-2 text-center text-xs text-faint">
              Pick at least one.
            </p>
          )}
        </section>
      )}

      {step === 1 && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-semibold">Anything you can&rsquo;t eat?</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Tick what applies. Nothing here is required — skip it if none of it
            is relevant.
          </p>

          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => {
              const on = intake.allergens.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggle("allergens", a.id)}
                  className={
                    "rounded-full border px-3 py-2 text-sm transition " +
                    (on
                      ? "border-hot bg-hot/15 font-semibold text-hot"
                      : "border-line bg-panel2 text-muted hover:border-faint")
                  }
                >
                  {on ? "✕ " : "+ "}
                  {a.label}
                </button>
              );
            })}
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-semibold">
              Anything else to avoid?
            </span>
            <span className="mb-2 block text-xs text-faint">
              Intolerances, things you just hate, foods that are off the table
              for any other reason.
            </span>
            <textarea
              rows={2}
              value={intake.avoidNote}
              maxLength={500}
              onChange={(e) => setIntake((p) => ({ ...p, avoidNote: e.target.value }))}
              placeholder="Optional…"
              className={FIELD}
            />
          </label>

          {intake.allergens.length > 0 && (
            <p className="mt-4 rounded-xl border border-hot/40 bg-hot/10 px-3 py-2.5 text-xs text-hot">
              <span className="font-bold">Read this bit.</span> Streakproof will
              flag ingredients whose names look like they contain these, so you
              can spot them quickly. It matches words in a name — it cannot read
              a label, it will not catch everything, and it is not a safety
              check. Check anything you&rsquo;re allergic to yourself.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
              {error}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setStep(0)}
              className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted"
            >
              Back
            </button>
            <button
              onClick={save}
              disabled={pending}
              className="flex-1 rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-3 font-bold text-bg disabled:opacity-60"
            >
              {pending ? "…" : "Save and see plans"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
