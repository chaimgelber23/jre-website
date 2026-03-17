// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { OutreachInteractionInsert } from "@/types/database";

// POST /api/admin/outreach/interactions — log a manual interaction
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  if (!body.contact_id || !body.type) {
    return NextResponse.json({ error: "contact_id and type are required" }, { status: 400 });
  }

  const insert: OutreachInteractionInsert = {
    contact_id:          body.contact_id,
    team_member_id:      body.team_member_id || null,
    type:                body.type,
    date:                body.date || new Date().toISOString().split("T")[0],
    notes:               body.notes          || null,
    location:            body.location       || null,
    stage_before:        body.stage_before   || null,
    stage_after:         body.stage_after    || null,
    event_id:            body.event_id       || null,
    donation_amount:     body.donation_amount || null,
    parsed_by_ai:        false,
    confirmation_status: "confirmed",
  };

  const { data, error } = await supabase
    .from("outreach_interactions")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update contact's updated_at so it bubbles to top of list
  await supabase
    .from("outreach_contacts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", body.contact_id);

  return NextResponse.json({ interaction: data });
}

// GET /api/admin/outreach/interactions?contact_id=&pending_only=true
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const contactId   = searchParams.get("contact_id")   || null;
  const pendingOnly = searchParams.get("pending_only") === "true";

  let query = supabase
    .from("outreach_interactions")
    .select(`
      *,
      contact:outreach_contacts(id, first_name, last_name, email),
      team_member:outreach_team_members(id, name)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (contactId)   query = query.eq("contact_id", contactId);
  if (pendingOnly) query = query.eq("confirmation_status", "pending");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ interactions: data });
}
