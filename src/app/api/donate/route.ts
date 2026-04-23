import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncDonationToSheets } from "@/lib/google-sheets/sync";
import { processDirectPayment } from "@/lib/banquest";
import { sendDonationConfirmation, sendHonoreeNotification } from "@/lib/email";
import type { Donation, DonationInsert } from "@/types/database";

// Helper to calculate next charge date (1 month from now)
function getNextChargeDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD format
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const {
      amount,
      isRecurring,
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
    } = body;

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

    // Validate card fields
    if (!cardNumber || !cardExpiry || !cardCvv) {
      return NextResponse.json(
        { success: false, error: "Card details are required" },
        { status: 400 }
      );
    }

    // Process payment via Banquest (direct card - same as event pages)
    const paymentResult = await processDirectPayment({
      amount: numericAmount,
      cardNumber,
      cardExpiry,
      cardCvv,
      cardName: cardName || name,
      email,
      description: sponsorship
        ? `JRE Donation - ${sponsorship}`
        : `JRE Donation${isRecurring ? " (Monthly)" : ""}`,
      orderNumber: isRecurring ? "donation-monthly" : "donation",
      invoiceNumber: `donation-${Date.now().toString(36)}`,
      customFields: {
        custom1: isRecurring ? "JRE Monthly Donation" : "JRE Donation",
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

    const paymentStatus = "success";
    const paymentReference = paymentResult.transactionId || `bq_${Date.now()}`;

    const supabase = createServerClient();

    // Insert into Supabase
    const insertData: DonationInsert = {
      amount: numericAmount,
      is_recurring: Boolean(isRecurring),
      recurring_frequency: isRecurring ? "monthly" : null,
      recurring_status: isRecurring ? "active" : "one_time",
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
      next_charge_date: isRecurring ? getNextChargeDate() : null,
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
      isRecurring: Boolean(isRecurring),
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
