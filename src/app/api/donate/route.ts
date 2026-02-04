import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncDonationToSheets } from "@/lib/google-sheets/sync";
import type { DonationInsert } from "@/types/database";

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

    const supabase = createServerClient();

    // For now, we'll simulate payment success
    // TODO: Integrate with Banquest API for actual payment processing
    const paymentStatus = "success"; // In production, this comes from payment processor
    const paymentReference = `sim_${Date.now()}`; // Simulated reference

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

    const { data, error } = await supabase
      .from("donations")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to save donation" },
        { status: 500 }
      );
    }

    // Sync to Google Sheets (async, non-blocking)
    syncDonationToSheets(data).catch(console.error);

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
