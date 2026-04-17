/**
 * Send executor — given an approved jre_email_drafts row, actually push it
 * out via Gmail or Constant Contact. Updates the draft status, logs an audit
 * entry, bubbles class status.
 */

import {
  getDraft,
  setDraftStatus,
  updateClass,
  setClassStatus,
  upsertPaymentForClass,
  getClassById,
} from "@/lib/db/secretary";
import { sendGmail } from "./gmail-client";
import { cloneCampaign, scheduleCampaign, LADIES_LIST_ID } from "./cc-campaigns";
import { recordDraftOutcome } from "./audit-engine";
import type { JreEmailDraft } from "@/types/secretary";

export type SendResult =
  | { ok: true; draft: JreEmailDraft; providerId?: string }
  | { ok: false; reason: string };

export async function sendApprovedDraft(draftId: string): Promise<SendResult> {
  const draft = await getDraft(draftId);
  if (!draft) return { ok: false, reason: "draft not found" };
  if (draft.status !== "approved") return { ok: false, reason: `draft status is ${draft.status}` };

  try {
    if (draft.delivery_channel === "gmail") {
      return await sendGmailDraft(draft);
    } else if (draft.delivery_channel === "constant_contact") {
      return await sendCcDraft(draft);
    }
    return { ok: false, reason: `unknown delivery_channel ${draft.delivery_channel}` };
  } catch (err) {
    console.error("[send] failed:", err);
    await setDraftStatus(draftId, "failed", {
      failure_reason: String(err).slice(0, 500),
    });
    return { ok: false, reason: String(err) };
  }
}

async function sendGmailDraft(draft: JreEmailDraft): Promise<SendResult> {
  const result = await sendGmail({
    to: draft.to_list,
    cc: draft.cc_list,
    bcc: draft.bcc_list,
    fromName: draft.from_name,
    fromEmail: draft.from_email,
    replyTo: draft.reply_to ?? undefined,
    subject: draft.subject,
    bodyHtml: draft.body_html,
    bodyText: draft.body_text ?? undefined,
  });
  if (!result?.messageId) {
    await setDraftStatus(draft.id, "failed", { failure_reason: "gmail send returned null" });
    return { ok: false, reason: "gmail send returned null" };
  }

  const now = new Date().toISOString();
  const sent = await setDraftStatus(draft.id, "sent", {
    sent_at: now,
    sent_provider_id: result.messageId,
  });

  // If this was the Tue night payment request, stamp jre_payments.request_sent_at.
  if (draft.draft_type === "email_payment") {
    const cls = await getClassById(draft.class_id);
    if (cls && cls.speaker_id) {
      await upsertPaymentForClass(draft.class_id, {
        amount_usd: cls.fee_usd ?? 0,
        speaker_id: cls.speaker_id,
        payment_method: "zelle",
        request_sent_at: now,
      });
    }
  }

  await bubbleClassStatus(draft);
  await recordDraftOutcome(draft.id, { sentOnTime: true });
  return { ok: true, draft: sent, providerId: result.messageId };
}

async function sendCcDraft(draft: JreEmailDraft): Promise<SendResult> {
  // A CC draft is created ONCE (in the email-drafter) but only "sent" when we
  // call scheduleCampaign. If we already have a cloned_from_id, we assume the
  // CC activity id is the one we want to schedule — but the drafter stored
  // the *source* id, not our own clone id. We clone now at send-time so an
  // aborted approval doesn't pollute CC with stray drafts.

  if (!draft.cloned_from_id) {
    return { ok: false, reason: "CC draft missing cloned_from_id" };
  }

  const cloneOverrides = {
    name: `JRE ${draft.draft_type === "email_cc_1" ? "MON" : "TUE"} ${draft.subject}`.slice(0, 80),
    subject: draft.subject,
    fromName: draft.from_name,
    fromEmail: draft.from_email,
    replyToEmail: draft.reply_to ?? draft.from_email,
    htmlContentTransform: () => draft.body_html,
    contactListIds: [LADIES_LIST_ID],
  };

  const clone = await cloneCampaign(draft.cloned_from_id, cloneOverrides);
  if (!clone) {
    return { ok: false, reason: "CC clone failed" };
  }
  const scheduleAt = draft.scheduled_send_at ?? new Date().toISOString();
  const scheduled = await scheduleCampaign(clone.activityId, scheduleAt);
  if (!scheduled) {
    return { ok: false, reason: "CC schedule failed" };
  }

  const sent = await setDraftStatus(draft.id, "sent", {
    sent_at: new Date().toISOString(),
    sent_provider_id: clone.activityId,
  });
  await bubbleClassStatus(draft);
  await recordDraftOutcome(draft.id, { sentOnTime: true });
  return { ok: true, draft: sent, providerId: clone.activityId };
}

async function bubbleClassStatus(draft: JreEmailDraft): Promise<void> {
  const cls = await getClassById(draft.class_id);
  if (!cls) return;
  if (cls.status === "approved" || cls.status === "drafts_pending") {
    await setClassStatus(cls.id, "scheduled");
  } else if (cls.status === "scheduled" && draft.draft_type === "email_cc_2") {
    await setClassStatus(cls.id, "sent");
  } else if (cls.status === "sent" && draft.draft_type === "email_payment") {
    await setClassStatus(cls.id, "class_complete");
  }
  void updateClass;
}
