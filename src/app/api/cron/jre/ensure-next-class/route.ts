/**
 * GET /api/cron/jre/ensure-next-class
 *
 * Scheduled Monday 9:00 AM local via cron-job.org.
 *
 * Ensures a row exists in jre_weekly_classes for next Tuesday. If the speaker
 * has not been confirmed yet, also drafts the "Elisheva, who's speaking?"
 * Gmail and Telegram-asks for approval.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureClassForDate,
  nextTuesdayISO,
  updateClass,
} from "@/lib/db/secretary";
import { assertCronAuth, enforceShabbos } from "@/lib/secretary/cron-guard";
import { draftElishevaAsk } from "@/lib/secretary/email-drafter";
import { getCanonicalZoomLink } from "@/lib/secretary/zoom-link-guard";
import { mirrorClassToSheet } from "@/lib/secretary/sheet-sync";
import { sendTelegram } from "@/lib/telegram/sender";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  const classDate = nextTuesdayISO();
  const zoom = (await getCanonicalZoomLink()) ?? undefined;
  const cls = await ensureClassForDate(classDate, zoom);

  let elishevaDraftId: string | null = null;
  if (!cls.speaker_id && !cls.elisheva_asked_at) {
    const draft = await draftElishevaAsk(cls.id);
    if (draft) {
      elishevaDraftId = draft.id;
      await updateClass(cls.id, {
        elisheva_asked_at: new Date().toISOString(),
      });
    }
  }

  // Mirror to Google Sheet (header placeholder row — empty speaker is fine).
  try {
    await mirrorClassToSheet(cls.id);
  } catch (err) {
    console.error("[cron] ensure-next-class: sheet sync failed", err);
    await sendTelegram(
      "jre",
      `Sheet sync failed for class ${classDate}: ${String(err).slice(0, 200)}`,
      { severity: "critical" }
    );
  }

  await sendTelegram(
    "jre",
    `Monday setup: class ${classDate} ready.${
      elishevaDraftId ? " Drafted ask-Elisheva email (pending approval)." : ""
    }${cls.speaker_id ? " Speaker already confirmed." : ""}`,
    { severity: "info" }
  );

  return NextResponse.json({
    ok: true,
    classId: cls.id,
    classDate,
    speakerConfirmed: !!cls.speaker_id,
    elishevaDraftId,
  });
}
