/**
 * POST /api/secretary/classes/:id/confirm-speaker
 *
 * Body: { speakerId, feeUsd?, topic? }
 *
 * Wires a confirmed speaker onto a pending class. Advances status to
 * "drafts_pending" so the Thu/Sun draft crons will pick it up.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getClassById,
  getSpeakerById,
  updateClass,
  incrementSpeakerTalks,
} from "@/lib/db/secretary";
import { mirrorClassToSheet } from "@/lib/secretary/sheet-sync";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { speakerId, feeUsd, topic } = body as {
    speakerId?: string;
    feeUsd?: number;
    topic?: string;
  };
  if (!speakerId) {
    return NextResponse.json({ error: "speakerId required" }, { status: 400 });
  }

  const cls = await getClassById(id);
  if (!cls) return NextResponse.json({ error: "class not found" }, { status: 404 });
  const speaker = await getSpeakerById(speakerId);
  if (!speaker) return NextResponse.json({ error: "speaker not found" }, { status: 404 });

  const finalFee = feeUsd ?? speaker.last_fee_usd ?? null;
  const patch = {
    speaker_id: speakerId,
    fee_usd: finalFee ?? null,
    topic: topic ?? cls.topic ?? null,
    elisheva_replied_at: new Date().toISOString(),
    status: "drafts_pending" as const,
  };

  const updated = await updateClass(cls.id, patch);
  await incrementSpeakerTalks(speakerId, cls.class_date, finalFee ?? undefined);
  await mirrorClassToSheet(cls.id).catch(() => {});
  return NextResponse.json({ ok: true, class: updated });
}
