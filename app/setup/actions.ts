"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function chooseProgram(formData: FormData) {
  const programId = String(formData.get("program_id") || "");
  if (!programId) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Assign the program to this user.
  await supabase.from("profiles").update({ program_id: programId }).eq("id", user.id);

  // Claim ownership if the program has no owner yet (lets you edit it in-app).
  await supabase
    .from("programs")
    .update({ owner_id: user.id })
    .eq("id", programId)
    .is("owner_id", null);

  revalidatePath("/", "layout");
  redirect("/");
}
