import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncRegistrationToSheets } from "@/lib/google-sheets/sync";
import type { Event, EventSponsorship, EventRegistration, EventRegistrationInsert } from "@/types/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    // Validate required fields
    const { adults, kids, name, email, phone, sponsorshipId, message } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    const numAdults = Number(adults) || 1;
    const numKids = Number(kids) || 0;

    if (numAdults < 1) {
      return NextResponse.json(
        { success: false, error: "At least 1 adult is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get the event by slug
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .single();

    if (eventError || !eventData) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const event = eventData as Event;

    // Calculate subtotal
    let subtotal = numAdults * event.price_per_adult + numKids * event.kids_price;

    // If sponsorship is selected, get sponsorship price
    let sponsorshipName: string | null = null;
    if (sponsorshipId) {
      const { data: sponsorshipData } = await supabase
        .from("event_sponsorships")
        .select("*")
        .eq("id", sponsorshipId)
        .single();

      if (sponsorshipData) {
        const sponsorship = sponsorshipData as EventSponsorship;
        subtotal = sponsorship.price; // Sponsorship replaces base price
        sponsorshipName = sponsorship.name;
      }
    }

    // For now, we'll simulate payment success
    // TODO: Integrate with Banquest API for actual payment processing
    const paymentStatus = "success";
    const paymentReference = `sim_${Date.now()}`;

    // Insert registration into Supabase
    const insertData: EventRegistrationInsert = {
      event_id: event.id,
      name,
      email,
      phone: phone || null,
      adults: numAdults,
      kids: numKids,
      sponsorship_id: sponsorshipId || null,
      message: message || null,
      subtotal,
      payment_status: paymentStatus,
      payment_reference: paymentReference,
    };

    const { data: registrationData, error: insertError } = await supabase
      .from("event_registrations")
      .insert(insertData as never)
      .select()
      .single();

    if (insertError || !registrationData) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to save registration" },
        { status: 500 }
      );
    }

    const registration = registrationData as EventRegistration;

    // Sync to Google Sheets (async, non-blocking)
    syncRegistrationToSheets(registration, event).catch(console.error);

    return NextResponse.json({
      success: true,
      id: registration.id,
      eventTitle: event.title,
      eventDate: event.date,
      total: subtotal,
      adults: numAdults,
      kids: numKids,
      sponsorship: sponsorshipName,
      paymentStatus: registration.payment_status,
    });
  } catch (error) {
    console.error("Event registration API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
