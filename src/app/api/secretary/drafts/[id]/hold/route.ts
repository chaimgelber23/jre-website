/**
 * POST /api/secretary/drafts/:id/hold
 *
 * Marks a draft "held" — it will NOT be sent by the send-approved cron.
 * Coordinator can open it in the dashboard, edit, and re-approve.
 */

import { NextRequest, NextResponse } from "next/server";
import { setDraftStatus } from "@/lib/db/secretary";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const updated = await setDraftStatus(id, "held", {
    failure_reason: body.reason ?? null,
  });
  return NextResponse.json({ ok: true, draft: updated });
}
