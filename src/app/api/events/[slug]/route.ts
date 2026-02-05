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
