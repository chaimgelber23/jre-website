/**
 * Deep workload read — pulls actual content (not just metadata) so we can
 * understand what Gitty actually does week to week.
 *
 *   - Training Manual doc (full text)
 *   - Pledges + projections + supplies sheets (rows)
 *   - Last 15 sent email bodies (subject + body excerpt)
 *   - Last 10 inbox bodies
 *
 * Run: node scripts/secretary-deep-read.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const KEYS = {
  accessToken: "gmail_jre_access_token",
  refreshToken: "gmail_jre_refresh_token",
  expiresAt: "gmail_jre_token_expires_at",
};

async function getAuth() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", Object.values(KEYS));
  const s = Object.fromEntries(data.map((r) => [r.key, r.value]));

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  oauth2.setCredentials({
    access_token: s[KEYS.accessToken],
    refresh_token: s[KEYS.refreshToken],
    expiry_date: Number(s[KEYS.expiresAt] || 0),
  });
  return oauth2;
}

function decodeBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts) {
    // Prefer text/plain
    const text = payload.parts.find((p) => p.mimeType === "text/plain");
    if (text?.body?.data) return Buffer.from(text.body.data, "base64").toString("utf-8");
    for (const p of payload.parts) {
      const nested = decodeBody(p);
      if (nested) return nested;
    }
  }
  return "";
}

function header(headers, name) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function shortAddr(s) {
  return s.replace(/.*</, "").replace(/>.*/, "").trim().toLowerCase();
}

function clean(s, max = 400) {
  return s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

async function main() {
  const auth = await getAuth();
  const gmail = google.gmail({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });
  const sheets = google.sheets({ version: "v4", auth });

  console.log("\n========== DEEP WORKLOAD READ ==========\n");

  // ----- Find target docs/sheets by name -----
  console.log("--- Finding target files ---");
  const wanted = [
    "JRE Program Coordinator Training Manual",
    "Next Level Pledges",
    "NEXT LEVEL campaign projections",
    "JRE Supplies and Food",
    "Tuesday Morning/Ladies Class Speakers",
    "$500+ 2023-2026",
  ];
  const fileMap = {};
  for (const name of wanted) {
    try {
      const res = await drive.files.list({
        q: `name='${name.replace(/'/g, "\\'")}' and trashed=false`,
        fields: "files(id,name,mimeType)",
        pageSize: 1,
      });
      const f = res.data.files?.[0];
      if (f) {
        fileMap[name] = f;
        console.log(`   ✅ ${name}  (${f.mimeType.split(".").pop()})`);
      } else {
        console.log(`   ❌ NOT FOUND: ${name}`);
      }
    } catch (e) {
      console.log(`   ⚠️  ${name}: ${e.message}`);
    }
  }

  // ----- Read Training Manual (Doc) -----
  console.log("\n========== JRE PROGRAM COORDINATOR TRAINING MANUAL ==========\n");
  const manual = fileMap["JRE Program Coordinator Training Manual"];
  if (manual) {
    try {
      const doc = await docs.documents.get({ documentId: manual.id });
      const text = (doc.data.body?.content || [])
        .map((el) =>
          (el.paragraph?.elements || [])
            .map((e) => e.textRun?.content || "")
            .join("")
        )
        .join("");
      console.log(text.slice(0, 8000));
      if (text.length > 8000) console.log(`\n[...TRUNCATED — full doc is ${text.length} chars]`);
    } catch (e) {
      console.log(`⚠️ could not read doc: ${e.message}`);
    }
  } else {
    console.log("(doc not found)");
  }

  // ----- Read sheets -----
  for (const name of ["Tuesday Morning/Ladies Class Speakers", "Next Level Pledges", "NEXT LEVEL campaign projections", "JRE Supplies and Food", "$500+ 2023-2026"]) {
    const f = fileMap[name];
    if (!f) continue;
    console.log(`\n========== SHEET: ${name} ==========`);
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId: f.id });
      const tabs = meta.data.sheets?.map((s) => s.properties.title) || [];
      console.log(`Tabs: ${tabs.join(", ")}`);
      // Read first tab, first 25 rows
      const firstTab = tabs[0];
      const valRes = await sheets.spreadsheets.values.get({
        spreadsheetId: f.id,
        range: `${firstTab}!A1:Z25`,
      });
      const rows = valRes.data.values || [];
      console.log(`\n(${firstTab}, first ${rows.length} rows)`);
      for (const row of rows) {
        console.log("   " + row.map((c) => String(c).slice(0, 30)).join(" | "));
      }
    } catch (e) {
      console.log(`⚠️  ${e.message}`);
    }
  }

  // ----- Read recent SENT email bodies -----
  console.log("\n========== LAST 15 SENT EMAILS (bodies) ==========\n");
  const sentList = await gmail.users.messages.list({
    userId: "me",
    q: "in:sent",
    maxResults: 15,
  });
  for (const ref of sentList.data.messages || []) {
    try {
      const m = await gmail.users.messages.get({ userId: "me", id: ref.id, format: "full" });
      const h = m.data.payload?.headers || [];
      const subject = header(h, "Subject");
      const to = shortAddr(header(h, "To"));
      const date = header(h, "Date");
      const body = decodeBody(m.data.payload);
      console.log(`📤 [${date.slice(0, 16)}]  → ${to}`);
      console.log(`   ${subject}`);
      console.log(`   ${clean(body, 350).split("\n").map((l) => "   " + l).join("\n")}`);
      console.log("");
    } catch {}
  }

  // ----- Read recent INBOX email bodies (skip noise) -----
  console.log("\n========== LAST 10 INBOX EMAILS (bodies) ==========\n");
  const inboxList = await gmail.users.messages.list({
    userId: "me",
    q: "in:inbox -from:noreply -from:no-reply -from:hello@usmobile.com",
    maxResults: 10,
  });
  for (const ref of inboxList.data.messages || []) {
    try {
      const m = await gmail.users.messages.get({ userId: "me", id: ref.id, format: "full" });
      const h = m.data.payload?.headers || [];
      const subject = header(h, "Subject");
      const from = shortAddr(header(h, "From"));
      const date = header(h, "Date");
      const body = decodeBody(m.data.payload);
      console.log(`📥 [${date.slice(0, 16)}]  ← ${from}`);
      console.log(`   ${subject}`);
      console.log(`   ${clean(body, 350).split("\n").map((l) => "   " + l).join("\n")}`);
      console.log("");
    } catch {}
  }

  console.log("\n========== DONE ==========\n");
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
