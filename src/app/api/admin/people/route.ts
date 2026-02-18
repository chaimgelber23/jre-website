import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Event, EventRegistration, EventSponsorship } from "@/types/database";

interface EventAttendance {
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
  role: "registrant" | "guest"; // whether they registered or were brought as a guest
  registeredBy?: string; // name of person who brought them (for guests)
}

interface PersonRecord {
  name: string;
  email: string; // empty string for guests without email
  phone: string | null;
  events: EventAttendance[];
  totalSpent: number;
  totalEvents: number;
  lastSeen: string;
  isGuest: boolean; // true if this person has only appeared as a guest (never registered themselves)
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

    // Aggregate people by key (email for those with email, "name:Name" for guests without)
    const peopleMap = new Map<string, PersonRecord>();

    function addPersonToMap(
      key: string,
      name: string,
      email: string,
      phone: string | null,
      eventAttendance: EventAttendance,
      spent: number,
      isGuest: boolean,
    ) {
      if (peopleMap.has(key)) {
        const person = peopleMap.get(key)!;
        // Don't add duplicate event entries for the same event
        const alreadyHasEvent = person.events.some(
          (e) => e.eventId === eventAttendance.eventId
        );
        if (!alreadyHasEvent) {
          person.events.push(eventAttendance);
          person.totalEvents += 1;
        }
        person.totalSpent += spent;
        // Upgrade from guest to registrant if they registered themselves
        if (!isGuest) person.isGuest = false;
        if (name) person.name = name;
        if (phone) person.phone = phone;
        if (eventAttendance.registrationDate > person.lastSeen) {
          person.lastSeen = eventAttendance.registrationDate;
        }
      } else {
        peopleMap.set(key, {
          name,
          email,
          phone,
          events: [eventAttendance],
          totalSpent: spent,
          totalEvents: 1,
          lastSeen: eventAttendance.registrationDate,
          isGuest,
        });
      }
    }

    for (const reg of registrations) {
      const email = reg.email.toLowerCase().trim();
      const event = eventMap.get(reg.event_id);
      const sponsorship = reg.sponsorship_id ? sponsorshipMap.get(reg.sponsorship_id) : null;
      const guests = parseGuests(reg.message);

      const eventRecord: EventAttendance = {
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
        role: "registrant",
      };

      // Add the registrant
      addPersonToMap(email, reg.name, reg.email, reg.phone || null, eventRecord, Number(reg.subtotal), false);

      // Add each guest as their own person
      for (const guest of guests) {
        if (!guest.name?.trim()) continue;
        const guestEmail = guest.email?.toLowerCase().trim() || "";
        // Key: use email if available, otherwise use normalized name
        const guestKey = guestEmail || `name:${guest.name.trim().toLowerCase()}`;

        const guestEventRecord: EventAttendance = {
          eventId: reg.event_id,
          eventTitle: event?.title || "Unknown Event",
          eventDate: event?.date || "",
          registrationDate: reg.created_at,
          adults: 0,
          kids: 0,
          subtotal: 0,
          paymentStatus: reg.payment_status,
          sponsorshipName: null,
          guests: [],
          role: "guest",
          registeredBy: reg.name,
        };

        addPersonToMap(guestKey, guest.name.trim(), guestEmail, null, guestEventRecord, 0, true);
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
