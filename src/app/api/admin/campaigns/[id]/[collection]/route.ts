import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const ALLOWED = new Set(["tiers", "causes", "matchers", "teams", "updates"]);
const TABLE_MAP: Record<string, string> = {
  tiers: "campaign_tiers",
  causes: "campaign_causes",
  matchers: "campaign_matchers",
  teams: "campaign_teams",
  updates: "campaign_updates",
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; collection: string }> }
) {
  const { id, collection } = await ctx.params;
  if (!ALLOWED.has(collection)) {
    return NextResponse.json({ success: false, error: "Unknown collection" }, { status: 400 });
  }
  const body = await req.json();
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from(TABLE_MAP[collection])
    .insert({ ...body, campaign_id: id })
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, row: data });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; collection: string }> }
) {
  const { id, collection } = await ctx.params;
  if (!ALLOWED.has(collection)) {
    return NextResponse.json({ success: false, error: "Unknown collection" }, { status: 400 });
  }
  const body = await req.json();
  if (!body.id) return NextResponse.json({ success: false, error: "Row id required" }, { status: 400 });
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { id: rowId, ...updates } = body;
  const { data, error } = await db
    .from(TABLE_MAP[collection])
    .update(updates)
    .eq("id", rowId)
    .eq("campaign_id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, row: data });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; collection: string }> }
) {
  const { id, collection } = await ctx.params;
  if (!ALLOWED.has(collection)) {
    return NextResponse.json({ success: false, error: "Unknown collection" }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const rowId = searchParams.get("row_id");
  if (!rowId) return NextResponse.json({ success: false, error: "row_id required" }, { status: 400 });
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db
    .from(TABLE_MAP[collection])
    .delete()
    .eq("id", rowId)
    .eq("campaign_id", id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
