import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

async function load(id: string) {
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [campaignRes, causes, tiers, matchers, teams, donations, progress] = await Promise.all([
    db.from("campaigns").select("*").eq("id", id).maybeSingle(),
    db.from("campaign_causes").select("*").eq("campaign_id", id).order("sort_order", { ascending: true }),
    db.from("campaign_tiers").select("*").eq("campaign_id", id).order("sort_order", { ascending: true }),
    db.from("campaign_matchers").select("*").eq("campaign_id", id).order("sort_order", { ascending: true }),
    db.from("campaign_teams").select("*").eq("campaign_id", id).order("sort_order", { ascending: true }),
    db.from("campaign_donations").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("campaign_progress").select("*").eq("campaign_id", id).maybeSingle(),
  ]);

  return {
    campaign: campaignRes.data,
    causes: causes.data ?? [],
    tiers: tiers.data ?? [],
    matchers: matchers.data ?? [],
    teams: teams.data ?? [],
    donations: donations.data ?? [],
    progress: progress.data ?? null,
  };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const data = await load(id);
  if (!data.campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, ...data });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const body = await req.json();
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db.from("campaigns").update(body).eq("id", id).select().single();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, campaign: data });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { error } = await db.from("campaigns").update({ is_active: false }).eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
