import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Mark a pledge as completed / refunded / failed. Admins use this to reconcile
// DAF & OJC Fund pledges once the grant actually arrives.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; donationId: string }> }
) {
  const { id, donationId } = await ctx.params;
  const body = await req.json();
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const allowed: Record<string, true> = {
    payment_status: true,
    payment_reference: true,
    daf_grant_id: true,
    check_number: true,
    admin_notes: true,
    matched_cents: true,
    team_id: true,
    cause_id: true,
    is_anonymous: true,
    display_name: true,
  };
  const updates: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    if (allowed[k]) updates[k] = body[k];
  }

  const { data, error } = await db
    .from("campaign_donations")
    .update(updates)
    .eq("id", donationId)
    .eq("campaign_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, donation: data });
}
