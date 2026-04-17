/**
 * POST /api/secretary/telegram-callback
 *
 * Telegram webhook for inline-button taps. Set the webhook once per project:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://thejre.org/api/secretary/telegram-callback&secret_token=<webhook-secret>"
 *
 * Supported callback_data payloads:
 *   approve:<draftId>                      — approve + schedule for default time
 *   hold:<draftId>                         — hold
 *   edit:<draftId>                         — deep-link back to dashboard (no-op DB)
 *   confirm_speaker:<classId>:<speakerId>:<fee?> — wire Mrs Oratz's email reply
 *   mark_paid:<classId>                    — close out payment
 *   open:<classId>                         — deep-link (no-op DB)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getDraft,
  getClassById,
  getSpeakerById,
  setDraftStatus,
  updateDraft,
  updateClass,
  incrementSpeakerTalks,
  markPaid,
} from "@/lib/db/secretary";
import {
  answerCallbackQuery,
  editMessageText,
} from "@/lib/telegram/sender";
import { mirrorClassToSheet } from "@/lib/secretary/sheet-sync";

const DASHBOARD_BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://thejre.org";

export async function POST(req: NextRequest) {
  // Optional: Telegram's secret_token guard
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expected) return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const cb = body?.callback_query;
  if (!cb?.data) return NextResponse.json({ ok: true, noop: true });

  const data = String(cb.data);
  const [verb, ...parts] = data.split(":");
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;

  try {
    if (verb === "approve") {
      const draftId = parts[0];
      const draft = await getDraft(draftId);
      if (!draft) throw new Error("draft not found");

      const patch: Record<string, unknown> = {
        approved_at: new Date().toISOString(),
        approved_by: `tg:${cb.from?.username ?? cb.from?.id ?? "unknown"}`,
        approval_channel: "telegram",
      };
      if (!draft.scheduled_send_at) patch.scheduled_send_at = new Date().toISOString();
      await updateDraft(draftId, patch);
      await setDraftStatus(draftId, "approved");

      if (chatId && messageId) {
        await editMessageText(
          chatId,
          messageId,
          `${cb.message?.text ?? ""}\n\n✅ <b>Approved by ${cb.from?.first_name ?? "you"}</b>`
        );
      }
      await answerCallbackQuery(cb.id, { text: "Approved — will send" });
    } else if (verb === "hold") {
      const draftId = parts[0];
      await setDraftStatus(draftId, "held");
      if (chatId && messageId) {
        await editMessageText(
          chatId,
          messageId,
          `${cb.message?.text ?? ""}\n\n✋ <b>Held</b>`
        );
      }
      await answerCallbackQuery(cb.id, { text: "Held" });
    } else if (verb === "edit") {
      const draftId = parts[0];
      await answerCallbackQuery(cb.id, {
        text: `Open: ${DASHBOARD_BASE}/admin/secretary/drafts/${draftId}`,
        showAlert: true,
      });
    } else if (verb === "confirm_speaker") {
      const [classId, speakerId, feeRaw] = parts;
      const cls = await getClassById(classId);
      const speaker = await getSpeakerById(speakerId);
      if (!cls || !speaker) throw new Error("class/speaker missing");
      const fee = feeRaw ? Number(feeRaw) : speaker.last_fee_usd ?? null;
      await updateClass(classId, {
        speaker_id: speakerId,
        fee_usd: fee ?? null,
        elisheva_replied_at: new Date().toISOString(),
        status: "drafts_pending",
      });
      await incrementSpeakerTalks(speakerId, cls.class_date, fee ?? undefined);
      await mirrorClassToSheet(classId).catch(() => {});
      if (chatId && messageId) {
        await editMessageText(
          chatId,
          messageId,
          `${cb.message?.text ?? ""}\n\n✅ <b>Confirmed: ${speaker.full_name}</b>`
        );
      }
      await answerCallbackQuery(cb.id, { text: "Speaker attached — drafts will follow" });
    } else if (verb === "mark_paid") {
      const classId = parts[0];
      await markPaid(classId, "telegram");
      await mirrorClassToSheet(classId).catch(() => {});
      if (chatId && messageId) {
        await editMessageText(
          chatId,
          messageId,
          `${cb.message?.text ?? ""}\n\n✅ <b>Marked paid</b>`
        );
      }
      await answerCallbackQuery(cb.id, { text: "Marked paid" });
    } else if (verb === "open") {
      const classId = parts[0];
      await answerCallbackQuery(cb.id, {
        text: `${DASHBOARD_BASE}/admin/secretary?class=${classId}`,
        showAlert: true,
      });
    } else {
      await answerCallbackQuery(cb.id, { text: "Unknown action" });
    }
  } catch (err) {
    console.error("[telegram-callback] error:", err);
    await answerCallbackQuery(cb.id, { text: `Error: ${String(err).slice(0, 80)}` });
  }

  return NextResponse.json({ ok: true });
}
