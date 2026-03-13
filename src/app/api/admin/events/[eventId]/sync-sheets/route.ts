import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  appendEventRegistration,
  slugToSheetName,
  type EventSheetConfig,
  type EventRegistrationRow,
} from "@/lib/google-sheets/event-sheets";
import type { Event, EventSponsorship, EventRegistration } from "@/types/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const supabase = createServerClient();

    // Get event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const ev = event as Event;

    // Get all registrations for this event
    const { data: registrations, error: regError } = await supabase
      .from("event_registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (regError) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch registrations" },
        { status: 500 }
      );
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: "No registrations to sync",
      });
    }

    // Get sponsorship tiers for this event
    const { data: sponsorships } = await supabase
      .from("event_sponsorships")
      .select("*")
      .eq("event_id", eventId);

    const sponsorshipMap = new Map(
      (sponsorships as EventSponsorship[] || []).map((s) => [s.id, s])
    );

    const sheetConfig: EventSheetConfig = {
      hasKids: ev.kids_price > 0,
      hasSponsorships: (sponsorships?.length ?? 0) > 0,
    };

    const sheetName = slugToSheetName(ev.slug);
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const reg of registrations as EventRegistration[]) {
      const sponsorship = reg.sponsorship_id
        ? sponsorshipMap.get(reg.sponsorship_id)
        : null;

      const sponsorshipPrice = sponsorship?.price ?? 0;
      const sponsorshipFMV = sponsorship?.fair_market_value ?? 0;
      const taxDeductible = sponsorship
        ? Math.max(0, sponsorshipPrice - sponsorshipFMV)
        : 0;

      // Parse message field for guest data
      let guestList: { name: string; email?: string }[] = [];
      let messageText = reg.message || "";
      try {
        const parsed = JSON.parse(reg.message || "");
        if (parsed && typeof parsed === "object" && "guests" in parsed) {
          messageText = parsed.text || "";
          guestList = parsed.guests || [];
        }
      } catch {
        // plain text
      }

      // Build attendees string
      let allAttendees: string;
      if (guestList.length > 0) {
        allAttendees = [
          reg.name,
          ...guestList.map(
            (g: { name: string; email?: string }) =>
              `${g.name}${g.email ? ` (${g.email})` : ""}`
          ),
        ].join("; ");
      } else {
        const parts = [reg.name];
        if (reg.adults > 1)
          parts.push(`+${reg.adults - 1} adult${reg.adults - 1 > 1 ? "s" : ""}`);
        if (reg.kids > 0)
          parts.push(`+${reg.kids} kid${reg.kids > 1 ? "s" : ""}`);
        allAttendees = parts.join(" ");
      }

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
        paymentMethod: reg.payment_reference?.startsWith("promo_")
          ? "promo"
          : reg.payment_reference?.startsWith("check_")
          ? "check"
          : "online",
        paymentStatus: reg.payment_status,
        paymentReference: reg.payment_reference || "",
        notes: messageText,
      };

      try {
        const result = await appendEventRegistration(sheetName, rowData, sheetConfig);
        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`${reg.name}: ${result.error}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${reg.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({
      success: true,
      sheetName,
      synced,
      failed,
      total: registrations.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Sync to sheets error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
