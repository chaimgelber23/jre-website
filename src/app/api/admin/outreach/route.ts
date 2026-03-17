// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { OutreachContactInsert } from "@/types/database";

// GET /api/admin/outreach?stage=&gender=&assigned_to=&search=&overdue=&page=
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const stage      = searchParams.get("stage")       || null;
  const gender     = searchParams.get("gender")      || null;
  const group      = searchParams.get("group")       || null;
  const assignedTo = searchParams.get("assigned_to") || null;
  const search     = searchParams.get("search")      || null;
  const overdue    = searchParams.get("overdue")      === "true";
  const page       = parseInt(searchParams.get("page") || "1", 10);
  const limit      = parseInt(searchParams.get("limit") || "50", 10);
  const offset     = (page - 1) * limit;

  let query = supabase
    .from("outreach_contacts")
    .select(`
      *,
      assigned_member:outreach_team_members!outreach_contacts_assigned_to_fkey(id, name, email, gender),
      interactions:outreach_interactions(id, type, date, notes)
    `, { count: "exact" })
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (stage)      query = query.eq("stage", stage);
  if (gender)     query = query.eq("gender", gender);
  if (group)      query = query.eq("group_name", group);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (overdue) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    query = query.lt("updated_at", cutoff.toISOString());
  }
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach last interaction summary
  const enriched = (data || []).map((c: any) => {
    const sortedInteractions = (c.interactions || []).sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return {
      ...c,
      last_interaction_date: sortedInteractions[0]?.date || null,
      last_interaction_type: sortedInteractions[0]?.type || null,
      interaction_count: sortedInteractions.length,
    };
  });

  return NextResponse.json({ contacts: enriched, total: count, page, limit });
}

// POST /api/admin/outreach — create a contact manually
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const body = await request.json();

  const insert: OutreachContactInsert = {
    first_name:  body.first_name,
    last_name:   body.last_name   || "",
    email:       body.email       || null,
    phone:       body.phone       || null,
    gender:      body.gender      || "unknown",
    stage:       body.stage       || "new_contact",
    assigned_to: body.assigned_to || null,
    background:  body.background  || null,
    how_met:     body.how_met     || null,
    spouse_name: body.spouse_name || null,
    source:      "manual",
    engagement_score: 0,
  };

  const { data, error } = await supabase
    .from("outreach_contacts")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
