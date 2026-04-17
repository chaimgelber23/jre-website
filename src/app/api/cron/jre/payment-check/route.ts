/**
 * GET /api/cron/jre/payment-check
 *
 * Scheduled Friday 10:00 AM local.
 *
 *   1. Reconcile sheet ↔ DB (if "Paid? Y/N" got flipped to y in the sheet,
 *      promote jre_payments.paid = true)
 *   2. For any still-unpaid class where the payment request was sent >48h ago,
 *      draft a reminder (Gmail to Rabbi Oratz), cap at 2 reminders/week.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  listUnpaidPayments,
  getClassById,
  getSpeakerById,
  updateDraft,
} from "@/lib/db/secretary";
import { draftPaymentReminder } from "@/lib/secretary/email-drafter";
import { reconcilePaidFromSheet } from "@/lib/secretary/sheet-sync";
import {
  assertCronAuth,
  enforceShabbos,
} from "@/lib/secretary/cron-guard";
import { sendTelegram, approvalKeyboard } from "@/lib/telegram/sender";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const DASHBOARD_BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://thejre.org";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const REMINDER_CAP = 2;
const HOURS_SINCE_REQUEST = 48;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  // 1) Reconcile sheet → DB
  const recon = await reconcilePaidFromSheet();

  // 2) Draft reminders for the still-unpaid
  const unpaid = await listUnpaidPayments();
  const now = new Date();
  let reminded = 0;
  let capped = 0;

  for (const p of unpaid) {
    if (!p.request_sent_at) continue;
    const ageHrs = (now.getTime() - new Date(p.request_sent_at).getTime()) / 36e5;
    if (ageHrs < HOURS_SINCE_REQUEST) continue;
    if (p.reminder_count >= REMINDER_CAP) {
      capped++;
      continue;
    }
    const cls = await getClassById(p.class_id);
    if (!cls || !cls.speaker_id) continue;
    const speaker = await getSpeakerById(cls.speaker_id);
    if (!speaker) continue;

    const draft = await draftPaymentReminder(cls.id, p.reminder_count + 1);
    if (!draft) continue;

    // Increment reminder count immediately so a crash mid-loop doesn't spam.
    await db()
      .from("jre_payments")
      .update({
        reminder_count: p.reminder_count + 1,
        last_reminder_at: now.toISOString(),
      })
      .eq("id", p.id);

    await sendTelegram(
      "jre",
      `💸 <b>Payment reminder drafted (${p.reminder_count + 1}/${REMINDER_CAP})</b>\nSpeaker: ${speaker.full_name}\nAmount: $${p.amount_usd}\n\n<a href="${DASHBOARD_BASE}/admin/secretary/drafts/${draft.id}">Preview</a>`,
      {
        severity: "warning",
        inlineKeyboard: approvalKeyboard(draft.id),
      }
    );
    reminded++;
  }

  return NextResponse.json({
    ok: true,
    reconciled: recon,
    reminded,
    capped,
  });
  void updateDraft;
}
