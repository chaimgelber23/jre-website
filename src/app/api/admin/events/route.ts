import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Event, EventInsert, EventSponsorshipInsert } from "@/types/database";

type RegistrationStats = {
  adults: number;
  kids: number;
  subtotal: number;
  payment_status: string;
  sponsorship_id: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");

    const supabase = createServerClient();

    // Get all events
    let eventsQuery = supabase
      .from("events")
      .select("*")
      .order("date", { ascending: false });

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      eventsQuery = eventsQuery.gte("date", startDate).lte("date", endDate);
    }

    const { data: eventsData, error: eventsError } = await eventsQuery;

    if (eventsError) {
      console.error("Supabase events query error:", eventsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    const events = (eventsData || []) as Event[];

    // Get registration stats for each event
    const eventsWithStats = await Promise.all(
      events.map(async (event) => {
        const { data: registrationsData } = await supabase
          .from("event_registrations")
          .select("adults, kids, subtotal, payment_status, sponsorship_id")
          .eq("event_id", event.id);

        const registrations = (registrationsData || []) as RegistrationStats[];

        return {
          ...event,
          stats: {
            totalRegistrations: registrations.length,
            totalAttendees: registrations.reduce((sum, r) => sum + r.adults + r.kids, 0),
            totalRevenue: registrations.reduce((sum, r) => sum + Number(r.subtotal), 0),
            sponsorshipsCount: registrations.filter((r) => r.sponsorship_id).length,
          },
        };
      })
    );

    // Get available years
    const { data: allEventsData } = await supabase
      .from("events")
      .select("date");

    const allEventsDates = (allEventsData || []) as { date: string }[];
    const availableYears = [
      ...new Set(allEventsDates.map((e) => new Date(e.date).getFullYear())),
    ].sort((a, b) => b - a);

    // If no years available, add current year
    if (availableYears.length === 0) {
      availableYears.push(new Date().getFullYear());
    }

    return NextResponse.json({
      success: true,
      events: eventsWithStats,
      availableYears,
    });
  } catch (error) {
    console.error("Admin events API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      slug,
      title,
      description,
      date,
      startTime,
      endTime,
      location,
      locationUrl,
      imageUrl,
      pricePerAdult,
      kidsPrice,
      themeColor,
      speaker,
      sponsorships,
    } = body;

    if (!slug || !title || !date) {
      return NextResponse.json(
        { success: false, error: "Slug, title, and date are required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Create event
    const eventInsert: EventInsert = {
      slug,
      title,
      description: description || null,
      date,
      start_time: startTime || null,
      end_time: endTime || null,
      location: location || null,
      location_url: locationUrl || null,
      image_url: imageUrl || null,
      price_per_adult: pricePerAdult || 0,
      kids_price: kidsPrice || 0,
      theme_color: themeColor || null,
      speaker: speaker || null,
    };

    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .insert(eventInsert as never)
      .select()
      .single();

    if (eventError || !eventData) {
      console.error("Supabase event insert error:", eventError);
      return NextResponse.json(
        { success: false, error: "Failed to create event" },
        { status: 500 }
      );
    }

    const event = eventData as Event;

    // Create sponsorships if provided
    if (sponsorships && sponsorships.length > 0) {
      const sponsorshipData: EventSponsorshipInsert[] = sponsorships.map((s: { name: string; price: number; description?: string }) => ({
        event_id: event.id,
        name: s.name,
        price: s.price,
        description: s.description || null,
      }));

      const { error: sponsorshipError } = await supabase
        .from("event_sponsorships")
        .insert(sponsorshipData as never);

      if (sponsorshipError) {
        console.error("Supabase sponsorship insert error:", sponsorshipError);
        // Event was created but sponsorships failed - still return success
      }
    }

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Admin create event API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, slug, ...updates } = body;

    if (!id && !slug) {
      return NextResponse.json(
        { success: false, error: "Event id or slug is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Map camelCase to snake_case for allowed fields
    const fieldMap: Record<string, string> = {
      title: "title",
      description: "description",
      date: "date",
      startTime: "start_time",
      endTime: "end_time",
      location: "location",
      locationUrl: "location_url",
      imageUrl: "image_url",
      pricePerAdult: "price_per_adult",
      kidsPrice: "kids_price",
      themeColor: "theme_color",
      speaker: "speaker",
      isActive: "is_active",
    };

    const dbUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = fieldMap[key];
      if (dbKey) {
        dbUpdates[dbKey] = value;
      }
    }

    if (Object.keys(dbUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    let query = supabase.from("events").update(dbUpdates as never);
    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("slug", slug);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Supabase event update error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, event: data });
  } catch (error) {
    console.error("Admin update event API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
