import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { processDirectPayment, setupRecurringPayment } from "@/lib/banquest";
import { createGrant } from "@/lib/donors-fund";
import { processCharityCardTransaction } from "@/lib/ojc-fund";
import {
  getCampaignBySlug,
  getActiveMatcher,
  maskDonorName,
} from "@/lib/campaign";
import { sendDonationConfirmation, sendHonoreeNotification, sendPaymentFailureAlert } from "@/lib/email";
import { verifyTurnstileToken, getClientIp } from "@/lib/turnstile";
import type {
  CampaignMatcher,
  CampaignTier,
  PaymentMethod,
  DedicationType,
} from "@/types/campaign";

interface BillingAddress {
  country?: string;
  line1?: string;
  apt?: string;
  zip?: string;
  city?: string;
  state?: string;
}

interface DonateBody {
  amount_cents: number;
  tier_id: string | null;
  cause_id: string | null;
  team_id: string | null;
  payment_method: PaymentMethod;
  name: string;
  display_name?: string | null;
  email: string;
  phone: string | null;
  is_anonymous: boolean;
  message: string | null;
  dedication_type: DedicationType | null;
  dedication_name: string | null;
  dedication_email: string | null;
  card: {
    name: string;
    number: string;
    expiry: string;
    cvv: string;
    billing?: BillingAddress;
  } | null;
  daf_sponsor: string | null;
  ojc_account_id: string | null;
  ojc: { cardNumber: string; expDate: string } | null;
  donors_fund: { donor: string; authorization: string } | null;
  is_recurring?: boolean;
  recurring_frequency?: "monthly" | null;
  turnstile_token?: string | null;
}

function addMonthsISODate(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Hard ceiling so a hung gateway can't pin a function instance during a campaign
// rush. Banquest/OJC/TDF calls have their own 25s timeouts; this is the backstop.
export const maxDuration = 30;

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

  const captcha = await verifyTurnstileToken(body.turnstile_token, getClientIp(req));
  if (!captcha.ok) {
    return NextResponse.json(
      { success: false, error: "Verification failed. Please refresh the page and try again." },
      { status: 400 }
    );
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
  const validMethods: PaymentMethod[] = ["card", "daf", "fidelity", "ojc_fund", "donors_fund", "check", "zelle", "other"];
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

  const wantsRecurring = body.is_recurring === true && body.recurring_frequency === "monthly";

  if (body.payment_method === "card") {
    if (!body.card || !body.card.number || !body.card.expiry || !body.card.cvv) {
      return NextResponse.json({ success: false, error: "Card details are required" }, { status: 400 });
    }
    const amountDollars = body.amount_cents / 100;
    const description = wantsRecurring
      ? `JRE Monthly: ${campaign.title}`
      : `JRE Campaign: ${campaign.title}`;
    const customFields = {
      custom1: `Campaign: ${campaign.title}`,
      custom2: body.tier_id ? `Tier: ${body.tier_id}` : "",
      custom3: body.team_id ? `Team: ${body.team_id}` : "",
      custom4: body.dedication_name ? `${body.dedication_type || "Dedication"}: ${body.dedication_name}` : "",
      custom5: wantsRecurring ? "Recurring: monthly" : (body.phone || ""),
    };

    let result;
    if (wantsRecurring) {
      const [mmStr, yyStr] = body.card.expiry.split("/").map((s) => s.trim());
      const expiryMonth = parseInt(mmStr, 10);
      let expiryYear = parseInt(yyStr, 10);
      if (!Number.isFinite(expiryMonth) || !Number.isFinite(expiryYear)) {
        return NextResponse.json({ success: false, error: "Invalid expiry date. Use MM/YY." }, { status: 400 });
      }
      if (expiryYear < 100) expiryYear += 2000;
      result = await setupRecurringPayment({
        amount: amountDollars,
        cardNumber: body.card.number,
        expiryMonth,
        expiryYear,
        cvv: body.card.cvv,
        cardName: body.card.name || body.name,
        email: body.email,
        description,
        orderNumber: `campaign-${campaign.slug ?? campaign.id}`,
        invoiceNumber: `campaign-${campaign.slug ?? campaign.id}-${Date.now().toString(36)}`,
        customFields,
      });
    } else {
      result = await processDirectPayment({
        amount: amountDollars,
        cardNumber: body.card.number,
        cardExpiry: body.card.expiry,
        cardCvv: body.card.cvv,
        cardName: body.card.name || body.name,
        email: body.email,
        description,
        orderNumber: `campaign-${campaign.slug ?? campaign.id}`,
        invoiceNumber: `campaign-${campaign.slug ?? campaign.id}-${Date.now().toString(36)}`,
        customFields,
      });
    }

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
        display_name: body.is_anonymous
        ? "Anonymous"
        : (body.display_name?.trim() || maskDonorName(body.name.trim(), false)),
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
      void sendPaymentFailureAlert({
        campaignTitle: campaign.title,
        campaignSlug: campaign.slug ?? String(campaign.id),
        amount: body.amount_cents / 100,
        paymentMethod: wantsRecurring ? "Card (monthly recurring)" : "Card",
        errorMessage: result.error || "Card declined",
        donorName: body.name.trim(),
        donorEmail: body.email.trim(),
        donorPhone: body.phone,
        dedicationType: body.dedication_type,
        dedicationName: body.dedication_name,
        tierId: body.tier_id,
        teamId: body.team_id,
      }).catch((e) => console.error("payment failure alert failed:", e));
      return NextResponse.json(
        { success: false, error: result.error || "Payment failed" },
        { status: 400 }
      );
    }

    paymentStatus = "completed";
    paymentReference = result.transactionId || `bq_${Date.now()}`;
    cardRef = result.cardRef || null;
  } else if (body.payment_method === "donors_fund") {
    // ---- Donor's Fund path: charge immediately via TDF /Create ---------------
    if (!body.donors_fund?.donor?.trim() || !body.donors_fund?.authorization?.trim()) {
      return NextResponse.json(
        { success: false, error: "Please enter your Giving Card + CVV (or email + PIN)." },
        { status: 400 }
      );
    }
    const taxId = process.env.TDF_TAX_ID;
    const accountNumber = process.env.TDF_ACCOUNT_NUMBER;
    if (!taxId || !accountNumber) {
      return NextResponse.json(
        { success: false, error: "Donor's Fund isn't fully configured. Please use a different payment method." },
        { status: 500 }
      );
    }
    const amountDollars = body.amount_cents / 100;
    const grant = await createGrant({
      taxId,
      accountNumber,
      amount: amountDollars.toFixed(2),
      donor: body.donors_fund.donor.trim(),
      donorAuthorization: body.donors_fund.authorization.trim(),
      purposeNote: `JRE-${campaign.slug}`.slice(0, 50),
    });

    if (!grant.success) {
      await db.from("campaign_donations").insert({
        campaign_id: campaign.id,
        cause_id: body.cause_id,
        tier_id: body.tier_id,
        team_id: body.team_id,
        amount_cents: body.amount_cents,
        matched_cents: 0,
        name: body.name.trim(),
        display_name: body.is_anonymous
        ? "Anonymous"
        : (body.display_name?.trim() || maskDonorName(body.name.trim(), false)),
        email: body.email.trim(),
        phone: body.phone,
        is_anonymous: body.is_anonymous,
        dedication_type: body.dedication_type,
        dedication_name: body.dedication_name,
        dedication_email: body.dedication_email,
        message: body.message,
        payment_method: "donors_fund",
        payment_status: "failed",
        failure_reason: grant.error || "Donor's Fund declined",
      });
      void sendPaymentFailureAlert({
        campaignTitle: campaign.title,
        campaignSlug: campaign.slug ?? String(campaign.id),
        amount: body.amount_cents / 100,
        paymentMethod: "Donor's Fund",
        errorMessage: grant.error || "Donor's Fund declined",
        donorName: body.name.trim(),
        donorEmail: body.email.trim(),
        donorPhone: body.phone,
        dedicationType: body.dedication_type,
        dedicationName: body.dedication_name,
        tierId: body.tier_id,
        teamId: body.team_id,
      }).catch((e) => console.error("payment failure alert failed:", e));
      return NextResponse.json(
        { success: false, error: grant.error || "Donor's Fund grant failed" },
        { status: 400 }
      );
    }

    paymentStatus = "completed";
    paymentReference = grant.transactionId || `tdf_${grant.confirmationNumber}`;
  } else if (body.payment_method === "ojc_fund") {
    // ---- OJC Charity Card path: charge immediately via OJC Fund --------------
    if (!body.ojc?.cardNumber?.trim() || !body.ojc?.expDate?.trim()) {
      return NextResponse.json(
        { success: false, error: "Please enter your OJC Charity Card number and expiration." },
        { status: 400 }
      );
    }
    const amountDollars = body.amount_cents / 100;
    // externalReferenceId max length appears undocumented; keep it short + unique.
    const externalReferenceId = `jre-${campaign.slug ?? campaign.id}-${Date.now().toString(36)}`;
    const charge = await processCharityCardTransaction({
      cardNo: body.ojc.cardNumber.trim(),
      expDate: body.ojc.expDate.trim(),
      amount: amountDollars,
      externalReferenceId,
    });

    if (!charge.success) {
      await db.from("campaign_donations").insert({
        campaign_id: campaign.id,
        cause_id: body.cause_id,
        tier_id: body.tier_id,
        team_id: body.team_id,
        amount_cents: body.amount_cents,
        matched_cents: 0,
        name: body.name.trim(),
        display_name: body.is_anonymous
          ? "Anonymous"
          : (body.display_name?.trim() || maskDonorName(body.name.trim(), false)),
        email: body.email.trim(),
        phone: body.phone,
        is_anonymous: body.is_anonymous,
        dedication_type: body.dedication_type,
        dedication_name: body.dedication_name,
        dedication_email: body.dedication_email,
        message: body.message,
        payment_method: "ojc_fund",
        payment_status: "failed",
        failure_reason: charge.error || "OJC Charity Card declined",
      });
      void sendPaymentFailureAlert({
        campaignTitle: campaign.title,
        campaignSlug: campaign.slug ?? String(campaign.id),
        amount: body.amount_cents / 100,
        paymentMethod: "OJC Charity Card",
        errorMessage: charge.error || "OJC Charity Card declined",
        donorName: body.name.trim(),
        donorEmail: body.email.trim(),
        donorPhone: body.phone,
        dedicationType: body.dedication_type,
        dedicationName: body.dedication_name,
        tierId: body.tier_id,
        teamId: body.team_id,
      }).catch((e) => console.error("payment failure alert failed:", e));
      return NextResponse.json(
        { success: false, error: charge.error || "OJC Charity Card declined" },
        { status: 400 }
      );
    }

    paymentStatus = "completed";
    paymentReference = charge.referenceNumber ? `ojc_${charge.referenceNumber}` : `ojc_${Date.now()}`;
  } else {
    // Pledge path — DAF / Fidelity / check / zelle / other
    paymentStatus = "pledged";
    if (body.payment_method === "daf" && !body.daf_sponsor?.trim()) {
      return NextResponse.json(
        { success: false, error: "Please specify your DAF sponsor." },
        { status: 400 }
      );
    }
    // Fidelity pledges auto-populate the sponsor name
    if (body.payment_method === "fidelity" && !body.daf_sponsor?.trim()) {
      body.daf_sponsor = "Fidelity Charitable";
    }
  }

  // ---- Compute match --------------------------------------------------------
  // Two-phase atomic match application:
  //   1. Pick the active matcher and compute the *requested* match (no cap
  //      clamping — that's the racy part).
  //   2. Call the apply_matcher_increment RPC, which locks the matcher row,
  //      clamps to remaining cap, increments, and returns the actual amount.
  //   3. Use the RPC's returned value as the donation's matched_cents.
  // This eliminates the lost-update race when many donors check out at once
  // during a match push: SELECT FOR UPDATE serializes concurrent callers.
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
    if (activeMatcher) {
      const multiplier = Number(activeMatcher.multiplier);
      const requestedMatch = multiplier > 1
        ? Math.round(body.amount_cents * (multiplier - 1))
        : 0;
      if (requestedMatch > 0) {
        const { data: appliedRaw, error: rpcErr } = await db.rpc("apply_matcher_increment", {
          p_matcher_id: activeMatcher.id,
          p_requested: requestedMatch,
        });
        if (rpcErr) {
          // RPC failure is non-fatal — fall back to the pre-RPC behavior
          // (no match credit) so the donor still goes through. Logged so we
          // can reconcile later.
          console.error("apply_matcher_increment failed:", rpcErr);
          matchedCents = 0;
        } else {
          matchedCents = Number(appliedRaw ?? 0);
        }
      }
    }
  }

  // Only card donations can actually recur (need a saved card_ref).
  const persistRecurring =
    wantsRecurring && body.payment_method === "card" && paymentStatus === "completed" && !!cardRef;
  const nextChargeDate = persistRecurring
    ? addMonthsISODate(new Date().toISOString(), 1)
    : null;

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
      display_name: body.is_anonymous
        ? "Anonymous"
        : (body.display_name?.trim() || maskDonorName(body.name.trim(), false)),
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
      is_recurring: persistRecurring,
      recurring_frequency: persistRecurring ? "monthly" : null,
      next_charge_date: nextChargeDate,
    })
    .select()
    .single();

  if (insertError || !insertData) {
    console.error("campaign_donations insert error:", insertError);
    // Compensate the matcher pool: we incremented it before the donation
    // insert, and the donation never made it into the table, so the credit
    // doesn't belong to anyone. Best-effort revert.
    if (activeMatcher && matchedCents > 0) {
      await db.rpc("revert_matcher_increment", {
        p_matcher_id: activeMatcher.id,
        p_amount: matchedCents,
      }).catch((e: unknown) => console.error("revert_matcher_increment failed:", e));
    }
    return NextResponse.json(
      { success: false, error: "Donation was processed but failed to save. Please contact us." },
      { status: 500 }
    );
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
      isRecurring: persistRecurring,
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
