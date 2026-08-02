"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addBuild,
  addFoodItem,
  addPrepTask,
  deleteBuild,
  deleteFoodItem,
  deletePrepTask,
  toggleBuildItem,
  updateBuild,
  updateFoodItem,
  updatePrepSession,
  updatePrepTask,
  type EditResult,
} from "@/app/food/edit/actions";
import { allergenLabels } from "@/lib/food-intake";
import type {
  Build,
  BuildItem,
  FoodItem,
  FoodRole,
  PrepSession,
  PrepTask,
} from "@/lib/types";

const ROLES: FoodRole[] = ["protein", "base", "veg", "sauce", "extra"];

const ROLE_LABEL: Record<FoodRole, string> = {
  protein: "Protein",
  base: "Base",
  veg: "Veg",
  sauce: "Sauce",
  extra: "Extras",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const INPUT =
  "w-full rounded-lg border border-line bg-panel2 px-2.5 py-2 text-sm text-ink placeholder:text-faint";

type Tab = "bowls" | "pantry" | "prep";

export default function FoodEditor({
  planId,
  planName,
  items,
  builds,
  buildItems,
  prepSessions,
  prepTasks,
  allergenFlags,
}: {
  planId: string;
  planName: string;
  items: FoodItem[];
  builds: Build[];
  buildItems: BuildItem[];
  prepSessions: PrepSession[];
  prepTasks: PrepTask[];
  /** food_item id -> declared allergens its name looks like it contains. */
  allergenFlags: Record<string, string[]>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("bowls");
  const [openBuild, setOpenBuild] = useState<string | null>(null);

  // The last failed action, so Retry replays it without retyping.
  const lastFailed = useRef<(() => Promise<EditResult>) | null>(null);

  /**
   * On failure we deliberately skip router.refresh() — refreshing replaces the
   * inputs with the server's unchanged values and destroys what was typed.
   * Same reasoning as the gym editor (ADR 0007).
   */
  function run(fn: () => Promise<EditResult>) {
    start(async () => {
      const res: EditResult = await fn().catch((e: unknown) => ({
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
      }));

      if (res.ok) {
        lastFailed.current = null;
        setError(null);
        router.refresh();
      } else {
        lastFailed.current = fn;
        setError(res.error ?? "Save failed");
      }
    });
  }

  const itemsByBuild = new Map<string, Set<string>>();
  for (const bi of buildItems) {
    const set = itemsByBuild.get(bi.build_id) ?? new Set<string>();
    set.add(bi.food_item_id);
    itemsByBuild.set(bi.build_id, set);
  }
  const itemsById = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-hot/40 bg-hot/10 px-3 py-2.5 text-sm">
          <span className="flex-1 text-hot">{error}</span>
          {lastFailed.current && (
            <button
              onClick={() => lastFailed.current && run(lastFailed.current)}
              className="rounded-lg border border-hot/50 px-3 py-1 text-xs font-semibold text-hot"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="flex gap-1 rounded-xl border border-line bg-panel p-1">
        {(["bowls", "pantry", "prep"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition " +
              (tab === t ? "bg-panel2 text-accent" : "text-faint")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------------- */}
      {tab === "bowls" && (
        <div className="space-y-3">
          {builds.map((b) => {
            const included = itemsByBuild.get(b.id) ?? new Set<string>();
            const open = openBuild === b.id;
            return (
              <div key={b.id} className="rounded-2xl border border-line bg-panel p-4">
                <div className="flex items-start gap-2">
                  <span className="mt-2 shrink-0 rounded-md bg-panel2 px-2 py-1 text-xs font-bold text-faint">
                    {b.key}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      defaultValue={b.title}
                      onBlur={(e) =>
                        e.target.value !== b.title &&
                        run(() => updateBuild(b.id, { title: e.target.value }))
                      }
                      className={INPUT + " font-semibold"}
                    />
                    <input
                      defaultValue={b.subtitle ?? ""}
                      placeholder="A line about it (optional)"
                      onBlur={(e) =>
                        e.target.value !== (b.subtitle ?? "") &&
                        run(() => updateBuild(b.id, { subtitle: e.target.value }))
                      }
                      className={INPUT}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="number"
                          min={0}
                          max={600}
                          defaultValue={b.est_minutes ?? ""}
                          onBlur={(e) =>
                            run(() =>
                              updateBuild(b.id, {
                                est_minutes: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            )
                          }
                          className="w-16 rounded-lg border border-line bg-panel2 px-2 py-1 text-sm"
                        />
                        min
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          defaultChecked={b.is_fallback}
                          onChange={(e) =>
                            run(() =>
                              updateBuild(b.id, { is_fallback: e.target.checked })
                            )
                          }
                          className="size-4 accent-gold"
                        />
                        Bad-day option
                      </label>
                      <button
                        onClick={() => setOpenBuild(open ? null : b.id)}
                        className="ml-auto text-xs font-semibold text-accent2"
                      >
                        {included.size} components {open ? "▲" : "▼"}
                      </button>
                    </div>

                    {!open && included.size > 0 && (
                      <p className="text-xs text-faint">
                        {[...included]
                          .map((id) => itemsById.get(id)?.name)
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}

                    {open && (
                      <div className="space-y-3 rounded-xl border border-line bg-panel2 p-3">
                        {ROLES.map((role) => {
                          const roleItems = items.filter((i) => i.role === role);
                          if (!roleItems.length) return null;
                          return (
                            <div key={role}>
                              <p className="mb-1.5 text-[11px] font-bold tracking-wider text-faint uppercase">
                                {ROLE_LABEL[role]}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {roleItems.map((i) => {
                                  const on = included.has(i.id);
                                  return (
                                    <button
                                      key={i.id}
                                      onClick={() =>
                                        run(() => toggleBuildItem(b.id, i.id, !on))
                                      }
                                      className={
                                        "rounded-full border px-2.5 py-1 text-xs transition " +
                                        (on
                                          ? "border-accent bg-accent/15 text-accent"
                                          : "border-line text-muted")
                                      }
                                    >
                                      {on ? "✓ " : "+ "}
                                      {i.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      run(async () => {
                        const res = await deleteBuild(b.id);
                        if (res.ok && openBuild === b.id) setOpenBuild(null);
                        return res;
                      })
                    }
                    disabled={pending}
                    className="mt-2 shrink-0 text-xs text-faint transition hover:text-hot"
                  >
                    delete
                  </button>
                </div>
              </div>
            );
          })}

          <button
            onClick={() => run(() => addBuild(planId))}
            disabled={pending}
            className="w-full rounded-xl border border-dashed border-line py-3 text-sm font-semibold text-accent2 disabled:opacity-50"
          >
            + Add a bowl
          </button>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {tab === "pantry" && (
        <div className="space-y-5">
          {ROLES.map((role) => {
            const roleItems = items.filter((i) => i.role === role);
            return (
              <section key={role}>
                <h2 className="mb-2 text-[11px] font-bold tracking-wider text-faint uppercase">
                  {ROLE_LABEL[role]}
                </h2>
                <div className="space-y-2">
                  {roleItems.map((i) => (
                    <div
                      key={i.id}
                      className={
                        "flex flex-wrap items-center gap-2 rounded-xl border bg-panel px-3 py-2 " +
                        (allergenFlags[i.id]?.length ? "border-hot/50" : "border-line")
                      }
                    >
                      <input
                        defaultValue={i.name}
                        onBlur={(e) =>
                          e.target.value !== i.name &&
                          run(() => updateFoodItem(i.id, { name: e.target.value }))
                        }
                        className={INPUT + " flex-1"}
                      />
                      <label
                        className="flex shrink-0 items-center gap-1 text-xs text-muted"
                        title="Batch cooked on prep day"
                      >
                        <input
                          type="checkbox"
                          defaultChecked={i.batch_cooked}
                          onChange={(e) =>
                            run(() =>
                              updateFoodItem(i.id, { batch_cooked: e.target.checked })
                            )
                          }
                          className="size-4 accent-accent"
                        />
                        batch
                      </label>
                      <button
                        onClick={() => run(() => deleteFoodItem(i.id))}
                        disabled={pending}
                        className="shrink-0 text-xs text-faint transition hover:text-hot"
                      >
                        ✕
                      </button>
                      {allergenFlags[i.id]?.length ? (
                        <p className="w-full text-xs text-hot">
                          Looks like it contains{" "}
                          {allergenLabels(allergenFlags[i.id]).join(", ").toLowerCase()}
                          {" "}— check it yourself.
                        </p>
                      ) : null}
                    </div>
                  ))}

                  <button
                    onClick={() => run(() => addFoodItem(planId, role))}
                    disabled={pending}
                    className="w-full rounded-xl border border-dashed border-line py-2 text-xs font-semibold text-accent2 disabled:opacity-50"
                  >
                    + Add {ROLE_LABEL[role].toLowerCase()}
                  </button>
                </div>
              </section>
            );
          })}

          <p className="rounded-xl border border-line bg-panel2 px-3 py-2.5 text-xs text-muted">
            Deleting an item removes it from every bowl that used it. Your logged
            meals aren&rsquo;t touched.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {tab === "prep" && (
        <div className="space-y-4">
          {prepSessions.map((s) => {
            const tasks = prepTasks.filter((t) => t.prep_session_id === s.id);
            return (
              <section
                key={s.id}
                className="rounded-2xl border border-line bg-panel p-4"
              >
                <input
                  defaultValue={s.title}
                  onBlur={(e) =>
                    e.target.value !== s.title &&
                    run(() => updatePrepSession(s.id, { title: e.target.value }))
                  }
                  className={INPUT + " font-semibold"}
                />

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {WEEKDAYS.map((d, idx) => (
                    <button
                      key={d}
                      onClick={() => run(() => updatePrepSession(s.id, { weekday: idx }))}
                      className={
                        "rounded-lg border px-2 py-1 text-xs transition " +
                        (s.weekday === idx
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-line text-faint")
                      }
                    >
                      {d}
                    </button>
                  ))}
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                    <input
                      type="number"
                      min={0}
                      max={600}
                      defaultValue={s.est_minutes ?? ""}
                      onBlur={(e) =>
                        run(() =>
                          updatePrepSession(s.id, {
                            est_minutes: e.target.value ? Number(e.target.value) : null,
                          })
                        )
                      }
                      className="w-16 rounded-lg border border-line bg-panel2 px-2 py-1 text-sm"
                    />
                    min
                  </label>
                </div>

                <ul className="mt-3 space-y-2">
                  {tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <input
                        defaultValue={t.text}
                        onBlur={(e) =>
                          e.target.value !== t.text &&
                          run(() => updatePrepTask(t.id, e.target.value))
                        }
                        className={INPUT + " flex-1"}
                      />
                      <button
                        onClick={() => run(() => deletePrepTask(t.id))}
                        disabled={pending}
                        className="shrink-0 text-xs text-faint transition hover:text-hot"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => run(() => addPrepTask(s.id))}
                  disabled={pending}
                  className="mt-2 w-full rounded-xl border border-dashed border-line py-2 text-xs font-semibold text-accent2 disabled:opacity-50"
                >
                  + Add a step
                </button>
              </section>
            );
          })}

          {!prepSessions.length && (
            <p className="rounded-2xl border border-line bg-panel p-5 text-sm text-muted">
              This plan has no prep sessions.
            </p>
          )}
        </div>
      )}

      <p className="text-center text-xs text-faint">
        Editing {planName}. Changes save as you leave each field.
      </p>
    </div>
  );
}
