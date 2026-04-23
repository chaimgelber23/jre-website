/**
 * Gmail client for the JRE AI Secretary.
 *
 * Authenticates as the JRE coordinator inbox (glevi@thejre.org) via OAuth2.
 * Refresh token is stored in Supabase `app_settings` after the admin clicks
 * through the OAuth consent flow once (see /admin/gmail-auth route).
 *
 * Responsibilities:
 *   - Send transactional emails (Thu speaker confirmation, Sun ask-Elisheva,
 *     Tue night payment request, Fri reminder).
 *   - Search the Sent folder for past emails to a given speaker (feeds
 *     the "clone Gitty's past email, swap name/date" drafter).
 *   - Poll the inbox for replies (Mrs. Oratz speaker confirmation, Rabbi
 *     Oratz Zelle-sent confirmation).
 */

import { google, type gmail_v1 } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const GMAIL_SCOPES = [
  // Gmail — send, read inbox, mark-as-read / label
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  // Drive — read all her files (Docs, Sheets, Slides, folders)
  "https://www.googleapis.com/auth/drive.readonly",
  // Drive — manage files the app creates (needed to share new sheets/docs)
  "https://www.googleapis.com/auth/drive.file",
  // Sheets — read + write any sheet she can access
  "https://www.googleapis.com/auth/spreadsheets",
  // Docs — read + write any doc
  "https://www.googleapis.com/auth/documents",
  // Calendar — read her JRE calendar (future: event reminders, siyum scheduling)
  "https://www.googleapis.com/auth/calendar.readonly",
];

const SETTINGS_KEYS = {
  accessToken: "gmail_jre_access_token",
  refreshToken: "gmail_jre_refresh_token",
  expiresAt: "gmail_jre_token_expires_at",
  userEmail: "gmail_jre_user_email",
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---- OAuth2 client helpers -------------------------------------------------

export function getOAuth2Client() {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  return oauth2;
}

export function buildGmailAuthUrl(state = ""): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh_token issuance
    scope: GMAIL_SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  // Identify the authorizing user so we can pin it to gmail_jre_user_email.
  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress ?? "";

  const supabase = getSupabase();
  const now = new Date().toISOString();
  const rows: Array<{ key: string; value: string; updated_at: string }> = [
    { key: SETTINGS_KEYS.userEmail, value: email, updated_at: now },
  ];
  if (tokens.access_token) {
    rows.push({ key: SETTINGS_KEYS.accessToken, value: tokens.access_token, updated_at: now });
  }
  if (tokens.refresh_token) {
    rows.push({ key: SETTINGS_KEYS.refreshToken, value: tokens.refresh_token, updated_at: now });
  }
  if (tokens.expiry_date) {
    rows.push({
      key: SETTINGS_KEYS.expiresAt,
      value: String(tokens.expiry_date),
      updated_at: now,
    });
  }
  await supabase.from("app_settings").upsert(rows);
}

async function loadStoredTokens(): Promise<{
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  userEmail?: string;
} | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", Object.values(SETTINGS_KEYS));
  if (!data || data.length === 0) return null;
  const s = Object.fromEntries(data.map((r) => [r.key, r.value]));
  return {
    accessToken: s[SETTINGS_KEYS.accessToken],
    refreshToken: s[SETTINGS_KEYS.refreshToken],
    expiresAt: s[SETTINGS_KEYS.expiresAt] ? Number(s[SETTINGS_KEYS.expiresAt]) : undefined,
    userEmail: s[SETTINGS_KEYS.userEmail],
  };
}

async function saveRefreshedAccessToken(accessToken: string, expiresAt: number): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  await supabase.from("app_settings").upsert([
    { key: SETTINGS_KEYS.accessToken, value: accessToken, updated_at: now },
    { key: SETTINGS_KEYS.expiresAt, value: String(expiresAt), updated_at: now },
  ]);
}

export async function getGmailClient(): Promise<{
  gmail: gmail_v1.Gmail;
  userEmail: string;
} | null> {
  const stored = await loadStoredTokens();
  if (!stored?.refreshToken) {
    console.warn("[Gmail] No refresh token — admin must run /admin/gmail-auth first");
    return null;
  }

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: stored.accessToken,
    refresh_token: stored.refreshToken,
    expiry_date: stored.expiresAt,
  });

  // Auto-refresh if close to expiry (googleapis handles this internally when
  // we supply a refresh_token; we also persist the new token).
  oauth2.on("tokens", async (tokens) => {
    if (tokens.access_token && tokens.expiry_date) {
      await saveRefreshedAccessToken(tokens.access_token, tokens.expiry_date).catch(() => {});
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  return { gmail, userEmail: stored.userEmail || "" };
}

// ---- Send ------------------------------------------------------------------

export type SendOptions = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  fromName?: string;
  fromEmail?: string; // defaults to authenticated account
  replyTo?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
};

/** RFC 2822 MIME message builder (single multipart/alternative). */
function buildMime(opts: SendOptions, authEmail: string): string {
  const from = opts.fromEmail
    ? `${opts.fromName ? `"${opts.fromName}" ` : ""}<${opts.fromEmail}>`
    : `${opts.fromName ? `"${opts.fromName}" ` : ""}<${authEmail}>`;
  const headers = [
    `From: ${from}`,
    `To: ${opts.to.join(", ")}`,
    opts.cc && opts.cc.length ? `Cc: ${opts.cc.join(", ")}` : null,
    opts.bcc && opts.bcc.length ? `Bcc: ${opts.bcc.join(", ")}` : null,
    opts.replyTo ? `Reply-To: ${opts.replyTo}` : null,
    `Subject: ${encodeHeaderUtf8(opts.subject)}`,
    "MIME-Version: 1.0",
  ].filter(Boolean) as string[];

  const boundary = `=_${Math.random().toString(36).slice(2)}`;
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const text = opts.bodyText ?? htmlToTextFallback(opts.bodyHtml);
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
    opts.bodyHtml,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  return headers.join("\r\n") + "\r\n" + body;
}

function encodeHeaderUtf8(value: string): string {
  // If all ASCII, use as-is. Otherwise RFC 2047 encoded-word.
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function htmlToTextFallback(html: string): string {
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

export async function sendGmail(
  opts: SendOptions
): Promise<{ messageId?: string; threadId?: string } | null> {
  const client = await getGmailClient();
  if (!client) return null;

  const mime = buildMime(opts, client.userEmail);
  const raw = Buffer.from(mime).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  const res = await client.gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return { messageId: res.data.id ?? undefined, threadId: res.data.threadId ?? undefined };
}

// ---- Search ----------------------------------------------------------------

export type GmailMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
};

function headerValue(msg: gmail_v1.Schema$Message, name: string): string {
  const h = msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function decodeBase64Url(s: string): string {
  const buf = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return buf.toString("utf8");
}

function extractParts(payload?: gmail_v1.Schema$MessagePart): {
  text: string;
  html: string;
} {
  if (!payload) return { text: "", html: "" };
  let text = "";
  let html = "";

  const walk = (p: gmail_v1.Schema$MessagePart) => {
    const mime = p.mimeType ?? "";
    const data = p.body?.data;
    if (data) {
      const decoded = decodeBase64Url(data);
      if (mime === "text/plain") text += decoded;
      if (mime === "text/html") html += decoded;
    }
    if (p.parts) p.parts.forEach(walk);
  };
  walk(payload);
  return { text, html };
}

async function messageToGmailMessage(
  gmail: gmail_v1.Gmail,
  id: string
): Promise<GmailMessage | null> {
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const msg = res.data;
  if (!msg) return null;
  const parts = extractParts(msg.payload);
  return {
    id: msg.id!,
    threadId: msg.threadId!,
    from: headerValue(msg, "From"),
    to: headerValue(msg, "To"),
    subject: headerValue(msg, "Subject"),
    snippet: msg.snippet ?? "",
    date: headerValue(msg, "Date"),
    bodyText: parts.text,
    bodyHtml: parts.html,
  };
}

/**
 * Search messages with a Gmail query (e.g. "from:elishevaoratz@gmail.com newer_than:7d").
 * Returns fully-hydrated message objects.
 */
export async function searchMessages(
  query: string,
  maxResults = 10
): Promise<GmailMessage[]> {
  const client = await getGmailClient();
  if (!client) return [];
  const list = await client.gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });
  const ids = list.data.messages?.map((m) => m.id).filter((x): x is string => !!x) ?? [];
  const out: GmailMessage[] = [];
  for (const id of ids) {
    const m = await messageToGmailMessage(client.gmail, id);
    if (m) out.push(m);
  }
  return out;
}

/**
 * Find the most recent email Gitty SENT to this speaker (for clone-past-sent).
 */
export async function findLastSentToSpeaker(
  speakerEmail: string
): Promise<GmailMessage | null> {
  const q = `in:sent to:${speakerEmail}`;
  const msgs = await searchMessages(q, 5);
  return msgs[0] ?? null;
}

/**
 * Poll INBOX for any reply from a given address since a cutoff timestamp.
 * Used by inbox-watch (Mrs. Oratz speaker confirmations, Rabbi Oratz Zelle
 * confirmations).
 */
export async function listInboxSince(
  fromAddress: string,
  sinceEpochSec: number
): Promise<GmailMessage[]> {
  const q = `in:inbox from:${fromAddress} after:${sinceEpochSec}`;
  return searchMessages(q, 25);
}

export async function markAsRead(messageId: string): Promise<void> {
  const client = await getGmailClient();
  if (!client) return;
  await client.gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}
