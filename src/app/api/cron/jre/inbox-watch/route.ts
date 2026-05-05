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
import { listOpenMoneyOwed, markMoneyOwedPaid } from "@/lib/secretary/money-owed";

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

/**
 * Parse a payer's reply (e.g. Elisheva or Yossi) to figure out which open
 * money_owed items they paid. Returns array of {id, paid:true} matches.
 *
 *   "paid all"             → mark every open item paid
 *   "paid Yocheved"        → fuzzy match by recipient_name
 *   "Yocheved done"        → same
 *   "1, 3 done"            → mark items 1 and 3 from the original digest
 *
 * Falls back to fuzzy substring matching if Claude unavailable.
 */
async function parsePaidReply(
  body: string,
  openItems: Array<{ id: string; recipient_name: string; amount_usd: number }>
): Promise<string[]> {
  if (openItems.length === 0) return [];
  const lc = body.toLowerCase();

  // Cheap "paid all" detection first
  if (/\bpaid (all|everything|them all|both)\b/.test(lc) || /\ball (sent|paid|done|zelled)\b/.test(lc)) {
    return openItems.map((i) => i.id);
  }

  // Try fuzzy substring match per item
  const matched: string[] = [];
  for (const item of openItems) {
    const firstName = item.recipient_name.split(/\s+/)[0].toLowerCase();
    const fullName = item.recipient_name.toLowerCase();
    if (lc.includes(fullName) || (firstName.length >= 4 && lc.includes(firstName))) {
      matched.push(item.id);
    }
  }
  if (matched.length > 0) return matched;

  // Fall back to Claude Haiku for ambiguous cases
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return [];
  try {
    const client = new Anthropic({ apiKey: key });
    const itemList = openItems.map((i, idx) => `${idx + 1}. ${i.recipient_name} ($${i.amount_usd})`).join("\n");
    const res = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `Gitty sent a Zelle digest with these open payments:
${itemList}

The payer replied:
"""
${body.slice(0, 2000)}
"""

Which items did they pay? Return ONLY a JSON array of 1-based indexes (e.g. [1,3]) or [] if none. Return [0] if they said "all" or "everything".`,
          },
        ],
      },
      { timeout: 15_000 }
    );
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    const m = text.match(/\[[\d,\s]*\]/);
    if (!m) return [];
    const arr: number[] = JSON.parse(m[0]);
    if (arr.includes(0)) return openItems.map((i) => i.id);
    return arr.map((idx) => openItems[idx - 1]?.id).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  try {
    return await runInboxWatch();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 5).join("\n") : null;
    console.error("[inbox-watch] unhandled:", err);
    return NextResponse.json(
      { ok: false, error: msg, stack },
      { status: 500 },
    );
  }
}

async function runInboxWatch() {
  const results = { mrsOratzMatches: 0, rabbiOratzMatches: 0, moneyOwedPaid: 0, skipped: 0 };

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

  // --- 3. Money-owed digest replies (from Mrs. Oratz OR Rabbi Oratz) -----
  // We pull replies from EITHER address since either may be the configured payee_email.
  const lastDigestCheck = await getLastCheck("jre_last_money_owed_check");
  const cutoffTs = Math.floor(Date.now() / 1000);
  const digestReplyMsgs = [
    ...(await listInboxSince(MRS_ORATZ, lastDigestCheck)),
    ...(await listInboxSince(RABBI_ORATZ, lastDigestCheck)),
  ];
  await setLastCheck("jre_last_money_owed_check", cutoffTs);

  for (const msg of digestReplyMsgs) {
    const body = msg.bodyText || msg.bodyHtml || "";
    const senderEmail = msg.from.replace(/.*</, "").replace(/>.*/, "").toLowerCase().trim();
    // Only consider replies that mention payment language
    if (!/paid|zelled|sent|done|all set|finished/i.test(body)) {
      continue;
    }
    const open = await listOpenMoneyOwed(senderEmail);
    if (open.length === 0) continue;

    const paidIds = await parsePaidReply(body, open);
    for (const id of paidIds) {
      await markMoneyOwedPaid(id, { source: "inbox_reply", method: "zelle" });
      results.moneyOwedPaid++;
    }

    if (paidIds.length > 0) {
      const paidItems = open.filter((i) => paidIds.includes(i.id));
      const totalPaid = paidItems.reduce((s, i) => s + i.amount_usd, 0);
      const stillOpen = open.length - paidIds.length;
      await sendTelegram(
        "jre",
        `<b>Payment(s) confirmed</b>\n${paidIds.length} item(s) marked paid: $${totalPaid.toLocaleString()}\nFrom: ${senderEmail}\n${stillOpen > 0 ? `Still open: ${stillOpen}` : "✅ all clear"}`,
        { severity: "info" }
      );
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
