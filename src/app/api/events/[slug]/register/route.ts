import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { appendEventRegistration, slugToSheetName } from "@/lib/google-sheets/event-sheets";
// Square kept for backup - uncomment to switch processors
// import { processSquarePayment } from "@/lib/square";
import { processDirectCardPayment } from "@/lib/banquest";
import { sendRegistrationConfirmation } from "@/lib/email";
import type { Event, EventSponsorship, EventRegistration, EventRegistrationInsert } from "@/types/database";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    // Validate required fields
    const { adults, kids, name, email, phone, sponsorshipId, message, cardName, cardNumber, cardExpiry, cardCvv, paymentMethod, guests } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Name and email are required." },
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

    const numAdults = Number(adults) || 1;
    const numKids = Number(kids) || 0;

    if (numAdults < 1) {
      return NextResponse.json(
        { success: false, error: "At least 1 adult is required" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Get the event by slug
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("slug", slug)
      .single();

    if (eventError || !eventData) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    const event = eventData as Event;

    // Calculate subtotal
    let subtotal = numAdults * event.price_per_adult + numKids * event.kids_price;

    // If sponsorship is selected, get sponsorship price
    let sponsorshipName: string | null = null;
    let sponsorshipPrice = 0;
    if (sponsorshipId) {
      const { data: sponsorshipData } = await supabase
        .from("event_sponsorships")
        .select("*")
        .eq("id", sponsorshipId)
        .single();

      if (sponsorshipData) {
        const sponsorship = sponsorshipData as EventSponsorship;
        sponsorshipPrice = sponsorship.price;
        subtotal = sponsorship.price; // Sponsorship replaces base price
        sponsorshipName = sponsorship.name;
      }
    }

    // Process payment
    let paymentStatus = "pending";
    let paymentReference = "";

    if (subtotal > 0 && paymentMethod === "online") {
      // Validate card fields
      if (!cardNumber || !cardExpiry || !cardCvv) {
        return NextResponse.json(
          { success: false, error: "Card details are required for online payment" },
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
        expYear += 2000;
      }

      const paymentResult = await processDirectCardPayment({
        cardNumber: cardNumber.replace(/\s/g, ""),
        expiryMonth: expMonth,
        expiryYear: expYear,
        cvv: cardCvv,
        amount: subtotal,
        cardName: cardName || name,
        email,
        description: `JRE Event Registration - ${event.title}${sponsorshipName ? ` (${sponsorshipName})` : ""}`,
      });

      if (!paymentResult.success) {
        return NextResponse.json(
          { success: false, error: paymentResult.error || "Payment failed" },
          { status: 400 }
        );
      }

      paymentStatus = "success";
      paymentReference = paymentResult.transactionId || `bq_${Date.now()}`;
    } else if (subtotal === 0) {
      // Free event
      paymentStatus = "success";
      paymentReference = `free_${Date.now()}`;
    } else if (paymentMethod === "check") {
      // Check payment - pending until check received
      paymentStatus = "pending";
      paymentReference = `check_${Date.now()}`;
    } else {
      // No payment info provided
      paymentStatus = "pending";
      paymentReference = `pending_${Date.now()}`;
    }

    // Encode guests + message together for storage
    // Format: JSON with { text, guests } when guests exist, plain text otherwise
    const guestList = (guests && Array.isArray(guests))
      ? guests.filter((g: { name: string; email?: string }) => g.name?.trim())
      : [];
    const encodedMessage = guestList.length > 0
      ? JSON.stringify({ text: message || "", guests: guestList })
      : (message || null);

    // Insert registration into Supabase
    const insertData: EventRegistrationInsert = {
      event_id: event.id,
      name,
      email,
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      adults: numAdults,
      kids: numKids,
      sponsorship_id: sponsorshipId || null,
      message: encodedMessage,
      subtotal,
      payment_status: paymentStatus,
      payment_reference: paymentReference,
    };

    const { data: registrationData, error: insertError } = await supabase
      .from("event_registrations")
      .insert(insertData as never)
      .select()
      .single();

    if (insertError || !registrationData) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to save registration" },
        { status: 500 }
      );
    }

    const registration = registrationData as EventRegistration;

    // Sync to Google Sheets - each event gets its own tab (e.g., "Chanukah25", "ScotchSteak26")
    const sheetName = slugToSheetName(slug);
    const rowData = [
      registration.id,
      new Date().toLocaleString(),
      name,
      email,
      normalizedPhone,
      "", // Spouse Name
      "", // Spouse Email
      "", // Spouse Phone
      numAdults,
      numKids,
      guestList.length > 0
        ? `${name}; ${guestList.map((g: { name: string; email?: string }) => `${g.name}${g.email ? ` (${g.email})` : ""}`).join("; ")}`
        : `${name}${numAdults > 1 ? ` + ${numAdults - 1} adults` : ""}${numKids > 0 ? ` + ${numKids} kids` : ""}`,
      sponsorshipName || "None",
      sponsorshipPrice > 0 ? sponsorshipPrice : 0,
      subtotal,
      body.paymentMethod || "online",
      paymentStatus,
      paymentReference,
      message || "",
    ];
    appendEventRegistration(sheetName, rowData).catch(console.error);

    // Send confirmation email
    try {
      const emailResult = await sendRegistrationConfirmation({
        to: email,
        name,
        eventTitle: event.title,
        eventDate: new Date(event.date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        eventTime: event.start_time || "See event details",
        eventLocation: event.location || "See event details",
        adults: numAdults,
        kids: numKids,
        total: subtotal,
        sponsorship: sponsorshipName || undefined,
        transactionId: paymentReference,
      });
      console.log("Email send result:", JSON.stringify(emailResult));
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    return NextResponse.json({
      success: true,
      id: registration.id,
      eventTitle: event.title,
      eventDate: event.date,
      total: subtotal,
      adults: numAdults,
      kids: numKids,
      sponsorship: sponsorshipName,
      paymentStatus: registration.payment_status,
    });
  } catch (error) {
    console.error("Event registration API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
