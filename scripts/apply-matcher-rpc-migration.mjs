// Apply supabase/migrations/campaign_matcher_atomic_rpc.sql via the Supabase
// Management API (PostgREST can't run DDL). Requires SUPABASE_DB_URL or a
// SUPABASE_ACCESS_TOKEN + project ref env to call the SQL endpoint.
//
// Easiest run path: open Supabase Studio → SQL editor → paste the .sql file
// and execute. This script is provided as an alternative when you have psql.
//
// Usage:
//   psql "$SUPABASE_DB_URL" -f supabase/migrations/campaign_matcher_atomic_rpc.sql
//
// Or, if you only have the service-role key, paste into the SQL editor at
// https://supabase.com/dashboard/project/<ref>/sql/new

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, "../supabase/migrations/campaign_matcher_atomic_rpc.sql");
const sql = readFileSync(sqlPath, "utf-8");

console.log("=".repeat(70));
console.log("Run this SQL in Supabase Studio (SQL editor) for project ");
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL || "<set NEXT_PUBLIC_SUPABASE_URL in .env.local>");
console.log("=".repeat(70));
console.log(sql);
console.log("=".repeat(70));
console.log("After running it, verify:");
console.log("  SELECT proname FROM pg_proc WHERE proname IN ('apply_matcher_increment','revert_matcher_increment');");
console.log("Expect 2 rows.");
