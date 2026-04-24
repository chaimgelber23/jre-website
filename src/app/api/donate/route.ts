import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncDonationToSheets } from "@/lib/google-sheets/sync";
import { processDirectPayment } from "@/lib/banquest";
import { createGrant } from "@/lib/donors-fund";
import { processCharityCardTransaction } from "@/lib/ojc-fund";
import { sendDonationConfirmation, sendHonoreeNotification } from "@/lib/email";
import { verifyTurnstileToken, getClientIp } from "@/lib/turnstile";
import type { Donation, DonationInsert } from "@/types/database";

type DonatePaymentMethod = "card" | "donors_fund" | "ojc_fund";

// Helper to calculate next charge date (1 month from now)
function getNextChargeDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const captcha = await verifyTurnstileToken(body?.turnstileToken, getClientIp(request));
    if (!captcha.ok) {
      return NextResponse.json(
        { success: false, error: "Verification failed. Please refresh the page and try again." },
        { status: 400 }
      );
    }

    // Validate required fields
    const {
      amount,
      isRecurring,
      paymentMethod: rawPaymentMethod,
      name,
      email,
      phone,
      honorName,
      honorEmail,
      sponsorship,
      message,
      cardName,
      cardNumber,
      cardExpiry,
      cardCvv,
      donorsFund,
      ojc,
    } = body;

    const paymentMethod: DonatePaymentMethod =
      rawPaymentMethod === "donors_fund" || rawPaymentMethod === "ojc_fund" ? rawPaymentMethod : "card";

    if (!amount || !name || !email) {
      return NextResponse.json(
        { success: false, error: "Amount, name, and email are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate amount
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid donation amount" },
        { status: 400 }
      );
    }

    // Recurring only works with card (needs saved card_ref + our own cron)
    const effectiveRecurring = Boolean(isRecurring) && paymentMethod === "card";

    const paymentStatus = "success";
    let paymentReference = "";

    if (paymentMethod === "card") {
      if (!cardNumber || !cardExpiry || !cardCvv) {
        return NextResponse.json(
          { success: false, error: "Card details are required" },
          { status: 400 }
        );
      }

      const paymentResult = await processDirectPayment({
        amount: numericAmount,
        cardNumber,
        cardExpiry,
        cardCvv,
        cardName: cardName || name,
        email,
        description: sponsorship
          ? `JRE Donation - ${sponsorship}`
          : `JRE Donation${effectiveRecurring ? " (Monthly)" : ""}`,
        orderNumber: effectiveRecurring ? "donation-monthly" : "donation",
        invoiceNumber: `donation-${Date.now().toString(36)}`,
        customFields: {
          custom1: effectiveRecurring ? "JRE Monthly Donation" : "JRE Donation",
          custom2: sponsorship || "",
          custom3: honorName ? `In honor/memory of: ${honorName}` : "",
          custom4: phone || "",
          custom5: message ? message.slice(0, 255) : "",
        },
      });

      if (!paymentResult.success) {
        return NextResponse.json(
          { success: false, error: paymentResult.error || "Payment failed" },
          { status: 400 }
        );
      }
      paymentReference = paymentResult.transactionId || `bq_${Date.now()}`;
    } else if (paymentMethod === "donors_fund") {
      if (!donorsFund?.donor?.trim() || !donorsFund?.authorization?.trim()) {
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
      const grant = await createGrant({
        taxId,
        accountNumber,
        amount: numericAmount.toFixed(2),
        donor: donorsFund.donor.trim(),
        donorAuthorization: donorsFund.authorization.trim(),
        purposeNote: sponsorship ? `JRE-${sponsorship}`.slice(0, 50) : "JRE Donation",
      });
      if (!grant.success) {
        return NextResponse.json(
          { success: false, error: grant.error || "Donor's Fund grant failed" },
          { status: 400 }
        );
      }
      paymentReference = grant.transactionId || `tdf_${grant.confirmationNumber ?? Date.now()}`;
    } else if (paymentMethod === "ojc_fund") {
      if (!ojc?.cardNumber?.trim() || !ojc?.expDate?.trim()) {
        return NextResponse.json(
          { success: false, error: "Please enter your OJC Charity Card number and expiration." },
          { status: 400 }
        );
      }
      const externalReferenceId = `jre-donate-${Date.now().toString(36)}`;
      const charge = await processCharityCardTransaction({
        cardNo: ojc.cardNumber.trim(),
        expDate: ojc.expDate.trim(),
        amount: numericAmount,
        externalReferenceId,
      });
      if (!charge.success) {
        return NextResponse.json(
          { success: false, error: charge.error || "OJC Charity Card declined" },
          { status: 400 }
        );
      }
      paymentReference = charge.referenceNumber ? `ojc_${charge.referenceNumber}` : `ojc_${Date.now()}`;
    }

    const supabase = createServerClient();

    // Insert into Supabase
    const insertData: DonationInsert = {
      amount: numericAmount,
      is_recurring: effectiveRecurring,
      recurring_frequency: effectiveRecurring ? "monthly" : null,
      recurring_status: effectiveRecurring ? "active" : "one_time",
      name,
      email,
      phone: phone || null,
      honor_name: honorName || null,
      honor_email: honorEmail || null,
      sponsorship: sponsorship || null,
      message: message || null,
      payment_status: paymentStatus,
      payment_reference: paymentReference,
      card_ref: null,
      next_charge_date: effectiveRecurring ? getNextChargeDate() : null,
    };

    const { data: insertedData, error } = await supabase
      .from("donations")
      .insert(insertData as never)
      .select()
      .single();

    if (error || !insertedData) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to save donation" },
        { status: 500 }
      );
    }

    const data = insertedData as Donation;

    // Sync to Google Sheets (async, non-blocking)
    syncDonationToSheets(data).catch(console.error);

    // Send confirmation email to donor (async, non-blocking)
    sendDonationConfirmation({
      to: email,
      name,
      amount: numericAmount,
      isRecurring: effectiveRecurring,
      sponsorship: sponsorship || undefined,
      transactionId: paymentReference,
    }).catch(console.error);

    // If honoring someone with an email, notify them (async, non-blocking)
    if (honorName && honorEmail) {
      sendHonoreeNotification({
        to: honorEmail,
        honoreeName: honorName,
        donorName: name,
        message: message || undefined,
      }).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      paymentStatus: data.payment_status,
      amount: data.amount,
    });
  } catch (error) {
    console.error("Donation API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
