import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getEventImageAspect } from "@/lib/image-meta";
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
    //   |||DATES|||...   → displayDate override (shown instead of formatted event.date)
    //   |||EMAIL|||...   → email-only HTML (stripped from public page, used by confirmation email)
    let desc = event.description || "";
    let displayDate: string | null = null;
    if (desc.includes("|||EMAIL|||")) {
      const idx = desc.indexOf("|||EMAIL|||");
      desc = desc.substring(0, idx).trim();
    }
    if (desc.includes("|||DATES|||")) {
      const idx = desc.indexOf("|||DATES|||");
      displayDate = desc.substring(idx + "|||DATES|||".length).trim();
      desc = desc.substring(0, idx).trim();
    }
    event.description = desc;
    (event as Event & { display_date?: string | null }).display_date = displayDate;

    // Get sponsorship tiers for this event
    const { data: sponsorshipsData } = await supabase
      .from("event_sponsorships")
      .select("*")
      .eq("event_id", event.id)
      .order("price", { ascending: false });

    const sponsorships = (sponsorshipsData || []) as EventSponsorship[];

    const imageAspectRatio = await getEventImageAspect(event.image_url);

    return NextResponse.json({
      success: true,
      event,
      sponsorships,
      imageAspectRatio,
    });
  } catch (error) {
    console.error("Event fetch API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
