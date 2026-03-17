// @ts-nocheck
/**
 * Phase 0: Import from existing Supabase event_registrations + email_signups
 *
 * Converts existing registration history into outreach contacts and interactions.
 * Also handles guest extraction from the JSON message field.
 */

import type { PartialContact } from "@/lib/outreach/engagement";
import { parseName } from "@/lib/outreach/engagement";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function importFromEventRegistrations(
  supabase: SupabaseClient
): Promise<PartialContact[]> {
  // Fetch all successful registrations with event info
  const { data: registrations, error } = await supabase
    .from("event_registrations")
    .select(`
      id,
      name,
      email,
      phone,
      message,
      created_at,
      events ( id, title, date, slug )
    `)
    .eq("payment_status", "success")
    .order("created_at", { ascending: true });

  if (error || !registrations) return [];

  const contacts: PartialContact[] = [];

  for (const reg of registrations) {
    const event = (reg as any).events;
    const eventTitle = event?.title || "JRE Event";
    const eventDate  = event?.date  || reg.created_at.split("T")[0];
    const eventId    = event?.id;

    const { firstName, lastName } = parseName(reg.name || "");

    contacts.push({
      firstName,
      lastName,
      email:    reg.email || undefined,
      phone:    reg.phone || undefined,
      source:   "event_import",
      eventCount: 1,
      interactions: [
        {
          type:       "event",
          date:       eventDate,
          eventTitle,
          notes:      `Registered for ${eventTitle}`,
        },
      ],
    });

    // Extract guests from the message JSON field
    if (reg.message) {
      try {
        const parsed = JSON.parse(reg.message);
        if (Array.isArray(parsed.guests)) {
          for (const guest of parsed.guests) {
            const guestName = guest.name || "";
            if (!guestName) continue;
            const { firstName: gFirst, lastName: gLast } = parseName(guestName);
            contacts.push({
              firstName: gFirst,
              lastName:  gLast,
              email:     guest.email || undefined,
              source:    "event_import",
              eventCount: 1,
              interactions: [
                {
                  type:       "event",
                  date:       eventDate,
                  eventTitle,
                  notes:      `Guest of ${reg.name} at ${eventTitle}`,
                },
              ],
            });
          }
        }
      } catch {
        // message is plain text, not JSON — skip guest extraction
      }
    }
  }

  return contacts;
}

export async function importFromEmailSignups(
  supabase: SupabaseClient
): Promise<PartialContact[]> {
  const { data: signups, error } = await supabase
    .from("email_signups")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !signups) return [];

  return signups.map((s) => {
    const { firstName, lastName } = parseName(s.name || "");
    return {
      firstName,
      lastName,
      email:          s.email || undefined,
      phone:          s.phone || undefined,
      source:         "email_signup_import",
      hasEmailSignup: true,
      eventCount:     0,
      donationCount:  0,
      interactions:   [
        {
          type:  "email",
          date:  s.created_at.split("T")[0],
          notes: `Submitted contact form — Subject: ${s.subject || "General"}, Message: ${(s.message || "").slice(0, 100)}`,
        },
      ],
    } as PartialContact;
  });
}

export async function importFromDonations(
  supabase: SupabaseClient
): Promise<PartialContact[]> {
  const { data: donations, error } = await supabase
    .from("donations")
    .select("*")
    .eq("payment_status", "success")
    .order("created_at", { ascending: true });

  if (error || !donations) return [];

  return donations.map((d) => {
    const { firstName, lastName } = parseName(d.name || "");
    return {
      firstName,
      lastName,
      email:           d.email || undefined,
      phone:           d.phone || undefined,
      source:          "event_import",
      donationCount:   1,
      donationTotal:   d.amount,
      isRecurringDonor: d.is_recurring && d.recurring_status === "active",
      interactions: [
        {
          type:           "donation",
          date:           d.created_at.split("T")[0],
          donationAmount: d.amount,
          notes:          `Website donation — $${d.amount.toFixed ? d.amount.toFixed(2) : d.amount}${d.is_recurring ? " (recurring)" : ""}`,
        },
      ],
    } as PartialContact;
  });
}
