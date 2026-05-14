/**
 * GET /api/cron/morning-sponsor-list
 *
 * Fires daily at 6am ET via cron-job.org. For each event whose `date` is
 * today (ET), if at least one registration has a sponsorship_id and
 * payment_status=success, email Chaim a clean sponsor list grouped by tier
 * (lowest → highest). No totals, no dollar amounts (per Chaim's preference).
 *
 * Recipient: chaimtgelber@gmail.com
 * Sender:    noreply@beta.thejre.org (verified Resend domain)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertCronAuth } from "@/lib/secretary/cron-guard";
import { sendSponsorListEmail } from "@/lib/email/sponsor-list";

export const maxDuration = 60;

const RECIPIENT = "chaimtgelber@gmail.com";

function todayInET(): string {
  // YYYY-MM-DD in America/New_York
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const overrideDate = url.searchParams.get("date"); // YYYY-MM-DD for manual probes
  const eventDate = overrideDate ?? todayInET();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: events, error: eventsErr } = await supabase
    .from("events")
    .select("id, slug, title, date, speaker, is_active")
    .eq("date", eventDate)
    .eq("is_active", true);

  if (eventsErr) {
    return NextResponse.json({ ok: false, error: eventsErr.message }, { status: 500 });
  }
  if (!events || events.length === 0) {
    return NextResponse.json({ ok: true, eventDate, eventsToday: 0, sent: [] });
  }

  const sent: Array<{ slug: string; emailId?: string; sponsorCount: number }> = [];
  const skipped: Array<{ slug: string; reason: string }> = [];

  for (const ev of events) {
    const [{ data: tiers }, { data: regs }] = await Promise.all([
      supabase
        .from("event_sponsorships")
        .select("id, name, price")
        .eq("event_id", ev.id)
        .order("price"),
      supabase
        .from("event_registrations")
        .select("name, sponsorship_id, created_at")
        .eq("event_id", ev.id)
        .eq("payment_status", "success")
        .not("sponsorship_id", "is", null)
        .order("created_at"),
    ]);

    if (!tiers || tiers.length === 0 || !regs || regs.length === 0) {
      skipped.push({ slug: ev.slug, reason: "no paid sponsors" });
      continue;
    }

    const byTier = new Map<string, string[]>();
    for (const t of tiers) byTier.set(t.id, []);
    for (const r of regs) {
      const arr = byTier.get(r.sponsorship_id as string);
      if (arr) arr.push((r.name || "").trim().replace(/\s+/g, " "));
    }

    const sponsorsByTier = tiers.map((t) => ({
      tier: t.name,
      names: byTier.get(t.id) ?? [],
    }));

    const subtitle = ev.speaker ? `with ${ev.speaker}` : null;

    const res = await sendSponsorListEmail({
      to: RECIPIENT,
      eventTitle: ev.title,
      subtitle,
      sponsorsByTier,
    });

    if (res.ok) {
      sent.push({ slug: ev.slug, emailId: res.id, sponsorCount: regs.length });
    } else {
      skipped.push({ slug: ev.slug, reason: res.error ?? "send failed" });
    }
  }

  return NextResponse.json({ ok: true, eventDate, eventsToday: events.length, sent, skipped });
}
