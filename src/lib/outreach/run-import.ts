// @ts-nocheck
/**
 * Phase 0: Run the full import pipeline.
 *
 * Called from the admin import API routes. Accepts a list of
 * PartialContacts (already collected from any source), deduplicates them,
 * scores them, and writes them to Supabase as outreach_contacts +
 * outreach_interactions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deduplicateContacts,
  computeEngagement,
  type PartialContact,
} from "@/lib/outreach/engagement";
import type { OutreachContactInsert, OutreachInteractionInsert } from "@/types/database";

export interface ImportResult {
  contactsCreated: number;
  contactsUpdated: number;
  interactionsCreated: number;
  errors: string[];
}

export async function writeContactsToSupabase(
  supabase: SupabaseClient,
  rawContacts: PartialContact[]
): Promise<ImportResult> {
  const result: ImportResult = {
    contactsCreated: 0,
    contactsUpdated: 0,
    interactionsCreated: 0,
    errors: [],
  };

  const deduped = deduplicateContacts(rawContacts);

  for (const c of deduped) {
    if (!c.firstName && !c.email) continue;

    const { score, stage } = computeEngagement({
      eventCount:      c.eventCount     || 0,
      donationCount:   c.donationCount  || 0,
      isRecurringDonor: c.isRecurringDonor || false,
      hasEmailSignup:  c.hasEmailSignup || false,
    });

    try {
      // Check if contact already exists by email
      let contactId: string | null = null;
      if (c.email) {
        const { data: existing } = await supabase
          .from("outreach_contacts")
          .select("id, stage, engagement_score")
          .eq("email", c.email.toLowerCase().trim())
          .maybeSingle();

        if (existing) {
          // Update stage/score if new data is better
          if (score > (existing.engagement_score || 0)) {
            await supabase
              .from("outreach_contacts")
              .update({
                engagement_score: score,
                stage: stage,
                stage_updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id);
            result.contactsUpdated++;
          }
          contactId = existing.id;
        }
      }

      if (!contactId) {
        const insert: OutreachContactInsert = {
          first_name:       c.firstName || "",
          last_name:        c.lastName  || "",
          email:            c.email     || null,
          phone:            c.phone     || null,
          gender:           "unknown",
          stage,
          stage_updated_at: new Date().toISOString(),
          source:           c.source    || "manual",
          engagement_score: score,
          is_active:        true,
        };

        const { data: created, error: insertError } = await supabase
          .from("outreach_contacts")
          .insert(insert)
          .select("id")
          .single();

        if (insertError || !created) {
          result.errors.push(`Failed to insert ${c.firstName} ${c.lastName}: ${insertError?.message}`);
          continue;
        }

        contactId = created.id;
        result.contactsCreated++;
      }

      // Insert interactions
      for (const interaction of c.interactions || []) {
        const iInsert: OutreachInteractionInsert = {
          contact_id:          contactId,
          type:                interaction.type as any,
          date:                interaction.date,
          notes:               interaction.notes || null,
          donation_amount:     interaction.donationAmount || null,
          parsed_by_ai:        false,
          confirmation_status: "confirmed",
        };

        const { error: iError } = await supabase
          .from("outreach_interactions")
          .insert(iInsert);

        if (iError) {
          result.errors.push(`Interaction insert failed for contact ${contactId}: ${iError.message}`);
        } else {
          result.interactionsCreated++;
        }
      }
    } catch (e: any) {
      result.errors.push(`Unexpected error for ${c.firstName} ${c.lastName}: ${e?.message}`);
    }
  }

  return result;
}
