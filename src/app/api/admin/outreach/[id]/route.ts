// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/admin/outreach/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data: contact, error } = await supabase
    .from("outreach_contacts")
    .select(`
      *,
      assigned_member:outreach_team_members!outreach_contacts_assigned_to_fkey(id, name, email, gender),
      interactions:outreach_interactions(*)
    `)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Sort interactions newest first
  const c = contact as any;
  if (c?.interactions) {
    c.interactions.sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  return NextResponse.json({ contact: c });
}

// PATCH /api/admin/outreach/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const body = await request.json();

  const updateFields: Record<string, any> = {};
  const allowed = [
    "first_name", "last_name", "email", "phone", "gender",
    "stage", "assigned_to", "background", "how_met", "spouse_name",
    "next_followup_date", "is_active",
  ];
  for (const key of allowed) {
    if (key in body) updateFields[key] = body[key];
  }

  // If stage changed, update stage_updated_at
  if ("stage" in body) {
    updateFields.stage_updated_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("outreach_contacts")
    .update(updateFields)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

// DELETE /api/admin/outreach/[id] — soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("outreach_contacts")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
