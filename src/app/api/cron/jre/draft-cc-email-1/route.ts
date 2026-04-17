/**
 * GET /api/cron/jre/draft-cc-email-1
 *
 * Scheduled Sunday 9:00 PM local.
 *
 * Clones the speaker's most recent Constant Contact campaign, swaps the date,
 * uploads as a scheduled draft in CC (scheduled for Monday 8:00 AM), and
 * Telegram-asks for approval. On Approve, we call scheduleCampaign().
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getNextUpcomingClass,
  findDraftForClass,
} from "@/lib/db/secretary";
import { draftCcEmail1 } from "@/lib/secretary/email-drafter";
import {
  assertCronAuth,
  enforceShabbos,
} from "@/lib/secretary/cron-guard";
import { sendTelegram, approvalKeyboard } from "@/lib/telegram/sender";

export const maxDuration = 60;

const DASHBOARD_BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://thejre.org";

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  const cls = await getNextUpcomingClass();
  if (!cls || !cls.speaker_id) {
    return NextResponse.json({ ok: true, skipped: "no speaker yet" });
  }
  const existing = await findDraftForClass(cls.id, "email_cc_1");
  if (existing && existing.status !== "cancelled" && existing.status !== "failed") {
    return NextResponse.json({ ok: true, skipped: "draft exists", id: existing.id });
  }

  const draft = await draftCcEmail1(cls.id);
  if (!draft) {
    await sendTelegram(
      "jre",
      "Could not clone CC Email #1 — no prior campaign for this speaker. Will need a manual seed.",
      { severity: "warning" }
    );
    return NextResponse.json({ ok: false, reason: "no prior campaign" });
  }

  await sendTelegram(
    "jre",
    `📧 <b>Monday CC email (8am) drafted</b>\nSubject: ${draft.subject}\nSender: ${draft.from_name}\n\n<a href="${DASHBOARD_BASE}/admin/secretary/drafts/${draft.id}">Preview</a>`,
    {
      severity: "info",
      inlineKeyboard: approvalKeyboard(draft.id),
    }
  );

  return NextResponse.json({ ok: true, draftId: draft.id });
}
