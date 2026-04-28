#!/usr/bin/env node
// Delete the 3 CRM tabs so add-crm-tabs can re-run cleanly.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

const TABS = ["Donor Pipeline", "Touchpoint Log", "Dashboard"];

const { sheets } = await getAuthedClient();
const sheetId = await getTrackerSheetId();
const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
const toDelete = meta.data.sheets.filter((s) => TABS.includes(s.properties.title));
if (!toDelete.length) {
  console.log("No CRM tabs to delete.");
  process.exit(0);
}
await sheets.spreadsheets.batchUpdate({
  spreadsheetId: sheetId,
  requestBody: { requests: toDelete.map((s) => ({ deleteSheet: { sheetId: s.properties.sheetId } })) },
});
console.log(`Deleted: ${toDelete.map((s) => s.properties.title).join(", ")}`);
