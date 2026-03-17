// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { auditGoogleSheets } from "@/lib/outreach/import-sheets";
import { writeContactsToSupabase } from "@/lib/outreach/run-import";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    const auditResult = await auditGoogleSheets();

    if (auditResult.contacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No contacts found in Google Sheets",
        tabsSummary: auditResult.tabsSummary,
        totalRows: auditResult.totalRows,
      });
    }

    const importResult = await writeContactsToSupabase(supabase, auditResult.contacts);

    return NextResponse.json({
      success: true,
      tabsSummary:   auditResult.tabsSummary,
      totalRows:     auditResult.totalRows,
      contactsFound: auditResult.contacts.length,
      importResult,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
