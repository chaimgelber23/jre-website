// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  importFromEventRegistrations,
  importFromEmailSignups,
  importFromDonations,
} from "@/lib/outreach/import-registrations";
import { writeContactsToSupabase } from "@/lib/outreach/run-import";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    const [regContacts, signupContacts, donationContacts] = await Promise.all([
      importFromEventRegistrations(supabase),
      importFromEmailSignups(supabase),
      importFromDonations(supabase),
    ]);

    const all = [...regContacts, ...signupContacts, ...donationContacts];
    const importResult = await writeContactsToSupabase(supabase, all);

    return NextResponse.json({
      success: true,
      sources: {
        eventRegistrations: regContacts.length,
        emailSignups:       signupContacts.length,
        donations:          donationContacts.length,
        total:              all.length,
      },
      importResult,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
