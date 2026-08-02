import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ProgramEditor from "@/components/ProgramEditor";
import { loadProgram } from "@/lib/load";
import { createClient } from "@/lib/supabase/server";
import type { Exercise } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const ctx = await loadProgram();
  if (ctx.redirect) redirect(ctx.redirect);

  const { userId, program, days, exercises } = ctx;

  // Who owns this program?
  const supabase = createClient();
  const { data: prog } = await supabase
    .from("programs")
    .select("owner_id")
    .eq("id", program?.id ?? "")
    .single();
  const canEdit = !!program && prog?.owner_id === userId;

  const exercisesByDay: Record<string, Exercise[]> = {};
  for (const d of days) {
    exercisesByDay[d.id] = exercises.filter((e) => e.day_id === d.id);
  }

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        <h1 className="mb-1 text-xl font-bold tracking-tight">Edit program</h1>
        <p className="mb-5 text-sm text-muted">
          Tweak your days and exercises without touching any code.
        </p>
        <ProgramEditor
          canEdit={canEdit}
          programId={program?.id ?? ""}
          programName={program?.name ?? "Your program"}
          days={days}
          exercisesByDay={exercisesByDay}
        />
      </main>
      <BottomNav />
    </>
  );
}
