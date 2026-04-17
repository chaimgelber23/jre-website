/**
 * Email drafter for the JRE AI Secretary — clone-past-everything pattern.
 *
 * Every draft we produce is derived from real past content the coordinator
 * (or the org) sent before:
 *   - Email #1 (Thu, Gmail to speaker)     -> clone Gitty's most recent Sent
 *                                              email to this speaker; swap date.
 *   - Email CC-1 / CC-2 (Mon AM / Tue AM)  -> clone the speaker's most recent
 *                                              Constant Contact campaign; swap
 *                                              date + headshot context.
 *   - Payment / reminder / Elisheva-ask    -> deterministic, no Claude needed.
 *
 * We deliberately do NOT generate novel content with Claude for the class-
 * facing emails. Matching past voice is a 1:1 template swap, which is both
 * cheaper and much more reliable for the "boss wants 100%" constraint.
 *
 * Claude Haiku is only used later, by the audit engine, to classify whether
 * a human edit was cosmetic vs meaningful.
 */

import { getCanonicalZoomLink } from "./zoom-link-guard";
import { findLastSentToSpeaker } from "./gmail-client";
import {
  findLastCampaignBySpeaker,
  getCampaignActivity,
  rewriteDateInHtml,
  rewriteSpeakerInHtml,
  campaignName,
  type CampaignActivity,
} from "./cc-campaigns";
import {
  getSpeakerById,
  getClassById,
  createDraft,
  updateClass,
} from "@/lib/db/secretary";
import type { JreSpeaker, JreWeeklyClass, JreEmailDraft } from "@/types/secretary";

// ---- Roster env fallbacks --------------------------------------------------

const COORDINATOR = {
  name: process.env.JRE_COORDINATOR_NAME ?? "Gitty Levi",
  email: process.env.JRE_COORDINATOR_EMAIL ?? "glevi@thejre.org",
};

const MRS_ORATZ_EMAIL = process.env.MRS_ORATZ_EMAIL ?? "elishevaoratz@gmail.com";
const RABBI_ORATZ_EMAIL = process.env.RABBI_ORATZ_EMAIL ?? "yoratz@thejre.org";

// ---- Shared helpers --------------------------------------------------------

function classDateObj(cls: JreWeeklyClass): Date {
  // YYYY-MM-DD → Date in local zone (no DST shifts for day-comparison purposes)
  const [y, m, d] = cls.class_date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatMMDD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================================
// 1. Email #1 — Thu Gmail confirmation to the speaker
//    Clones Gitty's most recent Sent email to this speaker. If none exists,
//    falls back to the canonical SOP template so we never block Week 1.
// ============================================================================

export async function draftSpeakerConfirmation(
  classId: string
): Promise<JreEmailDraft | null> {
  const cls = await getClassById(classId);
  if (!cls || !cls.speaker_id) {
    console.warn("[drafter] speaker confirm: no class or no speaker");
    return null;
  }
  const speaker = await getSpeakerById(cls.speaker_id);
  if (!speaker) return null;

  const cd = classDateObj(cls);
  const zoomLink = (await getCanonicalZoomLink()) ?? cls.zoom_link ?? "";

  // Try to clone the most recent message Gitty sent to this speaker.
  let bodyHtml: string | null = null;
  let clonedFromId: string | null = null;
  let subject = `JRE Tuesday ${formatMMDD(cd)} — Zoom confirmation`;

  if (speaker.email) {
    const past = await findLastSentToSpeaker(speaker.email);
    if (past) {
      bodyHtml = rewriteSpeakerInHtml(past.bodyHtml, speaker.full_name, speaker.full_name);
      // Best-effort date swap: try "date near Tuesday keyword"
      // The SOP template uses mm/dd; past emails typically do too.
      bodyHtml = maybeRewriteDatesByKeyword(bodyHtml, cd);
      subject = past.subject || subject;
      clonedFromId = past.id;
    }
  }

  if (!bodyHtml) {
    // SOP fallback — verbatim from the Chana Brownstein 2021 training manual.
    bodyHtml = fallbackSpeakerConfirmHtml(speaker, cd, zoomLink);
  }

  const draft = await createDraft({
    class_id: classId,
    draft_type: "email_speaker",
    delivery_channel: "gmail",
    from_name: COORDINATOR.name,
    from_email: COORDINATOR.email,
    reply_to: COORDINATOR.email,
    to_list: speaker.email ? [speaker.email] : [],
    cc_list: [MRS_ORATZ_EMAIL],
    bcc_list: [],
    subject,
    body_html: bodyHtml,
    body_text: null,
    cloned_from_provider: clonedFromId ? "gmail" : null,
    cloned_from_id: clonedFromId,
    scheduled_send_at: null, // Approval flow sets this
    sent_at: null,
    sent_provider_id: null,
    status: "drafted",
    approved_at: null,
    approved_by: null,
    approval_channel: null,
    edit_diff_score: null,
    edit_is_meaningful: null,
    failure_reason: null,
  });

  await updateClass(classId, { email_speaker_draft_id: draft.id });
  return draft;
}

function maybeRewriteDatesByKeyword(html: string, newDate: Date): string {
  // Match "this Tuesday, X" or "Tuesday MM/DD" and replace just the date.
  const newMMDD = formatMMDD(newDate);
  const newFull = newDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Replace any "Tuesday, Month DD" with our new date string.
  let out = html.replace(
    /Tuesday,\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}/gi,
    newFull
  );
  // Replace any "Tuesday, M/D" or "Tuesday M/D/YY"
  out = out.replace(/Tuesday,?\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?/gi, `Tuesday, ${newMMDD}`);
  // Fallback: any loose "M/D/YY" pattern followed within 40 chars of "10am"
  out = out.replace(
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(\s+at\s+10\s?am)/gi,
    `${newMMDD}$2`
  );
  return out;
}

function fallbackSpeakerConfirmHtml(
  speaker: JreSpeaker,
  classDate: Date,
  zoomLink: string
): string {
  const dateStr = classDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const firstName = speaker.full_name.split(/\s+/)[0];
  return `<p>Hi ${escapeHtml(firstName)},</p>

<p>I hope you are doing well! We are excited for your upcoming class at the JRE this ${escapeHtml(
    dateStr
  )} at 10am. Click the link below to join the Zoom.</p>

<p><b>Join Zoom Meeting</b><br>
<a href="${escapeHtml(zoomLink)}">${escapeHtml(zoomLink)}</a></p>

<p>Please provide your updated billing information in reply to this email to ensure prompt payment. Thank you!</p>

<p>All the best,<br>
${escapeHtml(COORDINATOR.name)}</p>`;
}

// ============================================================================
// 2. Emails CC-1 and CC-2 — Mon AM and Tue AM broadcast to JRE Ladies list
//    Pure clone of the speaker's most recent matching CC campaign; swap date.
// ============================================================================

async function draftCcCampaignEmail(
  classId: string,
  which: "email_cc_1" | "email_cc_2"
): Promise<JreEmailDraft | null> {
  const cls = await getClassById(classId);
  if (!cls || !cls.speaker_id) return null;
  const speaker = await getSpeakerById(cls.speaker_id);
  if (!speaker) return null;

  // Find the most recent campaign for this speaker (any #1 or #2 variant)
  const lastCampaign = await findLastCampaignBySpeaker(speaker.full_name);
  if (!lastCampaign || !lastCampaign.current_activity_id) {
    console.warn(
      `[drafter] CC ${which}: no prior campaign found for ${speaker.full_name}`
    );
    return null;
  }
  const activity = await getCampaignActivity(lastCampaign.current_activity_id);
  if (!activity) return null;

  const cd = classDateObj(cls);
  const oldDate = parsePastCampaignDate(lastCampaign.name) ??
    parsePastCampaignDate(lastCampaign.subject) ??
    cd; // if we can't find a date, no-op the date rewrite

  let html = activity.html_content;
  html = rewriteDateInHtml(html, oldDate, cd);
  // Speaker name is already correct — last campaign was for same speaker.
  // Re-validate the Zoom link: replace any in-content zoom URL with canonical.
  const canonicalZoom = (await getCanonicalZoomLink()) ?? null;
  if (canonicalZoom) {
    html = html.replace(
      /https:\/\/(?:us\d+|www\.)?zoom\.us\/j\/\d{9,12}(?:\?pwd=[A-Za-z0-9_.-]+)?/g,
      canonicalZoom
    );
  }

  // Subject: take past subject, swap date references conservatively.
  const subject = rewriteSubjectDate(activity.subject, oldDate, cd, which);

  const name = campaignName(speaker.full_name, cd, which === "email_cc_1" ? 1 : 2);

  // Sender assignment:
  //   #1 Monday — keep the past campaign's from_name (org default sender)
  //   #2 Tuesday — always Gitty Levi per SOP
  const fromName =
    which === "email_cc_2" ? COORDINATOR.name : activity.from_name;
  const fromEmail =
    which === "email_cc_2" ? COORDINATOR.email : activity.from_email;
  const replyTo =
    which === "email_cc_2" ? COORDINATOR.email : activity.reply_to_email;

  const draft = await createDraft({
    class_id: classId,
    draft_type: which,
    delivery_channel: "constant_contact",
    from_name: fromName,
    from_email: fromEmail,
    reply_to: replyTo,
    to_list: [], // CC uses list ids, not individual recipients
    cc_list: [],
    bcc_list: [],
    subject,
    body_html: html,
    body_text: null,
    cloned_from_provider: "constant_contact",
    cloned_from_id: lastCampaign.current_activity_id,
    scheduled_send_at: computeCcSendTime(cd, which),
    sent_at: null,
    sent_provider_id: null,
    status: "drafted",
    approved_at: null,
    approved_by: null,
    approval_channel: null,
    edit_diff_score: null,
    edit_is_meaningful: null,
    failure_reason: null,
  });

  // Stash the internal name for when we push to CC (subject is visible, name
  // is internal). We can't add it as a column without churn; store on audit
  // provenance instead.
  void name;

  await updateClass(classId, {
    [which === "email_cc_1" ? "email_cc_1_draft_id" : "email_cc_2_draft_id"]: draft.id,
  } as Partial<JreWeeklyClass>);
  return draft;
}

export async function draftCcEmail1(classId: string): Promise<JreEmailDraft | null> {
  return draftCcCampaignEmail(classId, "email_cc_1");
}

export async function draftCcEmail2(classId: string): Promise<JreEmailDraft | null> {
  return draftCcCampaignEmail(classId, "email_cc_2");
}

function rewriteSubjectDate(
  subject: string,
  oldDate: Date,
  newDate: Date,
  which: "email_cc_1" | "email_cc_2"
): string {
  // Best-effort: swap MM/DD tokens, then full month-day strings.
  let out = subject
    .replace(`${oldDate.getMonth() + 1}/${oldDate.getDate()}`, `${newDate.getMonth() + 1}/${newDate.getDate()}`)
    .replace(
      oldDate.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
      newDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    );
  // Tue-morning email has a specific subject form per SOP.
  if (which === "email_cc_2" && !/Live on Zoom/i.test(out)) {
    out = `${out} — Live on Zoom in One Hour`;
  }
  return out;
}

/**
 * Compute the UTC ISO timestamp for a scheduled CC send. Default windows:
 *   Email #1: Monday 8:00 AM local (America/New_York)
 *   Email #2: Tuesday 9:00 AM local
 */
function computeCcSendTime(classDate: Date, which: "email_cc_1" | "email_cc_2"): string {
  // classDate is a local Tuesday at 00:00. Compute relative date.
  const target = new Date(classDate);
  if (which === "email_cc_1") {
    target.setDate(target.getDate() - 1); // Monday
    target.setHours(8, 0, 0, 0);
  } else {
    target.setHours(9, 0, 0, 0); // Tuesday
  }
  return target.toISOString();
}

function parsePastCampaignDate(label: string): Date | null {
  // "RF 4.28 1" or "Rebbetzin Fink 4/28 2" style
  const m =
    label.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
  if (!m) return null;
  const mo = Number(m[1]);
  const day = Number(m[2]);
  let y = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(y, mo - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// ============================================================================
// 3. Payment request email (Tue night, Gmail to Rabbi Oratz)
// ============================================================================

export async function draftPaymentRequest(
  classId: string
): Promise<JreEmailDraft | null> {
  const cls = await getClassById(classId);
  if (!cls || !cls.speaker_id) return null;
  const speaker = await getSpeakerById(cls.speaker_id);
  if (!speaker) return null;
  const fee = cls.fee_usd ?? speaker.last_fee_usd;
  if (!fee) return null;

  const cd = classDateObj(cls);
  const dateStr = cd.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const subject = `Please Zelle $${fee} to ${speaker.full_name} — ${formatMMDD(cd)}`;
  const phoneLine = speaker.phone ? `<br>Phone: ${escapeHtml(speaker.phone)}` : "";
  const bodyHtml = `<p>Hi Rabbi Oratz,</p>

<p>Please Zelle <b>$${fee}</b> to <b>${escapeHtml(speaker.full_name)}</b> for ${escapeHtml(
    dateStr
  )}'s Tuesday class.${phoneLine}</p>

<p>Thanks!<br>
${escapeHtml(COORDINATOR.name)}</p>`;

  const draft = await createDraft({
    class_id: classId,
    draft_type: "email_payment",
    delivery_channel: "gmail",
    from_name: COORDINATOR.name,
    from_email: COORDINATOR.email,
    reply_to: COORDINATOR.email,
    to_list: [RABBI_ORATZ_EMAIL],
    cc_list: [MRS_ORATZ_EMAIL],
    bcc_list: [],
    subject,
    body_html: bodyHtml,
    body_text: null,
    cloned_from_provider: null,
    cloned_from_id: null,
    scheduled_send_at: null,
    sent_at: null,
    sent_provider_id: null,
    status: "drafted",
    approved_at: null,
    approved_by: null,
    approval_channel: null,
    edit_diff_score: null,
    edit_is_meaningful: null,
    failure_reason: null,
  });

  await updateClass(classId, { email_payment_draft_id: draft.id });
  return draft;
}

// ============================================================================
// 4. Payment reminder (Fri 10am, Gmail to Rabbi Oratz)
// ============================================================================

export async function draftPaymentReminder(
  classId: string,
  reminderIndex: number
): Promise<JreEmailDraft | null> {
  const cls = await getClassById(classId);
  if (!cls || !cls.speaker_id) return null;
  const speaker = await getSpeakerById(cls.speaker_id);
  if (!speaker) return null;
  const fee = cls.fee_usd ?? speaker.last_fee_usd;
  if (!fee) return null;

  const cd = classDateObj(cls);
  const subject = `Reminder: Zelle $${fee} to ${speaker.full_name} (${formatMMDD(cd)})`;
  const bodyHtml = `<p>Hi Rabbi Oratz,</p>

<p>Gentle reminder — still need to Zelle <b>$${fee}</b> to <b>${escapeHtml(
    speaker.full_name
  )}</b> from Tuesday ${formatMMDD(cd)}'s class.</p>

<p>Thanks!<br>
${escapeHtml(COORDINATOR.name)}</p>`;

  const draft = await createDraft({
    class_id: classId,
    draft_type: "email_reminder",
    delivery_channel: "gmail",
    from_name: COORDINATOR.name,
    from_email: COORDINATOR.email,
    reply_to: COORDINATOR.email,
    to_list: [RABBI_ORATZ_EMAIL],
    cc_list: [],
    bcc_list: [],
    subject,
    body_html: bodyHtml,
    body_text: null,
    cloned_from_provider: null,
    cloned_from_id: null,
    scheduled_send_at: null,
    sent_at: null,
    sent_provider_id: null,
    status: "drafted",
    approved_at: null,
    approved_by: null,
    approval_channel: null,
    edit_diff_score: null,
    edit_is_meaningful: null,
    failure_reason: null,
  });

  await updateClass(classId, { email_reminder_draft_id: draft.id });
  void reminderIndex; // kept for future per-reminder personalization
  return draft;
}

// ============================================================================
// 5. Sunday morning — ask Elisheva who's speaking Tuesday
// ============================================================================

export async function draftElishevaAsk(
  classId: string
): Promise<JreEmailDraft | null> {
  const cls = await getClassById(classId);
  if (!cls) return null;
  const cd = classDateObj(cls);

  const subject = `Who's speaking Tuesday ${formatMMDD(cd)}?`;
  const bodyHtml = `<p>Hi Elisheva,</p>

<p>Just checking in — who is speaking at this Tuesday's class (${formatMMDD(
    cd
  )} at 10am)?</p>

<p>If you can send over the speaker's name, email, and fee, I'll take it from there and send out the confirmation and Ladies emails.</p>

<p>Thank you!<br>
${escapeHtml(COORDINATOR.name)}</p>`;

  const draft = await createDraft({
    class_id: classId,
    draft_type: "email_elisheva_ask",
    delivery_channel: "gmail",
    from_name: COORDINATOR.name,
    from_email: COORDINATOR.email,
    reply_to: COORDINATOR.email,
    to_list: [MRS_ORATZ_EMAIL],
    cc_list: [],
    bcc_list: [],
    subject,
    body_html: bodyHtml,
    body_text: null,
    cloned_from_provider: null,
    cloned_from_id: null,
    scheduled_send_at: null,
    sent_at: null,
    sent_provider_id: null,
    status: "drafted",
    approved_at: null,
    approved_by: null,
    approval_channel: null,
    edit_diff_score: null,
    edit_is_meaningful: null,
    failure_reason: null,
  });

  return draft;
}

// Re-export types used by callers
export type { CampaignActivity };
