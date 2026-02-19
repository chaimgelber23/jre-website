import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { processSquarePayment } from "@/lib/square";
import { processDirectCardPayment } from "@/lib/banquest";
// KEPT FOR FALLBACK: Hosted Tokenization (has expiry encoding bug as of Feb 2026)
// import { processTokenizedPayment } from "@/lib/banquest";
import { sendRegistrationConfirmation } from "@/lib/email";
import { appendEventRegistration } from "@/lib/google-sheets/event-sheets";

// Purim event details (fallback if not in Supabase)
const PURIM_EVENT = {
  title: "JRE Purim Extravaganza",
  date: "2026-03-02",
  time: "6:00 PM",
  location: "Life, The Place To Be - 2 Lawrence Street, Ardsley, NY, 10502",
  pricePerAdult: 40,
  kidsPrice: 10,
  familyMax: 110,
};

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
      paymentProcessor,
      amount,
      cardName,
      cardNumber,
      cardExpiry,
      cardCvv,
      // KEPT FOR FALLBACK: paymentToken (for tokenized flow)
      paymentToken,
      message,
      guests,
      honoreeEmail,
    } = body;

    // Validate required fields
    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Phone is optional - normalize to empty string if not provided
    const normalizedPhone = phone?.trim() || "";

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

    // Require a valid payment method
    if (paymentMethod !== "online" && paymentMethod !== "check") {
      return NextResponse.json(
        { success: false, error: "Please select a payment method" },
        { status: 400 }
      );
    }

    // Process payment if online payment method selected
    let paymentStatus = "pending";
    let paymentReference = "";

    if (paymentMethod === "online" && totalAmount > 0) {
      // Determine which processor to use (default to Banquest - lower fees)
      const processor = paymentProcessor || "banquest";

      if (processor === "banquest") {
        // Direct card payment - matches old working site (thejre.org) pattern
        // Sends card, expiry_month, expiry_year, cvv2 as separate fields to charge API
        if (!cardNumber || !cardExpiry || !cardCvv) {
          return NextResponse.json(
            { success: false, error: "Card details are required" },
            { status: 400 }
          );
        }

        // Parse expiry: "MM/YY" or "MM/YYYY" → separate month + 4-digit year
        const expiryParts = cardExpiry.split("/");
        if (expiryParts.length < 2 || !expiryParts[0] || !expiryParts[1]) {
          return NextResponse.json(
            { success: false, error: "Invalid expiry date format. Please use MM/YY." },
            { status: 400 }
          );
        }
        const expMonth = parseInt(expiryParts[0], 10);
        let expYear = parseInt(expiryParts[1], 10);
        if (expYear < 100) {
          expYear += 2000; // Convert 2-digit to 4-digit year (e.g., 26 → 2026)
        }

        const paymentResult = await processDirectCardPayment({
          cardNumber: cardNumber.replace(/\s/g, ""),
          expiryMonth: expMonth,
          expiryYear: expYear,
          cvv: cardCvv,
          amount: totalAmount,
          cardName: cardName || name,
          email,
          description: `JRE Purim 2026 - ${name}${sponsorship ? ` (${sponsorship})` : ""}`,
        });

        if (!paymentResult.success) {
          return NextResponse.json(
            { success: false, error: paymentResult.error || "Payment failed" },
            { status: 400 }
          );
        }

        paymentStatus = "success";
        paymentReference = paymentResult.transactionId || `bq_${Date.now()}`;
      } else if (processor === "square") {
        // Process payment via Square (backup - tokenized)
        if (!paymentToken) {
          return NextResponse.json(
            { success: false, error: "Payment token is required for Square" },
            { status: 400 }
          );
        }

        const paymentResult = await processSquarePayment({
          sourceId: paymentToken,
          amount: totalAmount,
          email,
          name: cardName || name,
          description: `JRE Purim 2026 - ${name}${sponsorship ? ` (${sponsorship})` : ""}`,
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
        return NextResponse.json(
          { success: false, error: "Invalid payment processor" },
          { status: 400 }
        );
      }

      /* KEPT FOR FALLBACK: Banquest Hosted Tokenization (has expiry encoding bug)
      if (processor === "banquest") {
        const nameParts = (cardName || name).trim().split(" ");
        const paymentResult = await processTokenizedPayment({
          paymentToken,
          amount: totalAmount,
          email,
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || "",
          description: `JRE Purim 2026 - ${name}${sponsorship ? ` (${sponsorship})` : ""}`,
        });
        // ...
      }
      */
    } else if (paymentMethod === "check") {
      paymentStatus = "pending_check";
      paymentReference = `check_${Date.now()}`;
    } else if (totalAmount === 0) {
      paymentStatus = "free";
      paymentReference = `free_${Date.now()}`;
    }

    // Encode guests + message together for storage
    // Format: JSON with { text, guests } when guests exist, plain text otherwise
    const guestList = (guests && Array.isArray(guests))
      ? guests.filter((g: { name: string; email?: string }) => g.name?.trim())
      : [];
    const encodedMessage = guestList.length > 0
      ? JSON.stringify({ text: message || "", guests: guestList })
      : (message || null);

    // Generate registration ID
    const registrationId = `purim26_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Compile all attendees for the sheet
    const allAttendees: string[] = [name];
    if (spouseName) allAttendees.push(`Spouse: ${spouseName}`);
    if (additionalAdults && Array.isArray(additionalAdults)) {
      additionalAdults.forEach((a: { name: string }) => {
        if (a.name) allAttendees.push(`Adult: ${a.name}`);
      });
    }
    if (children && Array.isArray(children)) {
      children.forEach((c: { name: string }) => {
        if (c.name) allAttendees.push(`Child: ${c.name}`);
      });
    }
    if (guests && Array.isArray(guests)) {
      guests.forEach((g: { name: string; email?: string }) => {
        if (g.name) allAttendees.push(`Guest: ${g.name}${g.email ? ` (${g.email})` : ""}`);
      });
    }

    const supabase = createServerClient();

    // Save to event_registrations (admin-visible) by looking up event in Supabase
    try {
      const { data: eventData } = await supabase
        .from("events")
        .select("id")
        .eq("slug", "purim-2026")
        .single();

      const event = eventData as { id: string } | null;

      if (event) {
        const { error: insertError } = await supabase
          .from("event_registrations")
          .insert({
            event_id: event.id,
            name,
            email,
            phone: normalizedPhone || null,
            adults: numAdults,
            kids: numKids,
            sponsorship_id: null, // Standalone page uses sponsorship name, not ID
            message: encodedMessage,
            subtotal: totalAmount,
            payment_status: paymentStatus,
            payment_reference: paymentReference,
          } as never);

        if (!insertError) {
          console.log("Purim 2026 registration saved to event_registrations:", registrationId);
        } else {
          console.error("Failed to save to event_registrations:", insertError.message);
        }
      } else {
        console.error("Purim 2026 event not found in Supabase - registration not saved to DB!");
      }
    } catch (err) {
      console.error("Failed to save registration to Supabase:", err);
    }

    // Sync to Google Sheets - Auto-creates "Purim26" tab if needed
    try {
      const rowData = [
        registrationId,
        new Date().toLocaleString(),
        name,
        email,
        normalizedPhone,
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

      const sheetResult = await appendEventRegistration("Purim26", rowData);
      if (sheetResult.success) {
        console.log("Purim 2026 registration synced to Google Sheets:", registrationId);
      } else {
        console.error("Failed to sync to Google Sheets:", sheetResult.error);
      }
    } catch (sheetError) {
      console.error("Failed to sync to Google Sheets:", sheetError);
      // Don't fail the registration if sheets sync fails
    }

    // Send confirmation emails (awaited so errors are logged before response)
    try {
      const emailResult = await sendRegistrationConfirmation({
        to: email,
        name,
        eventTitle: PURIM_EVENT.title,
        eventDate: "Monday, March 2, 2026",
        eventTime: PURIM_EVENT.time,
        eventLocation: PURIM_EVENT.location,
        adults: numAdults,
        kids: numKids,
        total: totalAmount,
        sponsorship: sponsorship || undefined,
        transactionId: paymentReference,
      });
      console.log("Email send result:", JSON.stringify(emailResult));

      // Send to spouse email too if provided
      if (spouseEmail && emailRegex.test(spouseEmail)) {
        const spouseResult = await sendRegistrationConfirmation({
          to: spouseEmail,
          name: spouseName || name,
          eventTitle: PURIM_EVENT.title,
          eventDate: "Monday, March 2, 2026",
          eventTime: PURIM_EVENT.time,
          eventLocation: PURIM_EVENT.location,
          adults: numAdults,
          kids: numKids,
          total: totalAmount,
          sponsorship: sponsorship || undefined,
          transactionId: paymentReference,
        });
        console.log("Spouse email result:", JSON.stringify(spouseResult));
      }

      // Send to honoree email if provided
      if (honoreeEmail && emailRegex.test(honoreeEmail)) {
        const honoreeResult = await sendRegistrationConfirmation({
          to: honoreeEmail,
          name,
          eventTitle: PURIM_EVENT.title,
          eventDate: "Monday, March 2, 2026",
          eventTime: PURIM_EVENT.time,
          eventLocation: PURIM_EVENT.location,
          adults: numAdults,
          kids: numKids,
          total: totalAmount,
          sponsorship: sponsorship || undefined,
          transactionId: paymentReference,
        });
        console.log("Honoree email result:", JSON.stringify(honoreeResult));
      }
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the registration if email fails
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
