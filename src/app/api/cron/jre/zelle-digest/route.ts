/**
 * GET /api/cron/jre/zelle-digest
 *
 * Sends one digest email per payee_email listing all open jre_money_owed.
 * Default schedule: M/W/F 9am via cron-job.org.
 *
 * If zero open items for a payee, no email is sent (no "you owe nothing" spam).
 * Inbox-watch handles the reply parsing to mark items paid.
 */
import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth, enforceShabbos } from "@/lib/secretary/cron-guard";
import { listOpenMoneyOwed, buildDigestEmail, bumpDigestCounter } from "@/lib/secretary/money-owed";
import { sendGmail } from "@/lib/secretary/gmail-client";
import { sendTelegram } from "@/lib/telegram/sender";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  const allOpen = await listOpenMoneyOwed();
  if (allOpen.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "no open items" });
  }

  // Group by payee
  const byPayee: Record<string, typeof allOpen> = {};
  for (const item of allOpen) {
    (byPayee[item.payee_email] ||= []).push(item);
  }

  const results: Array<{ payee: string; itemCount: number; total: number; messageId?: string; error?: string }> = [];

  for (const [payeeEmail, items] of Object.entries(byPayee)) {
    const total = items.reduce((s, i) => s + i.amount_usd, 0);
    const { subject, html, text } = buildDigestEmail(items);

    try {
      const send = await sendGmail({
        to: [payeeEmail],
        fromName: "Gitty Levi",
        subject,
        bodyHtml: html,
        bodyText: text,
      });

      if (send?.messageId) {
        await bumpDigestCounter(items.map((i) => i.id));
        results.push({ payee: payeeEmail, itemCount: items.length, total, messageId: send.messageId });
      } else {
        results.push({ payee: payeeEmail, itemCount: items.length, total, error: "send returned null" });
      }
    } catch (err) {
      results.push({ payee: payeeEmail, itemCount: items.length, total, error: String(err) });
    }
  }

  // Telegram summary
  const totalSent = results.reduce((s, r) => s + (r.messageId ? r.itemCount : 0), 0);
  const totalDollars = results.reduce((s, r) => s + (r.messageId ? r.total : 0), 0);
  if (totalSent > 0) {
    await sendTelegram(
      "jre",
      `<b>Zelle digest sent</b>\n${totalSent} item(s), $${totalDollars.toLocaleString()} requested\nPayee(s): ${Object.keys(byPayee).join(", ")}`,
      { severity: "info" }
    );
  }

  return NextResponse.json({ ok: true, results });
}
