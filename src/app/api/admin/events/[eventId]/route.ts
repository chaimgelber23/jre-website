import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { EventRegistration, EventSponsorship, EventSponsorshipInsert } from "@/types/database";

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
    const { data: sponsorshipsData } = await supabase
      .from("event_sponsorships")
      .select("*")
      .eq("event_id", eventId)
      .order("price", { ascending: false });

    const sponsorships = (sponsorshipsData || []) as EventSponsorship[];

    // Get registrations for this event
    const { data: registrationsData } = await supabase
      .from("event_registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    const registrations = (registrationsData || []) as EventRegistration[];

    // Calculate stats - count ALL registrations regardless of payment status
    const successful = registrations.filter((r) => r.payment_status === "success");
    const failed = registrations.filter((r) => r.payment_status === "failed");
    const pending = registrations.filter((r) => r.payment_status === "pending");

    const stats = {
      totalRegistrations: registrations.length,
      totalAttendees: registrations.reduce((sum, r) => sum + r.adults + r.kids, 0),
      totalAdults: registrations.reduce((sum, r) => sum + r.adults, 0),
      totalKids: registrations.reduce((sum, r) => sum + r.kids, 0),
      totalRevenue: registrations.reduce((sum, r) => sum + Number(r.subtotal), 0),
      sponsorshipsCount: registrations.filter((r) => r.sponsorship_id).length,
      sponsorshipRevenue: registrations
        .filter((r) => r.sponsorship_id)
        .reduce((sum, r) => sum + Number(r.subtotal), 0),
      failedCount: failed.length,
      pendingCount: pending.length,
      paymentSuccessRate:
        registrations.length > 0
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const body = await request.json();
    const supabase = createServerClient();

    // Update event fields
    const allowedFields = [
      "title", "slug", "description", "date", "start_time", "end_time",
      "location", "location_url", "image_url", "price_per_adult", "kids_price", "is_active",
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0 && !body.sponsorships) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update event
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("events")
        .update(updates as never)
        .eq("id", eventId);

      if (updateError) {
        console.error("Supabase event update error:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to update event" },
          { status: 500 }
        );
      }
    }

    // Update sponsorships if provided
    if (body.sponsorships && Array.isArray(body.sponsorships)) {
      // Delete existing sponsorships that aren't in the new list
      const existingIds = body.sponsorships
        .filter((s: { id?: string }) => s.id)
        .map((s: { id: string }) => s.id);

      // Remove sponsorships not in the updated list
      if (existingIds.length > 0) {
        await supabase
          .from("event_sponsorships")
          .delete()
          .eq("event_id", eventId)
          .not("id", "in", `(${existingIds.join(",")})`);
      } else {
        // If no existing IDs, remove all old sponsorships
        await supabase
          .from("event_sponsorships")
          .delete()
          .eq("event_id", eventId);
      }

      // Upsert sponsorships
      for (const s of body.sponsorships) {
        if (s.id) {
          // Update existing
          await supabase
            .from("event_sponsorships")
            .update({ name: s.name, price: s.price, description: s.description || null } as never)
            .eq("id", s.id);
        } else {
          // Insert new
          const newSponsorship: EventSponsorshipInsert = {
            event_id: eventId,
            name: s.name,
            price: s.price,
            description: s.description || null,
          };
          await supabase
            .from("event_sponsorships")
            .insert(newSponsorship as never);
        }
      }
    }

    // Return updated event
    const { data: updatedEvent } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (error) {
    console.error("Admin update event API error:", error);
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
