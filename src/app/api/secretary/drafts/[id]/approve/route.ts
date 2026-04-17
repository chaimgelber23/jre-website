/**
 * POST /api/secretary/drafts/:id/approve
 *
 * Body (optional):
 *   { subject?, body_html?, body_text?, approved_by?, scheduled_send_at? }
 *
 * Marks a draft approved. If `scheduled_send_at` is in the past (or null),
 * the next run of /api/cron/jre/send-approved will ship it.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDraft, setDraftStatus, updateDraft } from "@/lib/db/secretary";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const draft = await getDraft(id);
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });

  const patch: Record<string, unknown> = {
    approved_at: new Date().toISOString(),
    approved_by: body.approved_by ?? "dashboard",
    approval_channel: body.approval_channel ?? "dashboard",
  };
  if (typeof body.subject === "string") patch.subject = body.subject;
  if (typeof body.body_html === "string") patch.body_html = body.body_html;
  if (typeof body.body_text === "string") patch.body_text = body.body_text;
  if (typeof body.scheduled_send_at === "string")
    patch.scheduled_send_at = body.scheduled_send_at;

  // Apply edits first, then flip status.
  if (Object.keys(patch).length > 0) await updateDraft(id, patch);
  const updated = await setDraftStatus(id, "approved");

  return NextResponse.json({ ok: true, draft: updated });
}
