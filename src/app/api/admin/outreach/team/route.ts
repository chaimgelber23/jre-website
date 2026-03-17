// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/admin/outreach/team — list all team members
export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("outreach_team_members")
    .select("id, name, email, gender, phone, is_active")
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data || [] });
}

// POST /api/admin/outreach/team — create a team member
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  if (!body.name || !body.gender) {
    return NextResponse.json({ error: "name and gender are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("outreach_team_members")
    .insert({
      name: body.name.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      gender: body.gender,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}

// PATCH /api/admin/outreach/team — update a team member
export async function PATCH(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { id, ...updates } = body;
  const allowed = ["name", "email", "phone", "is_active"];
  const fields: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in updates) fields[k] = updates[k];
  }

  const { data, error } = await supabase
    .from("outreach_team_members")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}
