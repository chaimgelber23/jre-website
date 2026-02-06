import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncDonationToSheets } from "@/lib/google-sheets/sync";
import { processPayment } from "@/lib/banquest";
import { sendDonationConfirmation, sendHonoreeNotification } from "@/lib/email";
import type { Donation, DonationInsert } from "@/types/database";

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
      paymentToken,
      cardName,
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

    // Process payment with Banquest
    let paymentStatus = "pending";
    let paymentReference = "";

    if (paymentToken) {
      // Process tokenized payment (secure - card data never touches our server)
      const paymentResult = await processPayment({
        amount: numericAmount,
        paymentToken,
        cardName,
        email,
        description: sponsorship
          ? `JRE Donation - ${sponsorship}`
          : `JRE Donation${isRecurring ? " (Monthly)" : ""}`,
      });

      if (!paymentResult.success) {
        return NextResponse.json(
          { success: false, error: paymentResult.error || "Payment failed" },
          { status: 400 }
        );
      }

      paymentStatus = "success";
      paymentReference = paymentResult.transactionId || `txn_${Date.now()}`;
    } else {
      // No payment token provided
      return NextResponse.json(
        { success: false, error: "Payment information is required" },
        { status: 400 }
      );
    }

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
