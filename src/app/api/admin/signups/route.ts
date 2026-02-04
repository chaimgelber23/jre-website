import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    // Build query
    let query = supabase
      .from("email_signups")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by subject if provided
    if (subject && subject !== "all") {
      query = query.eq("subject", subject);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch signups" },
        { status: 500 }
      );
    }

    // Get stats
    const { data: allSignupsData } = await supabase
      .from("email_signups")
      .select("created_at, subject");

    type SignupStats = { created_at: string; subject: string | null };
    const allSignups = (allSignupsData || []) as SignupStats[];

    const now = new Date();
    const thisMonth = allSignups.filter((s) => {
      const date = new Date(s.created_at);
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    });

    const bySubject = allSignups.reduce(
      (acc, s) => {
        const subj = s.subject || "general";
        acc[subj] = (acc[subj] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      signups: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats: {
        total: allSignups?.length || 0,
        thisMonth: thisMonth?.length || 0,
        bySubject: bySubject || {},
      },
    });
  } catch (error) {
    console.error("Admin signups API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
