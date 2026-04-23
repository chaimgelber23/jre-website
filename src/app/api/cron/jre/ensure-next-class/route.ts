/**
 * GET /api/cron/jre/ensure-next-class
 *
 * Scheduled Thursday 9:00 AM local via cron-job.org (5 days before class).
 *
 * Ensures a row exists in jre_weekly_classes for next Tuesday. Then:
 *   1. Reads the Tuesday Speakers sheet — source of truth for who's booked.
 *      If a name is filled in for that Tuesday, upsert the speaker into the DB
 *      and attach to the class row. No need to ask Elisheva.
 *   2. Only if the sheet is empty for that date AND the DB has no speaker AND
 *      we haven't asked already → draft the "Elisheva, who's speaking?" ask.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureClassForDate,
  nextTuesdayISO,
  updateClass,
  upsertSpeaker,
} from "@/lib/db/secretary";
import { assertCronAuth, enforceShabbos } from "@/lib/secretary/cron-guard";
import { draftElishevaAsk } from "@/lib/secretary/email-drafter";
import { getCanonicalZoomLink } from "@/lib/secretary/zoom-link-guard";
import {
  mirrorClassToSheet,
  readSheetRows,
  lastFeeForSpeaker,
} from "@/lib/secretary/sheet-sync";
import { sendTelegram } from "@/lib/telegram/sender";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  const classDate = nextTuesdayISO();
  const zoom = (await getCanonicalZoomLink()) ?? undefined;
  let cls = await ensureClassForDate(classDate, zoom);

  // 1. Pull the Speakers sheet — source of truth. If a row exists for this
  //    Tuesday with a speaker name, import that speaker and skip the ask.
  let importedFromSheet = false;
  if (!cls.speaker_id) {
    try {
      const rows = await readSheetRows();
      const sheetRow = rows.find((r) => r.dateISO === classDate);
      if (sheetRow && sheetRow.speaker.trim()) {
        const fee =
          sheetRow.payRateNumeric ??
          (await lastFeeForSpeaker(sheetRow.speaker));
        const speaker = await upsertSpeaker({
          full_name: sheetRow.speaker.trim(),
          last_fee_usd: fee ?? null,
          source: "sheet_import",
        });
        await updateClass(cls.id, {
          speaker_id: speaker.id,
          fee_usd: fee ?? null,
        });
        cls = { ...cls, speaker_id: speaker.id, fee_usd: fee ?? null };
        importedFromSheet = true;
      }
    } catch (err) {
      console.error("[cron] ensure-next-class: sheet read failed", err);
    }
  }

  // 2. Only ask Elisheva if no speaker (in DB or sheet) AND we haven't asked.
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

  // Mirror to Google Sheet (idempotent — keeps date column populated).
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

  const summary = importedFromSheet
    ? `Imported speaker from sheet — no ask needed.`
    : elishevaDraftId
      ? "Drafted ask-Elisheva email (pending approval)."
      : cls.speaker_id
        ? "Speaker already confirmed (no action)."
        : "Already asked Elisheva for this week.";

  await sendTelegram(
    "jre",
    `Thursday setup: class ${classDate} ready. ${summary}`,
    { severity: "info" }
  );

  return NextResponse.json({
    ok: true,
    classId: cls.id,
    classDate,
    speakerConfirmed: !!cls.speaker_id,
    importedFromSheet,
    elishevaDraftId,
  });
}
