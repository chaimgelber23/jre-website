#!/usr/bin/env node
/**
 * Idempotent upgrade for the Campaign Tracker sheet:
 *   1. Add "Level" column (Q) to Donor Pipeline — Major / Mid / Entry / Below
 *      Dropdown + populate from existing LTD ($) values.
 *   2. Add "Timeline" tab — structured for Rabbi Oratz's campaign dates.
 *   3. Add "Next Level Flyers" tab — lists the 12 PDFs in the
 *      "New NEXT LEVEL Flyers (Honey)" folder with Drive links.
 *
 * Run any time — safe to re-run. Only creates what's missing.
 *
 * Usage: node scripts/upgrade-crm-levels-and-tabs.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

const FLYERS_FOLDER_ID = "1MFvPSUlN989eMdwbH2xaWzTA2wyRfz6T"; // New NEXT LEVEL Flyers (Honey)

const LEVEL_VALUES = ["Major", "Mid", "Entry", "Below", "Unknown"];

function levelFromLTD(ltd) {
  const n = typeof ltd === "number" ? ltd : parseFloat(String(ltd || "").replace(/[$,]/g, ""));
  if (!Number.isFinite(n)) return "";
  if (n >= 3600) return "Major";
  if (n >= 1000) return "Mid";
  if (n >= 250) return "Entry";
  if (n > 0) return "Below";
  return "";
}

async function main() {
  const { sheets, drive } = await getAuthedClient();
  const sheetId = await getTrackerSheetId();
  if (!sheetId) throw new Error("No tracker sheet id");
  console.log(`Upgrading sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const tabs = Object.fromEntries(meta.data.sheets.map((s) => [s.properties.title, s.properties]));

  // ---- 1. Populate Level (col K) from Grand Total (col I) -----------------
  // The new schema has Level + Grand Total built in; this script just refreshes
  // Level values for any rows where it's blank, preserving manual edits.
  const pipelineGid = tabs["Donor Pipeline"]?.sheetId;
  if (pipelineGid === undefined) throw new Error("Donor Pipeline tab missing — run add-crm-tabs first");

  const totalRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId, range: "Donor Pipeline!F2:F1000",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const levelRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId, range: "Donor Pipeline!K2:K1000",
  });
  const totalCol = totalRes.data.values || [];
  const levelCol = levelRes.data.values || [];
  const newLevels = totalCol.map((row, i) => {
    const currLevel = levelCol[i]?.[0] || "";
    if (currLevel) return [currLevel]; // preserve manual edits
    return [levelFromLTD(row?.[0])];
  });
  const nonEmpty = newLevels.filter((r) => r[0]).length;
  if (nonEmpty > 0 && newLevels.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Donor Pipeline!K2:K${1 + newLevels.length}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: newLevels },
    });
    console.log(`  Populated Level for ${nonEmpty} rows (preserving manual edits).`);
  } else {
    console.log(`  No Level updates needed.`);
  }

  // ---- 2. Timeline tab ----------------------------------------------------
  if (!tabs["Timeline"]) {
    console.log("  Adding Timeline tab...");
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Timeline", gridProperties: { rowCount: 100, columnCount: 8, frozenRowCount: 1 } } } }],
      },
    });
    const timelineGid = addRes.data.replies[0].addSheet.properties.sheetId;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "Timeline!A1:H1", values: [["Date", "Milestone", "Owner", "What", "Status", "Depends On", "Notes", "Link"]] },
          {
            range: "Timeline!A2:H20",
            values: [
              ["", "Lock donor list", "Chaim", "Final donor list in Donor Pipeline tab + Level set for everyone", "In Progress", "", "104 donors pulled from Supabase; reconcile against Mrs. Levy's list", ""],
              ["", "Finish Next Level flyer writing", "Rabbi Oratz", "Write copy for every tier flyer", "Not Started", "", "First 2 tiers ready to go per Rabbi on 4/22 call", ""],
              ["", "Send flyers to designer (Honey)", "Gitty", "Gitty ships the finished copy to the designer", "Not Started", "Flyer writing done", "Existing 2025 designs are in Drive folder — use as reference", "https://drive.google.com/drive/folders/1MFvPSUlN989eMdwbH2xaWzTA2wyRfz6T"],
              ["", "Receive new flyer PDFs back", "Gitty", "Confirm all tier PDFs in Drive", "Not Started", "Send to designer", "", ""],
              ["", "Brooklyn Parlor Meeting", "Rabbi Oratz", "Host parlor meeting w/ majors", "Not Started", "Flyers done", "", ""],
              ["", "Farbi event (major donor event)", "Rabbi Oratz", "The big in-person event leading into the campaign", "Not Started", "Flyers done", "Beautiful event per Rabbi on 4/22 call", ""],
              ["", "Outreach window — Majors", "Rabbi Oratz", "1:1 + 2:1 meetings with $3.6k+ donors", "Not Started", "Flyers done", "Paul Greenberg, Paul Warhit, etc.", ""],
              ["", "Outreach window — Mid tier", "Rabbi Oratz + Abby", "Personal outreach to $1k-$3.6k donors", "Not Started", "Majors outreach in progress", "", ""],
              ["", "Outreach window — Entry", "Chaim / team", "Reach out to $250-$1k donors", "Not Started", "Mid tier progressing", "", ""],
              ["", "Campaign payment page ready", "Chaim", "Campaign page live on site — DAF Pay + OJC + Donors Fund + credit card", "Not Started", "", "Research whether we clone Charidy's flow to save $6,500/campaign", ""],
              ["2026-06-07", "CAMPAIGN STARTS", "—", "36-hour campaign begins (Sun 9 AM ET)", "Not Started", "All of the above", "Per campaigns table: jre-june-2026", ""],
              ["2026-06-09", "CAMPAIGN ENDS", "—", "Campaign closes (Tue 9 PM ET)", "Not Started", "", "", ""],
              ["", "Matching push — midway", "Rabbi Oratz", "Personal calls for momentum during 36hr window", "Not Started", "Campaign live", "", ""],
              ["", "Thank-you letters — majors", "Rabbi Oratz", "Handwritten / signed", "Not Started", "Campaign ends", "", ""],
              ["", "Thank-you letters — everyone else", "Gitty", "Enter gifts into Donorsnap → Thank You template → mail", "Not Started", "Campaign ends", "See coordinator training manual", ""],
              ["", "Collect outstanding pledges", "Gitty + Chaim", "Chase down pledges that weren't card-processed (DAF, checks, etc.)", "Not Started", "Campaign ends", "Outstanding pledge tab in Drive", ""],
              ["", "Post-campaign report", "Chaim", "Send Rabbi the numbers + lessons learned", "Not Started", "Pledges mostly in", "", ""],
              ["", "", "", "", "", "", "", ""],
              ["", "", "", "", "", "", "", ""],
            ],
          },
        ],
      },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: timelineGid, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.239, green: 0.325, blue: 0.541 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
                  padding: { top: 6, bottom: 6, left: 8, right: 8 },
                },
              },
              fields: "userEnteredFormat(backgroundColor,textFormat,padding)",
            },
          },
          { setDataValidation: {
              range: { sheetId: timelineGid, startRowIndex: 1, endRowIndex: 100, startColumnIndex: 4, endColumnIndex: 5 },
              rule: { condition: { type: "ONE_OF_LIST", values: ["Not Started","In Progress","Done","Blocked","Skipped"].map((v)=>({userEnteredValue:v})) }, showCustomUi: true, strict: true },
            },
          },
          { repeatCell: {
              range: { sheetId: timelineGid, startRowIndex: 1, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 1 },
              cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } },
              fields: "userEnteredFormat.numberFormat",
            },
          },
          ...[[100,200,330,110,120,240,80]].flatMap(() => [100,200,140,330,110,200,240,180].map((w, i) => ({
            updateDimensionProperties: {
              range: { sheetId: timelineGid, dimension: "COLUMNS", startIndex: i, endIndex: i+1 },
              properties: { pixelSize: w }, fields: "pixelSize",
            },
          }))),
          // Overdue row highlight
          { addConditionalFormatRule: { rule: { ranges: [{ sheetId: timelineGid, startRowIndex: 1, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 8 }], booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=AND($A2<>\"\",$A2<TODAY(),$E2<>\"Done\",$E2<>\"Skipped\")" }] }, format: { backgroundColor: { red: 0.99, green: 0.92, blue: 0.92 } } } }, index: 0 } },
          // Done row highlight
          { addConditionalFormatRule: { rule: { ranges: [{ sheetId: timelineGid, startRowIndex: 1, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 8 }], booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Done" }] }, format: { backgroundColor: { red: 0.88, green: 0.96, blue: 0.88 }, textFormat: { foregroundColor: { red: 0.3, green: 0.55, blue: 0.3 } } } } }, index: 0 } },
        ],
      },
    });
    console.log("  Timeline tab created with 17 milestone rows.");
  } else {
    console.log("  Timeline tab already exists.");
  }

  // ---- 3. Next Level Flyers tab ------------------------------------------
  if (!tabs["Next Level Flyers"]) {
    console.log("  Adding Next Level Flyers tab...");

    // Enumerate the flyer folder
    const listRes = await drive.files.list({
      q: `'${FLYERS_FOLDER_ID}' in parents and trashed=false`,
      fields: "files(id,name,mimeType,modifiedTime)",
      pageSize: 100,
      orderBy: "name",
    });
    const files = listRes.data.files || [];

    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Next Level Flyers", gridProperties: { rowCount: 40, columnCount: 7, frozenRowCount: 2 } } } }],
      },
    });
    const flyerGid = addRes.data.replies[0].addSheet.properties.sheetId;

    const header1 = ["📂 Reference folder (old designs)", "", "", "", "", "", ""];
    const header1Link = `https://drive.google.com/drive/folders/${FLYERS_FOLDER_ID}`;
    const headerRow = ["Flyer Name", "Status", "Old PDF (2025 reference)", "New Copy (2026)", "Designer", "Sent to Designer", "Notes"];

    const flyerRows = files.map((f) => [
      f.name.replace(/\.pdf$/i, ""),
      "To Rewrite",
      `=HYPERLINK("https://drive.google.com/file/d/${f.id}/view","${f.name}")`,
      "", // new copy — Rabbi fills
      "Honey", // default designer name from folder
      "", // sent date
      "",
    ]);

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "Next Level Flyers!A1:G1", values: [[`=HYPERLINK("${header1Link}","📂 Open reference folder (old 2025 designs)")`, "", "", "", "", "", ""]] },
          { range: "Next Level Flyers!A2:G2", values: [headerRow] },
          { range: "Next Level Flyers!A3:G" + (2 + flyerRows.length), values: flyerRows },
        ],
      },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          // Title row — big + highlighted
          { repeatCell: { range: { sheetId: flyerGid, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.94, green: 0.96, blue: 0.99 }, textFormat: { bold: true, fontSize: 13 }, padding: { top: 8, bottom: 8, left: 8 } } }, fields: "userEnteredFormat(backgroundColor,textFormat,padding)" } },
          { mergeCells: { range: { sheetId: flyerGid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 }, mergeType: "MERGE_ROWS" } },
          // Header row
          { repeatCell: { range: { sheetId: flyerGid, startRowIndex: 1, endRowIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.239, green: 0.325, blue: 0.541 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 }, padding: { top: 6, bottom: 6, left: 8, right: 8 } } }, fields: "userEnteredFormat(backgroundColor,textFormat,padding)" } },
          // Status dropdown
          { setDataValidation: { range: { sheetId: flyerGid, startRowIndex: 2, endRowIndex: 40, startColumnIndex: 1, endColumnIndex: 2 }, rule: { condition: { type: "ONE_OF_LIST", values: ["To Rewrite","Drafted","With Designer","Approved","Printed","Not Needed"].map((v)=>({userEnteredValue:v})) }, showCustomUi: true, strict: true } } },
          // Date format col F
          { repeatCell: { range: { sheetId: flyerGid, startRowIndex: 2, endRowIndex: 40, startColumnIndex: 5, endColumnIndex: 6 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } }, fields: "userEnteredFormat.numberFormat" } },
          // Column widths
          ...[260, 130, 300, 320, 110, 130, 220].map((w, i) => ({
            updateDimensionProperties: { range: { sheetId: flyerGid, dimension: "COLUMNS", startIndex: i, endIndex: i+1 }, properties: { pixelSize: w }, fields: "pixelSize" },
          })),
          // Approved = green
          { addConditionalFormatRule: { rule: { ranges: [{ sheetId: flyerGid, startRowIndex: 2, endRowIndex: 40, startColumnIndex: 0, endColumnIndex: 7 }], booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Approved" }] }, format: { backgroundColor: { red: 0.88, green: 0.96, blue: 0.88 } } } }, index: 0 } },
          { addConditionalFormatRule: { rule: { ranges: [{ sheetId: flyerGid, startRowIndex: 2, endRowIndex: 40, startColumnIndex: 0, endColumnIndex: 7 }], booleanRule: { condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Printed" }] }, format: { backgroundColor: { red: 0.88, green: 0.96, blue: 0.88 } } } }, index: 0 } },
        ],
      },
    });
    console.log(`  Next Level Flyers tab created with ${files.length} flyers linked.`);
  } else {
    console.log("  Next Level Flyers tab already exists.");
  }

  console.log(`\n✅ Upgrade complete.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
}

main().catch((e) => { console.error(e); process.exit(1); });
