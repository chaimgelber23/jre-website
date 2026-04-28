#!/usr/bin/env node
/**
 * Seed a few test rows into the tracker + dry-run the reminder script.
 * Deletes the test rows when done so it's repeatable.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const testRows = [
  ["T1", "TEST — Call Mr. Goldstein",     "Call donor to ask for this year's gift. Warm lead, gave $5k last year.", daysFromToday(7),  "High",   "Not Started", "", "", "", ""],
  ["T2", "TEST — Record video message",    "Record a 90-second thank-you video for the campaign page.",                daysFromToday(3),  "High",   "Not Started", "", "", "", ""],
  ["T3", "TEST — Sign donor letters",      "Sign 40 pre-printed letters and leave them in Gitty's inbox.",             daysFromToday(1),  "Medium", "Not Started", "", "", "", ""],
  ["T4", "TEST — Due today",               "A task that is due today for testing day-of reminders.",                   daysFromToday(0),  "High",   "Not Started", "", "", "", ""],
  ["T5", "TEST — Overdue 3 days",          "An overdue task to test escalation.",                                       daysFromToday(-3), "High",   "In Progress", "Waiting on names list.", "", "", ""],
  ["T6", "TEST — Already done",            "This one should be skipped.",                                               daysFromToday(1),  "Low",    "Done", "", "", "", ""],
];

async function main() {
  const { sheets } = await getAuthedClient();
  const sheetId = await getTrackerSheetId();
  if (!sheetId) throw new Error("No tracker sheet — run setup first");

  console.log("1. Seeding test rows...");
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Tasks!A2",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: testRows },
  });
  console.log(`   Seeded ${testRows.length} test tasks.`);
  console.log(`   View: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);

  console.log("\n2. Running reminder script in DRY_RUN mode...\n");
  process.env.DRY_RUN = "1";
  process.env.SKIP_SHABBOS = "0"; // let shabbos guard run normally
  await import("./send-campaign-reminders.mjs");

  // small wait for the dynamic import
  await new Promise((r) => setTimeout(r, 1500));

  console.log("\n3. Cleanup — deleting test rows...");
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Tasks!A:A" });
  const rows = res.data.values || [];
  const testIndexes = [];
  rows.forEach((r, i) => { if (r[0] && String(r[0]).startsWith("T")) testIndexes.push(i); });
  if (testIndexes.length) {
    // delete from bottom up so indexes stay stable
    testIndexes.sort((a, b) => b - a);
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const tasksSheetGid = meta.data.sheets.find((s) => s.properties.title === "Tasks").properties.sheetId;
    for (const idx of testIndexes) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: { sheetId: tasksSheetGid, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 },
            },
          }],
        },
      });
    }
    console.log(`   Deleted ${testIndexes.length} test rows.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
