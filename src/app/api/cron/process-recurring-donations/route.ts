import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { chargeRecurringPayment } from "@/lib/banquest";
import { sendDonationConfirmation } from "@/lib/email";
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
          description: donation.sponsorship
            ? `JRE Monthly Donation - ${donation.sponsorship}`
            : "JRE Monthly Donation",
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

    return NextResponse.json({
      message: "Recurring donations processed",
      ...results,
    });
  } catch (error) {
    console.error("Error processing recurring donations:", error);
    return NextResponse.json(
      { error: "Failed to process recurring donations" },
      { status: 500 }
    );
  }
}

// Vercel cron config - run daily at 9 AM EST
export const dynamic = "force-dynamic";
