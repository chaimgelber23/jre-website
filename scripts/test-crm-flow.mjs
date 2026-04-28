#!/usr/bin/env node
// Seed a few rows with owners + next-step dates, dry-run reminders + digest,
// then revert the changes so nothing is polluted.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const { sheets } = await getAuthedClient();
const sheetId = await getTrackerSheetId();

// Test scenario: edit rows 2, 20, 21 (Jerry Adler, Daniel Berman, Ken Miller).
// We'll capture original values first so we can restore.
// Schema (21 cols): Status=L, Asked=M, Pledged=N, Received=O, Owner=P, Next Step=Q, Next Step Date=R
// Test seeds 3 rows of operational state (cols L-R, 7 fields), then reverts.
const originalRes = await sheets.spreadsheets.values.get({
  spreadsheetId: sheetId, range: "Donor Pipeline!A2:U21",
});
const original = originalRes.data.values;

console.log("1. Seeding test scenarios on first 3 rows...");
const updates = [
  // Row 2 — Chaim owner, follow-up due today
  { range: "Donor Pipeline!L2:R2", values: [["Reached Out", "180", "", "", "Chaim", "Call back to ask for $180 again", daysFromToday(0)]] },
  // Row 20 — Rabbi Oratz owner, 3 days overdue (escalates to Chaim CC)
  { range: "Donor Pipeline!L20:R20", values: [["Conversation Had", "5000", "", "", "Rabbi Oratz", "Schedule coffee — open to re-engage", daysFromToday(-3)]] },
  // Row 21 — Rabbi Oratz owner, pledged $10k, no overdue
  { range: "Donor Pipeline!L21:R21", values: [["Pledge Made", "15000", "10000", "", "Rabbi Oratz", "Send pledge form for confirmation", daysFromToday(5)]] },
];
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: sheetId,
  requestBody: { valueInputOption: "USER_ENTERED", data: updates },
});
console.log("   Seeded 3 scenarios.");

console.log("\n2. Dry-run follow-up reminders...\n");
process.env.DRY_RUN = "1";
await import("./send-donor-followup-reminders.mjs");
await new Promise((r) => setTimeout(r, 1500));

console.log("\n3. Dry-run digest...\n");
await import("./daily-campaign-digest.mjs");
await new Promise((r) => setTimeout(r, 1500));

console.log("\n4. Reverting to original values...");
await sheets.spreadsheets.values.update({
  spreadsheetId: sheetId,
  range: "Donor Pipeline!A2:U21",
  valueInputOption: "USER_ENTERED",
  requestBody: { values: original },
});
console.log("   Reverted.");
