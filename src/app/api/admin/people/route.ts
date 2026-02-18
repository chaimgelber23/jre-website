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

    // Aggregate people - dedup by email first, then by normalized name
    // This ensures "John Smith" the registrant and "John Smith" the guest merge into one person
    const peopleMap = new Map<string, PersonRecord>();
    // Secondary index: normalized name → primary key, for matching guests by name
    const nameToKey = new Map<string, string>();

    function addEvent(person: PersonRecord, eventAttendance: EventAttendance, spent: number, isGuest: boolean) {
      const alreadyHasEvent = person.events.some(
        (e) => e.eventId === eventAttendance.eventId && e.role === eventAttendance.role
      );
      if (!alreadyHasEvent) {
        person.events.push(eventAttendance);
        person.totalEvents = new Set(person.events.map((e) => e.eventId)).size;
      }
      person.totalSpent += spent;
      if (!isGuest) person.isGuest = false;
      if (eventAttendance.registrationDate > person.lastSeen) {
        person.lastSeen = eventAttendance.registrationDate;
      }
    }

    function findOrCreatePerson(
      name: string,
      email: string,
      phone: string | null,
      eventAttendance: EventAttendance,
      spent: number,
      isGuest: boolean,
    ) {
      const normalizedName = name.trim().toLowerCase();

      // 1. Try exact email match first
      if (email) {
        const emailKey = email.toLowerCase().trim();
        if (peopleMap.has(emailKey)) {
          const person = peopleMap.get(emailKey)!;
          addEvent(person, eventAttendance, spent, isGuest);
          if (phone && !person.phone) person.phone = phone;
          // Also register name mapping
          if (normalizedName) nameToKey.set(normalizedName, emailKey);
          return;
        }
      }

      // 2. Try name match (catches guests without email matching registrants or other guests)
      if (normalizedName && nameToKey.has(normalizedName)) {
        const existingKey = nameToKey.get(normalizedName)!;
        const person = peopleMap.get(existingKey);
        if (person) {
          addEvent(person, eventAttendance, spent, isGuest);
          // Upgrade email/phone if we now have them
          if (email && !person.email) person.email = email;
          if (phone && !person.phone) person.phone = phone;
          return;
        }
      }

      // 3. New person - create entry
      const key = email ? email.toLowerCase().trim() : `name:${normalizedName}`;
      peopleMap.set(key, {
        name,
        email: email || "",
        phone,
        events: [eventAttendance],
        totalSpent: spent,
        totalEvents: 1,
        lastSeen: eventAttendance.registrationDate,
        isGuest,
      });
      if (normalizedName) nameToKey.set(normalizedName, key);
    }

    for (const reg of registrations) {
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
      findOrCreatePerson(reg.name, reg.email, reg.phone || null, eventRecord, Number(reg.subtotal), false);

      // Add each guest as their own person
      for (const guest of guests) {
        if (!guest.name?.trim()) continue;

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

        findOrCreatePerson(guest.name.trim(), guest.email?.trim() || "", null, guestEventRecord, 0, true);
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
