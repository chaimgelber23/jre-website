import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const supabase = createServerClient();

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 }
      );
    }

    // Get sponsorships for this event
    const { data: sponsorships } = await supabase
      .from("event_sponsorships")
      .select("*")
      .eq("event_id", eventId)
      .order("price", { ascending: false });

    // Get registrations for this event
    const { data: registrations } = await supabase
      .from("event_registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    // Calculate stats
    const successful = registrations?.filter((r) => r.payment_status === "success") || [];
    const failed = registrations?.filter((r) => r.payment_status === "failed") || [];
    const pending = registrations?.filter((r) => r.payment_status === "pending") || [];

    const stats = {
      totalRegistrations: successful.length,
      totalAttendees: successful.reduce((sum, r) => sum + r.adults + r.kids, 0),
      totalAdults: successful.reduce((sum, r) => sum + r.adults, 0),
      totalKids: successful.reduce((sum, r) => sum + r.kids, 0),
      totalRevenue: successful.reduce((sum, r) => sum + Number(r.subtotal), 0),
      sponsorshipsCount: successful.filter((r) => r.sponsorship_id).length,
      sponsorshipRevenue: successful
        .filter((r) => r.sponsorship_id)
        .reduce((sum, r) => sum + Number(r.subtotal), 0),
      failedCount: failed.length,
      pendingCount: pending.length,
      paymentSuccessRate:
        registrations && registrations.length > 0
          ? Math.round((successful.length / registrations.length) * 100)
          : 0,
    };

    // Map sponsorship names to registrations
    const registrationsWithSponsorships = registrations?.map((r) => {
      const sponsorship = sponsorships?.find((s) => s.id === r.sponsorship_id);
      return {
        ...r,
        sponsorship_name: sponsorship?.name || null,
      };
    });

    return NextResponse.json({
      success: true,
      event,
      sponsorships: sponsorships || [],
      registrations: registrationsWithSponsorships || [],
      stats,
    });
  } catch (error) {
    console.error("Admin event detail API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const supabase = createServerClient();

    // Delete event (cascades to sponsorships and registrations)
    const { error } = await supabase.from("events").delete().eq("id", eventId);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete event API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
