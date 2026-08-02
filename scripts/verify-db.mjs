#!/usr/bin/env node
/**
 * Checks that a Supabase project has the v2 schema loaded correctly.
 *
 *   npm run verify:db
 *
 * Reads .env.local and uses the anon key only, so it also proves RLS is
 * letting a signed-out visitor see exactly what it should (templates) and
 * nothing else.
 *
 * NOTE ON ERROR HANDLING: PostgREST reports a missing table as PGRST205
 * ("Could not find the table ... in the schema cache"), NOT as Postgres'
 * 42P01. An earlier version of this script only looked for 42P01, so every
 * table appeared to exist even when none did. Treat anything cache-ish as
 * missing, and never let a bare error count as a pass.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("No .env.local found. Create it with your Supabase URL + anon key.");
  process.exit(1);
}
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing from .env.local.\n" +
      "If you created the file with PowerShell's `>` it may be UTF-16 — rewrite it with -Encoding ascii."
  );
  process.exit(1);
}

const sb = createClient(url, key);

/** Does this error mean "the object isn't in the database"? */
function isMissing(error) {
  if (!error) return false;
  const code = error.code || "";
  const msg = error.message || "";
  return (
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST202" || // function not found
    code === "PGRST205" || // table not found
    /schema cache/i.test(msg) ||
    /does not exist/i.test(msg) ||
    /could not find/i.test(msg)
  );
}

const TABLES = [
  "plans", "days", "exercises", "profiles", "sessions", "set_logs",
  "food_items", "builds", "build_items", "prep_sessions", "prep_tasks",
  "meal_logs", "prep_logs", "plan_reviews", "builder_profiles", "ai_generations",
];

let failed = 0;
const missingTables = [];
const pass = (m) => console.log(`  ok       ${m}`);
const fail = (m) => {
  failed++;
  console.log(`  MISSING  ${m}`);
};

console.log(`\nChecking ${url}\n`);

console.log("Tables (…0001_schema.sql):");
for (const t of TABLES) {
  const { error } = await sb.from(t).select("*", { head: true, count: "exact" });
  if (isMissing(error)) {
    missingTables.push(t);
    fail(`${t}  — ${error.message || error.code}`);
  } else {
    // An RLS denial still proves the table exists, which is what we're testing.
    pass(t);
  }
}

const schemaLoaded = missingTables.length === 0;

console.log("\nFunctions (…0002_functions.sql):");
{
  // Signed out, clone_plan should fail with "not authenticated" — that's a
  // pass. Only "function not found" is a miss.
  const { error } = await sb.rpc("clone_plan", {
    p_source_id: "00000000-0000-0000-0000-000000000000",
  });
  if (isMissing(error)) fail(`clone_plan — ${error.message}`);
  else pass("clone_plan");
}
{
  const { error } = await sb.rpc("refresh_plan_estimates", {
    p_plan_id: "00000000-0000-0000-0000-000000000000",
  });
  if (isMissing(error)) fail(`refresh_plan_estimates — ${error.message}`);
  else pass("refresh_plan_estimates");
}

console.log("\nTemplates (visible signed-out, per migration 05):");
if (!schemaLoaded) {
  fail("skipped — tables are missing, push the migrations first");
} else {
  const { data, error } = await sb
    .from("plans")
    .select("slug, kind, name")
    .eq("is_template", true)
    .order("kind");
  if (error) {
    fail(`could not read templates — ${error.message}`);
  } else if (!data?.length) {
    fail(
      "no templates visible to a signed-out client.\n" +
        "           Either the templates migration didn't run, or the anon read\n" +
        "           policy is missing (migration 20260802000005). Check with:\n" +
        "             select count(*) from plans where is_template;\n" +
        "           in the SQL editor — that bypasses RLS and tells you which."
    );
  } else {
    for (const t of data) pass(`${t.kind.padEnd(4)} ${t.slug}  "${t.name}"`);
    const gym = data.filter((d) => d.kind === "gym").length;
    const food = data.filter((d) => d.kind === "food").length;
    if (gym < 2) fail(`expected 2 gym templates, found ${gym}`);
    if (food < 1) fail(`expected 1 food template, found ${food}`);
  }
}

console.log("\nRLS (…0003_rls.sql):");
if (!schemaLoaded) {
  fail("skipped — cannot test RLS on tables that don't exist");
} else {
  // Signed out, private data must be invisible. Zero rows with no error is the
  // real pass; an error here would be ambiguous, so say so rather than guess.
  const { data, error } = await sb.from("sessions").select("id").limit(1);
  if (error) fail(`sessions read returned an error, not an empty set — ${error.message}`);
  else if ((data ?? []).length === 0) pass("signed-out users cannot read sessions");
  else fail("signed-out users CAN read sessions — RLS is not enabled");

  const { error: writeErr } = await sb
    .from("plans")
    .insert({ kind: "gym", name: "rls probe", is_template: true });
  if (writeErr) pass("signed-out users cannot create plans");
  else fail("signed-out users CAN create plans — check …0003_rls.sql");
}

console.log("");
if (failed === 0) {
  console.log("✅ All checks passed — the v2 schema is loaded correctly.\n");
} else if (!schemaLoaded) {
  console.log(
    `❌ ${failed} check(s) failed. The schema isn't loaded.\n\n` +
      "Push the migrations:\n" +
      "  npx supabase link --project-ref <your-ref>\n" +
      "  npx supabase db push\n\n" +
      "Or paste each file in supabase/migrations/ into the SQL editor in\n" +
      "filename order, checking for 'Success' after each.\n\n" +
      "If they HAVE been run, PostgREST's schema cache may be stale. Run:\n" +
      "  notify pgrst, 'reload schema';\n" +
      "and try again. Also confirm you're pointed at the right project — the URL\n" +
      "above must match the one in Project Settings → API.\n"
  );
} else {
  console.log(`❌ ${failed} check(s) failed. See the notes above each section.\n`);
}
process.exit(failed === 0 ? 0 : 1);
