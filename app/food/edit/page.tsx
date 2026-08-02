import Link from "next/link";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import FoodEditor from "@/components/FoodEditor";
import { loadFood } from "@/lib/food";

export const dynamic = "force-dynamic";

export default async function FoodEditPage() {
  const ctx = await loadFood();
  if (ctx.redirect) redirect(ctx.redirect);

  const { userId, plan, items, builds, buildItems, prepSessions, prepTasks } = ctx;

  // In v2 an active plan is always one you own — clone_plan sets owner_id — so
  // this is belt and braces. RLS is what actually enforces it.
  const canEdit = plan.owner_id === userId;

  return (
    <>
      <main className="mx-auto max-w-2xl px-5 pt-5 pb-28">
        <header className="mb-5 flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Edit food plan</h1>
            <p className="mt-0.5 truncate text-sm text-muted">{plan.name}</p>
          </div>
          <Link href="/food" className="shrink-0 text-sm text-accent2">
            Done
          </Link>
        </header>

        {canEdit ? (
          <FoodEditor
            planId={plan.id}
            planName={plan.name}
            items={items}
            builds={builds}
            buildItems={buildItems}
            prepSessions={prepSessions}
            prepTasks={prepTasks}
          />
        ) : (
          <p className="rounded-2xl border border-line bg-panel p-5 text-sm text-muted">
            This plan isn&rsquo;t yours to edit.
          </p>
        )}
      </main>

      <BottomNav />
    </>
  );
}
