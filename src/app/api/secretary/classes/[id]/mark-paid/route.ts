/**
 * POST /api/secretary/classes/:id/mark-paid
 *
 * Flips jre_payments.paid = true for a class, bubbles class status to "paid",
 * mirrors to the sheet.
 */

import { NextRequest, NextResponse } from "next/server";
import { markPaid } from "@/lib/db/secretary";
import { mirrorClassToSheet } from "@/lib/secretary/sheet-sync";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const payment = await markPaid(id, "dashboard");
  if (!payment) {
    return NextResponse.json({ error: "no payment row for class" }, { status: 404 });
  }
  await mirrorClassToSheet(id).catch(() => {});
  return NextResponse.json({ ok: true, payment });
}
