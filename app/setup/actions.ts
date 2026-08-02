"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Start from a template.
 *
 * v1 set profiles.program_id and then CLAIMED owner_id on the shared program,
 * which meant the first person to pick a program owned it forever and nobody
 * else could use it. clone_plan() copies the template into a plan the user
 * owns, so any number of people can start from the same one.
 */
export async function chooseTemplate(formData: FormData) {
  const templateId = String(formData.get("template_id") || "");
  if (!templateId) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("clone_plan", {
    p_source_id: templateId,
    p_name: null,
    p_activate: true,
  });

  if (error) {
    redirect(`/setup?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
