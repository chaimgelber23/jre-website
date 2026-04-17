/**
 * GET /api/cron/jre/inbox-watch
 *
 * Scheduled every 3h Mon-Wed via cron-job.org.
 *
 * Polls Gitty's Gmail for:
 *   1. Replies from Mrs. Oratz (speaker confirmation)
 *   2. Replies from Rabbi Oratz (Zelle confirmation → mark paid)
 *
 * Never writes DB without human tap. When a candidate match is detected,
 * posts a one-tap Telegram card.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { assertCronAuth, enforceShabbos } from "@/lib/secretary/cron-guard";
import { listInboxSince } from "@/lib/secretary/gmail-client";
import {
  getNextUpcomingClass,
  listUnpaidPayments,
  getClassById,
  getSpeakerByName,
  upsertSpeaker,
} from "@/lib/db/secretary";
import { sendTelegram } from "@/lib/telegram/sender";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const MRS_ORATZ = process.env.MRS_ORATZ_EMAIL ?? "elishevaoratz@gmail.com";
const RABBI_ORATZ = process.env.RABBI_ORATZ_EMAIL ?? "yoratz@thejre.org";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getLastCheck(key: string): Promise<number> {
  const { data } = await db().from("app_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ? Number(data.value) : Math.floor(Date.now() / 1000) - 7 * 86400;
}
async function setLastCheck(key: string, ts: number): Promise<void> {
  await db()
    .from("app_settings")
    .upsert({ key, value: String(ts), updated_at: new Date().toISOString() });
}

type ExtractedConfirmation = {
  speakerName: string;
  speakerEmail?: string;
  feeUsd?: number;
  notes?: string;
};

async function extractSpeakerFromEmail(
  subject: string,
  body: string
): Promise<ExtractedConfirmation | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const client = new Anthropic({ apiKey: key });
  try {
    const res = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
        {
          role: "user",
          content: `Mrs. Oratz emails Gitty each week confirming who will speak at the upcoming JRE Tuesday 10am class. Extract speaker info from this email. Return strict JSON or NONE if not a confirmation.

Subject: ${subject}
Body: ${body.slice(0, 2000)}

If this is a speaker confirmation, return ONLY JSON like:
{"speakerName":"Rebbetzin Fink","speakerEmail":"dfinkprivate@gmail.com","feeUsd":400,"notes":""}

If this is NOT a speaker confirmation (or is ambiguous), return exactly: NONE`,
          },
        ],
      },
      { timeout: 20_000 }
    );
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (text.startsWith("NONE")) return null;
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return JSON.parse(m[0]) as ExtractedConfirmation;
  } catch (err) {
    console.error("[inbox-watch] extract failed:", err);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  const results = { mrsOratzMatches: 0, rabbiOratzMatches: 0, skipped: 0 };

  // --- 1. Mrs. Oratz → speaker confirmation ------------------------------
  const lastSpeakerCheck = await getLastCheck("jre_last_mrs_oratz_check");
  const mrsMsgs = await listInboxSince(MRS_ORATZ, lastSpeakerCheck);
  await setLastCheck("jre_last_mrs_oratz_check", Math.floor(Date.now() / 1000));

  const upcoming = await getNextUpcomingClass();
  for (const msg of mrsMsgs) {
    if (!upcoming) { results.skipped++; continue; }
    if (upcoming.speaker_id) { results.skipped++; continue; }
    const extracted = await extractSpeakerFromEmail(msg.subject, msg.bodyText || msg.bodyHtml);
    if (!extracted) { results.skipped++; continue; }

    // Match-or-upsert speaker so the Telegram card carries an id.
    let speaker = await getSpeakerByName(extracted.speakerName);
    if (!speaker) {
      speaker = await upsertSpeaker({
        full_name: extracted.speakerName,
        email: extracted.speakerEmail ?? null,
        last_fee_usd: extracted.feeUsd ?? null,
        source: "inbox_watch",
      });
    }

    const fee = extracted.feeUsd ?? speaker.last_fee_usd ?? null;
    await sendTelegram(
      "jre",
      `<b>Mrs. Oratz confirmed</b>\nSpeaker: ${speaker.full_name}\nFee: ${
        fee ? `$${fee}` : "(not specified)"
      }\nClass: Tue ${upcoming.class_date}\n\n<i>Tap Confirm to attach to class + start drafts.</i>`,
      {
        severity: "info",
        inlineKeyboard: [
          [
            {
              text: "✅ Confirm speaker",
              callback_data: `confirm_speaker:${upcoming.id}:${speaker.id}:${fee ?? ""}`,
            },
            { text: "✏️ Edit in dashboard", callback_data: `open:${upcoming.id}` },
          ],
        ],
      }
    );
    results.mrsOratzMatches++;
  }

  // --- 2. Rabbi Oratz → payment confirmation -----------------------------
  const lastPayCheck = await getLastCheck("jre_last_rabbi_oratz_check");
  const rabbiMsgs = await listInboxSince(RABBI_ORATZ, lastPayCheck);
  await setLastCheck("jre_last_rabbi_oratz_check", Math.floor(Date.now() / 1000));

  const unpaid = await listUnpaidPayments();
  for (const msg of rabbiMsgs) {
    const lc = `${msg.subject}\n${msg.bodyText}`.toLowerCase();
    if (!/zelled|zelle sent|paid|sent payment/.test(lc)) {
      results.skipped++;
      continue;
    }
    // Find which unpaid class his reply is about — naively match speaker name
    for (const p of unpaid) {
      const cls = await getClassById(p.class_id);
      if (!cls || !cls.speaker_id) continue;
      const speaker = await (await import("@/lib/db/secretary")).getSpeakerById(cls.speaker_id);
      if (!speaker) continue;
      if (lc.includes(speaker.full_name.toLowerCase()) || lc.includes(String(p.amount_usd))) {
        await sendTelegram(
          "jre",
          `<b>Rabbi Oratz may have paid</b>\nSpeaker: ${speaker.full_name}\nAmount: $${p.amount_usd}\nClass: ${cls.class_date}\n\n<i>Tap Mark Paid to close this out.</i>`,
          {
            severity: "info",
            inlineKeyboard: [
              [
                { text: "✅ Mark paid", callback_data: `mark_paid:${cls.id}` },
                { text: "👀 Open in dashboard", callback_data: `open:${cls.id}` },
              ],
            ],
          }
        );
        results.rabbiOratzMatches++;
        break;
      }
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
