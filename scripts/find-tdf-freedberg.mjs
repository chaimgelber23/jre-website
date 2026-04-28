// Search Gitty's inbox for any TDF (Donor's Fund) email mentioning Freedberg,
// plus all recent TDF confirmations (last 14d) so we can spot the orphan grant.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const KEYS = { accessToken: "gmail_jre_access_token", refreshToken: "gmail_jre_refresh_token", expiresAt: "gmail_jre_token_expires_at" };
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from("app_settings").select("key,value").in("key", Object.values(KEYS));
const s = Object.fromEntries(data.map((r) => [r.key, r.value]));
const oauth2 = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET, process.env.GOOGLE_OAUTH_REDIRECT_URI);
oauth2.setCredentials({ access_token: s[KEYS.accessToken], refresh_token: s[KEYS.refreshToken], expiry_date: Number(s[KEYS.expiresAt]) });
oauth2.on("tokens", async (t) => {
  const now = new Date().toISOString();
  const rows = [{ key: KEYS.accessToken, value: t.access_token, updated_at: now }];
  if (t.expiry_date) rows.push({ key: KEYS.expiresAt, value: String(t.expiry_date), updated_at: now });
  if (t.refresh_token) rows.push({ key: KEYS.refreshToken, value: t.refresh_token, updated_at: now });
  await sb.from("app_settings").upsert(rows);
});
const gmail = google.gmail({ version: "v1", auth: oauth2 });

async function search(label, q, maxResults = 25) {
  const { data } = await gmail.users.messages.list({ userId: "me", q, maxResults });
  console.log(`\n=== ${label} — query: ${q}`);
  console.log(`    matches: ${data.messages?.length ?? 0}`);
  for (const m of data.messages ?? []) {
    const full = await gmail.users.messages.get({ userId: "me", id: m.id, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] });
    const h = Object.fromEntries((full.data.payload?.headers ?? []).map(x => [x.name, x.value]));
    console.log(`    - ${h.Date}\n      from: ${h.From}\n      subj: ${h.Subject}`);
  }
}

await search("ANY mention of Freedberg",          'freedberg newer_than:30d');
await search("TDF emails (donorsfund.org)",       'from:donorsfund.org newer_than:14d');
await search("TDF emails (thedonorsfund.org)",    'from:thedonorsfund.org newer_than:14d');
await search("TDF emails (tdfcharitable.org)",    'from:tdfcharitable.org newer_than:14d');
await search("Anything saying 'donor's fund'",    '"donor\'s fund" newer_than:14d', 15);
await search("Grant / confirmation in last 7d",   'subject:(grant OR confirmation) newer_than:7d', 15);
