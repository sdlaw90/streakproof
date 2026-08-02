import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ProgramEditor from "@/components/ProgramEditor";
import { loadPlan } from "@/lib/load";
import type { Exercise } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const ctx = await loadPlan("gym");
  if (ctx.redirect) redirect(ctx.redirect);

  const { userId, plan, days, exercises } = ctx;

  // In v2 the plan a user has active is always one they own (clone_plan sets
  // owner_id), so the old "did you claim this program?" lookup is gone. RLS
  // enforces the real rule server-side either way.
  const canEdit = !!plan && plan.owner_id === userId;

  const exercisesByDay: Record<string, Exercise[]> = {};
  for (const d of days) {
    exercisesByDay[d.id] = exercises.filter((e) => e.day_id === d.id);
  }

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        <h1 className="mb-1 text-xl font-bold tracking-tight">Edit plan</h1>
        <p className="mb-5 text-sm text-muted">
          Tweak your days and exercises without touching any code.
        </p>
        <ProgramEditor
          canEdit={canEdit}
          planId={plan?.id ?? ""}
          programName={plan?.name ?? "Your plan"}
          days={days}
          exercisesByDay={exercisesByDay}
        />
      </main>
      <BottomNav />
    </>
  );
}
