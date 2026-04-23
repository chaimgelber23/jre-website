/**
 * Share the workflow sheet with cgelber@thejre.org as Editor.
 * Run AFTER re-authorizing OAuth (so drive.file scope is active).
 *
 * Usage: node scripts/share-workflow-sheet.mjs [<sheet_id>]
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const SHEET_ID = process.argv[2] || "1t9lwzRSG5lIbNi9JAxhe8fZlQ17V9AFdgP60E6IyMMk";
const SHARE_WITH = "cgelber@thejre.org";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: t } = await sb.from("app_settings").select("key,value").in("key", ["gmail_jre_access_token","gmail_jre_refresh_token","gmail_jre_token_expires_at"]);
const s = Object.fromEntries(t.map((r) => [r.key, r.value]));

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI
);
oauth2.setCredentials({
  access_token: s.gmail_jre_access_token,
  refresh_token: s.gmail_jre_refresh_token,
  expiry_date: Number(s.gmail_jre_token_expires_at),
});
oauth2.on("tokens", async (refreshed) => {
  if (!refreshed.access_token) return;
  const now = new Date().toISOString();
  const rows = [{ key: "gmail_jre_access_token", value: refreshed.access_token, updated_at: now }];
  if (refreshed.expiry_date) rows.push({ key: "gmail_jre_token_expires_at", value: String(refreshed.expiry_date), updated_at: now });
  if (refreshed.refresh_token) rows.push({ key: "gmail_jre_refresh_token", value: refreshed.refresh_token, updated_at: now });
  await sb.from("app_settings").upsert(rows);
});

const drive = google.drive({ version: "v3", auth: oauth2 });

console.log(`Sharing sheet ${SHEET_ID} with ${SHARE_WITH}...`);
try {
  const r = await drive.permissions.create({
    fileId: SHEET_ID,
    sendNotificationEmail: true,
    emailMessage: "JRE Women's Events workflow sheet — full task map + email templates.",
    requestBody: { role: "writer", type: "user", emailAddress: SHARE_WITH },
  });
  console.log(`✅ Shared. Permission id: ${r.data.id}`);
  console.log(`   ${SHARE_WITH} should receive an email invite shortly.`);
  console.log(`   URL: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`);
} catch (err) {
  if (err.code === 403) {
    console.error("❌ Still 403. Token does NOT have drive.file scope yet.");
    console.error("   Re-authorize at https://thejre.org/api/secretary/gmail/authorize");
    console.error("   in fresh incognito as glevi@thejre.org, then re-run this script.");
    process.exit(1);
  }
  throw err;
}
