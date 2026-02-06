import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { processSquarePayment } from "@/lib/square";
import { sendRegistrationConfirmation } from "@/lib/email";
import { appendEventRegistration } from "@/lib/google-sheets/event-sheets";

// Purim event details
const PURIM_EVENT = {
  title: "JRE's Next-Level Purim Experience",
  date: "2025-03-02",
  time: "6:00 PM",
  location: "Life, The Place To Be - 2 Lawrence Street, Ardsley, NY, 10502",
  pricePerAdult: 40,
  kidsPrice: 10,
  familyMax: 100,
};

interface FamilyMember {
  id: string;
  name: string;
  type: "adult" | "child";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      email,
      phone,
      spouseName,
      spouseEmail,
      spousePhone,
      additionalAdults,
      children,
      totalAdults,
      totalKids,
      sponsorship,
      sponsorshipAmount,
      paymentMethod,
      amount,
      cardName,
      paymentToken,
      message,
    } = body;

    // Validate required fields
    if (!name || !email || !phone) {
      return NextResponse.json(
        { success: false, error: "Name, email, and phone are required" },
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

    const numAdults = Number(totalAdults) || 1;
    const numKids = Number(totalKids) || 0;
    const totalAmount = Number(amount) || 0;

    // Process payment if online payment method selected
    let paymentStatus = "pending";
    let paymentReference = "";

    if (paymentMethod === "online" && totalAmount > 0) {
      if (paymentToken) {
        // Process payment via Square (secure - card data tokenized on frontend)
        const paymentResult = await processSquarePayment({
          sourceId: paymentToken,
          amount: totalAmount,
          email,
          name: cardName || name,
          description: `JRE Purim 2025 - ${name}${sponsorship ? ` (${sponsorship})` : ""}`,
        });

        if (!paymentResult.success) {
          return NextResponse.json(
            { success: false, error: paymentResult.error || "Payment failed" },
            { status: 400 }
          );
        }

        paymentStatus = "success";
        paymentReference = paymentResult.transactionId || `sq_${Date.now()}`;
      } else {
        // Payment token missing
        return NextResponse.json(
          { success: false, error: "Payment information is required for online payment" },
          { status: 400 }
        );
      }
    } else if (paymentMethod === "check") {
      paymentStatus = "pending_check";
      paymentReference = `check_${Date.now()}`;
    } else if (totalAmount === 0) {
      paymentStatus = "free";
      paymentReference = `free_${Date.now()}`;
    }

    // Generate registration ID
    const registrationId = `purim25_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Compile all attendees for the sheet
    const allAttendees: string[] = [name];
    if (spouseName) allAttendees.push(`Spouse: ${spouseName}`);
    if (additionalAdults && additionalAdults.length > 0) {
      additionalAdults.forEach((a: FamilyMember) => {
        if (a.name) allAttendees.push(`Adult: ${a.name}`);
      });
    }
    if (children && children.length > 0) {
      children.forEach((c: FamilyMember) => {
        if (c.name) allAttendees.push(`Child: ${c.name}`);
      });
    }

    // Sync to Google Sheets - Auto-creates "Purim25" tab if needed
    try {
      const rowData = [
        registrationId,
        new Date().toLocaleString(),
        name,
        email,
        phone,
        spouseName || "",
        spouseEmail || "",
        spousePhone || "",
        numAdults,
        numKids,
        allAttendees.join("; "),
        sponsorship || "None",
        sponsorshipAmount || 0,
        totalAmount,
        paymentMethod,
        paymentStatus,
        paymentReference,
        message || "",
      ];

      const sheetResult = await appendEventRegistration("Purim25", rowData);
      if (sheetResult.success) {
        console.log("Purim registration synced to Google Sheets:", registrationId);
      } else {
        console.error("Failed to sync to Google Sheets:", sheetResult.error);
      }
    } catch (sheetError) {
      console.error("Failed to sync to Google Sheets:", sheetError);
      // Don't fail the registration if sheets sync fails
    }

    // Optionally save to Supabase if you want to track in the database
    try {
      const supabase = createServerClient();

      // Check if purim_registrations table exists, if not, skip this step
      const { error: insertError } = await supabase
        .from("purim_registrations")
        .insert({
          id: registrationId,
          name,
          email,
          phone,
          spouse_name: spouseName || null,
          spouse_email: spouseEmail || null,
          spouse_phone: spousePhone || null,
          adults: numAdults,
          kids: numKids,
          all_attendees: allAttendees,
          sponsorship: sponsorship || null,
          sponsorship_amount: sponsorshipAmount || null,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          payment_reference: paymentReference,
          message: message || null,
        } as never);

      if (insertError) {
        console.log("Supabase insert skipped (table may not exist):", insertError.message);
      }
    } catch (dbError) {
      console.log("Database sync skipped:", dbError);
      // Don't fail if database table doesn't exist
    }

    // Send confirmation email
    sendRegistrationConfirmation({
      to: email,
      name,
      eventTitle: PURIM_EVENT.title,
      eventDate: "Sunday, March 2, 2025",
      eventTime: PURIM_EVENT.time,
      eventLocation: PURIM_EVENT.location,
      adults: numAdults,
      kids: numKids,
      total: totalAmount,
      sponsorship: sponsorship || undefined,
      transactionId: paymentReference,
    }).catch(console.error);

    // Send to spouse email too if provided
    if (spouseEmail && emailRegex.test(spouseEmail)) {
      sendRegistrationConfirmation({
        to: spouseEmail,
        name: spouseName || name,
        eventTitle: PURIM_EVENT.title,
        eventDate: "Sunday, March 2, 2025",
        eventTime: PURIM_EVENT.time,
        eventLocation: PURIM_EVENT.location,
        adults: numAdults,
        kids: numKids,
        total: totalAmount,
        sponsorship: sponsorship || undefined,
        transactionId: paymentReference,
      }).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      id: registrationId,
      eventTitle: PURIM_EVENT.title,
      total: totalAmount,
      adults: numAdults,
      kids: numKids,
      sponsorship,
      paymentStatus,
    });
  } catch (error) {
    console.error("Purim registration API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
