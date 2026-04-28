/**
 * Shared helpers for the Rabbi Oratz Campaign Task Tracker.
 *
 * - Loads Gitty's (glevi@thejre.org) OAuth tokens from Supabase app_settings.
 * - Refreshes and persists tokens on expiry.
 * - Provides Sheets, Drive, Gmail, Docs clients.
 * - Reads/writes the tracker sheet ID in app_settings.
 */
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const SETTINGS_KEYS = {
  accessToken: "gmail_jre_access_token",
  refreshToken: "gmail_jre_refresh_token",
  expiresAt: "gmail_jre_token_expires_at",
  trackerSheetId: "campaign_tracker_sheet_id",
};

export const RABBI_ORATZ_EMAIL = "yoratz@thejre.org";
export const CHAIM_EMAIL = "cgelber@thejre.org";

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

export async function getAuthedClient() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [SETTINGS_KEYS.accessToken, SETTINGS_KEYS.refreshToken, SETTINGS_KEYS.expiresAt]);
  if (!data || data.length === 0) {
    throw new Error("No Gmail tokens in app_settings — run /api/secretary/gmail/authorize once");
  }
  const s = Object.fromEntries(data.map((r) => [r.key, r.value]));

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  oauth2.setCredentials({
    access_token: s[SETTINGS_KEYS.accessToken],
    refresh_token: s[SETTINGS_KEYS.refreshToken],
    expiry_date: Number(s[SETTINGS_KEYS.expiresAt] || 0),
  });

  oauth2.on("tokens", async (tokens) => {
    if (!tokens.access_token) return;
    const now = new Date().toISOString();
    const rows = [{ key: SETTINGS_KEYS.accessToken, value: tokens.access_token, updated_at: now }];
    if (tokens.expiry_date) rows.push({ key: SETTINGS_KEYS.expiresAt, value: String(tokens.expiry_date), updated_at: now });
    if (tokens.refresh_token) rows.push({ key: SETTINGS_KEYS.refreshToken, value: tokens.refresh_token, updated_at: now });
    await supabase.from("app_settings").upsert(rows);
  });

  await oauth2.getAccessToken();

  return {
    oauth2,
    sheets: google.sheets({ version: "v4", auth: oauth2 }),
    drive: google.drive({ version: "v3", auth: oauth2 }),
    gmail: google.gmail({ version: "v1", auth: oauth2 }),
    docs: google.docs({ version: "v1", auth: oauth2 }),
  };
}

export async function getTrackerSheetId() {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEYS.trackerSheetId)
    .maybeSingle();
  return data?.value || null;
}

export async function setTrackerSheetId(sheetId) {
  const supabase = getSupabase();
  await supabase.from("app_settings").upsert([
    { key: SETTINGS_KEYS.trackerSheetId, value: sheetId, updated_at: new Date().toISOString() },
  ]);
}

/** Build an RFC 2822 MIME message (multipart/alternative). */
export function buildMime({ to, cc, subject, bodyHtml, bodyText, fromName, fromEmail, inReplyTo, references }) {
  const from = fromName ? `"${fromName}" <${fromEmail}>` : `<${fromEmail}>`;
  const headers = [
    `From: ${from}`,
    `To: ${Array.isArray(to) ? to.join(", ") : to}`,
    cc && cc.length ? `Cc: ${Array.isArray(cc) ? cc.join(", ") : cc}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    references ? `References: ${references}` : null,
  ].filter(Boolean);

  const boundary = `=_${Math.random().toString(36).slice(2)}`;
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const text = bodyText || htmlToText(bodyHtml);
  const body = [
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    bodyHtml,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return headers.join("\r\n") + "\r\n" + body;
}

function encodeHeader(v) {
  if (/^[\x20-\x7E]*$/.test(v)) return v;
  return `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendGmail(gmail, opts, { threadId } = {}) {
  const mime = buildMime(opts);
  const raw = Buffer.from(mime).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, ...(threadId ? { threadId } : {}) },
  });
  return { messageId: res.data.id, threadId: res.data.threadId };
}

/** Simple Shabbos / Yom Tov check using @hebcal/core. */
export async function isShabbosOrYomTov(now = new Date()) {
  const { HDate, HebrewCalendar, flags } = await import("@hebcal/core");
  const dow = now.getDay();
  if (dow === 6) return { blocked: true, reason: "Shabbos" };
  if (dow === 5 && now.getHours() >= 16) return { blocked: true, reason: "Erev Shabbos (close to candle-lighting)" };
  const hd = new HDate(now);
  const events = HebrewCalendar.calendar({
    start: hd, end: hd, noMinorFast: true, noModern: true, noRoshChodesh: true, noSpecialShabbat: true,
  });
  for (const ev of events) {
    if (ev.getFlags() & flags.CHAG) return { blocked: true, reason: `Yom Tov: ${ev.getDesc()}` };
  }
  return { blocked: false };
}
