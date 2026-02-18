import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Event, EventRegistration, EventSponsorship } from "@/types/database";

interface PersonRecord {
  name: string;
  email: string;
  phone: string | null;
  events: {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    registrationDate: string;
    adults: number;
    kids: number;
    subtotal: number;
    paymentStatus: string;
    sponsorshipName: string | null;
    guests: { name: string; email?: string }[];
  }[];
  totalSpent: number;
  totalEvents: number;
  lastSeen: string;
}

// Parse guest data from message field
function parseGuests(message: string | null): { name: string; email?: string }[] {
  if (!message) return [];
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed === "object" && "guests" in parsed) {
      return parsed.guests || [];
    }
  } catch {
    // Not JSON
  }
  return [];
}

export async function GET() {
  try {
    const supabase = createServerClient();

    // Get all events
    const { data: eventsData } = await supabase
      .from("events")
      .select("id, title, date, slug")
      .order("date", { ascending: false });

    const events = (eventsData || []) as Event[];

    // Get all registrations with event info
    const { data: registrationsData } = await supabase
      .from("event_registrations")
      .select("*")
      .order("created_at", { ascending: false });

    const registrations = (registrationsData || []) as EventRegistration[];

    // Get all sponsorships for name lookup
    const { data: sponsorshipsData } = await supabase
      .from("event_sponsorships")
      .select("id, name, event_id");

    const sponsorships = (sponsorshipsData || []) as EventSponsorship[];

    // Build a map of event IDs to event info
    const eventMap = new Map(events.map((e) => [e.id, e]));
    const sponsorshipMap = new Map(sponsorships.map((s) => [s.id, s]));

    // Aggregate people by email (primary key for dedup)
    const peopleMap = new Map<string, PersonRecord>();

    for (const reg of registrations) {
      const email = reg.email.toLowerCase().trim();
      const event = eventMap.get(reg.event_id);
      const sponsorship = reg.sponsorship_id ? sponsorshipMap.get(reg.sponsorship_id) : null;
      const guests = parseGuests(reg.message);

      const eventRecord = {
        eventId: reg.event_id,
        eventTitle: event?.title || "Unknown Event",
        eventDate: event?.date || "",
        registrationDate: reg.created_at,
        adults: reg.adults,
        kids: reg.kids,
        subtotal: Number(reg.subtotal),
        paymentStatus: reg.payment_status,
        sponsorshipName: sponsorship?.name || null,
        guests,
      };

      if (peopleMap.has(email)) {
        const person = peopleMap.get(email)!;
        person.events.push(eventRecord);
        person.totalSpent += Number(reg.subtotal);
        person.totalEvents += 1;
        // Update name/phone if newer
        if (reg.name) person.name = reg.name;
        if (reg.phone) person.phone = reg.phone;
        if (reg.created_at > person.lastSeen) person.lastSeen = reg.created_at;
      } else {
        peopleMap.set(email, {
          name: reg.name,
          email: reg.email,
          phone: reg.phone || null,
          events: [eventRecord],
          totalSpent: Number(reg.subtotal),
          totalEvents: 1,
          lastSeen: reg.created_at,
        });
      }
    }

    // Convert to array and sort by most events, then by name
    const people = Array.from(peopleMap.values()).sort((a, b) => {
      if (b.totalEvents !== a.totalEvents) return b.totalEvents - a.totalEvents;
      return a.name.localeCompare(b.name);
    });

    // All events list (for the "attended/didn't attend" matrix)
    const allEvents = events.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      slug: e.slug,
    }));

    return NextResponse.json({
      success: true,
      people,
      allEvents,
      stats: {
        totalPeople: people.length,
        totalRegistrations: registrations.length,
        totalEvents: events.length,
      },
    });
  } catch (error) {
    console.error("Admin people API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
