#!/usr/bin/env node
/**
 * One-way sync: Supabase outreach_contacts → Donor Pipeline tab.
 *
 * Pulls the four priority tiers (same segmentation as send-campaign-brief.mjs):
 *   Tier 1A — 2023 first-timers who haven't given since
 *   Tier 1B — lapsed major donors ($500+ LTD, last gift < 2024)
 *   Tier 1C — upgrade candidates ($500–$5k LTD, still active)
 *   Tier 2A — engaged non-donors
 *
 * Matching is by email. Rows already in the sheet are NEVER overwritten —
 * only brand-new prospects get appended. Rabbi Oratz's edits are preserved.
 *
 * Flags:
 *   --all        Also include every other active contact with an email
 *                (not just the 4 tiers). Use sparingly.
 *   --dry-run    Print what would be added, don't write.
 *
 * Usage:
 *   node scripts/sync-donor-pipeline.mjs
 *   node scripts/sync-donor-pipeline.mjs --dry-run
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getAuthedClient, getSupabase, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const INCLUDE_ALL = process.argv.includes("--all");

function parseLTD(bg) {
  if (!bg) return 0;
  const m = bg.match(/Total giving: \$([0-9,.]+)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}
function parseLastGift(bg) {
  if (!bg) return null;
  const m = bg.match(/Last gift: (\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
function parseSince(bg) {
  if (!bg) return null;
  const m = bg.match(/Donor since (\d{4})/);
  return m ? parseInt(m[1]) : null;
}

async function fetchAll(supabase) {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("outreach_contacts")
      .select("id, first_name, last_name, email, phone, stage, how_met, background, engagement_score, next_followup_date")
      .eq("is_active", true)
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

function classifyTier(c) {
  const ltd = parseLTD(c.background);
  const lastGift = parseLastGift(c.background);
  const since = parseSince(c.background);
  const isDonor = ltd > 0;
  const lastBefore2024 = lastGift && lastGift < "2024-01-01";
  const lastSince2023 = lastGift && lastGift >= "2023-01-01";

  if (isDonor && since === 2023 && (!lastGift || lastBefore2024)) return { tier: "1A", priority: 1, ltd, lastGift, since };
  if (isDonor && ltd >= 500 && lastBefore2024 && since !== 2023) return { tier: "1B", priority: 2, ltd, lastGift, since };
  if (isDonor && ltd >= 500 && ltd < 5000 && lastSince2023) return { tier: "1C", priority: 3, ltd, lastGift, since };
  if (!isDonor && ((c.engagement_score ?? 0) >= 3 || ["deepening", "learning", "inner_circle"].includes(c.stage)) && c.email) {
    return { tier: "2A", priority: 4, ltd: 0, lastGift: null, since: null };
  }
  if (isDonor) return { tier: "2B", priority: 5, ltd, lastGift, since }; // any other donor
  return null;
}

function buildNotes(c, classification) {
  const bits = [];
  if (classification.ltd > 0) bits.push(`LTD $${classification.ltd.toLocaleString()}`);
  if (classification.lastGift) bits.push(`last gift ${classification.lastGift}`);
  if (classification.since) bits.push(`donor since ${classification.since}`);
  if (c.stage) bits.push(`stage: ${c.stage}`);
  if (c.how_met) bits.push(`met: ${c.how_met}`);
  return bits.join(" · ");
}

async function main() {
  console.log(`[${new Date().toISOString()}] Syncing Supabase → Donor Pipeline${DRY_RUN ? " (DRY RUN)" : ""}${INCLUDE_ALL ? " [--all]" : ""}`);
  const supabase = getSupabase();
  const { sheets } = await getAuthedClient();
  const sheetId = await getTrackerSheetId();
  if (!sheetId) throw new Error("No tracker sheet id — run setup-campaign-tracker.mjs first");

  // 1. Load existing names from Donor Pipeline (dedup key — Email/Phone removed; col A is Name)
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Donor Pipeline!A2:A1000",
  });
  const existing = new Set((existingRes.data.values || []).map((r) => (r[0] || "").trim().toLowerCase()).filter(Boolean));
  console.log(`  existing names in sheet: ${existing.size}`);

  // 2. Pull all active contacts
  const contacts = await fetchAll(supabase);
  console.log(`  active contacts in Supabase: ${contacts.length}`);

  // 3. Classify + filter + cap per tier
  const buckets = { "1A": [], "1B": [], "1C": [], "2A": [], "2B": [], "new": [] };
  for (const c of contacts) {
    if (!c.email) continue;
    const emailKey = c.email.trim().toLowerCase();
    if (existing.has(emailKey)) continue;
    const cl = classifyTier(c);
    if (!cl) {
      if (INCLUDE_ALL) buckets["new"].push({ c, cl: { tier: "new", priority: 9, ltd: parseLTD(c.background), lastGift: parseLastGift(c.background), since: parseSince(c.background) } });
      continue;
    }
    buckets[cl.tier].push({ c, cl });
  }
  // Cap the long tails so we don't overwhelm Rabbi Oratz with hundreds of rows
  const TIER_CAPS = { "1A": Infinity, "1B": Infinity, "1C": 50, "2A": 20, "2B": 0, "new": 0 };
  const candidates = [];
  for (const tier of ["1A", "1B", "1C", "2A", "2B", "new"]) {
    buckets[tier].sort((a, b) => b.cl.ltd - a.cl.ltd || (b.c.engagement_score ?? 0) - (a.c.engagement_score ?? 0));
    const cap = TIER_CAPS[tier];
    const keep = cap === Infinity ? buckets[tier] : buckets[tier].slice(0, cap);
    candidates.push(...keep);
    const dropped = buckets[tier].length - keep.length;
    if (dropped > 0) console.log(`  ${tier}: keeping top ${keep.length}, dropped ${dropped}`);
    else if (keep.length) console.log(`  ${tier}: ${keep.length} rows`);
  }

  const rows = candidates.map(({ c, cl }) => [
    `${c.first_name} ${c.last_name}`.trim(),   // A: Name
    "",                                         // B: 2023 (unknown for synced contacts)
    "",                                         // C: 2024
    "",                                         // D: 2025
    "",                                         // E: 2026
    cl.ltd || "",                               // F: Grand Total
    "",                                         // G: Action (rabbi sets manually)
    cl.tier,                                    // H: Tier
    "",                                         // I: Level (filled by upgrade-crm-levels-and-tabs)
    "Not Contacted",                            // J: Status
    "",                                         // K: Asked $
    "",                                         // L: Pledged $
    "",                                         // M: Received $
    "",                                         // N: Owner
    "",                                         // O: Next Step
    c.next_followup_date || "",                 // P: Next Step Date
    "",                                         // Q: Last Touch
    buildNotes(c, cl),                          // R: Notes
    "",                                         // S: Thread ID
  ]);

  console.log(`  new rows to add: ${rows.length}`);
  for (const r of rows) {
    console.log(`    ${String(r[7]).padEnd(5)} ${r[0].padEnd(28)} $${String(r[5]||0).padStart(8)}`);
  }

  if (!rows.length) {
    console.log("\nNothing to sync.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n(DRY RUN — no writes)");
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Donor Pipeline!A2",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
  console.log(`\n✅ Appended ${rows.length} rows to Donor Pipeline.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
}

main().catch((e) => { console.error(e); process.exit(1); });
