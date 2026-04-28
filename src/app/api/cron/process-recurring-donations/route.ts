import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { chargeRecurringPayment } from "@/lib/banquest";
import { sendDonationConfirmation, sendPaymentFailureAlert } from "@/lib/email";
import type { Donation } from "@/types/database";

// Vercel Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// Helper to get next charge date (1 month from now)
function getNextChargeDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
}

// Helper to get today's date
function getToday(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
}

export async function GET(request: NextRequest) {
  // Verify cron secret (optional but recommended for security)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const today = getToday();
  const results: { processed: number; successful: number; failed: number; errors: string[] } = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Find all active recurring donations due for charge
    const { data: donationsData, error: fetchError } = await supabase
      .from("donations")
      .select("*")
      .eq("is_recurring", true)
      .eq("recurring_status", "active")
      .not("card_ref", "is", null)
      .lte("next_charge_date", today);

    if (fetchError) {
      console.error("Error fetching recurring donations:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch recurring donations" },
        { status: 500 }
      );
    }

    const donations = donationsData as Donation[] | null;

    if (!donations || donations.length === 0) {
      return NextResponse.json({
        message: "No recurring donations due for processing",
        processed: 0,
      });
    }

    console.log(`Processing ${donations.length} recurring donations...`);

    // Process each donation
    for (const donation of donations) {
      results.processed++;

      // Skip if no card_ref (shouldn't happen due to query filter, but TypeScript check)
      if (!donation.card_ref) {
        results.failed++;
        results.errors.push(`Donation ${donation.id}: No saved card reference`);
        continue;
      }

      try {
        // Charge the saved card
        const paymentResult = await chargeRecurringPayment({
          cardRef: donation.card_ref,
          amount: donation.amount,
          email: donation.email,
          name: donation.name || undefined,
          description: donation.sponsorship
            ? `JRE Monthly Donation - ${donation.sponsorship}`
            : "JRE Monthly Donation",
          orderNumber: "donation-monthly",
          invoiceNumber: `donation-monthly-${donation.id}-${Date.now().toString(36)}`,
          customFields: {
            custom1: "JRE Monthly Donation",
            custom2: donation.sponsorship || "",
            custom3: `Donation ID: ${donation.id}`,
          },
        });

        if (paymentResult.success) {
          // Payment successful - update next charge date
          const { error: updateError } = await supabase
            .from("donations")
            .update({
              next_charge_date: getNextChargeDate(),
              payment_reference: paymentResult.transactionId,
              payment_status: "success",
              payment_error: null,
              updated_at: new Date().toISOString(),
            } as never)
            .eq("id", donation.id);

          if (updateError) {
            console.error(`Failed to update donation ${donation.id}:`, updateError);
          }

          // Send confirmation email
          sendDonationConfirmation({
            to: donation.email,
            name: donation.name,
            amount: donation.amount,
            isRecurring: true,
            sponsorship: donation.sponsorship || undefined,
            transactionId: paymentResult.transactionId || "",
          }).catch(console.error);

          results.successful++;
          console.log(`Successfully charged donation ${donation.id}: $${donation.amount}`);
        } else {
          // Payment failed
          const { error: updateError } = await supabase
            .from("donations")
            .update({
              payment_status: "failed",
              payment_error: paymentResult.error || "Payment declined",
              updated_at: new Date().toISOString(),
            } as never)
            .eq("id", donation.id);

          if (updateError) {
            console.error(`Failed to update donation ${donation.id}:`, updateError);
          }

          results.failed++;
          results.errors.push(`Donation ${donation.id}: ${paymentResult.error}`);
          console.error(`Failed to charge donation ${donation.id}:`, paymentResult.error);

          void sendPaymentFailureAlert({
            campaignTitle: donation.sponsorship
              ? `Recurring Donation — ${donation.sponsorship}`
              : "Recurring Donation",
            campaignSlug: `recurring-${donation.id}`,
            amount: donation.amount,
            paymentMethod: "Card (recurring — saved card_ref)",
            errorMessage: paymentResult.error || "Payment declined",
            donorName: donation.name,
            donorEmail: donation.email,
            donorPhone: donation.phone || null,
            dedicationType: donation.honor_name ? "In honor of" : null,
            dedicationName: donation.honor_name || null,
            tierId: null,
            teamId: null,
          }).catch((e) => console.error("recurring failure alert failed:", e));

          // TODO: After X consecutive failures, set recurring_status to "failed" or "paused"
          // and send notification email to donor
        }
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`Donation ${donation.id}: ${errorMsg}`);
        console.error(`Error processing donation ${donation.id}:`, error);
      }
    }

    // ---- Also process campaign_donations (new multi-campaign schema) --------
    const campaignResults = await processCampaignRecurring(supabase, today);

    return NextResponse.json({
      message: "Recurring donations processed",
      donations: results,
      campaign_donations: campaignResults,
    });
  } catch (error) {
    console.error("Error processing recurring donations:", error);
    return NextResponse.json(
      { error: "Failed to process recurring donations" },
      { status: 500 }
    );
  }
}

interface CampaignRecurringRow {
  id: string;
  campaign_id: string;
  amount_cents: number;
  name: string;
  email: string;
  card_ref: string | null;
}

async function processCampaignRecurring(
  supabase: ReturnType<typeof createServerClient>,
  today: string,
) {
  const results = { processed: 0, successful: 0, failed: 0, errors: [] as string[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data, error } = await db
    .from("campaign_donations")
    .select("id, campaign_id, amount_cents, name, email, card_ref")
    .eq("is_recurring", true)
    .eq("payment_status", "completed")
    .not("card_ref", "is", null)
    .lte("next_charge_date", today);

  if (error) {
    console.error("campaign_donations fetch error:", error);
    return { ...results, errors: [error.message] };
  }
  const rows = (data ?? []) as CampaignRecurringRow[];
  if (rows.length === 0) return results;

  for (const row of rows) {
    results.processed++;
    if (!row.card_ref) {
      results.failed++;
      continue;
    }
    try {
      const amount = row.amount_cents / 100;
      const paymentResult = await chargeRecurringPayment({
        cardRef: row.card_ref,
        amount,
        email: row.email,
        name: row.name,
        description: "JRE Monthly Donation",
        orderNumber: `campaign-monthly-${row.campaign_id}`,
        invoiceNumber: `campaign-monthly-${row.id}-${Date.now().toString(36)}`,
        customFields: { custom1: `Campaign: ${row.campaign_id}`, custom2: `Parent: ${row.id}` },
      });

      if (paymentResult.success) {
        await db.from("campaign_donations").insert({
          campaign_id: row.campaign_id,
          amount_cents: row.amount_cents,
          matched_cents: 0,
          name: row.name,
          display_name: row.name,
          email: row.email,
          payment_method: "card",
          payment_status: "completed",
          payment_reference: paymentResult.transactionId,
          card_ref: row.card_ref,
          is_recurring: false,
          recurring_frequency: null,
          next_charge_date: null,
        });
        await db
          .from("campaign_donations")
          .update({ next_charge_date: getNextChargeDate() })
          .eq("id", row.id);
        await sendDonationConfirmation({
          to: row.email,
          name: row.name,
          amount,
          isRecurring: true,
          transactionId: paymentResult.transactionId ?? "",
        }).catch(console.error);
        results.successful++;
      } else {
        await db
          .from("campaign_donations")
          .update({ failure_reason: paymentResult.error || "Recurring charge declined" })
          .eq("id", row.id);
        results.failed++;
        results.errors.push(`${row.id}: ${paymentResult.error}`);

        void sendPaymentFailureAlert({
          campaignTitle: `Campaign Recurring (${row.campaign_id})`,
          campaignSlug: `campaign-${row.campaign_id}`,
          amount,
          paymentMethod: "Card (recurring — saved card_ref)",
          errorMessage: paymentResult.error || "Recurring charge declined",
          donorName: row.name,
          donorEmail: row.email,
          donorPhone: null,
          dedicationType: null,
          dedicationName: null,
          tierId: null,
          teamId: null,
        }).catch((e) => console.error("campaign recurring failure alert failed:", e));
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${row.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  return results;
}

// Vercel cron config - run daily at 9 AM EST
export const dynamic = "force-dynamic";
