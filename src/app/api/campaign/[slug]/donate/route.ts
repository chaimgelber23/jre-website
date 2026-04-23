import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { processDirectPayment } from "@/lib/banquest";
import {
  getCampaignBySlug,
  getActiveMatcher,
  computeMatchedAmount,
  maskDonorName,
} from "@/lib/campaign";
import { sendDonationConfirmation, sendHonoreeNotification } from "@/lib/email";
import type {
  CampaignMatcher,
  CampaignTier,
  PaymentMethod,
  DedicationType,
} from "@/types/campaign";

interface DonateBody {
  amount_cents: number;
  tier_id: string | null;
  cause_id: string | null;
  team_id: string | null;
  payment_method: PaymentMethod;
  name: string;
  email: string;
  phone: string | null;
  is_anonymous: boolean;
  message: string | null;
  dedication_type: DedicationType | null;
  dedication_name: string | null;
  dedication_email: string | null;
  card: { name: string; number: string; expiry: string; cvv: string } | null;
  daf_sponsor: string | null;
  ojc_account_id: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;

  let body: DonateBody;
  try {
    body = (await req.json()) as DonateBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ success: false, error: "Name and email are required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(body.email)) {
    return NextResponse.json({ success: false, error: "Invalid email format" }, { status: 400 });
  }
  if (!Number.isFinite(body.amount_cents) || body.amount_cents < 100) {
    return NextResponse.json({ success: false, error: "Minimum donation is $1" }, { status: 400 });
  }
  const validMethods: PaymentMethod[] = ["card", "daf", "ojc_fund", "check", "zelle", "other"];
  if (!validMethods.includes(body.payment_method)) {
    return NextResponse.json({ success: false, error: "Invalid payment method" }, { status: 400 });
  }

  const campaign = await getCampaignBySlug(slug);
  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }
  if (campaign.status !== "live" && campaign.status !== "scheduled") {
    return NextResponse.json(
      { success: false, error: "This campaign is not currently accepting donations." },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // ---- Card path: charge immediately via Banquest ---------------------------
  let paymentStatus: "completed" | "pledged" | "failed" = "pledged";
  let paymentReference: string | null = null;
  let cardRef: string | null = null;
  const failureReason: string | null = null;

  if (body.payment_method === "card") {
    if (!body.card || !body.card.number || !body.card.expiry || !body.card.cvv) {
      return NextResponse.json({ success: false, error: "Card details are required" }, { status: 400 });
    }
    const amountDollars = body.amount_cents / 100;
    const result = await processDirectPayment({
      amount: amountDollars,
      cardNumber: body.card.number,
      cardExpiry: body.card.expiry,
      cardCvv: body.card.cvv,
      cardName: body.card.name || body.name,
      email: body.email,
      description: `JRE Campaign: ${campaign.title}`,
    });

    if (!result.success) {
      // Store failed attempt for reconciliation, then reject
      await db.from("campaign_donations").insert({
        campaign_id: campaign.id,
        cause_id: body.cause_id,
        tier_id: body.tier_id,
        team_id: body.team_id,
        amount_cents: body.amount_cents,
        matched_cents: 0,
        name: body.name.trim(),
        display_name: maskDonorName(body.name.trim(), body.is_anonymous),
        email: body.email.trim(),
        phone: body.phone,
        is_anonymous: body.is_anonymous,
        dedication_type: body.dedication_type,
        dedication_name: body.dedication_name,
        dedication_email: body.dedication_email,
        message: body.message,
        payment_method: "card",
        payment_status: "failed",
        failure_reason: result.error || "Card declined",
      });
      return NextResponse.json(
        { success: false, error: result.error || "Payment failed" },
        { status: 400 }
      );
    }

    paymentStatus = "completed";
    paymentReference = result.transactionId || `bq_${Date.now()}`;
    cardRef = result.cardRef || null;
  } else {
    // Pledge path — DAF / OJC / check / zelle / other
    paymentStatus = "pledged";
    if (body.payment_method === "daf" && !body.daf_sponsor?.trim()) {
      return NextResponse.json(
        { success: false, error: "Please specify your DAF sponsor." },
        { status: 400 }
      );
    }
  }

  // ---- Compute match --------------------------------------------------------
  let matchedCents = 0;
  let activeMatcher: CampaignMatcher | null = null;
  if (paymentStatus === "completed" || paymentStatus === "pledged") {
    const { data: matchersData } = await db
      .from("campaign_matchers")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("is_active", true);
    const matchers = (matchersData ?? []) as CampaignMatcher[];
    activeMatcher = getActiveMatcher(matchers);
    matchedCents = computeMatchedAmount(body.amount_cents, activeMatcher);
  }

  // ---- Insert donation ------------------------------------------------------
  const { data: insertData, error: insertError } = await db
    .from("campaign_donations")
    .insert({
      campaign_id: campaign.id,
      cause_id: body.cause_id,
      tier_id: body.tier_id,
      team_id: body.team_id,
      amount_cents: body.amount_cents,
      matched_cents: matchedCents,
      name: body.name.trim(),
      display_name: maskDonorName(body.name.trim(), body.is_anonymous),
      email: body.email.trim(),
      phone: body.phone,
      is_anonymous: body.is_anonymous,
      dedication_type: body.dedication_type,
      dedication_name: body.dedication_name,
      dedication_email: body.dedication_email,
      message: body.message,
      payment_method: body.payment_method,
      payment_status: paymentStatus,
      payment_reference: paymentReference,
      card_ref: cardRef,
      daf_sponsor: body.daf_sponsor,
      daf_grant_id: body.ojc_account_id,
      failure_reason: failureReason,
    })
    .select()
    .single();

  if (insertError || !insertData) {
    console.error("campaign_donations insert error:", insertError);
    return NextResponse.json(
      { success: false, error: "Donation was processed but failed to save. Please contact us." },
      { status: 500 }
    );
  }

  // ---- Increment matcher pool (best-effort) ---------------------------------
  if (activeMatcher && matchedCents > 0) {
    await db
      .from("campaign_matchers")
      .update({ matched_cents: (activeMatcher.matched_cents ?? 0) + matchedCents })
      .eq("id", activeMatcher.id);
  }

  // ---- Receipt + dedication emails (fire-and-forget) ------------------------
  if (paymentStatus === "completed") {
    let tierLabel: string | undefined;
    if (body.tier_id) {
      const { data: tierRow } = await db
        .from("campaign_tiers")
        .select("label,amount_cents")
        .eq("id", body.tier_id)
        .maybeSingle();
      const tier = tierRow as Pick<CampaignTier, "label" | "amount_cents"> | null;
      if (tier?.label) tierLabel = tier.label;
    }

    void sendDonationConfirmation({
      to: body.email.trim(),
      name: body.name.trim(),
      amount: body.amount_cents / 100,
      isRecurring: false,
      sponsorship: tierLabel,
      transactionId: paymentReference ?? insertData.id,
    }).catch((e) => console.error("donation receipt email failed:", e));

    if (body.dedication_email && EMAIL_RE.test(body.dedication_email) && body.dedication_name) {
      void sendHonoreeNotification({
        to: body.dedication_email.trim(),
        honoreeName: body.dedication_name.trim(),
        donorName: body.is_anonymous ? "A JRE friend" : body.name.trim(),
        message: body.message ?? undefined,
      }).catch((e) => console.error("honoree email failed:", e));
    }
  }

  return NextResponse.json({
    success: true,
    id: insertData.id,
    payment_status: paymentStatus,
    amount_cents: body.amount_cents,
    matched_cents: matchedCents,
  });
}
