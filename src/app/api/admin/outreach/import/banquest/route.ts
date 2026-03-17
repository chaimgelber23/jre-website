// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { parseBanquestCSV } from "@/lib/outreach/import-banquest";
import { writeContactsToSupabase } from "@/lib/outreach/run-import";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const csvText = await file.text();
    const parsed = parseBanquestCSV(csvText);

    if (parsed.contacts.length === 0) {
      return NextResponse.json({
        error: "No valid rows found in CSV. Check that the file has name/email columns.",
      }, { status: 400 });
    }

    const importResult = await writeContactsToSupabase(supabase, parsed.contacts);

    return NextResponse.json({
      success: true,
      csvStats: {
        rowsProcessed:       parsed.rowsProcessed,
        rowsSkipped:         parsed.rowsSkipped,
        totalDonationAmount: parsed.totalDonationAmount,
        donorsFound:         parsed.contacts.length,
      },
      importResult,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
