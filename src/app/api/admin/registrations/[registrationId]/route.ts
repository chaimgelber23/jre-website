import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import type { Database, EventRegistration } from "@/types/database";

type EventRegistrationUpdate =
  Database["public"]["Tables"]["event_registrations"]["Update"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const { registrationId } = await params;
    const supabase = createServerClient();

    // Get registration
    const { data: registration, error: regError } = await supabase
      .from("event_registrations")
      .select("*")
      .eq("id", registrationId)
      .single();

    if (regError || !registration) {
      return NextResponse.json(
        { success: false, error: "Registration not found" },
        { status: 404 }
      );
    }

    const reg = registration as EventRegistration;

    // Get event details
    const { data: event } = await supabase
      .from("events")
      .select("*")
      .eq("id", reg.event_id)
      .single();

    // Get sponsorship name if applicable
    let sponsorshipName: string | null = null;
    if (reg.sponsorship_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sponsorship } = await (supabase
        .from("event_sponsorships") as any)
        .select("*")
        .eq("id", reg.sponsorship_id)
        .single();

      if (sponsorship) {
        sponsorshipName = sponsorship.name;
      }
    }

    return NextResponse.json({
      success: true,
      registration: {
        ...reg,
        sponsorship_name: sponsorshipName,
      },
      event: event || null,
    });
  } catch (error) {
    console.error("Admin registration detail API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const { registrationId } = await params;
    const body = await request.json();
    const supabase = createServerClient();

    // Only allow updating specific fields
    const allowedFields = [
      "name",
      "email",
      "phone",
      "adults",
      "kids",
      "sponsorship_id",
      "message",
      "subtotal",
      "payment_status",
    ];

    const updates: Partial<Record<string, unknown>> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase
      .from("event_registrations") as any)
      .update(updates)
      .eq("id", registrationId)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to update registration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, registration: data });
  } catch (error) {
    console.error("Admin update registration API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const { registrationId } = await params;
    const supabase = createServerClient();

    const { error } = await supabase
      .from("event_registrations")
      .delete()
      .eq("id", registrationId);

    if (error) {
      console.error("Supabase delete error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete registration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete registration API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
