/**
 * Verify the speaker flow by reading Gitty's actual sent emails
 * to recent speakers (Esther Wein 4/14, Rebbetzin Fink 4/21+4/28).
 */
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

function decodeBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) return Buffer.from(payload.body.data, "base64").toString("utf-8");
  if (payload.parts) {
    const text = payload.parts.find((p) => p.mimeType === "text/plain");
    if (text?.body?.data) return Buffer.from(text.body.data, "base64").toString("utf-8");
    for (const p of payload.parts) {
      const n = decodeBody(p);
      if (n) return n;
    }
  }
  return "";
}
function header(headers, name) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

const targets = [
  { name: "Rebbetzin Dinah Fink", email: "Lvnglobal@gmail.com", classDates: ["4/21", "4/28"] },
  { name: "Esther Wein", email: "estwein@gmail.com", classDates: ["4/14"] },
];

for (const t of targets) {
  console.log(`\n========== ${t.name} (classes: ${t.classDates.join(", ")}) ==========`);
  // Search both directions: from her TO speaker, and from speaker TO her
  const queries = [
    { label: "FROM Gitty TO speaker", q: `to:${t.email}` },
    { label: "FROM speaker TO Gitty", q: `from:${t.email}` },
  ];
  for (const { label, q } of queries) {
    console.log(`\n--- ${label} (q: ${q}) ---`);
    const list = await gmail.users.messages.list({ userId: "me", q, maxResults: 10 });
    const ids = list.data.messages?.map((m) => m.id) || [];
    if (ids.length === 0) {
      console.log("  (no messages found)");
      continue;
    }
    for (const id of ids) {
      try {
        const m = await gmail.users.messages.get({ userId: "me", id, format: "full" });
        const h = m.data.payload?.headers || [];
        const date = header(h, "Date");
        const subject = header(h, "Subject");
        const from = header(h, "From");
        const to = header(h, "To");
        const body = decodeBody(m.data.payload).replace(/\r/g, "").trim().slice(0, 400);
        console.log(`\n  [${date.slice(0, 25)}]`);
        console.log(`  From: ${from}`);
        console.log(`  To:   ${to}`);
        console.log(`  Subj: ${subject}`);
        console.log(`  Body: ${body.split("\n").map((l) => "        " + l).join("\n").trim()}`);
      } catch {}
    }
  }
}
