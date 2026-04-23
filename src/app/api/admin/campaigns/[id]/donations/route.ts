import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { maskDonorName, getActiveMatcher, computeMatchedAmount } from "@/lib/campaign";
import type { CampaignMatcher, DedicationType, PaymentMethod, PaymentStatus } from "@/types/campaign";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ManualDonationBody {
  name: string;
  email: string;
  phone?: string | null;
  amount_cents: number;
  team_id?: string | null;
  tier_id?: string | null;
  cause_id?: string | null;
  payment_method?: PaymentMethod;           // default "other" for manual pledges
  payment_status?: PaymentStatus;            // default "pledged"
  is_anonymous?: boolean;
  message?: string | null;
  dedication_type?: DedicationType | null;
  dedication_name?: string | null;
  dedication_email?: string | null;
  admin_notes?: string | null;
  payment_reference?: string | null;
  check_number?: string | null;
  apply_match?: boolean;                     // optional: compute matcher cents for this pledge
}

/**
 * Admin: create a donation record manually (typically a pledge — donor said they'll pay later).
 * No card is charged here. Use the PATCH endpoint on the individual donation to flip to "completed"
 * once payment is received.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await ctx.params;

  let body: ManualDonationBody;
  try {
    body = (await req.json()) as ManualDonationBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
  }
  if (!body.email?.trim() || !EMAIL_RE.test(body.email)) {
    return NextResponse.json({ success: false, error: "Valid email is required" }, { status: 400 });
  }
  if (!Number.isFinite(body.amount_cents) || body.amount_cents < 100) {
    return NextResponse.json({ success: false, error: "Minimum amount is $1" }, { status: 400 });
  }

  const paymentMethod: PaymentMethod = body.payment_method ?? "other";
  const paymentStatus: PaymentStatus = body.payment_status ?? "pledged";

  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Compute match if requested (typically pledges don't match until paid, but admin may opt-in).
  let matchedCents = 0;
  if (body.apply_match && (paymentStatus === "completed" || paymentStatus === "pledged")) {
    const { data: matchersData } = await db
      .from("campaign_matchers")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("is_active", true);
    const matchers = (matchersData ?? []) as CampaignMatcher[];
    const activeMatcher = getActiveMatcher(matchers);
    matchedCents = computeMatchedAmount(body.amount_cents, activeMatcher);
  }

  const { data, error } = await db
    .from("campaign_donations")
    .insert({
      campaign_id: campaignId,
      cause_id: body.cause_id ?? null,
      tier_id: body.tier_id ?? null,
      team_id: body.team_id ?? null,
      amount_cents: body.amount_cents,
      matched_cents: matchedCents,
      name: body.name.trim(),
      display_name: maskDonorName(body.name.trim(), !!body.is_anonymous),
      email: body.email.trim(),
      phone: body.phone?.trim() || null,
      is_anonymous: !!body.is_anonymous,
      dedication_type: body.dedication_type ?? null,
      dedication_name: body.dedication_name?.trim() || null,
      dedication_email: body.dedication_email?.trim() || null,
      message: body.message?.trim() || null,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      payment_reference: body.payment_reference?.trim() || null,
      check_number: body.check_number?.trim() || null,
      admin_notes: body.admin_notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error("manual donation insert error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, donation: data });
}
