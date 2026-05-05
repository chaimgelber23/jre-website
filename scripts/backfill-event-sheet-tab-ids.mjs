/**
 * Backfill events.sheet_tab_id (gid) for every event that currently has a
 * matching tab in the master Google Sheet. Run once after applying the
 * event_registrations_sheet_sync.sql migration.
 *
 * Match logic (in priority order):
 *   1. Tab whose title === slugToSheetName(event.slug) — the historical default.
 *   2. Tab title that contains an obvious humanized form of the slug (catches
 *      cases where admin already renamed, e.g. "LunchandLearn26" for
 *      "lag-baomer-2026" — only if the operator has manually mapped it via
 *      MANUAL_OVERRIDES below).
 *
 * Anything that can't be matched is logged and left as NULL — the live
 * registration path will then create a tab and persist the new gid on the
 * first registration.
 *
 * Usage: node scripts/backfill-event-sheet-tab-ids.mjs [--dry-run]
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

const DRY = process.argv.includes("--dry-run");

// Slugs that have been manually renamed in the Sheets UI. The auto-match by
// slugToSheetName() will miss these, so map them explicitly.
const MANUAL_OVERRIDES = {
  "lag-baomer-2026": "LunchandLearn26",
};

function slugToSheetName(slug) {
  slug = slug.replace(/^\//, "");
  const parts = slug.split("-");
  const lastPart = parts[parts.length - 1];
  const hasYear = /^\d{4}$/.test(lastPart);
  if (hasYear) {
    const nameParts = parts.slice(0, -1);
    const name = nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    return `${name}${lastPart.slice(-2)}`;
  }
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID });
const tabsByTitle = new Map();
for (const s of meta.data.sheets || []) {
  if (s.properties?.title && s.properties?.sheetId !== undefined) {
    tabsByTitle.set(s.properties.title, s.properties.sheetId);
  }
}

const { data: events, error } = await sb.from("events").select("id,slug,title,sheet_tab_id");
if (error) throw error;

let matched = 0;
let manual = 0;
let unmatched = 0;
const updates = [];

for (const ev of events) {
  if (ev.sheet_tab_id != null) {
    continue;
  }
  const expected = MANUAL_OVERRIDES[ev.slug] || slugToSheetName(ev.slug);
  const gid = tabsByTitle.get(expected);
  if (gid !== undefined) {
    if (MANUAL_OVERRIDES[ev.slug]) manual++;
    else matched++;
    updates.push({ id: ev.id, slug: ev.slug, title: ev.title, expected, gid });
  } else {
    unmatched++;
    console.log(`UNMATCHED: ${ev.slug} (looked for "${expected}")`);
  }
}

console.log(`\nAuto-matched: ${matched}`);
console.log(`Manual override: ${manual}`);
console.log(`Unmatched (will auto-create on first registration): ${unmatched}`);
console.log(`\nUpdates to apply: ${updates.length}${DRY ? " (dry run)" : ""}\n`);

for (const u of updates) {
  console.log(`  ${u.slug} → ${u.expected} (gid=${u.gid})`);
  if (!DRY) {
    const { error: upErr } = await sb.from("events").update({ sheet_tab_id: u.gid }).eq("id", u.id);
    if (upErr) console.error(`  ERROR updating ${u.slug}:`, upErr.message);
  }
}

console.log(DRY ? "\nDry run complete." : "\nBackfill complete.");
