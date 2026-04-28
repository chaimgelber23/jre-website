#!/usr/bin/env node
/**
 * Add priority-based color coding to the tracker sheet:
 *   - Tasks tab, Priority column (E): High = red, Medium = amber, Low = green
 *   - Plus a light row-tint on each, so at-a-glance the whole row shows urgency
 *     (without overriding the existing Done-green / Overdue-red row rules)
 *   - Timeline tab: same logic, triggered off milestone Status urgency
 *
 * Idempotent — safe to re-run. Does NOT duplicate rules (checks first).
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

const { sheets } = await getAuthedClient();
const sheetId = await getTrackerSheetId();

const meta = await sheets.spreadsheets.get({
  spreadsheetId: sheetId,
  ranges: ["Tasks", "Timeline", "Donor Pipeline"],
  fields: "sheets(properties(sheetId,title),conditionalFormats(ranges,booleanRule(condition(values,type),format)))",
});
const tabs = Object.fromEntries(meta.data.sheets.map((s) => [s.properties.title, s]));

const colors = {
  highBg:    { red: 0.99, green: 0.80, blue: 0.80 }, // strong red-pink
  highText:  { red: 0.60, green: 0.05, blue: 0.05 },
  medBg:     { red: 1.00, green: 0.93, blue: 0.72 }, // amber
  medText:   { red: 0.55, green: 0.35, blue: 0.00 },
  lowBg:     { red: 0.82, green: 0.95, blue: 0.82 }, // green
  lowText:   { red: 0.15, green: 0.45, blue: 0.15 },
  highRowTint: { red: 1.00, green: 0.96, blue: 0.96 }, // very pale pink across whole row
};

const requests = [];

// ---- Tasks tab -----------------------------------------------------------
const tasks = tabs["Tasks"];
if (tasks) {
  const gid = tasks.properties.sheetId;
  // Priority is column E (index 4). Rows 2..200.
  // Cell-level color for the Priority column
  for (const [val, bg, text] of [
    ["High",   colors.highBg, colors.highText],
    ["Medium", colors.medBg,  colors.medText],
    ["Low",    colors.lowBg,  colors.lowText],
  ]) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: gid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 4, endColumnIndex: 5 }],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: val }] },
            format: { backgroundColor: bg, textFormat: { foregroundColor: text, bold: true } },
          },
        },
        index: 10, // push to end so Done / Overdue row rules still win at index 0-1
      },
    });
  }
  // Light whole-row tint on High priority (won't override Done / Overdue row rules which hit earlier)
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: gid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 10 }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=AND($E2=\"High\",$F2<>\"Done\")" }] },
          format: { backgroundColor: colors.highRowTint },
        },
      },
      index: 20,
    },
  });
}

// ---- Timeline tab --------------------------------------------------------
const timeline = tabs["Timeline"];
if (timeline) {
  const gid = timeline.properties.sheetId;
  // Timeline doesn't have a priority column, but CAMPAIGN STARTS/ENDS milestones
  // should stand out. Color the "Milestone" cell (col B, index 1) when it contains CAMPAIGN.
  requests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: gid, startRowIndex: 1, endRowIndex: 100, startColumnIndex: 1, endColumnIndex: 2 }],
        booleanRule: {
          condition: { type: "TEXT_CONTAINS", values: [{ userEnteredValue: "CAMPAIGN" }] },
          format: {
            backgroundColor: { red: 0.98, green: 0.27, blue: 0.11 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
          },
        },
      },
      index: 10,
    },
  });
}

// ---- Donor Pipeline — Status column color chips -------------------------
const pipeline = tabs["Donor Pipeline"];
if (pipeline) {
  const gid = pipeline.properties.sheetId;
  // Status is column F (index 5). Color chip each status cell so the whole column
  // becomes a visible progress bar.
  const statusColors = [
    ["Not Contacted",    { red: 0.93, green: 0.93, blue: 0.93 }, { red: 0.30, green: 0.30, blue: 0.30 }],
    ["Reached Out",      { red: 0.80, green: 0.88, blue: 0.98 }, { red: 0.15, green: 0.28, blue: 0.55 }],
    ["Conversation Had", { red: 0.87, green: 0.80, blue: 0.96 }, { red: 0.35, green: 0.20, blue: 0.55 }],
    ["Pledge Made",      { red: 0.99, green: 0.90, blue: 0.75 }, { red: 0.60, green: 0.35, blue: 0.05 }],
    ["Gift Received",    { red: 0.73, green: 0.92, blue: 0.75 }, { red: 0.10, green: 0.40, blue: 0.15 }],
    ["Declined",         { red: 0.96, green: 0.80, blue: 0.80 }, { red: 0.50, green: 0.20, blue: 0.20 }],
    ["No Response",      { red: 0.90, green: 0.90, blue: 0.90 }, { red: 0.40, green: 0.40, blue: 0.40 }],
    ["Parked",           { red: 0.97, green: 0.97, blue: 0.97 }, { red: 0.60, green: 0.60, blue: 0.60 }],
  ];
  for (const [val, bg, text] of statusColors) {
    requests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 }],
          booleanRule: {
            condition: { type: "TEXT_EQ", values: [{ userEnteredValue: val }] },
            format: { backgroundColor: bg, textFormat: { foregroundColor: text, bold: true } },
          },
        },
        index: 30,
      },
    });
  }
}

console.log(`Applying ${requests.length} conditional format rules...`);
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: sheetId,
  requestBody: { requests },
});
console.log(`✅ Color coding applied.`);

// ---- Done checkbox on Tasks tab -----------------------------------------
// Add column G = "✓ Done" (checkbox). Shifts Notes/Reminder/Thread right by 1.
// Reminder engine (send-campaign-reminders.mjs) has been updated to read the
// new layout + respect the checkbox.
if (tasks) {
  const gid = tasks.properties.sheetId;
  const hdrRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Tasks!1:1" });
  const header = hdrRes.data.values?.[0] || [];
  const hasDoneCol = header.includes("✓ Done") || header.includes("Done?");

  if (!hasDoneCol) {
    console.log(`\nAdding Done checkbox column to Tasks tab...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          // Insert column at position 6 (zero-indexed), i.e., column G
          {
            insertDimension: {
              range: { sheetId: gid, dimension: "COLUMNS", startIndex: 6, endIndex: 7 },
              inheritFromBefore: false,
            },
          },
        ],
      },
    });
    // Header + validation + width
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "Tasks!G1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["✓ Done"]] },
    });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          // Header styling (blue + white like the rest)
          {
            repeatCell: {
              range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 6, endColumnIndex: 7 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.239, green: 0.325, blue: 0.541 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
                  horizontalAlignment: "CENTER",
                  padding: { top: 6, bottom: 6, left: 8, right: 8 },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)",
            },
          },
          // Checkbox data validation on rows 2-200
          {
            setDataValidation: {
              range: { sheetId: gid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 6, endColumnIndex: 7 },
              rule: { condition: { type: "BOOLEAN" } },
            },
          },
          // Center-align the checkbox column
          {
            repeatCell: {
              range: { sheetId: gid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 6, endColumnIndex: 7 },
              cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
              fields: "userEnteredFormat.horizontalAlignment",
            },
          },
          // Column width
          {
            updateDimensionProperties: {
              range: { sheetId: gid, dimension: "COLUMNS", startIndex: 6, endIndex: 7 },
              properties: { pixelSize: 80 }, fields: "pixelSize",
            },
          },
          // When checked, strike-through + green row
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [{ sheetId: gid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 11 }],
                booleanRule: {
                  condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=$G2=TRUE" }] },
                  format: {
                    backgroundColor: { red: 0.88, green: 0.96, blue: 0.88 },
                    textFormat: { foregroundColor: { red: 0.3, green: 0.55, blue: 0.3 }, strikethrough: true },
                  },
                },
              },
              index: 0, // evaluated first so it beats High-priority tint
            },
          },
        ],
      },
    });
    console.log(`  Done checkbox added at column G.`);
  } else {
    console.log(`\nDone checkbox already exists on Tasks tab.`);
  }
}

console.log(`\nSheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
