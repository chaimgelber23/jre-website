/**
 * Backfill Google Sheets from Supabase.
 *
 * Pulls donations, event_registrations, and email_signups from Supabase and
 * appends any rows that aren't already in the sheet (deduped by id in column A).
 *
 * Creates missing tabs with proper headers. Safe to re-run.
 *
 * Usage: node scripts/backfill-sheets.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase env vars");
if (!SPREADSHEET_ID) throw new Error("Missing GOOGLE_SHEETS_ID");
if (!SERVICE_EMAIL || !PRIVATE_KEY) throw new Error("Missing Google service account env vars");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const auth = new google.auth.GoogleAuth({
  credentials: { client_email: SERVICE_EMAIL, private_key: PRIVATE_KEY },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const TABS = {
  Donations: {
    headers: ["ID","Amount","Recurring","Frequency","Name","Email","Phone","Honor Name","Honor Email","Sponsorship","Message","Payment Status","Payment Reference","Timestamp"],
    range: "Donations!A:N",
    idRange: "Donations!A:A",
  },
  "Event Registrations": {
    headers: ["ID","Event","Event Date","Year","Name","Email","Phone","Adults","Kids","Sponsorship","Subtotal","Payment Status","Payment Reference","Timestamp"],
    range: "Event Registrations!A:N",
    idRange: "Event Registrations!A:A",
  },
  "Email Signups": {
    headers: ["ID","Name","Email","Phone","Subject","Message","Timestamp","Source"],
    range: "Email Signups!A:H",
    idRange: "Email Signups!A:A",
  },
};

function colLetter(n) {
  let s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

async function ensureTab(tabName) {
  const { headers } = TABS[tabName];
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === tabName);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A1:${colLetter(headers.length)}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });
  const refreshed = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetId = refreshed.data.sheets?.find((s) => s.properties?.title === tabName)?.properties?.sheetId;
  if (sheetId !== undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.937, green: 0.502, blue: 0.275 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } },
          { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
        ],
      },
    });
  }
  console.log(`  ✓ Created tab: ${tabName}`);
}

async function fetchExistingIds(tabName) {
  const { idRange } = TABS[tabName];
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: idRange });
  const rows = res.data.values || [];
  return new Set(rows.slice(1).map((r) => r[0]).filter(Boolean));
}

function donationRow(d) {
  return [
    d.id, d.amount, d.is_recurring ? "Yes" : "No", d.recurring_frequency || "",
    d.name, d.email, d.phone || "", d.honor_name || "", d.honor_email || "",
    d.sponsorship || "", d.message || "", d.payment_status, d.payment_reference || "",
    new Date(d.created_at).toLocaleString(),
  ];
}

function registrationRow(r, eventsById) {
  const ev = eventsById.get(r.event_id) || {};
  const year = ev.date ? new Date(ev.date + "T00:00:00").getFullYear() : "";
  return [
    r.id, ev.title || "", ev.date || "", year,
    r.name, r.email, r.phone || "", r.adults, r.kids,
    r.sponsorship_id || "None", r.subtotal, r.payment_status, r.payment_reference || "",
    new Date(r.created_at).toLocaleString(),
  ];
}

function signupRow(s) {
  return [s.id, s.name, s.email, s.phone || "", s.subject || "", s.message || "", new Date(s.created_at).toLocaleString(), s.source];
}

async function backfillTab(tabName, rowsToAppend) {
  if (rowsToAppend.length === 0) {
    console.log(`  — nothing to backfill for ${tabName}`);
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: TABS[tabName].range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rowsToAppend },
  });
  console.log(`  ✓ Appended ${rowsToAppend.length} rows to ${tabName}`);
}

async function main() {
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`);

  for (const tabName of Object.keys(TABS)) {
    console.log(`→ ${tabName}`);
    await ensureTab(tabName);
  }

  console.log("\nFetching from Supabase...");
  const [donations, registrations, signups, events] = await Promise.all([
    supabase.from("donations").select("*").order("created_at"),
    supabase.from("event_registrations").select("*").order("created_at"),
    supabase.from("email_signups").select("*").order("created_at"),
    supabase.from("events").select("id,title,date"),
  ]);

  for (const [label, res] of [["donations", donations], ["registrations", registrations], ["signups", signups], ["events", events]]) {
    if (res.error) {
      console.error(`  ✗ ${label} fetch error:`, res.error.message);
      process.exit(1);
    }
    console.log(`  • ${label}: ${res.data?.length || 0} rows`);
  }

  const eventsById = new Map((events.data || []).map((e) => [e.id, e]));

  console.log("\nDeduping and appending...");

  const donationIds = await fetchExistingIds("Donations");
  const regIds = await fetchExistingIds("Event Registrations");
  const signupIds = await fetchExistingIds("Email Signups");

  const missingDonations = (donations.data || []).filter((d) => !donationIds.has(d.id)).map(donationRow);
  const missingRegs = (registrations.data || []).filter((r) => !regIds.has(r.id)).map((r) => registrationRow(r, eventsById));
  const missingSignups = (signups.data || []).filter((s) => !signupIds.has(s.id)).map(signupRow);

  await backfillTab("Donations", missingDonations);
  await backfillTab("Event Registrations", missingRegs);
  await backfillTab("Email Signups", missingSignups);

  console.log("\nDone.");
}

main().catch((err) => { console.error(err); process.exit(1); });
