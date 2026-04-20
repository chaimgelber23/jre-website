/**
 * Backfill jre_money_owed from Gitty's manual 2026-04-20 Zelle digest.
 *
 *   1) Yocheved Bakst (Purim 2026)  845-263-7241   $1,200
 *   2) Shaimos (Before Pesach)       347-907-3550   $200
 *   3) Esther Wein (4/14/26)         estwein@gmail.com   $250
 *   4) Rebbetzin Dinah Fink (4/21+4/28/26)  Lvnglobal@gmail.com   $800
 *
 * Run AFTER applying migration jre_money_owed.sql.
 *
 *   node scripts/backfill-money-owed.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const items = [
  {
    recipient_name: "Yocheved Bakst",
    recipient_phone: "845-263-7241",
    amount_usd: 1200,
    reason: "Purim 2026",
    payee_email: "elishevaoratz@gmail.com",
    notes: "Backfilled from Gitty's 2026-04-20 manual Zelle digest",
  },
  {
    recipient_name: "Shaimos",
    recipient_phone: "347-907-3550",
    amount_usd: 200,
    reason: "Before Pesach",
    payee_email: "elishevaoratz@gmail.com",
    notes: "Backfilled from Gitty's 2026-04-20 manual Zelle digest",
  },
  {
    recipient_name: "Esther Wein",
    recipient_email: "estwein@gmail.com",
    amount_usd: 250,
    reason: "4/14/26 class",
    payee_email: "elishevaoratz@gmail.com",
    notes: "Backfilled from Gitty's 2026-04-20 manual Zelle digest",
  },
  {
    recipient_name: "Rebbetzin Dinah Fink",
    recipient_email: "Lvnglobal@gmail.com",
    amount_usd: 800,
    reason: "4/21/26 + 4/28/26 classes",
    payee_email: "elishevaoratz@gmail.com",
    notes: "Backfilled from Gitty's 2026-04-20 manual Zelle digest",
  },
];

console.log(`Inserting ${items.length} backfill items...`);
for (const item of items) {
  const { data, error } = await supabase.from("jre_money_owed").insert(item).select().single();
  if (error) {
    console.error(`❌ ${item.recipient_name}: ${error.message}`);
  } else {
    console.log(`✅ ${item.recipient_name}  $${item.amount_usd}  → ${item.payee_email}`);
  }
}

const { data: open } = await supabase
  .from("jre_money_owed")
  .select("recipient_name, amount_usd, status, payee_email")
  .eq("status", "open")
  .order("amount_usd", { ascending: false });

const total = open?.reduce((s, i) => s + i.amount_usd, 0) ?? 0;
console.log(`\nOpen items: ${open?.length ?? 0}  Total: $${total.toLocaleString()}`);
for (const o of open ?? []) {
  console.log(`   ${o.recipient_name.padEnd(28)} $${String(o.amount_usd).padStart(6)}  → ${o.payee_email}`);
}
