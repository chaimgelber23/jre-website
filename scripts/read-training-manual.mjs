/**
 * Read JRE Program Coordinator Training Manual from Gitty's drive.
 * Saves full text to docs/jre-coordinator-training-manual-extract.md
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const KEYS = {
  accessToken: "gmail_jre_access_token",
  refreshToken: "gmail_jre_refresh_token",
  expiresAt: "gmail_jre_token_expires_at",
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data } = await supabase.from("app_settings").select("key, value").in("key", Object.values(KEYS));
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

oauth2.on("tokens", async (tokens) => {
  if (tokens.access_token) {
    console.log("🔄 access token refreshed, persisting...");
    const now = new Date().toISOString();
    const rows = [
      { key: KEYS.accessToken, value: tokens.access_token, updated_at: now },
    ];
    if (tokens.expiry_date) rows.push({ key: KEYS.expiresAt, value: String(tokens.expiry_date), updated_at: now });
    if (tokens.refresh_token) rows.push({ key: KEYS.refreshToken, value: tokens.refresh_token, updated_at: now });
    await supabase.from("app_settings").upsert(rows);
  }
});

// Force a refresh by calling getAccessToken explicitly
console.log("Forcing token refresh...");
try {
  const t = await oauth2.getAccessToken();
  console.log(`✅ Token good. Length: ${t.token?.length ?? "(null)"}`);
} catch (e) {
  console.error("❌ Refresh failed:", e.message);
  console.error("Need to re-run https://thejre.org/api/secretary/gmail/authorize");
  process.exit(1);
}

const drive = google.drive({ version: "v3", auth: oauth2 });
const docs = google.docs({ version: "v1", auth: oauth2 });

console.log("\nSearching for Training Manual...");
const res = await drive.files.list({
  q: "name contains 'Training Manual' and trashed=false",
  fields: "files(id,name,mimeType,modifiedTime)",
});
console.log("Matches:");
for (const f of res.data.files || []) {
  console.log(`  • ${f.name}  (${f.mimeType.split(".").pop()})  id=${f.id}`);
}

const manual = (res.data.files || []).find((f) => f.name?.includes("Coordinator"));
if (!manual) {
  console.error("❌ Could not find a 'Training Manual' in her Drive");
  process.exit(1);
}

console.log(`\nReading "${manual.name}"...`);
const doc = await docs.documents.get({ documentId: manual.id });

const text = (doc.data.body?.content || [])
  .map((el) =>
    (el.paragraph?.elements || [])
      .map((e) => e.textRun?.content || "")
      .join("")
  )
  .join("");

const out = `# ${manual.name}

_Extracted ${new Date().toISOString()} from Gitty's Drive (id ${manual.id})_

---

${text}
`;

const outPath = "docs/jre-coordinator-training-manual-extract.md";
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync(outPath, out);
console.log(`\n✅ Saved ${text.length} chars to ${outPath}`);
console.log("\n--- FIRST 3000 CHARS ---\n");
console.log(text.slice(0, 3000));
