// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sheets, SPREADSHEET_ID } from "@/lib/google-sheets/client";
import {
  appendEventRegistration,
  slugToSheetName,
  type EventSheetConfig,
  type EventRegistrationRow,
} from "@/lib/google-sheets/event-sheets";

/**
 * POST /api/admin/events/reset-sheet
 * Body: { slug: string }
 *
 * Clears the Google Sheet tab for an event and re-fills it from Supabase registrations.
 */
export async function POST(request: NextRequest) {
  try {
    const { slug } = await request.json();
    if (!slug) {
      return NextResponse.json({ success: false, error: "slug is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get the event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ success: false, error: "Event not found" }, { status: 404 });
    }

    // Get all registrations for this event
    const { data: registrations, error: regError } = await supabase
      .from("event_registrations")
      .select("*, event_sponsorships(name, price, fair_market_value)")
      .eq("event_id", event.id)
      .order("created_at", { ascending: true });

    if (regError) {
      return NextResponse.json({ success: false, error: regError.message }, { status: 500 });
    }

    // Check sponsorship tiers exist
    const { count: sponsorshipCount } = await supabase
      .from("event_sponsorships")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id);

    const sheetConfig: EventSheetConfig = {
      hasKids: event.kids_price > 0,
      hasSponsorships: (sponsorshipCount ?? 0) > 0,
    };

    const sheetName = slugToSheetName(slug);

    // Step 1: Delete the existing sheet tab
    if (SPREADSHEET_ID) {
      try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const existingSheet = spreadsheet.data.sheets?.find(
          (s) => s.properties?.title === sheetName
        );

        if (existingSheet?.properties?.sheetId !== undefined) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
              requests: [{ deleteSheet: { sheetId: existingSheet.properties.sheetId } }],
            },
          });
          console.log(`Deleted sheet tab: ${sheetName}`);
        }
      } catch (err) {
        console.error("Error deleting sheet:", err);
      }
    }

    // Step 2: Re-add each registration (ensureSheetExists will recreate the tab + headers)
    let synced = 0;
    const errors: string[] = [];

    for (const reg of registrations || []) {
      // Parse guests from message field
      let guestList: Array<{ name: string; email?: string }> = [];
      let messageText = reg.message || "";
      try {
        if (reg.message && reg.message.startsWith("{")) {
          const parsed = JSON.parse(reg.message);
          messageText = parsed.text || "";
          guestList = parsed.guests || [];
        }
      } catch { /* not JSON, keep as text */ }

      // Build attendees string
      let allAttendees: string;
      if (guestList.length > 0) {
        allAttendees = [
          reg.name,
          ...guestList.map((g: { name: string; email?: string }) =>
            `${g.name}${g.email ? ` (${g.email})` : ""}`
          ),
        ].join("; ");
      } else {
        const parts = [reg.name];
        if (reg.adults > 1) parts.push(`+${reg.adults - 1} adult${reg.adults - 1 > 1 ? "s" : ""}`);
        if (reg.kids > 0) parts.push(`+${reg.kids} kid${reg.kids > 1 ? "s" : ""}`);
        allAttendees = parts.join(" ");
      }

      const sponsorship = reg.event_sponsorships;
      const sponsorshipName = sponsorship?.name || "";
      const sponsorshipAmount = sponsorship?.price || 0;
      const fmv = sponsorship?.fair_market_value || 0;
      const taxDeductible = sponsorshipName ? Math.max(0, sponsorshipAmount - fmv) : 0;

      const rowData: EventRegistrationRow = {
        id: reg.id,
        timestamp: new Date(reg.created_at).toLocaleString(),
        name: reg.name,
        email: reg.email,
        phone: reg.phone || "",
        adults: reg.adults,
        kids: reg.kids || 0,
        allAttendees,
        sponsorshipName,
        sponsorshipAmount,
        fairMarketValue: fmv,
        taxDeductible,
        total: reg.subtotal,
        paymentMethod: reg.payment_reference?.startsWith("promo_") ? "promo" : "online",
        paymentStatus: reg.payment_status,
        paymentReference: reg.payment_reference || "",
        notes: messageText,
      };

      const result = await appendEventRegistration(sheetName, rowData, sheetConfig);
      if (result.success) {
        synced++;
      } else {
        errors.push(`${reg.name}: ${result.error}`);
      }
    }

    return NextResponse.json({
      success: true,
      sheetName,
      totalRegistrations: registrations?.length || 0,
      synced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Reset sheet error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
