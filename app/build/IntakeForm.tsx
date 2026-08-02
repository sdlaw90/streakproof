"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveIntake, type IntakeResult } from "./actions";
import ImageUpload from "./ImageUpload";
import {
  GYM_INTAKE,
  missingAnswers,
  validateWeights,
  type ImageAnswer,
  type IntakeAnswers,
  type IntakeQuestion,
  type WeightAnswer,
} from "@/lib/intake";

const FIELD =
  "w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-ink placeholder:text-faint";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="w-full rounded-xl bg-linear-to-r from-accent2 to-accent px-4 py-4 font-bold text-bg disabled:opacity-50"
    >
      {pending ? "…" : "Save my answers"}
    </button>
  );
}

function Option({
  name,
  value,
  type,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  type: "radio" | "checkbox";
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition " +
        (checked
          ? "border-accent bg-accent/10"
          : "border-line bg-panel2 hover:border-faint")
      }
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-accent"
      />
      {value}
    </label>
  );
}

export default function IntakeForm() {
  const [state, action] = useActionState<IntakeResult | null, FormData>(
    saveIntake,
    null
  );
  const [answers, setAnswers] = useState<IntakeAnswers>({});

  const set = (id: string, value: IntakeAnswers[string]) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const toggle = (id: string, value: string) => {
    const current = (answers[id] as string[]) ?? [];
    set(
      id,
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  };

  const weightProblem = validateWeights(answers.weights as WeightAnswer | undefined);
  const missing = missingAnswers(GYM_INTAKE, answers);
  const answered = GYM_INTAKE.filter((q) => !q.optional).length - missing.length;
  const required = GYM_INTAKE.filter((q) => !q.optional).length;

  return (
    <form action={action} className="space-y-4">
      <div className="sticky top-0 z-10 -mx-5 bg-bg/95 px-5 py-3 backdrop-blur">
        <div className="h-1.5 overflow-hidden rounded-full bg-panel2">
          <div
            className="h-full rounded-full bg-linear-to-r from-accent2 to-accent transition-all"
            style={{ width: `${(answered / required) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-faint">
          {answered} of {required} answered
        </p>
      </div>

      {GYM_INTAKE.map((q, i) => (
        <Question
          key={q.id}
          q={q}
          index={i + 1}
          answers={answers}
          onSet={set}
          onToggle={toggle}
        />
      ))}

      {/* Objects can't ride along as form fields, so they're serialised here. */}
      <input type="hidden" name="weights_json" value={JSON.stringify(answers.weights ?? null)} />
      <input type="hidden" name="image_json" value={JSON.stringify(answers.inspo_image ?? null)} />

      {(state?.error || weightProblem) && (
        <p className="rounded-lg bg-hot/10 px-3 py-2 text-sm text-hot" role="alert">
          {state?.error ?? weightProblem}
        </p>
      )}

      <Submit disabled={missing.length > 0 || !!weightProblem} />

      {missing.length > 0 && (
        <p className="text-center text-xs text-faint">
          {missing.length} required question{missing.length === 1 ? "" : "s"} left.
        </p>
      )}
    </form>
  );
}

function Question({
  q,
  index,
  answers,
  onSet,
  onToggle,
}: {
  q: IntakeQuestion;
  index: number;
  answers: IntakeAnswers;
  onSet: (id: string, value: IntakeAnswers[string]) => void;
  onToggle: (id: string, value: string) => void;
}) {
  const value = answers[q.id];

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <p className="font-semibold">
        <span className="mr-2 text-accent">{index}</span>
        {q.prompt}
        {q.optional && (
          <span className="ml-2 text-xs font-normal text-faint">optional</span>
        )}
      </p>
      {q.hint && <p className="mt-1 mb-3 text-xs text-faint">{q.hint}</p>}
      {!q.hint && <div className="mb-3" />}

      {q.kind === "single" && (
        <div className="flex flex-col gap-2">
          {q.options?.map((opt) => (
            <Option
              key={opt}
              name={q.id}
              value={opt}
              type="radio"
              checked={value === opt}
              onChange={() => onSet(q.id, opt)}
            />
          ))}
        </div>
      )}

      {q.kind === "multi" && (
        <div className="flex flex-col gap-2">
          {q.options?.map((opt) => (
            <Option
              key={opt}
              name={q.id}
              value={opt}
              type="checkbox"
              checked={((value as string[]) ?? []).includes(opt)}
              onChange={() => onToggle(q.id, opt)}
            />
          ))}
        </div>
      )}

      {q.kind === "text" && (
        <input
          name={q.id}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onSet(q.id, e.target.value)}
          placeholder={q.placeholder}
          className={FIELD}
        />
      )}

      {q.kind === "weights" && (
        <Weights
          value={(value as WeightAnswer) ?? { unit: "lb" }}
          onChange={(v) => onSet(q.id, v)}
        />
      )}

      {q.kind === "image" && (
        <ImageUpload
          value={value as ImageAnswer | undefined}
          onChange={(v) => onSet(q.id, v)}
        />
      )}

      {q.kind === "longtext" && (
        <textarea
          name={q.id}
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => onSet(q.id, e.target.value)}
          placeholder={q.placeholder}
          className={FIELD}
        />
      )}
    </div>
  );
}

function Weights({
  value,
  onChange,
}: {
  value: WeightAnswer;
  onChange: (v: WeightAnswer) => void;
}) {
  const num = (s: string): number | undefined => {
    const t = s.trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["lb", "kg"] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => onChange({ ...value, unit: u })}
            className={
              "rounded-lg border px-3 py-1.5 text-sm font-semibold transition " +
              (value.unit === u
                ? "border-accent bg-accent/10 text-accent"
                : "border-line bg-panel2 text-muted")
            }
          >
            {u}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Current</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step="0.1"
            value={value.current ?? ""}
            onChange={(e) => onChange({ ...value, current: num(e.target.value) })}
            placeholder={value.unit}
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Goal</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step="0.1"
            value={value.goal ?? ""}
            onChange={(e) => onChange({ ...value, goal: num(e.target.value) })}
            placeholder={value.unit}
            className={FIELD}
          />
        </label>
      </div>
    </div>
  );
}
