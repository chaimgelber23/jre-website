#!/usr/bin/env node
// Share the campaign tracker sheet with a list of emails as editors.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { getAuthedClient, getTrackerSheetId } from "./campaign-tracker-lib.mjs";

const emails = process.argv.slice(2);
if (!emails.length) {
  console.error("Usage: node scripts/share-tracker-with.mjs email1@x.com email2@y.com ...");
  process.exit(1);
}

const { drive } = await getAuthedClient();
const sheetId = await getTrackerSheetId();
console.log(`Sharing https://docs.google.com/spreadsheets/d/${sheetId}/edit`);

for (const email of emails) {
  try {
    await drive.permissions.create({
      fileId: sheetId,
      requestBody: { type: "user", role: "writer", emailAddress: email },
      sendNotificationEmail: true,
      emailMessage: "This is the JRE campaign tracker. Each tab: Tasks (yours to do), Donor Pipeline (everyone to contact), Touchpoint Log (record every call/email), Dashboard (live status). Open anytime.",
    });
    console.log(`  ✅ shared with ${email}`);
  } catch (e) {
    console.error(`  ❌ ${email}: ${e.message}`);
  }
}
