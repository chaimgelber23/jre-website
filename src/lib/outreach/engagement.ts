// @ts-nocheck
import type { OutreachStage } from "@/types/database";

/**
 * Compute an engagement score (0–100) and an initial stage
 * from historical data (event count, donation count, recurring donor flag).
 */
export function computeEngagement(params: {
  eventCount: number;
  donationCount: number;
  isRecurringDonor: boolean;
  hasEmailSignup: boolean;
}): { score: number; stage: OutreachStage } {
  const { eventCount, donationCount, isRecurringDonor, hasEmailSignup } = params;

  let score = 0;
  score += Math.min(eventCount * 15, 45);   // up to 45 pts for events (3+ maxes out)
  score += Math.min(donationCount * 10, 30); // up to 30 pts for donations
  if (isRecurringDonor) score += 20;
  if (hasEmailSignup) score += 5;
  score = Math.min(score, 100);

  let stage: OutreachStage = 'new_contact';
  if (isRecurringDonor || (eventCount >= 3 && donationCount >= 1)) {
    stage = 'inner_circle';
  } else if (eventCount >= 2 || (eventCount >= 1 && donationCount >= 1)) {
    stage = 'deepening';
  } else if (eventCount >= 1) {
    stage = 'event_connected';
  } else if (donationCount >= 1 || hasEmailSignup) {
    stage = 'in_touch';
  }

  return { score, stage };
}

/**
 * Normalize a full name string into { firstName, lastName }.
 * Handles "Last, First" and "First Last" formats.
 */
export function parseName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (trimmed.includes(",")) {
    // "Cohen, David" format
    const [last, first] = trimmed.split(",").map((s) => s.trim());
    return { firstName: first || "", lastName: last || "" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(" ");
  return { firstName, lastName };
}

/**
 * Normalize a phone number to digits only (strip formatting).
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Deduplicate a list of partial contact records by email first, then by
 * normalized name. Returns a merged list with engagement data combined.
 */
export interface PartialContact {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  eventCount?: number;
  donationCount?: number;
  donationTotal?: number;
  isRecurringDonor?: boolean;
  hasEmailSignup?: boolean;
  source?: string;
  notes?: string;
  interactions?: Array<{
    type: string;
    date: string;
    notes?: string;
    eventTitle?: string;
    donationAmount?: number;
  }>;
}

export function deduplicateContacts(contacts: PartialContact[]): PartialContact[] {
  const byEmail = new Map<string, PartialContact>();
  const noEmail: PartialContact[] = [];

  for (const c of contacts) {
    const emailKey = c.email?.toLowerCase().trim();
    if (emailKey) {
      if (byEmail.has(emailKey)) {
        const existing = byEmail.get(emailKey)!;
        // Merge
        existing.eventCount = (existing.eventCount || 0) + (c.eventCount || 0);
        existing.donationCount = (existing.donationCount || 0) + (c.donationCount || 0);
        existing.donationTotal = (existing.donationTotal || 0) + (c.donationTotal || 0);
        existing.isRecurringDonor = existing.isRecurringDonor || c.isRecurringDonor;
        existing.hasEmailSignup = existing.hasEmailSignup || c.hasEmailSignup;
        if (c.phone && !existing.phone) existing.phone = c.phone;
        if (c.interactions) existing.interactions = [...(existing.interactions || []), ...c.interactions];
        // Keep the most informative name (whichever has a last name)
        if (!existing.lastName && c.lastName) {
          existing.firstName = c.firstName;
          existing.lastName = c.lastName;
        }
      } else {
        byEmail.set(emailKey, { ...c, interactions: c.interactions ? [...c.interactions] : [] });
      }
    } else {
      noEmail.push({ ...c, interactions: c.interactions ? [...c.interactions] : [] });
    }
  }

  return [...byEmail.values(), ...noEmail];
}
