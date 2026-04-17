/**
 * GET /api/cron/jre/draft-speaker-email
 *
 * Scheduled Thursday 10:00 AM local via cron-job.org.
 *
 * For next Tuesday's class, if the speaker is confirmed but the Thu Gmail
 * confirmation draft hasn't been written yet, draft it (cloning Gitty's most
 * recent Sent email to that speaker) and Telegram-ask for approval.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getNextUpcomingClass,
  findDraftForClass,
} from "@/lib/db/secretary";
import { draftSpeakerConfirmation } from "@/lib/secretary/email-drafter";
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
    return NextResponse.json({ ok: true, skipped: "no speaker confirmed yet" });
  }

  const existing = await findDraftForClass(cls.id, "email_speaker");
  if (existing && existing.status !== "cancelled" && existing.status !== "failed") {
    return NextResponse.json({ ok: true, skipped: "draft already exists", id: existing.id });
  }

  const draft = await draftSpeakerConfirmation(cls.id);
  if (!draft) {
    await sendTelegram("jre", "Failed to draft speaker confirmation — held for human", {
      severity: "warning",
    });
    return NextResponse.json({ ok: false, reason: "drafter returned null" });
  }

  await sendTelegram(
    "jre",
    `📧 <b>Thu speaker confirmation drafted</b>\nTo: ${draft.to_list.join(", ")}\nSubject: ${draft.subject}\n\n<a href="${DASHBOARD_BASE}/admin/secretary/drafts/${draft.id}">Preview in dashboard</a>`,
    {
      severity: "info",
      inlineKeyboard: approvalKeyboard(draft.id),
    }
  );

  return NextResponse.json({ ok: true, draftId: draft.id });
}
