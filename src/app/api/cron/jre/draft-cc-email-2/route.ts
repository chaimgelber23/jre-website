/**
 * GET /api/cron/jre/draft-cc-email-2
 *
 * Scheduled Monday 9:00 PM local.
 *
 * Same clone flow as Email #1, but the draft is scheduled for Tuesday 9:00 AM
 * and the sender is always Gitty Levi (per SOP).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getNextUpcomingClass,
  findDraftForClass,
} from "@/lib/db/secretary";
import { draftCcEmail2 } from "@/lib/secretary/email-drafter";
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
  const existing = await findDraftForClass(cls.id, "email_cc_2");
  if (existing && existing.status !== "cancelled" && existing.status !== "failed") {
    return NextResponse.json({ ok: true, skipped: "draft exists", id: existing.id });
  }

  const draft = await draftCcEmail2(cls.id);
  if (!draft) {
    await sendTelegram("jre", "Could not clone CC Email #2 — no prior campaign", {
      severity: "warning",
    });
    return NextResponse.json({ ok: false, reason: "no prior campaign" });
  }

  await sendTelegram(
    "jre",
    `📧 <b>Tuesday CC email (9am) drafted</b>\nSubject: ${draft.subject}\nSender: ${draft.from_name}\n\n<a href="${DASHBOARD_BASE}/admin/secretary/drafts/${draft.id}">Preview</a>`,
    {
      severity: "info",
      inlineKeyboard: approvalKeyboard(draft.id),
    }
  );

  return NextResponse.json({ ok: true, draftId: draft.id });
}
