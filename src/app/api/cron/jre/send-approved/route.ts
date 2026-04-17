/**
 * GET /api/cron/jre/send-approved
 *
 * Scheduled every 15min during business hours (9am-9pm local) via cron-job.org.
 *
 * Picks up every draft where status='approved' and scheduled_send_at <= now
 * and actually ships it (Gmail send or CC clone + schedule).
 *
 * Gmail drafts that are "approved" but scheduled for the future stay queued;
 * CC drafts that are "approved" go straight to clone + schedule (CC sends
 * at the target time itself).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendApprovedDraft } from "@/lib/secretary/send-executor";
import {
  assertCronAuth,
  enforceShabbos,
} from "@/lib/secretary/cron-guard";
import { sendTelegram } from "@/lib/telegram/sender";
import type { JreEmailDraft } from "@/types/secretary";

export const maxDuration = 60;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  const nowISO = new Date().toISOString();

  // Two pick-up criteria:
  //   1) Gmail: approved + scheduled_send_at <= now (or null/asap)
  //   2) CC:    approved (CC schedules itself on clone; we push once)
  const { data } = await db()
    .from("jre_email_drafts")
    .select("*")
    .eq("status", "approved")
    .or(`scheduled_send_at.is.null,scheduled_send_at.lte.${nowISO}`)
    .limit(10);

  const drafts = (data as JreEmailDraft[]) ?? [];
  const results: Array<{ id: string; ok: boolean; reason?: string }> = [];

  for (const draft of drafts) {
    const result = await sendApprovedDraft(draft.id);
    if (result.ok) {
      results.push({ id: draft.id, ok: true });
    } else {
      results.push({ id: draft.id, ok: false, reason: result.reason });
      await sendTelegram(
        "jre",
        `Send failed for draft ${draft.id} (${draft.draft_type}): ${result.reason}`,
        { severity: "warning" }
      );
    }
  }

  return NextResponse.json({ ok: true, processed: drafts.length, results });
}
