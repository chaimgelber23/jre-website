import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { syncContactToSheets } from "@/lib/google-sheets/sync";
import type { EmailSignup, EmailSignupInsert } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: "Name, email, and message are required" },
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

    const supabase = createServerClient();

    // Insert into Supabase
    const insertData: EmailSignupInsert = {
      name,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
      source: "contact_form",
    };

    const { data: insertedData, error } = await supabase
      .from("email_signups")
      .insert(insertData as never)
      .select()
      .single();

    if (error || !insertedData) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to save contact submission" },
        { status: 500 }
      );
    }

    const data = insertedData as EmailSignup;

    // Sync to Google Sheets (async, non-blocking)
    syncContactToSheets(data).catch(console.error);

    return NextResponse.json({
      success: true,
      id: data.id,
    });
  } catch (error) {
    console.error("Contact API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
