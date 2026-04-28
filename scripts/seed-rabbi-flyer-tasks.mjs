#!/usr/bin/env node
/**
 * Seed the remaining 7 Next Level flyer rewrites into the Tasks tab as
 * Rabbi Oratz's action items.
 *
 * Idempotent: checks existing task names and only adds what's missing.
 *
 * Usage: node scripts/seed-rabbi-flyer-tasks.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

const TASKS = [
  { flyer: "Brooklyn Parlor Meeting Flyer", fileId: "1SJLyEd0G5_csp85MG1VGAS5wayPsXOpv" },
  { flyer: "Half Letter Card", fileId: "1djxGIlm5OOPuMM3rDhbtswYCbI8xhJ3t" },
  { flyer: "Small Donation Flyer", fileId: "1CJYE8FOXL2CdSAHQ3twKcHTXEudzg1_S" },
  { flyer: "Medium Donation Flyer", fileId: "1SO0ArZFX_ymx_ZONRRLgEbFitB6fC2oY" },
  { flyer: "Rabbi Farhi Flyer (Honey)", fileId: "1xItuS0YJvdZnNs6QFHPNNuAVqJQ9_5AX" },
  { flyer: "Roll up Banner (with icons)", fileId: "11oR5GF_l6tHerwxkH0kQGy8HFIxLR0ha" },
  { flyer: "Roll up Banner", fileId: "1JIesEZYNl5DHizdaJVi6x13IZ1YgBuSB" },
];

// Extra task flagged directly in Rabbi's doc: "Brochure — Don't have enough info yet"
const EXTRA_TASKS = [
  {
    name: "Finish Brochure copy (need more info first)",
    whatToDo:
      `In your "Campaign Documents Necessary 2026" doc you flagged: "Brochure — Don't have enough info yet." ` +
      `Once you have the info, complete the Brochure copy. The front-cover slogan, goal ($300k), and URL are already locked in the doc — ` +
      `just need to fill out the inside content. The drafted portion already synced into the tracker's "Next Level Flyers" tab (row: JRE_Campaign Brochure 2025).`,
    priority: "High",
  },
];

async function main() {
  const { sheets } = await getAuthedClient();
  const sheetId = await getTrackerSheetId();

  // Read existing tasks to dedupe
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId, range: "Tasks!B2:B200",
  });
  const existing = new Set((existingRes.data.values || []).map((r) => (r[0] || "").trim().toLowerCase()).filter(Boolean));

  // Starting row number
  const numRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId, range: "Tasks!A2:A200",
  });
  const startNum = (numRes.data.values || []).filter((r) => r[0]).length + 1;

  const rowsToAdd = [];
  let i = 0;
  for (const t of TASKS) {
    const taskName = `Write copy — ${t.flyer}`;
    if (existing.has(taskName.toLowerCase())) continue;
    const whatToDo =
      `Rewrite this flyer's copy for the 2026 "ON FIRE" campaign ` +
      `($300k goal, June 7–8 tentative, thejre.org/onfire). ` +
      `Old 2025 PDF: https://drive.google.com/file/d/${t.fileId}/view. ` +
      `When the copy's drafted, paste it into the "Next Level Flyers" tab in the "New Copy (2026)" column ` +
      `and change that row's Status to "Drafted" — then Gitty ships it to Honey.`;
    rowsToAdd.push([
      String(startNum + i),  // A: #
      taskName,              // B: Task
      whatToDo,              // C: What to Do
      "",                    // D: Due Date — blank for now (dates in flux per you)
      "High",                // E: Priority
      "Not Started",         // F: Status
      "",                    // G: Notes
      "",                    // H: Last Reminder Stage
      "",                    // I: Last Reminder At
      "",                    // J: Thread ID
    ]);
    i++;
  }
  for (const extra of EXTRA_TASKS) {
    if (existing.has(extra.name.toLowerCase())) continue;
    rowsToAdd.push([
      String(startNum + i), extra.name, extra.whatToDo, "", extra.priority, "Not Started", "", "", "", "",
    ]);
    i++;
  }

  if (rowsToAdd.length === 0) {
    console.log("All 7 flyer tasks already exist. Nothing to add.");
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Tasks!A2",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rowsToAdd },
  });

  console.log(`✅ Added ${rowsToAdd.length} flyer-rewrite tasks to Tasks tab.`);
  for (const r of rowsToAdd) console.log(`  ${r[0]}. ${r[1]}`);
  console.log(`\nDue dates left blank — no reminders fire until you set them.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
}

main().catch((e) => { console.error(e); process.exit(1); });
