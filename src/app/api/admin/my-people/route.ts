import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureTable(supabase: any) {
  const { error } = await supabase
    .from("personal_contacts")
    .select("id")
    .limit(1);

  if (error?.code === "42P01") {
    // Table doesn't exist - create it via raw insert workaround
    // User needs to run the migration SQL manually in Supabase dashboard
    return false;
  }
  return true;
}

// GET: List all personal contacts
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const howMet = url.searchParams.get("how_met") || "";

  const tableExists = await ensureTable(supabase);
  if (!tableExists) {
    return NextResponse.json(
      {
        error: "Table not created yet",
        sql: "Run the SQL in supabase/migrations/personal_contacts.sql in your Supabase dashboard SQL editor",
      },
      { status: 503 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("personal_contacts")
    .select("*")
    .eq("is_active", true)
    .order("date_met", { ascending: false });

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,notes.ilike.%${search}%,location.ilike.%${search}%,interests.ilike.%${search}%`
    );
  }
  if (howMet) {
    query = query.eq("how_met", howMet);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contacts: data });
}

// POST: Add a new personal contact
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();

  const tableExists = await ensureTable(supabase);
  if (!tableExists) {
    return NextResponse.json(
      {
        error: "Table not created yet",
        sql: "Run the SQL in supabase/migrations/personal_contacts.sql in your Supabase dashboard SQL editor",
      },
      { status: 503 }
    );
  }

  const {
    name,
    phone,
    email,
    how_met,
    location,
    notes,
    follow_up,
    date_met,
    jewish_background,
    spouse_name,
    kids,
    interests,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("personal_contacts")
    .insert({
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      how_met: how_met || "shabbos",
      location: location?.trim() || null,
      notes: notes?.trim() || null,
      follow_up: follow_up?.trim() || null,
      date_met: date_met || new Date().toISOString().split("T")[0],
      jewish_background: jewish_background?.trim() || null,
      spouse_name: spouse_name?.trim() || null,
      kids: kids?.trim() || null,
      interests: interests?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data }, { status: 201 });
}

// PATCH: Update a contact
export async function PATCH(req: NextRequest) {
  const supabase = createServerClient();
  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // Clean up string fields
  const cleanUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    cleanUpdates[key] = typeof value === "string" ? value.trim() || null : value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("personal_contacts")
    .update(cleanUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ contact: data });
}

// DELETE: Soft-delete a contact
export async function DELETE(req: NextRequest) {
  const supabase = createServerClient();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("personal_contacts")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
