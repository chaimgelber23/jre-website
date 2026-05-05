import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  appendEventRegistration,
  slugToSheetName,
  type EventSheetConfig,
  type EventRegistrationRow,
} from "@/lib/google-sheets/event-sheets";
import type { Event, EventSponsorship, EventRegistration } from "@/types/database";
import { Resend } from "resend";

// Belt-and-suspenders for the per-event Google Sheets sync. Picks up
// event_registrations rows where synced_to_sheet=false and replays the append.
// On persistent failures (>= MAX_AGE_MIN old, >= MAX_ATTEMPTS tries), emails
// Gitty + Chaim so a human can intervene before the day of the event.
//
// Schedule: cron-job.org, every 10 min (matches the recurring-donations cadence
// we already pay $0 for).

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_ATTEMPTS = 5;
const MAX_AGE_MIN = 30;
const ALERT_EMAILS = ["glevi@thejre.org", "cgelber@thejre.org"];

type RegistrationRow = EventRegistration & {
  synced_to_sheet?: boolean;
  sheet_sync_attempts?: number;
  sheet_sync_error?: string | null;
};

function buildAttendees(reg: EventRegistration, guestList: { name: string; email?: string }[]): string {
  if (guestList.length > 0) {
    return [
      reg.name,
      ...guestList.map((g) => `${g.name}${g.email ? ` (${g.email})` : ""}`),
    ].join("; ");
  }
  const parts = [reg.name];
  if (reg.adults > 1) parts.push(`+${reg.adults - 1} adult${reg.adults - 1 > 1 ? "s" : ""}`);
  if (reg.kids > 0) parts.push(`+${reg.kids} kid${reg.kids > 1 ? "s" : ""}`);
  return parts.join(" ");
}

function parseMessage(raw: string | null): { text: string; guests: { name: string; email?: string }[] } {
  if (!raw) return { text: "", guests: [] };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "guests" in parsed) {
      return { text: parsed.text || "", guests: parsed.guests || [] };
    }
  } catch {}
  return { text: raw, guests: [] };
}

async function sendStuckAlert(stuck: Array<{ id: string; name: string; email: string; eventTitle: string; ageMin: number; attempts: number; error: string | null }>) {
  if (!process.env.RESEND_API_KEY || stuck.length === 0) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const list = stuck
    .map(
      (s) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.name} (${s.email})</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.eventTitle}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.ageMin} min</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.attempts}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px;">${s.error || ""}</td></tr>`
    )
    .join("");

  await resend.emails.send({
    from: "The JRE <noreply@beta.thejre.org>",
    to: ALERT_EMAILS,
    subject: `[JRE ALERT] ${stuck.length} event registration${stuck.length > 1 ? "s" : ""} not syncing to Google Sheets`,
    html: `
      <p>The following registrations are saved in Supabase but the Google Sheets append has failed repeatedly. The drain cron will keep retrying, but please check the Sheets API status / quota / service account access.</p>
      <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;">
        <thead><tr style="background:#f97316;color:#fff;"><th style="padding:8px;text-align:left;">Donor</th><th style="padding:8px;text-align:left;">Event</th><th style="padding:8px;text-align:left;">Age</th><th style="padding:8px;text-align:left;">Attempts</th><th style="padding:8px;text-align:left;">Last error</th></tr></thead>
        <tbody>${list}</tbody>
      </table>
      <p style="margin-top:16px;color:#666;">Triggered by /api/cron/sync-event-sheets-drain.</p>
    `,
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();

  const { data: unsynced, error } = await supabase
    .from("event_registrations")
    .select("*")
    .eq("synced_to_sheet", false)
    .lt("sheet_sync_attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("drain: failed to query event_registrations", error);
    return NextResponse.json({ error: "Query failed", details: error.message }, { status: 500 });
  }

  const rows = (unsynced as RegistrationRow[]) || [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, drained: 0 });
  }

  const eventIds = Array.from(new Set(rows.map((r) => r.event_id)));
  const { data: events } = await supabase.from("events").select("*").in("id", eventIds);
  const eventsById = new Map<string, Event>(((events as Event[]) || []).map((e) => [e.id, e]));

  const { data: sponsorships } = await supabase
    .from("event_sponsorships")
    .select("*")
    .in("event_id", eventIds);
  const sponsorshipsByEvent = new Map<string, EventSponsorship[]>();
  for (const s of (sponsorships as EventSponsorship[]) || []) {
    const arr = sponsorshipsByEvent.get(s.event_id) || [];
    arr.push(s);
    sponsorshipsByEvent.set(s.event_id, arr);
  }

  const stuck: Array<{ id: string; name: string; email: string; eventTitle: string; ageMin: number; attempts: number; error: string | null }> = [];
  let synced = 0;
  let stillFailing = 0;

  for (const reg of rows) {
    const ev = eventsById.get(reg.event_id);
    if (!ev) {
      console.error(`drain: event ${reg.event_id} not found for registration ${reg.id}`);
      continue;
    }
    const eventSponsors = sponsorshipsByEvent.get(reg.event_id) || [];
    const sponsorship = reg.sponsorship_id ? eventSponsors.find((s) => s.id === reg.sponsorship_id) : null;
    const sponsorshipPrice = sponsorship?.price ?? 0;
    const sponsorshipFMV = sponsorship?.fair_market_value ?? 0;
    const taxDeductible = sponsorship ? Math.max(0, sponsorshipPrice - sponsorshipFMV) : 0;

    const { text: messageText, guests } = parseMessage(reg.message);
    const allAttendees = buildAttendees(reg, guests);
    const paymentMethod = reg.payment_reference?.startsWith("promo_")
      ? "promo"
      : reg.payment_reference?.startsWith("check_")
      ? "check"
      : "online";

    const sheetConfig: EventSheetConfig = {
      hasKids: ev.kids_price > 0,
      hasSponsorships: eventSponsors.length > 0,
    };

    const rowData: EventRegistrationRow = {
      id: reg.id,
      timestamp: new Date(reg.created_at).toLocaleString(),
      name: reg.name,
      email: reg.email,
      phone: reg.phone || "",
      adults: reg.adults,
      kids: reg.kids,
      allAttendees,
      sponsorshipName: sponsorship?.name || "",
      sponsorshipAmount: sponsorshipPrice,
      fairMarketValue: sponsorshipFMV,
      taxDeductible,
      total: reg.subtotal,
      paymentMethod,
      paymentStatus: reg.payment_status,
      paymentReference: reg.payment_reference || "",
      notes: messageText,
    };

    const sheetName = slugToSheetName(ev.slug);
    const eventTabId = (ev as Record<string, unknown>).sheet_tab_id as number | null | undefined;
    const result = await appendEventRegistration(sheetName, rowData, sheetConfig, eventTabId ?? null);
    const newAttempts = (reg.sheet_sync_attempts ?? 0) + 1;

    if (result.success) {
      await supabase
        .from("event_registrations")
        .update({
          synced_to_sheet: true,
          sheet_sync_attempts: newAttempts,
          sheet_sync_error: null,
        } as never)
        .eq("id", reg.id);
      if (result.tabId != null && eventTabId !== result.tabId) {
        try {
          await supabase
            .from("events")
            .update({ sheet_tab_id: result.tabId } as never)
            .eq("id", ev.id);
        } catch (e) {
          console.error("drain: failed to persist sheet_tab_id on event", e);
        }
      }
      synced++;
    } else {
      await supabase
        .from("event_registrations")
        .update({
          sheet_sync_attempts: newAttempts,
          sheet_sync_error: result.error || "unknown",
        } as never)
        .eq("id", reg.id);
      stillFailing++;

      const ageMin = Math.round((Date.now() - new Date(reg.created_at).getTime()) / 60000);
      if (ageMin >= MAX_AGE_MIN) {
        stuck.push({
          id: reg.id,
          name: reg.name,
          email: reg.email,
          eventTitle: ev.title,
          ageMin,
          attempts: newAttempts,
          error: result.error || null,
        });
      }
    }
  }

  if (stuck.length > 0) {
    try {
      await sendStuckAlert(stuck);
    } catch (e) {
      console.error("drain: alert email failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    inspected: rows.length,
    synced,
    stillFailing,
    alerted: stuck.length,
  });
}
