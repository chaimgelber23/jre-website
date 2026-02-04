import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year");
    const status = searchParams.get("status");
    const recurring = searchParams.get("recurring");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    // Build query
    let query = supabase
      .from("donations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by year if provided
    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte("created_at", startDate).lte("created_at", endDate);
    }

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("payment_status", status);
    }

    // Filter by recurring if provided
    if (recurring === "true") {
      query = query.eq("is_recurring", true);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch donations" },
        { status: 500 }
      );
    }

    // Get all donations for stats
    const { data: allDonations } = await supabase
      .from("donations")
      .select("amount, payment_status, is_recurring, created_at");

    // Calculate stats
    const successful = allDonations?.filter((d) => d.payment_status === "success") || [];
    const failed = allDonations?.filter((d) => d.payment_status === "failed") || [];
    const recurringDonations = successful.filter((d) => d.is_recurring);

    const totalAmount = successful.reduce((sum, d) => sum + Number(d.amount), 0);
    const recurringTotal = recurringDonations.reduce((sum, d) => sum + Number(d.amount), 0);

    // Yearly totals
    const yearlyTotals = successful.reduce(
      (acc, d) => {
        const y = new Date(d.created_at).getFullYear();
        acc[y] = (acc[y] || 0) + Number(d.amount);
        return acc;
      },
      {} as Record<number, number>
    );

    // Get available years
    const availableYears = [
      ...new Set(allDonations?.map((d) => new Date(d.created_at).getFullYear())),
    ].sort((a, b) => b - a);

    return NextResponse.json({
      success: true,
      donations: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats: {
        totalAmount,
        successfulCount: successful.length,
        failedCount: failed.length,
        recurringCount: recurringDonations.length,
        recurringTotal,
        yearlyTotals,
      },
      availableYears,
    });
  } catch (error) {
    console.error("Admin donations API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
