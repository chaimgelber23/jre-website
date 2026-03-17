// @ts-nocheck
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/admin/outreach/groups — list unique group names
export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("outreach_contacts")
    .select("group_name")
    .not("group_name", "is", null)
    .order("group_name");

  if (error) return NextResponse.json({ groups: [] });

  const unique = [...new Set((data || []).map((r: any) => r.group_name).filter(Boolean))];
  return NextResponse.json({ groups: unique });
}
