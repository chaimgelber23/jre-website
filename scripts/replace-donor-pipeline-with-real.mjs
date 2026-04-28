#!/usr/bin/env node
/**
 * Migrate the live "Donor Pipeline" tab to mirror the rabbi's source layout
 * ("Copy of Donor Pipeline"), and load 192 real donors with year-by-year giving.
 *
 * SCHEMA (21 cols, A–G visible / H–U hidden) — matches the rabbi's view:
 *   VISIBLE:
 *     A: Name           B: 2023           C: 2024
 *     D: 2025           E: 2026           F: Grand Total
 *     G: Action         (rabbi's tag: Matcher / Ask / Commit / Fire / etc.)
 *   HIDDEN (operational):
 *     H: Email          I: Phone          J: Tier
 *     K: Level          L: Status         M: Asked $
 *     N: Pledged $      O: Received $     P: Owner
 *     Q: Next Step      R: Next Step Date S: Last Touch
 *     T: Notes          U: Thread ID
 *
 * Tier (auto, hidden): Major / 1A / 1B / 1C / 2B
 * Level (auto, hidden): Major ≥ $3,600 · Mid ≥ $1,000 · Entry ≥ $250 · Below > $0
 *
 * Flags:  --dry-run (default)  ·  --commit (apply)
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getSupabase, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

const DRY_RUN = !process.argv.includes("--commit");
const SOURCE_TAB = "Copy of Donor Pipeline";
const TARGET_TAB = "Donor Pipeline";

const HEADERS = [
  "Name",       "2023",       "2024",       "2025",       "2026",       "Grand Total", "Action",
  "Email",      "Phone",      "Tier",       "Level",      "Status",     "Asked $",     "Pledged $",
  "Received $", "Owner",      "Next Step",  "Next Step Date", "Last Touch", "Notes",   "Thread ID",
];
const COLUMN_COUNT = HEADERS.length; // 21
const VISIBLE_COL_COUNT = 7; // A–G
const WIDTHS = [200, 95, 95, 95, 95, 110, 130, 220, 130, 70, 70, 130, 90, 90, 90, 110, 280, 120, 120, 280, 180];
const TIER_VALUES = ["Major", "1A", "1B", "1C", "2A", "2B"];
const LEVEL_VALUES = ["Major", "Mid", "Entry", "Below"];
const STATUS_VALUES = ["Not Contacted", "Reached Out", "Conversation Had", "Pledge Made", "Gift Received", "Declined", "No Response", "Parked"];
const OWNER_VALUES = ["Chaim", "Rabbi Oratz", "Gitty", "Other"];
const ACTION_VALUES = ["Matcher", "Ask", "Commit", "Fire", "Try a little more", "Discuss", "Meeting In the City", "Go Up"];

// --- helpers --------------------------------------------------------------

function parseMoney(s) {
  if (!s) return 0;
  const n = parseFloat(String(s).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function levelFromLTD(ltd) {
  if (ltd >= 3600) return "Major";
  if (ltd >= 1000) return "Mid";
  if (ltd >= 250) return "Entry";
  if (ltd > 0) return "Below";
  return "";
}
function tierFromGiving({ y2023, y2024, y2025, y2026, ltd }) {
  const active = y2024 > 0 || y2025 > 0 || y2026 > 0;
  const lapsed = y2023 > 0 && !active;
  if (ltd >= 5000 && active) return "Major";
  if (lapsed && ltd >= 500) return "1B";
  if (lapsed) return "1A";
  if (active && ltd >= 500 && ltd < 5000) return "1C";
  if (active) return "2B";
  return "1A";
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\b(dr|mr|mrs|ms|miss|rabbi|reb|rav|prof|hon)\.?\b/g, "")
    .replace(/[^\w\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function parseName(raw) {
  const norm = normalize(raw);
  if (!norm) return [];
  const splitMatch = norm.match(/^(.*?)\s*(?:&|\band\b)\s*(.*?)\s+(\S+)$/);
  if (splitMatch) {
    const [, p1, p2, last] = splitMatch;
    const p1First = p1.trim().split(/\s+/)[0];
    const p2First = p2.trim().split(/\s+/)[0];
    return [{ first: p1First, last }, { first: p2First, last }];
  }
  const words = norm.split(/\s+/);
  if (words.length === 1) return [{ first: "", last: words[0] }];
  return [{ first: words.slice(0, -1).join(" "), last: words[words.length - 1] }];
}
function findContactMatch(candidates, contactsByLast) {
  for (const cand of candidates) {
    const bucket = contactsByLast.get(cand.last) || [];
    if (!bucket.length) continue;
    const exact = bucket.find((c) => normalize(c.first_name).split(/\s+/)[0] === cand.first);
    if (exact) return exact;
    const partial = bucket.find((c) => {
      const cf = normalize(c.first_name).split(/\s+/)[0];
      return cf && cand.first && (cf.startsWith(cand.first) || cand.first.startsWith(cf));
    });
    if (partial) return partial;
  }
  for (const cand of candidates) {
    const bucket = contactsByLast.get(cand.last) || [];
    if (bucket.length === 1) return bucket[0];
  }
  return null;
}

async function fetchAllContacts(supabase) {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("outreach_contacts")
      .select("id, first_name, last_name, email, phone")
      .eq("is_active", true)
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

// --- main -----------------------------------------------------------------

async function main() {
  console.log(`[${new Date().toISOString()}] Migrate Donor Pipeline (rabbi-view layout) ${DRY_RUN ? "(DRY RUN)" : "(WRITE)"}`);
  const supabase = getSupabase();
  const { sheets } = await getAuthedClient();
  const sheetId = await getTrackerSheetId();
  if (!sheetId) throw new Error("No tracker sheet id");
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);

  // 1. Load FULL source (cols A–Z) so we capture rabbi's action tags in cols G/J
  const srcRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SOURCE_TAB}!A2:Z2000` });
  const srcRowsRaw = srcRes.data.values || [];
  const srcRows = srcRowsRaw.filter((r) => {
    const name = (r[0] || "").trim();
    if (!name) return false;
    const ltd = parseMoney(r[5]) || parseMoney(r[1]) + parseMoney(r[2]) + parseMoney(r[3]) + parseMoney(r[4]);
    if (ltd === 0 && !(r[6] || r[9])) return false; // skip $0-LTD junk rows unless they have an action tag
    return true;
  });
  console.log(`Source rows: ${srcRows.length}`);

  // 2. Load Supabase contacts
  const contacts = await fetchAllContacts(supabase);
  const contactsByLast = new Map();
  for (const c of contacts) {
    const last = normalize(c.last_name).split(/\s+/).pop();
    if (!last) continue;
    if (!contactsByLast.has(last)) contactsByLast.set(last, []);
    contactsByLast.get(last).push(c);
  }
  console.log(`Supabase contacts: ${contacts.length} (${contactsByLast.size} unique last names)`);

  // 3. Build new rows (matching live schema A–U)
  const usedContactIds = new Set();
  let matched = 0;
  let actionTagsCarriedOver = 0;
  const out = srcRows.map((r) => {
    const name = (r[0] || "").trim();
    const y2023 = parseMoney(r[1]);
    const y2024 = parseMoney(r[2]);
    const y2025 = parseMoney(r[3]);
    const y2026 = parseMoney(r[4]);
    const ltd = parseMoney(r[5]) || y2023 + y2024 + y2025 + y2026;
    // Rabbi's action tag — usually col G (idx 6); one in col J (idx 9) for "Fire"
    const action = ((r[6] || r[9] || "")).trim();
    if (action) actionTagsCarriedOver++;

    const candidates = parseName(name);
    let contact = findContactMatch(candidates, contactsByLast);
    if (contact && usedContactIds.has(contact.id)) contact = null;
    if (contact) { usedContactIds.add(contact.id); matched++; }

    const tier = tierFromGiving({ y2023, y2024, y2025, y2026, ltd });
    const level = levelFromLTD(ltd);

    return [
      name,                    // A: Name
      y2023 || "",             // B: 2023
      y2024 || "",             // C: 2024
      y2025 || "",             // D: 2025
      y2026 || "",             // E: 2026
      ltd || "",               // F: Grand Total
      action,                  // G: Action (rabbi's tag)
      contact?.email || "",    // H: Email
      contact?.phone || "",    // I: Phone
      tier,                    // J: Tier
      level,                   // K: Level
      "Not Contacted",         // L: Status
      "",                      // M: Asked $
      "",                      // N: Pledged $
      "",                      // O: Received $
      "",                      // P: Owner
      "",                      // Q: Next Step
      "",                      // R: Next Step Date
      "",                      // S: Last Touch
      "",                      // T: Notes
      "",                      // U: Thread ID
    ];
  });

  // Sort by Grand Total desc — matches source ordering
  out.sort((a, b) => (Number(b[5]) || 0) - (Number(a[5]) || 0));

  // Stats
  const tierCounts = {}, levelCounts = {}, actionCounts = {};
  for (const r of out) {
    tierCounts[r[9]] = (tierCounts[r[9]] || 0) + 1;
    levelCounts[r[10] || "(none)"] = (levelCounts[r[10] || "(none)"] || 0) + 1;
    if (r[6]) actionCounts[r[6]] = (actionCounts[r[6]] || 0) + 1;
  }
  console.log(`\nMatched ${matched}/${out.length} donors to Supabase contacts.`);
  console.log(`Rabbi action tags carried over: ${actionTagsCarriedOver}`);
  console.log("By tier:", tierCounts);
  console.log("By level:", levelCounts);
  console.log("By action tag:", actionCounts);
  console.log("\nTop 5 by Grand Total:");
  for (const r of out.slice(0, 5)) {
    console.log(`  ${r[0].padEnd(34)} $${String(r[5]||0).padStart(11)}  ${r[9].padEnd(5)} ${(r[10]||"").padEnd(6)} ${(r[6]||"").padEnd(20)} ${r[7]||"(no email)"}`);
  }

  if (DRY_RUN) {
    console.log("\n(DRY RUN — pass --commit to migrate schema + write data)");
    return;
  }

  // 4. Schema migration on the target tab
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const tab = meta.data.sheets.find((s) => s.properties.title === TARGET_TAB);
  if (!tab) throw new Error(`Tab '${TARGET_TAB}' not found`);
  const tabGid = tab.properties.sheetId;
  const currentColCount = tab.properties.gridProperties.columnCount;
  const currentRowCount = tab.properties.gridProperties.rowCount;

  const migrationRequests = [];
  if (currentColCount < COLUMN_COUNT) {
    migrationRequests.push({ appendDimension: { sheetId: tabGid, dimension: "COLUMNS", length: COLUMN_COUNT - currentColCount } });
  }
  // Wipe old conditional format rules
  const oldRuleCount = (tab.conditionalFormats || []).length;
  for (let i = oldRuleCount - 1; i >= 0; i--) {
    migrationRequests.push({ deleteConditionalFormatRule: { sheetId: tabGid, index: i } });
  }
  // Wipe old data validation
  migrationRequests.push({
    setDataValidation: { range: { sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT } },
  });
  if (migrationRequests.length) {
    console.log(`Migrating schema (${migrationRequests.length} ops)...`);
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests: migrationRequests } });
  }

  // Clear old data + write new headers + data
  console.log(`Clearing ${TARGET_TAB}!A1:Z${Math.max(currentRowCount, 1000)} ...`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId, range: `${TARGET_TAB}!A1:Z${Math.max(currentRowCount, 1000)}`,
  });
  console.log(`Writing headers + ${out.length} donor rows ...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${TARGET_TAB}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [HEADERS, ...out] },
  });

  // Re-apply formatting + dropdowns + hide operational columns
  console.log("Applying header format, widths, dropdowns, currency/date formats, conditional formatting, hiding ops cols ...");
  const fmtRequests = [];

  // Header row format
  fmtRequests.push({
    repeatCell: {
      range: { sheetId: tabGid, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: {
        backgroundColor: { red: 0.239, green: 0.325, blue: 0.541 },
        textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
        padding: { top: 6, bottom: 6, left: 8, right: 8 },
      } },
      fields: "userEnteredFormat(backgroundColor,textFormat,padding)",
    },
  });
  // Freeze header row
  fmtRequests.push({
    updateSheetProperties: {
      properties: { sheetId: tabGid, gridProperties: { rowCount: Math.max(currentRowCount, 1000), columnCount: COLUMN_COUNT, frozenRowCount: 1 } },
      fields: "gridProperties(rowCount,columnCount,frozenRowCount)",
    },
  });
  // Column widths
  WIDTHS.forEach((pixelSize, idx) => {
    fmtRequests.push({
      updateDimensionProperties: {
        range: { sheetId: tabGid, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
        properties: { pixelSize }, fields: "pixelSize",
      },
    });
  });
  // Ensure cols A–G are visible (in case a previous run hid them)
  fmtRequests.push({
    updateDimensionProperties: {
      range: { sheetId: tabGid, dimension: "COLUMNS", startIndex: 0, endIndex: VISIBLE_COL_COUNT },
      properties: { hiddenByUser: false }, fields: "hiddenByUser",
    },
  });
  // Hide cols H–U (idx 7..20) so rabbi sees only A–G
  fmtRequests.push({
    updateDimensionProperties: {
      range: { sheetId: tabGid, dimension: "COLUMNS", startIndex: VISIBLE_COL_COUNT, endIndex: COLUMN_COUNT },
      properties: { hiddenByUser: true }, fields: "hiddenByUser",
    },
  });
  // Currency format on B,C,D,E,F (years + Grand Total) and M,N,O (Asked/Pledged/Received)
  for (const colIdx of [1, 2, 3, 4, 5, 12, 13, 14]) {
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "\"$\"#,##0" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    });
  }
  // Date format on R, S (Next Step Date, Last Touch — idx 17, 18)
  for (const colIdx of [17, 18]) {
    fmtRequests.push({
      repeatCell: {
        range: { sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
        cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    });
  }
  // Action dropdown (col G, idx 6) — visible on rabbi's view, lets him pick from canonical tags
  fmtRequests.push({
    setDataValidation: {
      range: { sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 6, endColumnIndex: 7 },
      rule: { condition: { type: "ONE_OF_LIST", values: ACTION_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
    },
  });
  // Tier dropdown (col J, idx 9)
  fmtRequests.push({
    setDataValidation: {
      range: { sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 9, endColumnIndex: 10 },
      rule: { condition: { type: "ONE_OF_LIST", values: TIER_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
    },
  });
  // Level dropdown (col K, idx 10)
  fmtRequests.push({
    setDataValidation: {
      range: { sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 10, endColumnIndex: 11 },
      rule: { condition: { type: "ONE_OF_LIST", values: LEVEL_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
    },
  });
  // Status dropdown (col L, idx 11)
  fmtRequests.push({
    setDataValidation: {
      range: { sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 11, endColumnIndex: 12 },
      rule: { condition: { type: "ONE_OF_LIST", values: STATUS_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: true },
    },
  });
  // Owner dropdown (col P, idx 15)
  fmtRequests.push({
    setDataValidation: {
      range: { sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 15, endColumnIndex: 16 },
      rule: { condition: { type: "ONE_OF_LIST", values: OWNER_VALUES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: false },
    },
  });
  // Conditional format — Tier=Major: gold
  fmtRequests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 9, endColumnIndex: 10 }],
        booleanRule: {
          condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "Major" }] },
          format: { backgroundColor: { red: 0.99, green: 0.95, blue: 0.80 }, textFormat: { bold: true, foregroundColor: { red: 0.55, green: 0.38, blue: 0.0 } } },
        },
      },
      index: 0,
    },
  });
  // Action tag highlight (col G) — gold for any action set
  fmtRequests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 6, endColumnIndex: 7 }],
        booleanRule: {
          condition: { type: "NOT_BLANK" },
          format: { backgroundColor: { red: 0.99, green: 0.95, blue: 0.80 }, textFormat: { bold: true, foregroundColor: { red: 0.55, green: 0.38, blue: 0.0 } } },
        },
      },
      index: 0,
    },
  });
  // Status row colors (driven by hidden col L)
  fmtRequests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT }],
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
        ranges: [{ sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=$L2=\"Declined\"" }] },
          format: { backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 }, textFormat: { foregroundColor: { red: 0.5, green: 0.5, blue: 0.5 } } },
        },
      },
      index: 0,
    },
  });
  // Overdue follow-up (driven by hidden col R)
  fmtRequests.push({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId: tabGid, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: COLUMN_COUNT }],
        booleanRule: {
          condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: "=AND($R2<>\"\",$R2<TODAY(),$L2<>\"Gift Received\",$L2<>\"Declined\",$L2<>\"Parked\")" }] },
          format: { backgroundColor: { red: 0.99, green: 0.92, blue: 0.92 } },
        },
      },
      index: 0,
    },
  });

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests: fmtRequests } });

  console.log(`\n✅ Migrated Donor Pipeline. Rabbi sees clean A–G view; ops cols H–U hidden.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
}

main().catch((e) => { console.error(e); process.exit(1); });
