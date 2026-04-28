#!/usr/bin/env node
/**
 * One-time setup for the Rabbi Oratz Campaign Task Tracker.
 *
 * Creates a Google Sheet in Gitty's (glevi@thejre.org) Drive with:
 *   - Tasks tab (task list, due dates, statuses, notes)
 *   - Reminder Log tab (audit trail of every email sent)
 * Stores the sheet ID in Supabase app_settings (campaign_tracker_sheet_id).
 *
 * Flags:
 *   --share       Share the sheet with Rabbi Oratz + Chaim as editors
 *                 (otherwise only Gitty can see it). Send with ops email.
 *   --force-new   Create a NEW sheet even if one is already in app_settings.
 *
 * Usage:
 *   node scripts/setup-campaign-tracker.mjs
 *   node scripts/setup-campaign-tracker.mjs --share
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  getAuthedClient,
  getTrackerSheetId,
  setTrackerSheetId,
  RABBI_ORATZ_EMAIL,
  CHAIM_EMAIL,
} from "./campaign-tracker-lib.mjs";

const SHARE = process.argv.includes("--share");
const FORCE_NEW = process.argv.includes("--force-new");

const SHEET_TITLE = "JRE Campaign — Rabbi Oratz Task Tracker";

const TASK_HEADERS = [
  "#",
  "Task",
  "What to Do",
  "Due Date",
  "Priority",
  "Status",
  "Notes",
  "Last Reminder Stage",
  "Last Reminder At",
  "Thread ID",
];
const LOG_HEADERS = ["Timestamp (ET)", "Task #", "Task", "Stage", "To", "Message ID", "Status"];

async function main() {
  const { sheets, drive } = await getAuthedClient();

  let sheetId = await getTrackerSheetId();
  if (sheetId && !FORCE_NEW) {
    console.log(`Existing tracker sheet: ${sheetId}`);
    console.log(`URL: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
    console.log(`(use --force-new to create a fresh one)`);
    if (SHARE) await share(drive, sheetId);
    return;
  }

  console.log(`Creating new sheet: "${SHEET_TITLE}"`);
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SHEET_TITLE, locale: "en_US", timeZone: "America/New_York" },
      sheets: [
        { properties: { title: "Tasks", gridProperties: { rowCount: 200, columnCount: 10, frozenRowCount: 1 } } },
        { properties: { title: "Reminder Log", gridProperties: { rowCount: 2000, columnCount: 7, frozenRowCount: 1 } } },
        { properties: { title: "Instructions", gridProperties: { rowCount: 30, columnCount: 2 } } },
      ],
    },
  });
  sheetId = created.data.spreadsheetId;
  console.log(`Created sheet ID: ${sheetId}`);

  const tasksSheetId = created.data.sheets.find((s) => s.properties.title === "Tasks").properties.sheetId;
  const logSheetId = created.data.sheets.find((s) => s.properties.title === "Reminder Log").properties.sheetId;
  const instrSheetId = created.data.sheets.find((s) => s.properties.title === "Instructions").properties.sheetId;

  // Seed headers + formatting via batchUpdate
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        { range: "Tasks!A1:J1", values: [TASK_HEADERS] },
        { range: "Reminder Log!A1:G1", values: [LOG_HEADERS] },
        {
          range: "Instructions!A1:B20",
          values: [
            ["JRE Campaign — Rabbi Oratz Task Tracker", ""],
            ["", ""],
            ["How this works:", ""],
            ["1", "Chaim fills in the Tasks tab (task name, what to do, due date)."],
            ["2", "Rabbi Oratz gets an email reminder 7d, 3d, 1d, and day-of the due date."],
            ["3", "When Rabbi Oratz finishes a task, he (or Chaim) sets Status → Done. No more reminders for it."],
            ["4", "If a task goes 2+ days overdue, Chaim gets CC'd on the reminder."],
            ["", ""],
            ["Columns:", ""],
            ["Task", "Short name of the task."],
            ["What to Do", "Clear description of the action Rabbi Oratz needs to take."],
            ["Due Date", "YYYY-MM-DD. Reminders are scheduled relative to this date."],
            ["Priority", "High / Medium / Low — affects subject-line urgency."],
            ["Status", "Not Started / In Progress / Done."],
            ["Notes", "Free text. Rabbi Oratz can reply here with status or blockers."],
            ["Last Reminder…", "Auto-filled by the script — don't edit."],
            ["Thread ID", "Auto-filled — Gmail thread for follow-up replies."],
            ["", ""],
            ["Questions / issues?", "Reply to any reminder email, or ping Chaim."],
            ["", ""],
          ],
        },
      ],
    },
  });

  // Header formatting + data validation
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        // Tasks header row — bold, background color
        {
          repeatCell: {
            range: { sheetId: tasksSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.239, green: 0.325, blue: 0.541 }, // JRE blue
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
                horizontalAlignment: "LEFT",
                padding: { top: 6, bottom: 6, left: 8, right: 8 },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)",
          },
        },
        // Log header row
        {
          repeatCell: {
            range: { sheetId: logSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.239, green: 0.325, blue: 0.541 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        // Instructions title
        {
          repeatCell: {
            range: { sheetId: instrSheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } },
            fields: "userEnteredFormat.textFormat",
          },
        },
        // Status dropdown on Tasks col F (index 5), rows 2-200
        {
          setDataValidation: {
            range: { sheetId: tasksSheetId, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 5, endColumnIndex: 6 },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: [{ userEnteredValue: "Not Started" }, { userEnteredValue: "In Progress" }, { userEnteredValue: "Done" }],
              },
              showCustomUi: true,
              strict: true,
            },
          },
        },
        // Priority dropdown on col E (index 4)
        {
          setDataValidation: {
            range: { sheetId: tasksSheetId, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 4, endColumnIndex: 5 },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: [{ userEnteredValue: "High" }, { userEnteredValue: "Medium" }, { userEnteredValue: "Low" }],
              },
              showCustomUi: true,
              strict: true,
            },
          },
        },
        // Due Date column (D, index 3) → date format
        {
          repeatCell: {
            range: { sheetId: tasksSheetId, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 3, endColumnIndex: 4 },
            cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } },
            fields: "userEnteredFormat.numberFormat",
          },
        },
        // Column widths on Tasks
        ...colWidths(tasksSheetId, [40, 200, 380, 110, 90, 110, 260, 130, 160, 220]),
        // Column widths on Log
        ...colWidths(logSheetId, [170, 60, 220, 110, 220, 260, 100]),
        // Column widths on Instructions
        ...colWidths(instrSheetId, [180, 560]),
        // Conditional formatting — Done rows go green
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId: tasksSheetId, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 10 }],
              booleanRule: {
                condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Done" }] },
                format: {
                  backgroundColor: { red: 0.9, green: 0.97, blue: 0.9 },
                  textFormat: { foregroundColor: { red: 0.4, green: 0.6, blue: 0.4 } },
                },
              },
            },
            index: 0,
          },
        },
        // Overdue (due date < today, status != Done) → red tint
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId: tasksSheetId, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 10 }],
              booleanRule: {
                condition: {
                  type: "CUSTOM_FORMULA",
                  values: [{ userEnteredValue: "=AND($D2<TODAY(),$F2<>\"Done\",$D2<>\"\")" }],
                },
                format: { backgroundColor: { red: 0.99, green: 0.92, blue: 0.92 } },
              },
            },
            index: 0,
          },
        },
      ],
    },
  });

  await setTrackerSheetId(sheetId);
  console.log(`\n✅ Setup complete.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);

  if (SHARE) await share(drive, sheetId);
  else console.log(`\n(not shared yet — run again with --share to send invites to ${RABBI_ORATZ_EMAIL} + ${CHAIM_EMAIL})`);
}

function colWidths(sheetId, widths) {
  return widths.map((pixelSize, idx) => ({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
      properties: { pixelSize },
      fields: "pixelSize",
    },
  }));
}

async function share(drive, sheetId) {
  for (const { email, role, note } of [
    { email: RABBI_ORATZ_EMAIL, role: "writer", note: "Rabbi Oratz" },
    { email: CHAIM_EMAIL, role: "writer", note: "Chaim" },
  ]) {
    try {
      await drive.permissions.create({
        fileId: sheetId,
        requestBody: { type: "user", role, emailAddress: email },
        sendNotificationEmail: true,
        emailMessage: "This is the campaign task tracker. You'll get email reminders as due dates approach. Mark tasks Done in column F when finished — that stops the reminders.",
      });
      console.log(`Shared (${role}) with ${note} <${email}>`);
    } catch (e) {
      console.error(`Failed to share with ${email}: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
