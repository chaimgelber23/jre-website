#!/usr/bin/env node
/**
 * Extend the Rabbi Oratz Campaign Tracker sheet with 3 CRM tabs:
 *   - Donor Pipeline (every prospect + status + $ + next-step)
 *   - Touchpoint Log (every call/email/text logged)
 *   - Dashboard (live summary via formulas)
 *
 * Idempotent: skips any tab that already exists.
 *
 * Usage: node scripts/add-crm-tabs.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

// ---- Column definitions ---------------------------------------------------

const PIPELINE_HEADERS = [
  "Name",           // A (visible)
  "2023",           // B (visible)
  "2024",           // C (visible)
  "2025",           // D (visible)
  "2026",           // E (visible)
  "Grand Total",    // F (visible)
  "Action",         // G (visible — rabbi's tag)
  "Email",          // H (hidden)
  "Phone",          // I (hidden)
  "Tier",           // J (hidden)
  "Level",          // K (hidden)
  "Status",         // L (hidden)
  "Asked $",        // M (hidden)
  "Pledged $",      // N (hidden)
  "Received $",     // O (hidden)
  "Owner",          // P (hidden)
  "Next Step",      // Q (hidden)
  "Next Step Date", // R (hidden)
  "Last Touch",     // S (hidden)
  "Notes",          // T (hidden)
  "Thread ID",      // U (hidden)
];
const VISIBLE_COL_COUNT = 7;

const PIPELINE_WIDTHS = [200, 95, 95, 95, 95, 110, 130, 220, 130, 70, 70, 130, 90, 90, 90, 110, 280, 120, 120, 280, 180];

const STATUS_VALUES = [
  "Not Contacted",
  "Reached Out",
  "Conversation Had",
  "Pledge Made",
  "Gift Received",
  "Declined",
  "No Response",
  "Parked",
];

const TIER_VALUES = ["Major", "1A", "1B", "1C", "2A", "2B"];
const LEVEL_VALUES = ["Major", "Mid", "Entry", "Below"];
const OWNER_VALUES = ["Chaim", "Rabbi Oratz", "Gitty", "Other"];
const ACTION_VALUES = ["Matcher", "Ask", "Commit", "Fire", "Try a little more", "Discuss", "Meeting In the City", "Go Up"];

const LOG_HEADERS = [
  "Timestamp (ET)", // A
  "Donor Name",     // B
  "Donor Email",    // C
  "Channel",        // D
  "Owner",          // E
  "Outcome",        // F
  "Amount $",       // G
  "Notes",          // H
  "Next Step",      // I
  "Next Step Date", // J
];
const LOG_WIDTHS = [170, 170, 200, 100, 110, 140, 100, 300, 260, 120];
const CHANNEL_VALUES = ["Call", "Text", "Email", "In-person", "WhatsApp", "Other"];
const OUTCOME_VALUES = ["Connected", "Left VM", "No Answer", "Pledge", "Gift", "Declined", "Rescheduled", "Other"];

// ---- Main -----------------------------------------------------------------

const TABS_TO_ADD = ["Donor Pipeline", "Touchpoint Log", "Dashboard"];

async function main() {
  const { sheets } = await getAuthedClient();
  const sheetId = await getTrackerSheetId();
  if (!sheetId) throw new Error("No tracker sheet id — run setup-campaign-tracker.mjs first");

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const existingTabs = new Set(meta.data.sheets.map((s) => s.properties.title));

  const toCreate = TABS_TO_ADD.filter((t) => !existingTabs.has(t));
  if (toCreate.length === 0) {
    console.log("All CRM tabs already exist. Nothing to do.");
    return;
  }
  console.log(`Creating tabs: ${toCreate.join(", ")}`);

  // Step 1 — add the tabs
  const addRequests = toCreate.map((title) => {
    const grid =
      title === "Donor Pipeline" ? { rowCount: 1000, columnCount: PIPELINE_HEADERS.length, frozenRowCount: 1 } :
      title === "Touchpoint Log" ? { rowCount: 5000, columnCount: LOG_HEADERS.length, frozenRowCount: 1 } :
      { rowCount: 100, columnCount: 10 };
    return { addSheet: { properties: { title, gridProperties: grid } } };
  });
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests: addRequests },
  });
  const newGids = {};
  for (const reply of addRes.data.replies) {
    const p = reply.addSheet.properties;
    newGids[p.title] = p.sheetId;
  }

  // Step 2 — seed headers
  const valuesData = [];
  if (newGids["Donor Pipeline"] !== undefined) {
    valuesData.push({ range: "Donor Pipeline!A1:U1", values: [PIPELINE_HEADERS] });
  }
  if (newGids["Touchpoint Log"] !== undefined) {
    valuesData.push({ range: "Touchpoint Log!A1:J1", values: [LOG_HEADERS] });
  }
  if (newGids["Dashboard"] !== undefined) {
    valuesData.push({ range: "Dashboard!A1:B1", values: [["📊 JRE Campaign Dashboard", ""]] });
    valuesData.push({
      range: "Dashboard!A3:B3",
      values: [["💰 Money", ""]],
    });
    valuesData.push({
      range: "Dashboard!A4:B8",
      values: [
        ["Total Asked",    `=IFERROR(SUM('Donor Pipeline'!M2:M), 0)`],
        ["Total Pledged",  `=IFERROR(SUM('Donor Pipeline'!N2:N), 0)`],
        ["Total Received", `=IFERROR(SUM('Donor Pipeline'!O2:O), 0)`],
        ["Gap to Goal ($250k)", `=250000-IFERROR(SUM('Donor Pipeline'!N2:N),0)`],
        ["Pledge → Received %", `=IFERROR(SUM('Donor Pipeline'!O2:O)/SUM('Donor Pipeline'!N2:N),0)`],
      ],
    });
    valuesData.push({
      range: "Dashboard!A10:B10",
      values: [["📋 Pipeline by Status", ""]],
    });
    const statusRows = STATUS_VALUES.map((s) => [s, `=COUNTIF('Donor Pipeline'!L:L,"${s}")`]);
    valuesData.push({ range: `Dashboard!A11:B${10 + statusRows.length}`, values: statusRows });

    const nextSection = 11 + statusRows.length + 1;
    valuesData.push({
      range: `Dashboard!A${nextSection}:B${nextSection}`,
      values: [["⚠️ Overdue Follow-Ups (next step date < today)", ""]],
    });
    valuesData.push({
      range: `Dashboard!A${nextSection + 1}:F${nextSection + 1}`,
      values: [["Name", "Status", "Owner", "Next Step", "Next Step Date", "Days Overdue"]],
    });
    valuesData.push({
      range: `Dashboard!A${nextSection + 2}`,
      values: [[`=IFERROR(QUERY('Donor Pipeline'!A2:U, "select B, L, P, Q, R, (today()-R) where R is not null and R < today() and L != 'Gift Received' and L != 'Declined' and L != 'Parked' order by R asc label (today()-R) 'Days Overdue'", 0), "—no overdue items—")`]],
    });

    const staleSection = nextSection + 20;
    valuesData.push({
      range: `Dashboard!A${staleSection}:B${staleSection}`,
      values: [["🌡️ Stale Donors (no touch in 14+ days, not finalized)", ""]],
    });
    valuesData.push({
      range: `Dashboard!A${staleSection + 1}:E${staleSection + 1}`,
      values: [["Name", "Status", "Last Touch", "Days Since", "Owner"]],
    });
    valuesData.push({
      range: `Dashboard!A${staleSection + 2}`,
      values: [[`=IFERROR(QUERY('Donor Pipeline'!A2:U, "select B, L, S, (today()-S), P where S is not null and S < today()-14 and L != 'Gift Received' and L != 'Declined' and L != 'Parked' order by S asc label (today()-S) 'Days Since'", 0), "—none—")`]],
    });

    const weekSection = staleSection + 20;
    valuesData.push({
      range: `Dashboard!A${weekSection}:B${weekSection}`,
      values: [["📞 Touchpoints (last 7 days)", ""]],
    });
    valuesData.push({
      range: `Dashboard!A${weekSection + 1}:B${weekSection + 3}`,
      values: [
        ["Calls",  `=COUNTIFS('Touchpoint Log'!A:A,">="&(TODAY()-7),'Touchpoint Log'!D:D,"Call")`],
        ["Emails", `=COUNTIFS('Touchpoint Log'!A:A,">="&(TODAY()-7),'Touchpoint Log'!D:D,"Email")`],
        ["Total",  `=COUNTIFS('Touchpoint Log'!A:A,">="&(TODAY()-7),'Touchpoint Log'!A:A,"<>")`],
      ],
    });
  }

  if (valuesData.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: valuesData },
    });
  }

  // Step 3 — formatting, dropdowns, widths, number formats
  const fmtRequests = [];

  if (newGids["Donor Pipeline"] !== undefined) {
    const gid = newGids["Donor Pipeline"];
    // Header row
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.239, green: 0.325, blue: 0.541 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
            padding: { top: 6, bottom: 6, left: 8, right: 8 },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,padding)",
      },
    });
    // Column widths
    PIPELINE_WIDTHS.forEach((pixelSize, idx) => {
      fmtRequests.push({
        updateDimensionProperties: {
          range: { sheetId: gid, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
          properties: { pixelSize }, fields: "pixelSize",
        },
      });
    });
    // Hide cols H-U (operational; rabbi sees only A-G)
    fmtRequests.push({
      updateDimensionProperties: {
        range: { sheetId: gid, dimension: "COLUMNS", startIndex: VISIBLE_COL_COUNT, endIndex: PIPELINE_HEADERS.length },
        properties: { hiddenByUser: true }, fields: "hiddenByUser",
      },
    });
    // Action dropdown (col G, idx 6 — rabbi's tag)
    fmtRequests.push({
      setDataValidation: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 6, endColumnIndex: 7 },
        rule: { condition: { type: "ONE_OF_LIST", values: ACTION_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
      },
    });
    // Tier dropdown (col J, idx 9)
    fmtRequests.push({
      setDataValidation: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 9, endColumnIndex: 10 },
        rule: { condition: { type: "ONE_OF_LIST", values: TIER_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
      },
    });
    // Level dropdown (col K, idx 10)
    fmtRequests.push({
      setDataValidation: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 10, endColumnIndex: 11 },
        rule: { condition: { type: "ONE_OF_LIST", values: LEVEL_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
      },
    });
    // Status dropdown (col L, idx 11)
    fmtRequests.push({
      setDataValidation: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 11, endColumnIndex: 12 },
        rule: { condition: { type: "ONE_OF_LIST", values: STATUS_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: true },
      },
    });
    // Owner dropdown (col P, idx 15)
    fmtRequests.push({
      setDataValidation: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 15, endColumnIndex: 16 },
        rule: { condition: { type: "ONE_OF_LIST", values: OWNER_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
      },
    });
    // Currency format on year/total/asked/pledged/received cols (B,C,D,E,F,M,N,O = idx 1,2,3,4,5,12,13,14)
    for (const colIdx of [1, 2, 3, 4, 5, 12, 13, 14]) {
      fmtRequests.push({
        repeatCell: {
          range: { sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "\"$\"#,##0" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    }
    // Date format on R, S (Next Step Date, Last Touch — idx 17, 18)
    for (const colIdx of [17, 18]) {
      fmtRequests.push({
        repeatCell: {
          range: { sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      });
    }
    // Conditional formatting — row colors based on Status (col L)
    fmtRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 21 }],
          booleanRule: {
            condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=$L2=\"Gift Received\"" }] },
            format: { backgroundColor: { red: 0.85, green: 0.96, blue: 0.85 } },
          },
        },
        index: 0,
      },
    });
    fmtRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 21 }],
          booleanRule: {
            condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=$L2=\"Declined\"" }] },
            format: { backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 }, textFormat: { foregroundColor: { red: 0.5, green: 0.5, blue: 0.5 } } },
          },
        },
        index: 0,
      },
    });
    // Overdue next-step: Next Step Date (R) < today AND Status (L) not final
    fmtRequests.push({
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId: gid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 21 }],
          booleanRule: {
            condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=AND($R2<>\"\",$R2<TODAY(),$L2<>\"Gift Received\",$L2<>\"Declined\",$L2<>\"Parked\")" }] },
            format: { backgroundColor: { red: 0.99, green: 0.92, blue: 0.92 } },
          },
        },
        index: 0,
      },
    });
  }

  if (newGids["Touchpoint Log"] !== undefined) {
    const gid = newGids["Touchpoint Log"];
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.239, green: 0.325, blue: 0.541 },
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
            padding: { top: 6, bottom: 6, left: 8, right: 8 },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,padding)",
      },
    });
    LOG_WIDTHS.forEach((pixelSize, idx) => {
      fmtRequests.push({
        updateDimensionProperties: {
          range: { sheetId: gid, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
          properties: { pixelSize }, fields: "pixelSize",
        },
      });
    });
    // Channel dropdown (D, 3)
    fmtRequests.push({
      setDataValidation: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 3, endColumnIndex: 4 },
        rule: { condition: { type: "ONE_OF_LIST", values: CHANNEL_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
      },
    });
    // Owner dropdown (E, 4)
    fmtRequests.push({
      setDataValidation: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 4, endColumnIndex: 5 },
        rule: { condition: { type: "ONE_OF_LIST", values: OWNER_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
      },
    });
    // Outcome dropdown (F, 5)
    fmtRequests.push({
      setDataValidation: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 5, endColumnIndex: 6 },
        rule: { condition: { type: "ONE_OF_LIST", values: OUTCOME_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
      },
    });
    // Amount currency (G, 6)
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 6, endColumnIndex: 7 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "\"$\"#,##0" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    });
    // Date (J, 9)
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: gid, startRowIndex: 1, endRowIndex: 5000, startColumnIndex: 9, endColumnIndex: 10 },
        cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    });
  }

  if (newGids["Dashboard"] !== undefined) {
    const gid = newGids["Dashboard"];
    // Title row
    fmtRequests.push({
      mergeCells: {
        range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
        mergeType: "MERGE_ROWS",
      },
    });
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: gid, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 18 }, padding: { top: 8, bottom: 8, left: 8 } } },
        fields: "userEnteredFormat(textFormat,padding)",
      },
    });
    // Section headers (A3, A10, etc.) — bold
    for (const row of [2, 9, 11 + STATUS_VALUES.length, 11 + STATUS_VALUES.length + 20, 11 + STATUS_VALUES.length + 40]) {
      fmtRequests.push({
        repeatCell: {
          range: { sheetId: gid, startRowIndex: row, endRowIndex: row + 1 },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 }, textFormat: { bold: true, fontSize: 13 }, padding: { top: 4, bottom: 4, left: 8 } } },
          fields: "userEnteredFormat(backgroundColor,textFormat,padding)",
        },
      });
    }
    // Column widths
    [220, 150, 120, 280, 130, 120].forEach((pixelSize, idx) => {
      fmtRequests.push({
        updateDimensionProperties: {
          range: { sheetId: gid, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
          properties: { pixelSize }, fields: "pixelSize",
        },
      });
    });
    // Currency format on money rows (B4, B5, B6, B7)
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: gid, startRowIndex: 3, endRowIndex: 7, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "\"$\"#,##0" }, textFormat: { bold: true } } },
        fields: "userEnteredFormat(numberFormat,textFormat)",
      },
    });
    // Percent format on B8
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: gid, startRowIndex: 7, endRowIndex: 8, startColumnIndex: 1, endColumnIndex: 2 },
        cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0%" }, textFormat: { bold: true } } },
        fields: "userEnteredFormat(numberFormat,textFormat)",
      },
    });
  }

  if (fmtRequests.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: fmtRequests },
    });
  }

  console.log(`\n✅ CRM tabs ready.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
}

main().catch((e) => { console.error(e); process.exit(1); });
