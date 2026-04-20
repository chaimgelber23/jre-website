/**
 * JRE Secretary — Local Task Discovery Audit
 *
 * Reads Gitty's OAuth tokens from Supabase, then uses them to map her
 * actual workflow: inbox patterns, sent patterns, drive files.
 *
 * Run: node scripts/secretary-audit.mjs
 *
 * No Vercel needed — talks directly to Supabase + Google APIs.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const SETTINGS_KEYS = {
  accessToken: "gmail_jre_access_token",
  refreshToken: "gmail_jre_refresh_token",
  expiresAt: "gmail_jre_token_expires_at",
  userEmail: "gmail_jre_user_email",
};

function bar(n, max = 30) {
  const w = Math.round((n / max) * 30);
  return "█".repeat(Math.max(1, Math.min(30, w)));
}

function headerVal(headers, name) {
  const h = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function shortAddr(s) {
  return s.replace(/.*</, "").replace(/>.*/, "").trim().toLowerCase();
}

function topN(map, n = 12) {
  return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, n);
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log("\n=== STEP 1: Load Gitty's OAuth tokens from Supabase ===");
  const { data: settings, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", Object.values(SETTINGS_KEYS));

  if (error) throw new Error(`Supabase error: ${error.message}`);
  if (!settings || settings.length === 0) {
    console.error("❌ NO TOKENS FOUND in app_settings.");
    console.error("   The OAuth callback never wrote to the DB.");
    console.error("   Re-run https://thejre.org/api/secretary/gmail/authorize");
    process.exit(1);
  }

  const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));
  const userEmail = s[SETTINGS_KEYS.userEmail];
  const refreshToken = s[SETTINGS_KEYS.refreshToken];
  const accessToken = s[SETTINGS_KEYS.accessToken];
  const expiresAt = Number(s[SETTINGS_KEYS.expiresAt] || 0);

  console.log(`   Stored email: ${userEmail || "(none)"}`);
  console.log(`   Refresh token: ${refreshToken ? "✅ present" : "❌ MISSING"}`);
  console.log(`   Access token: ${accessToken ? "✅ present" : "❌ missing"}`);
  console.log(`   Expires: ${expiresAt ? new Date(expiresAt).toISOString() : "(none)"}`);

  if (!refreshToken) {
    console.error("\n❌ No refresh token. OAuth flow didn't issue offline access.");
    console.error("   Re-run authorize URL in incognito to force prompt=consent.");
    process.exit(1);
  }

  console.log("\n=== STEP 2: Initialize Google API client ===");
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  oauth2.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiresAt,
  });

  // Persist refreshed tokens back to supabase
  oauth2.on("tokens", async (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      console.log("   🔄 Token refreshed, persisting back to Supabase...");
      await supabase.from("app_settings").upsert([
        { key: SETTINGS_KEYS.accessToken, value: tokens.access_token, updated_at: new Date().toISOString() },
        { key: SETTINGS_KEYS.expiresAt, value: String(tokens.expiry_date), updated_at: new Date().toISOString() },
      ]);
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const drive = google.drive({ version: "v3", auth: oauth2 });

  console.log("\n=== STEP 3: Verify connection (Gmail profile ping) ===");
  const profile = await gmail.users.getProfile({ userId: "me" });
  console.log(`   ✅ Connected as: ${profile.data.emailAddress}`);
  console.log(`   Total messages: ${profile.data.messagesTotal?.toLocaleString()}`);
  console.log(`   Total threads:  ${profile.data.threadsTotal?.toLocaleString()}`);

  console.log("\n=== STEP 4: Inbox last 30 days ===");
  const thirtyDays = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
  const inboxList = await gmail.users.messages.list({
    userId: "me",
    q: `in:inbox after:${thirtyDays}`,
    maxResults: 50,
  });
  const inboxIds = inboxList.data.messages?.map((m) => m.id) || [];
  console.log(`   Found ${inboxIds.length} inbox messages (last 30 days)`);

  const inbox = [];
  for (const id of inboxIds) {
    try {
      const m = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date"],
      });
      const h = m.data.payload?.headers || [];
      inbox.push({
        subject: headerVal(h, "Subject"),
        from: headerVal(h, "From"),
        to: headerVal(h, "To"),
        date: headerVal(h, "Date"),
        snippet: m.data.snippet || "",
        unread: (m.data.labelIds || []).includes("UNREAD"),
      });
    } catch {}
  }

  const fromCounts = {};
  for (const e of inbox) {
    const a = shortAddr(e.from);
    if (a) fromCounts[a] = (fromCounts[a] || 0) + 1;
  }
  console.log("\n   📥 Top inbound contacts (who emails her most):");
  for (const [addr, count] of topN(fromCounts)) {
    console.log(`      ${bar(count, 10).padEnd(12)} ${count.toString().padStart(3)}  ${addr}`);
  }

  const unreadCount = inbox.filter((e) => e.unread).length;
  console.log(`\n   🔴 Unread: ${unreadCount} of last 50`);
  if (unreadCount > 0) {
    console.log("   Recent unread:");
    inbox.filter((e) => e.unread).slice(0, 5).forEach((e) => {
      console.log(`      • ${e.subject?.slice(0, 70) || "(no subject)"} — ${shortAddr(e.from)}`);
    });
  }

  console.log("\n=== STEP 5: Sent last 30 days ===");
  const sentList = await gmail.users.messages.list({
    userId: "me",
    q: `in:sent after:${thirtyDays}`,
    maxResults: 50,
  });
  const sentIds = sentList.data.messages?.map((m) => m.id) || [];
  console.log(`   Found ${sentIds.length} sent messages (last 30 days)`);

  const sent = [];
  for (const id of sentIds) {
    try {
      const m = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date"],
      });
      const h = m.data.payload?.headers || [];
      sent.push({
        subject: headerVal(h, "Subject"),
        to: headerVal(h, "To"),
        date: headerVal(h, "Date"),
        snippet: m.data.snippet || "",
      });
    } catch {}
  }

  const toCounts = {};
  for (const e of sent) {
    const a = shortAddr(e.to);
    if (a) toCounts[a] = (toCounts[a] || 0) + 1;
  }
  console.log("\n   📤 Top outbound recipients (who she emails most):");
  for (const [addr, count] of topN(toCounts)) {
    console.log(`      ${bar(count, 10).padEnd(12)} ${count.toString().padStart(3)}  ${addr}`);
  }

  // Day-of-week pattern
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowSent = {};
  for (const e of sent) {
    try {
      const d = new Date(e.date);
      const day = days[d.getDay()];
      dowSent[day] = (dowSent[day] || 0) + 1;
    } catch {}
  }
  console.log("\n   📅 Sends by day-of-week:");
  for (const day of days) {
    const c = dowSent[day] || 0;
    console.log(`      ${day}  ${bar(c, 10).padEnd(12)} ${c}`);
  }

  // Subject pattern matching
  const subjects = sent.map((e) => (e.subject || "").toLowerCase());
  const patterns = {
    "Speaker / class": subjects.filter((s) => /speaker|class|tuesday|jre|zoom/i.test(s)).length,
    "Payment / Zelle": subjects.filter((s) => /payment|zelle|paid|invoice/i.test(s)).length,
    "Donation / pledge": subjects.filter((s) => /donat|pledge|sponsor|thank you/i.test(s)).length,
    "Newsletter / CC": subjects.filter((s) => /newsletter|bulletin|reminder|join us/i.test(s)).length,
    "Reminder": subjects.filter((s) => /reminder|don't forget|tomorrow/i.test(s)).length,
    "Reply / Re:": subjects.filter((s) => s.startsWith("re:")).length,
    "Forward / Fwd:": subjects.filter((s) => s.startsWith("fwd:") || s.startsWith("fw:")).length,
  };
  console.log("\n   🏷️  Subject pattern match:");
  for (const [label, count] of Object.entries(patterns)) {
    console.log(`      ${count.toString().padStart(3)}  ${label}`);
  }

  console.log("\n=== STEP 6: Drive files (recent 30) ===");
  const filesRes = await drive.files.list({
    pageSize: 30,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,owners(emailAddress))",
    orderBy: "modifiedTime desc",
    q: "trashed=false",
  });
  const files = filesRes.data.files || [];
  const sheets = files.filter((f) => f.mimeType === "application/vnd.google-apps.spreadsheet");
  const docs = files.filter((f) => f.mimeType === "application/vnd.google-apps.document");

  console.log(`   Total recent files: ${files.length}`);
  console.log(`   • Sheets: ${sheets.length}`);
  console.log(`   • Docs:   ${docs.length}`);

  console.log("\n   📊 Google Sheets she has access to:");
  for (const f of sheets.slice(0, 10)) {
    const owner = f.owners?.[0]?.emailAddress || "?";
    console.log(`      • ${f.name?.slice(0, 60)}`);
    console.log(`        owner: ${owner}  modified: ${f.modifiedTime?.slice(0, 10)}`);
  }

  console.log("\n   📄 Google Docs she has access to:");
  for (const f of docs.slice(0, 10)) {
    const owner = f.owners?.[0]?.emailAddress || "?";
    console.log(`      • ${f.name?.slice(0, 60)}`);
    console.log(`        owner: ${owner}  modified: ${f.modifiedTime?.slice(0, 10)}`);
  }

  console.log("\n=== STEP 7: Existing automation coverage (from DB) ===");
  const { data: flags } = await supabase.from("jre_automation_flags").select("*");
  const { data: drafts } = await supabase
    .from("jre_email_drafts")
    .select("draft_type, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  console.log(`   Automation flags: ${flags?.length || 0}`);
  if (flags?.length) {
    for (const f of flags) {
      console.log(`      • ${f.draft_type}: auto_send=${f.auto_send_enabled} kill_switch=${f.kill_switch_active}`);
    }
  }
  console.log(`   Recent drafts: ${drafts?.length || 0}`);
  if (drafts?.length) {
    const byStatus = {};
    for (const d of drafts) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    for (const [st, n] of Object.entries(byStatus)) {
      console.log(`      ${n.toString().padStart(3)}  ${st}`);
    }
  }

  console.log("\n=== STEP 8: Automation gap analysis ===");
  const knownAutomated = ["email_speaker", "email_cc_1", "email_cc_2", "email_payment", "email_reminder", "email_elisheva_ask"];
  const gaps = [];
  if (patterns["Donation / pledge"] > 2) gaps.push(`📌 ${patterns["Donation / pledge"]} donation/thank-you emails — not automated`);
  if (patterns["Newsletter / CC"] > 2 && !knownAutomated.includes("newsletter")) gaps.push(`📌 ${patterns["Newsletter / CC"]} newsletter/bulletin emails`);
  if (patterns["Reply / Re:"] > sent.length * 0.4) gaps.push(`📌 ${patterns["Reply / Re:"]} reply emails (${Math.round((patterns["Reply / Re:"] / sent.length) * 100)}% of sent) — inbox triage AI candidate`);
  if (patterns["Forward / Fwd:"] > 2) gaps.push(`📌 ${patterns["Forward / Fwd:"]} forwards — recurring info routing?`);
  if (sheets.length > 1) gaps.push(`📌 ${sheets.length} sheets — only 1 is sync'd to JRE DB; audit the rest`);

  if (gaps.length) {
    for (const g of gaps) console.log(`   ${g}`);
  } else {
    console.log("   ✅ No obvious gaps detected (low data — re-run after she's been active a few weeks)");
  }

  console.log("\n=== DONE ===\n");
}

main().catch((err) => {
  console.error("\n❌ FAIL:", err.message);
  console.error(err.stack);
  process.exit(1);
});
