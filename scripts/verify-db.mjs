#!/usr/bin/env node
/**
 * Checks that a Supabase project has the v2 schema loaded correctly.
 *
 *   node scripts/verify-db.mjs
 *
 * Reads .env.local. Uses the anon key only, so it also proves RLS is letting
 * a signed-out visitor see exactly what it should (templates) and nothing else.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("No .env.local found. Copy .env.local.example and fill it in.");
  process.exit(1);
}
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing from .env.local");
  process.exit(1);
}

const sb = createClient(url, key);

const TABLES = [
  "plans", "days", "exercises", "profiles", "sessions", "set_logs",
  "food_items", "builds", "build_items", "prep_sessions", "prep_tasks",
  "meal_logs", "prep_logs", "plan_reviews", "builder_profiles", "ai_generations",
];

let failed = 0;
const pass = (m) => console.log(`  ok       ${m}`);
const fail = (m) => { failed++; console.log(`  MISSING  ${m}`); };

console.log(`\nChecking ${url}\n`);

console.log("Tables (01_schema.sql):");
for (const t of TABLES) {
  const { error } = await sb.from(t).select("*", { head: true, count: "exact" });
  // A permission/RLS error still means the table EXISTS, which is what we're
  // checking here. Only "relation does not exist" (42P01) is a real miss.
  if (error && (error.code === "42P01" || /does not exist/i.test(error.message || ""))) {
    fail(`${t}  — ${error.message}`);
  } else {
    pass(t);
  }
}

console.log("\nFunctions (02_functions.sql):");
{
  // Calling clone_plan signed-out must fail with "not authenticated" — if the
  // function were missing we'd get a 404-style "could not find function".
  const { error } = await sb.rpc("clone_plan", {
    p_source_id: "00000000-0000-0000-0000-000000000000",
  });
  const msg = error?.message || "";
  if (/could not find|does not exist|not found/i.test(msg)) fail(`clone_plan — ${msg}`);
  else pass("clone_plan");
}

console.log("\nTemplates (04_seed.sql):");
{
  const { data, error } = await sb
    .from("plans")
    .select("slug, kind, name")
    .eq("is_template", true)
    .order("kind");
  if (error) {
    fail(`could not read templates — ${error.message}`);
  } else if (!data?.length) {
    fail("no templates found — did 04_seed.sql run?");
  } else {
    for (const t of data) pass(`${t.kind.padEnd(4)} ${t.slug}  “${t.name}”`);
    const gym = data.filter((d) => d.kind === "gym").length;
    const food = data.filter((d) => d.kind === "food").length;
    if (gym < 2) fail(`expected 2 gym templates, found ${gym}`);
    if (food < 1) fail(`expected 1 food template, found ${food}`);
  }
}

console.log("\nRLS (03_rls.sql):");
{
  // Signed out, private data must be invisible. Zero rows is the pass.
  const { data, error } = await sb.from("sessions").select("id").limit(1);
  if (error || (data ?? []).length === 0) pass("signed-out users cannot read sessions");
  else fail("signed-out users CAN read sessions — RLS is not on");

  const { error: writeErr } = await sb
    .from("plans")
    .insert({ kind: "gym", name: "rls probe", is_template: true });
  if (writeErr) pass("signed-out users cannot create templates");
  else fail("signed-out users CAN create plans — check 03_rls.sql");
}

console.log(
  failed === 0
    ? "\n✅ All checks passed — the v2 schema is loaded correctly.\n"
    : `\n❌ ${failed} check(s) failed. Re-run the SQL files in order from supabase/v2/.\n`
);
process.exit(failed === 0 ? 0 : 1);
