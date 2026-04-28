#!/usr/bin/env node
/**
 * Sync Rabbi Oratz's "Campaign Documents Necessary 2026" Google Doc → tracker sheet.
 *
 * Pulls the doc fresh each run so changes (dates, goal, copy) flow in.
 *   - Creates/updates a "Campaign Brief" tab with the full doc text, sectioned.
 *   - Updates Timeline dates for CAMPAIGN STARTS / CAMPAIGN ENDS from the doc.
 *   - Updates Dashboard goal amount from the doc.
 *   - Populates "New Copy (2026)" column in Next Level Flyers tab for
 *     Brochure / Easel Poster / General Flyer / Matcher Flyer.
 *
 * Re-run this any time the source doc changes.
 *
 * Usage: node scripts/sync-campaign-brief.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

const DOC_ID = "1tvFVcvUxtBMVy8wNX18PqzgtuIcEfK6NXvNV3IdjwtM";

// ---- Parse the doc -------------------------------------------------------

function parseDoc(fullText) {
  const text = fullText.replace(/\r\n/g, "\n");

  // Amount (first $ figure)
  const goalMatch = text.match(/\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)/);
  const goalAmount = goalMatch ? parseFloat(goalMatch[1].replace(/,/g, "")) : null;

  // Slogan — heuristic: first line with a phrase right after "slogan is" or first ALL-CAPS short phrase
  const sloganMatch = text.match(/slogan is ([A-Z][A-Z ]+[A-Z])/);
  const slogan = sloganMatch ? sloganMatch[1].trim() : "";

  // URL
  const urlMatch = text.match(/\b(?:https?:\/\/)?((?:www\.)?thejre\.org\/[a-zA-Z0-9_\-\/]+)/);
  const url = urlMatch ? urlMatch[1] : "";

  // Date — find June X-Y pattern
  const dateMatch = text.match(/June\s+(\d{1,2})[-–](\d{1,2})(?:,\s*(\d{4}))?/i);
  const startDay = dateMatch ? parseInt(dateMatch[1]) : null;
  const endDay = dateMatch ? parseInt(dateMatch[2]) : null;
  const year = dateMatch && dateMatch[3] ? parseInt(dateMatch[3]) : 2026;
  const startDate = startDay ? `${year}-06-${String(startDay).padStart(2, "0")}` : null;
  const endDate = endDay ? `${year}-06-${String(endDay).padStart(2, "0")}` : null;

  // Matcher tiers — find the "$25,000 Platinum / $18,000 Gold / ..." block
  const matcherTiers = [];
  const tierLines = text.match(/\$[\d,]+\s+(Platinum|Gold|Silver|Bronze)/gi) || [];
  for (const line of tierLines) {
    const m = line.match(/\$([\d,]+)\s+(\w+)/);
    if (m) matcherTiers.push({ amount: parseFloat(m[1].replace(/,/g, "")), label: m[2] });
  }

  // Split into sections by heading-like lines (heuristic: short lines, followed by body)
  const sections = splitSections(text);

  return { goalAmount, slogan, url, startDate, endDate, matcherTiers, sections, fullText: text };
}

function splitSections(text) {
  // Treat any line that matches known flyer/brochure names as a section header
  const HEADINGS = [/^Brochure/i, /^Easel Poster/i, /^For the New General Flier/i, /^General Flier/i, /^Matcher Flier/i, /^First Side/i, /^Second Side/i];
  const lines = text.split("\n");
  const sections = [];
  let current = { title: "Intro", body: [] };
  for (const line of lines) {
    const l = line.trim();
    if (!l) {
      if (current.body.length) current.body.push("");
      continue;
    }
    if (HEADINGS.some((re) => re.test(l))) {
      if (current.body.length || current.title !== "Intro") sections.push(current);
      current = { title: l, body: [] };
    } else {
      current.body.push(l);
    }
  }
  if (current.body.length) sections.push(current);
  return sections.map((s) => ({ title: s.title, body: s.body.join("\n").trim() }));
}

// ---- Apply to sheet ------------------------------------------------------

async function main() {
  const { sheets, docs } = await getAuthedClient();
  const sheetId = await getTrackerSheetId();
  if (!sheetId) throw new Error("No tracker sheet id");

  console.log(`Reading doc ${DOC_ID}...`);
  const doc = await docs.documents.get({ documentId: DOC_ID });
  const rawText = (doc.data.body?.content || [])
    .map((el) => (el.paragraph?.elements || []).map((e) => e.textRun?.content || "").join(""))
    .join("");

  const parsed = parseDoc(rawText);
  console.log(`  goal: $${parsed.goalAmount?.toLocaleString() || "?"}`);
  console.log(`  slogan: "${parsed.slogan}"`);
  console.log(`  url: ${parsed.url}`);
  console.log(`  dates: ${parsed.startDate} → ${parsed.endDate}`);
  console.log(`  matcher tiers: ${parsed.matcherTiers.map(t => `$${t.amount.toLocaleString()} ${t.label}`).join(", ")}`);
  console.log(`  sections: ${parsed.sections.length}`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const tabs = Object.fromEntries(meta.data.sheets.map((s) => [s.properties.title, s.properties]));

  // ---- 1. Campaign Brief tab (create or refresh) -------------------------
  let briefGid = tabs["Campaign Brief"]?.sheetId;
  if (briefGid === undefined) {
    console.log("\nCreating Campaign Brief tab...");
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Campaign Brief", gridProperties: { rowCount: 400, columnCount: 4 } } } }],
      },
    });
    briefGid = addRes.data.replies[0].addSheet.properties.sheetId;
  } else {
    console.log("\nRefreshing Campaign Brief tab...");
    // Clear existing content
    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: "Campaign Brief!A1:D400" });
  }

  // Build content rows
  const rows = [
    [`🔥 ${parsed.slogan || "ON FIRE"} — JRE June Campaign 2026`],
    [""],
    [`Goal: $${parsed.goalAmount?.toLocaleString() || "?"}`],
    [`Dates: ${parsed.startDate || "?"} → ${parsed.endDate || "?"}`],
    [`URL: ${parsed.url || "?"}`],
    [""],
    [`Source: https://docs.google.com/document/d/${DOC_ID}/edit`],
    [`Last synced: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`],
    [""],
    ["MATCHER TIERS"],
    ...parsed.matcherTiers.map((t) => [`  $${t.amount.toLocaleString()} ${t.label}`]),
    [""],
    ["────────────────────────────────────────────"],
    [""],
  ];
  for (const s of parsed.sections) {
    rows.push([s.title.toUpperCase()]);
    rows.push([s.body]);
    rows.push([""]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Campaign Brief!A1:A${rows.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        { repeatCell: { range: { sheetId: briefGid, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.98, green: 0.27, blue: 0.11 }, textFormat: { bold: true, fontSize: 18, foregroundColor: { red: 1, green: 1, blue: 1 } }, padding: { top: 10, bottom: 10, left: 10 } } }, fields: "userEnteredFormat(backgroundColor,textFormat,padding)" } },
        { mergeCells: { range: { sheetId: briefGid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 }, mergeType: "MERGE_ROWS" } },
        { updateDimensionProperties: { range: { sheetId: briefGid, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 800 }, fields: "pixelSize" } },
        { repeatCell: { range: { sheetId: briefGid, startRowIndex: 1, endRowIndex: rows.length, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP", padding: { top: 4, bottom: 4, left: 8 } } }, fields: "userEnteredFormat(wrapStrategy,verticalAlignment,padding)" } },
      ],
    },
  });
  console.log(`  Wrote ${rows.length} lines.`);

  // ---- 2. Timeline dates — NOT auto-overwritten ------------------------
  // Per user: "dates in the doc are not always true, but the logic is."
  // So we DON'T touch Timeline dates. The Campaign Brief tab shows what the
  // doc says so you can see the suggested dates and update Timeline manually
  // when they're locked.
  if (parsed.startDate && parsed.endDate) {
    console.log(`\nTimeline dates from doc (not applied — update Timeline manually): ${parsed.startDate} → ${parsed.endDate}`);
  }

  // ---- 3. Dashboard goal ------------------------------------------------
  if (parsed.goalAmount) {
    console.log(`\nUpdating Dashboard goal to $${parsed.goalAmount.toLocaleString()}...`);
    // Row 7 is "Gap to Goal ($250k)" label + formula. Update both.
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "Dashboard!A7", values: [[`Gap to Goal ($${Math.round(parsed.goalAmount / 1000)}k)`]] },
          { range: "Dashboard!B7", values: [[`=${parsed.goalAmount}-IFERROR(SUM('Donor Pipeline'!I2:I),0)`]] },
        ],
      },
    });
  }

  // ---- 4. Flyers tab — populate New Copy for flyers mentioned in doc ----
  if (tabs["Next Level Flyers"]) {
    console.log("\nUpdating Next Level Flyers 'New Copy (2026)' column...");
    const flyerRes = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "Next Level Flyers!A3:G40" });
    const flyerRows = flyerRes.data.values || [];

    const flyerMap = {
      "JRE_Campaign Brochure 2025": buildBrochureCopy(parsed),
      "Easel Poster 3x4": buildEaselCopy(parsed),
      "General Flyer": buildGeneralCopy(parsed),
      "Matcher Flyer": buildMatcherCopy(parsed),
      "Matchers Poster 3x4": buildMatcherCopy(parsed),
    };

    let updated = 0;
    for (let i = 0; i < flyerRows.length; i++) {
      const name = flyerRows[i][0];
      if (!name) continue;
      const newCopy = flyerMap[name];
      if (!newCopy) continue;
      const currCopy = flyerRows[i][3] || "";
      if (currCopy === newCopy) continue; // already up to date
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [
            { range: `Next Level Flyers!B${i + 3}`, values: [["Drafted"]] },
            { range: `Next Level Flyers!D${i + 3}`, values: [[newCopy]] },
          ],
        },
      });
      updated++;
    }
    console.log(`  Updated ${updated} flyer rows.`);
  }

  console.log(`\n✅ Campaign brief synced.`);
  console.log(`Sheet: https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
}

// ---- Flyer copy builders (assemble structured text from the doc sections) ----

function buildBrochureCopy(p) {
  return [
    `FRONT COVER: "${p.slogan || "ON FIRE"}"`,
    `Amount: $${(p.goalAmount || 0).toLocaleString()}`,
    `URL: ${p.url || "thejre.org/onfire"}`,
    ``,
    `BOX COPY: Join us as we raise $${(p.goalAmount || 300000).toLocaleString()} so we can bring you Classes, Events, and Experiences that are ${p.slogan || "ON FIRE"}. Because that's the way it's supposed to be.`,
  ].join("\n");
}

function buildEaselCopy(p) {
  return [
    `10+ Classes A Week`,
    `Shteigers! Teen Boys Learning`,
    `Now What? Bat Mitzvah Program`,
    `Over 170 Hours Weekly Learning`,
    `Community Night Kollel`,
    ``,
    `Servicing (small print): White Plains, Scarsdale, New Rochelle, Larchmont, Mamaroneck, Harrison, West Harrison, Rivertowns, Hartsdale, Rye`,
    ``,
    `BOTTOM BOXES: Torah-On Fire · Events-On Fire · Teacher-On Fire · Brisket-On THE Fire`,
    ``,
    `Date: June ${(p.startDate || "").slice(-2)}-${(p.endDate || "").slice(-2)}, 2026`,
  ].join("\n");
}

function buildGeneralCopy(p) {
  return [
    `FRONT (model after Easel Poster):`,
    `"Because you should have an experience that is ${p.slogan || "ON FIRE"}"`,
    `June ${(p.startDate || "").slice(-2)}-${(p.endDate || "").slice(-2)}`,
    `Join us in raising $${(p.goalAmount || 300000).toLocaleString()}`,
    ``,
    `Small print: Help us keep bringing you experiences that are On Fire — so we can continue to grow and elevate our community.`,
    ``,
    `BOTTOM: Torah-On Fire · Events-On Fire · Teacher-On Fire · Brisket-On THE Fire`,
    `+ Rabbi's name + email`,
    ``,
    `BACK: Modeled after 2025 General Flier back cover.`,
  ].join("\n");
}

function buildMatcherCopy(p) {
  const tiers = p.matcherTiers.length
    ? p.matcherTiers.map((t) => `  $${t.amount.toLocaleString()} ${t.label}`).join("\n")
    : `  $25,000 Platinum\n  $18,000 Gold\n  $12,000 Silver\n  $6,000 Bronze`;
  return [
    `FRONT:`,
    `Bringing You Experiences that are ${p.slogan || "ON FIRE"}`,
    `June ${(p.startDate || "").slice(-2)}-${(p.endDate || "").slice(-2)} · Join us in Raising $${(p.goalAmount || 300000).toLocaleString()}`,
    ``,
    `Small print: Help us keep bringing you experiences that are On Fire — so we can continue to grow and elevate our community.`,
    ``,
    `Bottom: Torah-On Fire · Events-On Fire · Teacher-On Fire · Brisket-On THE Fire + Rabbi's name + email`,
    ``,
    `BACK:`,
    `Be a part of helping us provide experiences that are On Fire`,
    ``,
    tiers,
    ``,
    `Bottom taglines:`,
    `- Thousands of hours of learning with men, women, and teens`,
    `- Incredible teachers from around the world at Growing and Glowing`,
    `- Engaging events for the entire spectrum of the community`,
    `- Inspiring and reaching hundreds of people`,
    `- Helping people find meaning in their Torah, Mitzvos, and Shabbos observance`,
  ].join("\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
