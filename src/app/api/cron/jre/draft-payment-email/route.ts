/**
 * GET /api/cron/jre/draft-payment-email
 *
 * Scheduled Tuesday 9:00 PM local (after the 10am class has run).
 *
 * Drafts the Gmail to Rabbi Oratz asking him to Zelle the speaker, creates
 * the jre_payments row, Telegram-asks for approval.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getNextUpcomingClass,
  getClassByDate,
  getSpeakerById,
  findDraftForClass,
  upsertPaymentForClass,
} from "@/lib/db/secretary";
import { draftPaymentRequest } from "@/lib/secretary/email-drafter";
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

  // "Today's class" = today if Tuesday, else most recent Tuesday
  const today = new Date();
  const dow = today.getDay();
  const back = dow >= 2 ? dow - 2 : dow + 5; // Tue is 2
  const mostRecentTue = new Date(today);
  mostRecentTue.setDate(today.getDate() - back);
  const classDate = mostRecentTue.toISOString().slice(0, 10);

  const cls = await getClassByDate(classDate);
  if (!cls || !cls.speaker_id) {
    return NextResponse.json({ ok: true, skipped: "no class or speaker" });
  }
  const speaker = await getSpeakerById(cls.speaker_id);
  if (!speaker) return NextResponse.json({ ok: true, skipped: "no speaker" });
  const fee = cls.fee_usd ?? speaker.last_fee_usd;
  if (!fee) return NextResponse.json({ ok: true, skipped: "no fee" });

  // Ensure payment row exists so the Fri reminder + inbox-watch can find it.
  await upsertPaymentForClass(cls.id, {
    amount_usd: fee,
    speaker_id: speaker.id,
    payment_method: "zelle",
  });

  const existing = await findDraftForClass(cls.id, "email_payment");
  if (existing && existing.status !== "cancelled" && existing.status !== "failed") {
    return NextResponse.json({ ok: true, skipped: "draft exists", id: existing.id });
  }

  const draft = await draftPaymentRequest(cls.id);
  if (!draft) return NextResponse.json({ ok: false, reason: "drafter returned null" });

  await sendTelegram(
    "jre",
    `💸 <b>Payment request drafted</b>\nSpeaker: ${speaker.full_name}\nAmount: $${fee}\nTo: Rabbi Oratz\n\n<a href="${DASHBOARD_BASE}/admin/secretary/drafts/${draft.id}">Preview</a>`,
    {
      severity: "info",
      inlineKeyboard: approvalKeyboard(draft.id),
    }
  );

  return NextResponse.json({ ok: true, draftId: draft.id });
  void getNextUpcomingClass;
}
