import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { appendEventRegistration, slugToSheetName, type EventSheetConfig, type EventRegistrationRow } from "@/lib/google-sheets/event-sheets";
// Square kept for backup - uncomment to switch processors
// import { processSquarePayment } from "@/lib/square";
import { processDirectCardPayment } from "@/lib/banquest";
import { sendRegistrationConfirmation } from "@/lib/email";
import { syncContactToConstantContact } from "@/lib/constant-contact";
import type { Event, EventSponsorship, EventRegistration, EventRegistrationInsert } from "@/types/database";

/** Convert 24-hour time (e.g. "19:30:00") to 12-hour (e.g. "7:30 PM") */
function to12Hour(time: string): string {
  if (/am|pm/i.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatEventTime(start: string | null, end: string | null): string {
  if (!start) return "See event details";
  const s = to12Hour(start);
  if (end) return `${s} - ${to12Hour(end)}`;
  return s;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    // Validate required fields
    const { adults, kids, name, email, phone, sponsorshipId, message, cardName, cardNumber, cardExpiry, cardCvv, paymentMethod, guests, promoCode } = body;

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

    // If sponsorship is selected, get sponsorship price + FMV
    let sponsorshipName: string | null = null;
    let sponsorshipPrice = 0;
    let sponsorshipFMV = 0;
    if (sponsorshipId) {
      const { data: sponsorshipData } = await supabase
        .from("event_sponsorships")
        .select("*")
        .eq("id", sponsorshipId)
        .single();

      if (sponsorshipData) {
        const sponsorship = sponsorshipData as EventSponsorship;
        sponsorshipPrice = sponsorship.price;
        sponsorshipFMV = sponsorship.fair_market_value ?? 0;
        subtotal = sponsorship.price; // Sponsorship replaces base price
        sponsorshipName = sponsorship.name;
      }
    }

    // Handle promo code — validated server-side
    const VALID_PROMO_CODES: Record<string, number> = { "0000": 0 }; // code → price override
    let promoApplied = false;
    if (promoCode && paymentMethod === "promo") {
      if (!(promoCode in VALID_PROMO_CODES)) {
        return NextResponse.json(
          { success: false, error: "Invalid promo code" },
          { status: 400 }
        );
      }
      subtotal = VALID_PROMO_CODES[promoCode];
      promoApplied = true;
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
      // Free event or promo code
      paymentStatus = "success";
      paymentReference = promoApplied ? `promo_${promoCode}_${Date.now()}` : `free_${Date.now()}`;
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

    // Check if event has sponsorship tiers (for dynamic sheet columns)
    const { count: sponsorshipCount } = await supabase
      .from("event_sponsorships")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id);

    const sheetConfig: EventSheetConfig = {
      hasKids: event.kids_price > 0,
      hasSponsorships: (sponsorshipCount ?? 0) > 0,
    };

    // Build attendees string: handles any number of guests
    let allAttendees: string;
    if (guestList.length > 0) {
      allAttendees = [
        name,
        ...guestList.map((g: { name: string; email?: string }) =>
          `${g.name}${g.email ? ` (${g.email})` : ""}`
        ),
      ].join("; ");
    } else {
      const parts = [name];
      if (numAdults > 1) parts.push(`+${numAdults - 1} adult${numAdults - 1 > 1 ? "s" : ""}`);
      if (numKids > 0) parts.push(`+${numKids} kid${numKids > 1 ? "s" : ""}`);
      allAttendees = parts.join(" ");
    }

    // FMV = what the sponsor actually receives (seats for their attendees)
    // Tax deductible = sponsorship price minus FMV
    const attendeeFMV = (numAdults * event.price_per_adult) + (numKids * event.kids_price);
    const taxDeductible = sponsorshipName ? Math.max(0, sponsorshipPrice - attendeeFMV) : undefined;

    const sheetName = slugToSheetName(slug);
    const rowData: EventRegistrationRow = {
      id: registration.id,
      timestamp: new Date().toLocaleString(),
      name,
      email,
      phone: normalizedPhone,
      adults: numAdults,
      kids: numKids,
      allAttendees,
      sponsorshipName: sponsorshipName || "",
      sponsorshipAmount: sponsorshipPrice,
      fairMarketValue: sponsorshipName ? attendeeFMV : 0,
      taxDeductible: taxDeductible ?? 0,
      total: subtotal,
      paymentMethod: promoApplied ? "promo" : (body.paymentMethod || "online"),
      paymentStatus,
      paymentReference,
      notes: promoApplied ? `PROMO CODE: ${promoCode}${message ? ` | ${message}` : ""}` : (message || ""),
    };
    // Await sheets sync before responding — fire-and-forget gets killed on Vercel serverless
    try {
      const sheetResult = await appendEventRegistration(sheetName, rowData, sheetConfig);
      if (sheetResult.success) {
        console.log(`Registration synced to Google Sheets: ${sheetName} / ${registration.id}`);
      } else {
        console.error(`Failed to sync to Google Sheets (${sheetName}):`, sheetResult.error);
      }
    } catch (sheetError) {
      console.error("Google Sheets sync error:", sheetError);
    }

    // Send confirmation email
    try {
      const emailResult = await sendRegistrationConfirmation({
        to: email,
        name,
        eventTitle: event.title,
        eventDate: (() => {
          // If description carries a |||DATES||| override (multi-session events), use it in the email
          const desc = event.description || "";
          if (desc.includes("|||DATES|||")) {
            const afterDates = desc.substring(desc.indexOf("|||DATES|||") + "|||DATES|||".length);
            const override = afterDates.split("|||EMAIL|||")[0].trim();
            if (override) return override;
          }
          const [y, m, d] = event.date.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        })(),
        eventTime: formatEventTime(event.start_time, event.end_time),
        eventLocation: event.location || "See event details",
        eventImageUrl: event.image_url || null,
        emailExtraHtml: (event.description && event.description.includes("|||EMAIL|||"))
          ? event.description.split("|||EMAIL|||").slice(1).join("|||EMAIL|||").trim()
          : null,
        adults: numAdults,
        kids: numKids,
        total: subtotal,
        sponsorship: sponsorshipName || undefined,
        fairMarketValue: sponsorshipName ? sponsorshipFMV : undefined,
        taxDeductible,
        transactionId: paymentReference,
      });
      console.log("Email send result:", JSON.stringify(emailResult));
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    // Sync contact to Constant Contact (non-blocking — don't fail registration if CC is down)
    try {
      await syncContactToConstantContact({
        email,
        name,
        phone: normalizedPhone || undefined,
        eventTitle: event.title,
        eventType: (event as Record<string, unknown>).theme_color === "womens" ? "womens" : "mens",
      });
    } catch (ccError) {
      console.error("Constant Contact sync error:", ccError);
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
