import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Event } from "@/types/database";

export async function GET() {
  try {
    const supabase = createServerClient();

    // Get all active events, ordered by date
    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("date", { ascending: true });

    if (error) {
      console.error("Supabase events fetch error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    const events = (eventsData || []) as Event[];

    // Split into upcoming and past based on today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = events.filter((e) => new Date(e.date) >= today);
    const past = events
      .filter((e) => new Date(e.date) < today)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      upcoming,
      past,
    });
  } catch (error) {
    console.error("Events list API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
