import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [campaignsRes, progressRes] = await Promise.all([
    db.from("campaigns").select("*").order("created_at", { ascending: false }),
    db.from("campaign_progress").select("*"),
  ]);

  return NextResponse.json({
    success: true,
    campaigns: campaignsRes.data ?? [],
    progress: progressRes.data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data, error } = await db.from("campaigns").insert(body).select().single();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, campaign: data });
}
