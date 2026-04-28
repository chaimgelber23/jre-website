// Print the campaign_donations payment_method CHECK migration so it can be
// pasted into the Supabase Studio SQL editor. PostgREST can't run DDL and we
// don't keep a direct PG connection string in .env.local.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, "../supabase/migrations/campaign_donations_payment_method_extend.sql");
const sql = readFileSync(sqlPath, "utf-8");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "<project-ref>";
const editorUrl = `https://supabase.com/dashboard/project/${ref}/sql/new`;

console.log("=".repeat(72));
console.log("Open the SQL editor:");
console.log(`  ${editorUrl}`);
console.log("Paste & run the SQL below.");
console.log("=".repeat(72));
console.log(sql);
console.log("=".repeat(72));
console.log("Verify:");
console.log("  SELECT pg_get_constraintdef(con.oid) FROM pg_constraint con");
console.log("    JOIN pg_class rel ON rel.oid = con.conrelid");
console.log("   WHERE rel.relname = 'campaign_donations'");
console.log("     AND con.conname = 'campaign_donations_payment_method_check';");
console.log("Expect: CHECK ((payment_method = ANY (ARRAY['card','daf','fidelity','ojc_fund','donors_fund','check','zelle','other'])))");
