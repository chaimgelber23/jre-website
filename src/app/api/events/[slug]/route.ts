import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Event, EventSponsorship } from "@/types/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = createServerClient();

    // Get event by slug
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (eventError || !eventData) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const event = eventData as Event;

    // Parse description markers:
    //   |||DATES|||...    → displayDate override (shown instead of formatted event.date)
    //   |||EMAIL|||...    → email-only HTML (stripped from public page, used by confirmation email)
    //   |||DONATION|||N   → suggested-donation amount in dollars (drives the opt-in donation toggle on free events)
    let desc = event.description || "";
    let displayDate: string | null = null;
    let suggestedDonation: number | null = null;
    if (desc.includes("|||EMAIL|||")) {
      const idx = desc.indexOf("|||EMAIL|||");
      desc = desc.substring(0, idx).trim();
    }
    if (desc.includes("|||DATES|||")) {
      const idx = desc.indexOf("|||DATES|||");
      displayDate = desc.substring(idx + "|||DATES|||".length).trim();
      desc = desc.substring(0, idx).trim();
    }
    // |||ADMIN_LABEL|||...   → admin-only display title (admin portal only). Public side just strips it.
    // Process this BEFORE DONATION so the regex's [^\n|]+ stops at the next |||...||| boundary
    // instead of swallowing prose after sibling markers get stripped.
    {
      const re = /\|\|\|ADMIN_LABEL\|\|\|([^\n|]+)/;
      const m = desc.match(re);
      if (m) desc = desc.replace(re, "").trim();
    }
    {
      const re = /\|\|\|DONATION\|\|\|(\d+)/;
      const m = desc.match(re);
      if (m) {
        suggestedDonation = parseInt(m[1], 10);
        desc = desc.replace(re, "").trim();
      }
    }
    event.description = desc;
    (event as Event & { display_date?: string | null; suggested_donation?: number | null }).display_date = displayDate;
    (event as Event & { display_date?: string | null; suggested_donation?: number | null }).suggested_donation = suggestedDonation;

    // Get sponsorship tiers for this event
    const { data: sponsorshipsData } = await supabase
      .from("event_sponsorships")
      .select("*")
      .eq("event_id", event.id)
      .order("price", { ascending: false });

    const sponsorships = (sponsorshipsData || []) as EventSponsorship[];

    return NextResponse.json({
      success: true,
      event,
      sponsorships,
    });
  } catch (error) {
    console.error("Event fetch API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
