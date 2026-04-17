/**
 * Constant Contact campaign operations for the JRE AI Secretary.
 *
 * The "clone past campaign, swap date + name, schedule" flow lives here.
 * Token management is inherited from the existing src/lib/constant-contact.ts
 * pattern (Supabase-stored refresh token + auto-refresh).
 *
 * CC API v3 docs: https://developer.constantcontact.com/api_reference/
 */

import { createClient } from "@supabase/supabase-js";

const CC_API_BASE = "https://api.cc.email/v3";
const CC_API_KEY =
  process.env.CONSTANT_CONTACT_CLIENT_ID || "99aae6aa-e950-4d6e-9182-8f31dc2d0abe";

/** Canonical list for Tuesday class emails. */
export const LADIES_LIST_ID = "209a8790-1df5-11e6-a66f-d4ae527536ce";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---- Token plumbing (mirrors existing src/lib/constant-contact.ts) ---------

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["cc_access_token", "cc_refresh_token", "cc_token_expires_at"]);
  if (!data) return process.env.CONSTANT_CONTACT_ACCESS_TOKEN ?? null;

  const s = Object.fromEntries(data.map((r) => [r.key, r.value]));
  const accessToken = s.cc_access_token as string | undefined;
  const refreshToken = s.cc_refresh_token as string | undefined;
  const expiresAt = Number(s.cc_token_expires_at || 0);

  if (!refreshToken) return process.env.CONSTANT_CONTACT_ACCESS_TOKEN ?? null;
  if (accessToken && expiresAt > Date.now() + 5 * 60 * 1000) return accessToken;

  const res = await fetch("https://authz.constantcontact.com/oauth2/default/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CC_API_KEY,
    }),
  });
  if (!res.ok) {
    console.error("[CC] Token refresh failed:", await res.text());
    return null;
  }
  const tokens = await res.json();
  const newExpiresAt = String(Date.now() + tokens.expires_in * 1000);
  await supabase.from("app_settings").upsert([
    { key: "cc_access_token", value: tokens.access_token, updated_at: new Date().toISOString() },
    { key: "cc_token_expires_at", value: newExpiresAt, updated_at: new Date().toISOString() },
    ...(tokens.refresh_token
      ? [{ key: "cc_refresh_token", value: tokens.refresh_token, updated_at: new Date().toISOString() }]
      : []),
  ]);
  return tokens.access_token;
}

async function ccFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error("No Constant Contact access token");
  const res = await fetch(`${CC_API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  return res;
}

// ---- Campaign types --------------------------------------------------------

export type CampaignSummary = {
  campaign_id: string;
  name: string;
  subject: string;
  current_status: string; // "DRAFT" | "SCHEDULED" | "SENT" | "DONE" | ...
  created_at: string;
  updated_at: string;
  last_sent_date?: string;
  current_activity_id?: string; // the email activity (where content lives)
};

export type CampaignActivity = {
  campaign_activity_id: string;
  campaign_id: string;
  role: string; // "primary_email" | "resend_email" | ...
  subject: string;
  from_name: string;
  from_email: string;
  reply_to_email: string;
  html_content: string;
  physical_address_in_footer?: unknown;
  contact_list_ids?: string[];
};

// ---- Discovery -------------------------------------------------------------

/**
 * List recent email campaigns (most recent first).
 */
export async function listRecentCampaigns(limit = 50): Promise<CampaignSummary[]> {
  const res = await ccFetch(`/emails?limit=${limit}&order=desc`);
  if (!res.ok) {
    console.error("[CC] listRecentCampaigns failed:", res.status, await res.text());
    return [];
  }
  const body = await res.json();
  return (body.campaigns || []) as CampaignSummary[];
}

/**
 * Find the most recent campaign whose subject or name contains the speaker's
 * name. Returns null if none matches.
 *
 * For repeat speakers, this is the "clone source" — we copy its HTML, swap
 * the date, and push it back as a new scheduled campaign.
 */
export async function findLastCampaignBySpeaker(
  speakerName: string
): Promise<CampaignSummary | null> {
  const needle = speakerName.trim().toLowerCase();
  // First token of the name (last name for "Rebbetzin X", first word otherwise)
  const short = needle.split(/\s+/).pop() || needle;

  const campaigns = await listRecentCampaigns(100);
  const match = campaigns.find((c) => {
    const hay = `${c.name} ${c.subject}`.toLowerCase();
    return hay.includes(needle) || hay.includes(short);
  });
  return match ?? null;
}

/**
 * Full campaign activity detail (html + from + subject + list memberships).
 */
export async function getCampaignActivity(activityId: string): Promise<CampaignActivity | null> {
  const res = await ccFetch(`/emails/activities/${activityId}`);
  if (!res.ok) {
    console.error("[CC] getCampaignActivity failed:", res.status, await res.text());
    return null;
  }
  return (await res.json()) as CampaignActivity;
}

// ---- Clone + update --------------------------------------------------------

export type CloneOverrides = {
  name: string;                    // internal campaign name (e.g., "RF 4.28 1")
  subject: string;                 // subject line shown to recipients
  fromName?: string;               // override sender display name
  fromEmail?: string;              // override sender email
  replyToEmail?: string;
  htmlContentTransform?: (html: string) => string; // mutate cloned body
  contactListIds?: string[];       // which lists the new campaign sends to
};

/**
 * Clone an existing campaign activity, then PATCH the copy with new date/name/
 * subject/body. Returns the new campaign_activity_id on success.
 *
 * Two-step: (1) POST to create a fresh email with the source's content,
 *           (2) PATCH the activity with our overrides.
 */
export async function cloneCampaign(
  sourceActivityId: string,
  overrides: CloneOverrides
): Promise<{ campaignId: string; activityId: string } | null> {
  // 1) Load the source activity
  const source = await getCampaignActivity(sourceActivityId);
  if (!source) {
    console.error("[CC] Clone failed: source activity not found");
    return null;
  }

  const newHtml = overrides.htmlContentTransform
    ? overrides.htmlContentTransform(source.html_content)
    : source.html_content;

  // 2) Create a new email campaign seeded with the source's content
  const createBody = {
    name: overrides.name,
    email_campaign_activities: [
      {
        format_type: 5, // HTML email
        from_name: overrides.fromName ?? source.from_name,
        from_email: overrides.fromEmail ?? source.from_email,
        reply_to_email: overrides.replyToEmail ?? source.reply_to_email,
        subject: overrides.subject,
        html_content: newHtml,
        physical_address_in_footer: source.physical_address_in_footer,
        contact_list_ids: overrides.contactListIds ?? source.contact_list_ids ?? [LADIES_LIST_ID],
      },
    ],
  };

  const res = await ccFetch(`/emails`, {
    method: "POST",
    body: JSON.stringify(createBody),
  });
  if (!res.ok) {
    console.error("[CC] Clone create failed:", res.status, await res.text());
    return null;
  }
  const body = await res.json();
  const activityId =
    body.campaign_activities?.[0]?.campaign_activity_id ||
    body.primary_email_campaign_activity_id;
  const campaignId = body.campaign_id;

  if (!activityId || !campaignId) {
    console.error("[CC] Clone: no activity id returned", body);
    return null;
  }
  return { campaignId, activityId };
}

// ---- Schedule --------------------------------------------------------------

/**
 * Schedule a campaign activity for a specific ISO timestamp.
 * CC times are UTC. Leave scheduled_date = "0" to send immediately.
 */
export async function scheduleCampaign(
  activityId: string,
  scheduledAtISO: string | "now"
): Promise<boolean> {
  const body = { scheduled_date: scheduledAtISO === "now" ? "0" : scheduledAtISO };
  const res = await ccFetch(`/emails/activities/${activityId}/schedules`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[CC] Schedule failed:", res.status, await res.text());
    return false;
  }
  return true;
}

/**
 * Cancel a previously scheduled send (e.g., if coordinator hits "Hold").
 */
export async function unscheduleCampaign(activityId: string): Promise<boolean> {
  const res = await ccFetch(`/emails/activities/${activityId}/schedules`, {
    method: "DELETE",
  });
  return res.ok;
}

// ---- Smart body transforms -------------------------------------------------

/**
 * Swap one date for another inside HTML content. Handles the common formats
 * used in past campaigns: "4/28", "April 28", "4/28/26", "Tuesday, 4/28".
 * Conservative — only replaces tokens, never collapses context.
 */
export function rewriteDateInHtml(
  html: string,
  oldDate: Date,
  newDate: Date
): string {
  const pad = (n: number) => String(n).padStart(1, "0");
  const oldMd = `${oldDate.getMonth() + 1}/${pad(oldDate.getDate())}`;
  const newMd = `${newDate.getMonth() + 1}/${pad(newDate.getDate())}`;
  const oldFull = oldDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const newFull = newDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const oldMonthDay = oldDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const newMonthDay = newDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return html
    .replaceAll(oldFull, newFull)
    .replaceAll(oldMonthDay, newMonthDay)
    .replaceAll(`${oldDate.getMonth() + 1}/${oldDate.getDate()}`, `${newDate.getMonth() + 1}/${newDate.getDate()}`)
    .replaceAll(oldMd, newMd);
}

/**
 * Swap speaker name references inside HTML. Runs after dates to avoid
 * colliding with dates that contain numbers.
 */
export function rewriteSpeakerInHtml(
  html: string,
  oldSpeaker: string,
  newSpeaker: string
): string {
  if (oldSpeaker === newSpeaker) return html;
  return html.replaceAll(oldSpeaker, newSpeaker);
}

// ---- Derive campaign naming ("RF 4.28 1") ---------------------------------

export function speakerInitials(fullName: string): string {
  const skipTitles = new Set(["rabbi", "rebbetzin", "mrs", "mrs.", "mr", "mr.", "dr", "dr."]);
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter((w) => !skipTitles.has(w.toLowerCase()));
  if (words.length === 0) return fullName.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function campaignName(
  speakerFullName: string,
  classDate: Date,
  emailNumber: 1 | 2
): string {
  const mo = classDate.getMonth() + 1;
  const day = classDate.getDate();
  return `${speakerInitials(speakerFullName)} ${mo}.${day} ${emailNumber}`;
}
