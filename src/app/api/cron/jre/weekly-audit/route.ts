/**
 * GET /api/cron/jre/weekly-audit
 *
 * Scheduled Saturday 8:00 PM local (after Shabbos ends — guard still applies).
 *
 * Computes per-draft-type accuracy for the past week, posts Telegram report,
 * identifies any draft-types that hit the 4-week perfect-streak threshold
 * and offers to upgrade them to auto-send.
 */

import { NextRequest, NextResponse } from "next/server";
import { runWeeklyAudit } from "@/lib/secretary/audit-engine";
import {
  assertCronAuth,
  enforceShabbos,
} from "@/lib/secretary/cron-guard";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  const summary = await runWeeklyAudit();
  return NextResponse.json({ ok: true, summary });
}
