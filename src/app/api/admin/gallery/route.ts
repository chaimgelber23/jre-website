import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("gallery_photos")
      .select("category")
      .eq("is_active", true);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const photos = data || [];

    // Count per category
    const categoryCounts: Record<string, number> = {};
    for (const photo of photos) {
      const cat = (photo as { category: string }).category;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const categories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      stats: {
        totalPhotos: photos.length,
        categories,
      },
    });
  } catch (error) {
    console.error("Admin gallery stats error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** Trigger gallery sync from the admin panel (server-side, so CRON_SECRET is available) */
export async function POST(request: NextRequest) {
  try {
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const cronUrl = `${protocol}://${host}/api/cron/sync-gallery`;

    const res = await fetch(cronUrl, {
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
      },
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Admin gallery sync error:", error);
    return NextResponse.json(
      { success: false, error: "Sync failed" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = createServerClient();

    const { error } = await supabase
      .from("gallery_photos")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin gallery clear error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
