#!/usr/bin/env node
/**
 * Consolidation pass on the tracker sheet:
 *   1. Expand Tasks tab columns: add "✓ Done" (K), "Type" (L), "Link" (M), "Draft Copy" (N)
 *   2. Expand Status dropdown to cover flyer workflow:
 *      Not Started / In Progress / Drafted / With Designer / Approved / Done
 *   3. Migrate all Next Level Flyers rows INTO the Tasks tab
 *      - 4 already-drafted flyers become new Task rows (Status = Drafted)
 *      - The 8 flyer tasks I previously seeded get enriched with Type/Link
 *   4. Delete the standalone "Next Level Flyers" tab
 *   5. Add priority-based color coding (High = red, Medium = amber, Low = green)
 *      + Done-row strikethrough (checkbox triggered)
 *      + Status chip coloring on Donor Pipeline
 *
 * Re-runnable — checks what's already done before applying.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

const FLYERS_FOLDER_ID = "1MFvPSUlN989eMdwbH2xaWzTA2wyRfz6T";

const STATUS_VALUES = [
  "Not Started", "In Progress", "Drafted", "With Designer", "Approved", "Done",
];

const { sheets, drive } = await getAuthedClient();
const sheetId = await getTrackerSheetId();
if (!sheetId) throw new Error("No tracker sheet id");
console.log(`Consolidating: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);

const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
const tabs = Object.fromEntries(meta.data.sheets.map((s) => [s.properties.title, s.properties]));

// ---- 1. Expand Tasks tab ------------------------------------------------
const tasksTab = tabs["Tasks"];
if (!tasksTab) throw new Error("No Tasks tab — run setup first");
const tasksGid = tasksTab.sheetId;

const hdrRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Tasks!1:1" });
const header = hdrRes.data.values?.[0] || [];
const hasNewCols = header.includes("✓ Done");

if (!hasNewCols) {
  console.log("  Expanding Tasks tab columns...");
  // Ensure enough columns (need 14: A-N)
  const currentCols = tasksTab.gridProperties?.columnCount || 10;
  if (currentCols < 14) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ appendDimension: { sheetId: tasksGid, dimension: "COLUMNS", length: 14 - currentCols } }],
      },
    });
  }

  // Set new headers K / L / M / N
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "Tasks!K1:N1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [["✓ Done", "Type", "Link", "Draft Copy"]] },
  });

  // Expand Status dropdown on col F + header styling on new cols + checkbox on K + widths + dropdown on L
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        // Header styling on K/L/M/N
        {
          repeatCell: {
            range: { sheetId: tasksGid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 10, endColumnIndex: 14 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.239, green: 0.325, blue: 0.541 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
                horizontalAlignment: "LEFT",
                padding: { top: 6, bottom: 6, left: 8, right: 8 },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)",
          },
        },
        // Checkbox validation on K (rows 2-200)
        {
          setDataValidation: {
            range: { sheetId: tasksGid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 10, endColumnIndex: 11 },
            rule: { condition: { type: "BOOLEAN" } },
          },
        },
        // Center-align checkbox column
        {
          repeatCell: {
            range: { sheetId: tasksGid, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 10, endColumnIndex: 11 },
            cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
            fields: "userEnteredFormat.horizontalAlignment",
          },
        },
        // Type dropdown on L: Task / Flyer / Meeting / Other
        {
          setDataValidation: {
            range: { sheetId: tasksGid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 11, endColumnIndex: 12 },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: ["Task", "Flyer", "Meeting", "Outreach", "Other"].map((v) => ({ userEnteredValue: v })),
              },
              showCustomUi: true, strict: false,
            },
          },
        },
        // Expand Status dropdown on F to cover flyer workflow
        {
          setDataValidation: {
            range: { sheetId: tasksGid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 5, endColumnIndex: 6 },
            rule: {
              condition: { type: "ONE_OF_LIST", values: STATUS_VALUES.map((v) => ({ userEnteredValue: v })) },
              showCustomUi: true, strict: true,
            },
          },
        },
        // Column widths on K/L/M/N
        ...[80, 100, 220, 400].map((w, i) => ({
          updateDimensionProperties: {
            range: { sheetId: tasksGid, dimension: "COLUMNS", startIndex: 10 + i, endIndex: 11 + i },
            properties: { pixelSize: w }, fields: "pixelSize",
          },
        })),
        // Wrap text on Draft Copy (N) so long copy doesn't run off
        {
          repeatCell: {
            range: { sheetId: tasksGid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 13, endColumnIndex: 14 },
            cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
            fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
          },
        },
      ],
    },
  });
  console.log("    Added: K=Done, L=Type, M=Link, N=Draft Copy. Status dropdown expanded.");
} else {
  console.log("  Tasks tab already has new columns.");
}

// ---- 2. Pull current Tasks rows + Flyers rows to reconcile --------------
const taskRowsRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Tasks!A2:N200" });
const taskRows = taskRowsRes.data.values || [];

const flyerTab = tabs["Next Level Flyers"];
let flyerRows = [];
if (flyerTab) {
  const fRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Next Level Flyers!A3:G40" });
  flyerRows = (fRes.data.values || []).filter((r) => r[0]);
}

// Map existing tasks by name (lowercase) for reconciliation
const existingTasksByName = new Map();
for (let i = 0; i < taskRows.length; i++) {
  const name = (taskRows[i][1] || "").toLowerCase();
  if (name) existingTasksByName.set(name, i + 2); // row number
}

// ---- 3. Enrich existing flyer-tasks with Type/Link from Flyers tab -----
//    Also: collect flyers NOT yet in Tasks → add new rows.
const nowStart = (taskRows.filter((r) => r[0]).length) + 2;
const newRows = [];
const enrichments = [];

for (const fr of flyerRows) {
  const flyerName = fr[0];
  const status = fr[1] || "To Rewrite";
  const oldPdfFormula = fr[2] || ""; // already =HYPERLINK("url","label")
  const newCopy = fr[3] || "";
  const rawFlyerName = flyerName.replace(/\.pdf$/i, "");

  // Existing task name (from seed-rabbi-flyer-tasks.mjs): "Write copy — <flyer>"
  // Match loosely
  const candidate = `write copy — ${rawFlyerName}`.toLowerCase();
  const matchRow = existingTasksByName.get(candidate)
    || existingTasksByName.get(`write copy — ${rawFlyerName.replace(/\s+3x4$/i, "").replace(/\s+\(.*\)$/, "")}`.toLowerCase())
    || findFuzzyTaskRow(rawFlyerName, existingTasksByName);

  if (matchRow) {
    // Enrich L (Type), M (Link), N (Draft Copy)
    enrichments.push({
      range: `Tasks!L${matchRow}:N${matchRow}`,
      values: [["Flyer", oldPdfFormula, newCopy]],
    });
    if (status === "Drafted" && newCopy) {
      // Also update Status to "Drafted" if flyer already has new copy
      enrichments.push({ range: `Tasks!F${matchRow}`, values: [["Drafted"]] });
    }
  } else {
    // This flyer isn't in Tasks yet. Add a new task row.
    const taskName =
      status === "Drafted" ? `Ship to designer — ${rawFlyerName}` : `Write copy — ${rawFlyerName}`;
    const whatToDo =
      status === "Drafted"
        ? `The new "ON FIRE" copy for this flyer is drafted in the Draft Copy column (N). When ready, send to Honey for design.`
        : `Rewrite this flyer's copy for the 2026 "ON FIRE" campaign. Old 2025 PDF in column M (Link).`;
    newRows.push([
      String(nowStart + newRows.length),  // A: #
      taskName,                            // B
      whatToDo,                            // C
      "",                                  // D: Due Date
      "High",                              // E: Priority
      status === "Drafted" ? "Drafted" : "Not Started", // F
      "",                                  // G: Notes
      "",                                  // H: stage
      "",                                  // I: at
      "",                                  // J: thread
      false,                               // K: Done checkbox
      "Flyer",                             // L: Type
      oldPdfFormula,                       // M: Link
      newCopy,                             // N: Draft Copy
    ]);
  }
}

function findFuzzyTaskRow(flyerName, map) {
  const fn = flyerName.toLowerCase();
  for (const [k, v] of map.entries()) {
    if (k.startsWith("write copy") && k.includes(fn.split(" ")[0])) return v;
  }
  return null;
}

if (enrichments.length) {
  console.log(`  Enriching ${enrichments.length} existing flyer-tasks with Type/Link/Draft data...`);
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: enrichments },
  });
}

if (newRows.length) {
  console.log(`  Appending ${newRows.length} new flyer-tasks (drafted + unmatched)...`);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Tasks!A2",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: newRows },
  });
}

// Also mark existing non-flyer tasks with Type=Task (defaults)
const existingTaskTypes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Tasks!L2:L200" });
const types = existingTaskTypes.data.values || [];
const rowsNeedingDefault = [];
for (let i = 0; i < Math.min(taskRows.length, types.length); i++) {
  if (!types[i]?.[0]) {
    const taskName = (taskRows[i][1] || "").toLowerCase();
    const type = /write copy|flyer|brochure|copy/.test(taskName) ? "Flyer" : "Task";
    rowsNeedingDefault.push({ range: `Tasks!L${i + 2}`, values: [[type]] });
  }
}
if (rowsNeedingDefault.length) {
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: rowsNeedingDefault },
  });
  console.log(`  Set default Type on ${rowsNeedingDefault.length} existing rows.`);
}

// ---- 4. Delete the standalone Next Level Flyers tab --------------------
if (flyerTab) {
  console.log("  Deleting standalone Next Level Flyers tab (now merged into Tasks)...");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [{ deleteSheet: { sheetId: flyerTab.sheetId } }],
    },
  });
}

// ---- 5. Priority + Done color coding -----------------------------------
console.log("  Applying priority + Done color coding...");

const colors = {
  highBg:  { red: 0.99, green: 0.80, blue: 0.80 },
  highText:{ red: 0.60, green: 0.05, blue: 0.05 },
  medBg:   { red: 1.00, green: 0.93, blue: 0.72 },
  medText: { red: 0.55, green: 0.35, blue: 0.00 },
  lowBg:   { red: 0.82, green: 0.95, blue: 0.82 },
  lowText: { red: 0.15, green: 0.45, blue: 0.15 },
  rowHigh: { red: 1.00, green: 0.96, blue: 0.96 },
  doneRow: { red: 0.88, green: 0.96, blue: 0.88 },
  doneText:{ red: 0.3, green: 0.55, blue: 0.3 },
};

const cfRequests = [
  // When Done=TRUE → green row + strikethrough (highest priority — index 0)
  {
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: tasksGid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 14 }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=$K2=TRUE" }] },
          format: { backgroundColor: colors.doneRow, textFormat: { foregroundColor: colors.doneText, strikethrough: true } },
        },
      },
      index: 0,
    },
  },
  // Priority cells (col E) — High/Medium/Low
  ...[
    ["High", colors.highBg, colors.highText],
    ["Medium", colors.medBg, colors.medText],
    ["Low", colors.lowBg, colors.lowText],
  ].map(([val, bg, text]) => ({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: tasksGid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 4, endColumnIndex: 5 }],
        booleanRule: {
          condition: { type: "TEXT_EQ", values: [{ userEnteredValue: val }] },
          format: { backgroundColor: bg, textFormat: { foregroundColor: text, bold: true } },
        },
      },
      index: 10,
    },
  })),
  // High priority whole row tint (only if not Done)
  {
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: tasksGid, startRowIndex: 1, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 14 }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=AND($E2=\"High\",$K2<>TRUE,$F2<>\"Done\")" }] },
          format: { backgroundColor: colors.rowHigh },
        },
      },
      index: 20,
    },
  },
];

// Donor Pipeline status chip colors
const pipelineGid = tabs["Donor Pipeline"]?.sheetId;
if (pipelineGid !== undefined) {
  for (const [val, bg, text] of [
    ["Not Contacted",    { red: 0.93, green: 0.93, blue: 0.93 }, { red: 0.30, green: 0.30, blue: 0.30 }],
    ["Reached Out",      { red: 0.80, green: 0.88, blue: 0.98 }, { red: 0.15, green: 0.28, blue: 0.55 }],
    ["Conversation Had", { red: 0.87, green: 0.80, blue: 0.96 }, { red: 0.35, green: 0.20, blue: 0.55 }],
    ["Pledge Made",      { red: 0.99, green: 0.90, blue: 0.75 }, { red: 0.60, green: 0.35, blue: 0.05 }],
    ["Gift Received",    { red: 0.73, green: 0.92, blue: 0.75 }, { red: 0.10, green: 0.40, blue: 0.15 }],
    ["Declined",         { red: 0.96, green: 0.80, blue: 0.80 }, { red: 0.50, green: 0.20, blue: 0.20 }],
  ]) {
    cfRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: pipelineGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 5, endColumnIndex: 6 }],
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

await sheets.spreadsheets.batchUpdate({
  spreadsheetId: sheetId,
  requestBody: { requests: cfRequests },
});

console.log(`\n✅ Consolidation done.`);
console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
