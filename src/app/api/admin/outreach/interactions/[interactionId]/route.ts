// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ interactionId: string }> }
) {
  const { interactionId } = await params;
  const supabase = createServerClient();
  const body = await request.json();

  const allowed = ["type", "date", "notes", "location", "stage_before", "stage_after", "confirmation_status"];
  const update: Record<string, any> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  const { data, error } = await supabase
    .from("outreach_interactions")
    .update(update)
    .eq("id", interactionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ interaction: data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ interactionId: string }> }
) {
  const { interactionId } = await params;
  const supabase = createServerClient();

  const { error } = await supabase
    .from("outreach_interactions")
    .delete()
    .eq("id", interactionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
