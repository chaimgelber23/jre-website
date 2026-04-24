import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getCampaignSnapshot } from "@/lib/campaign";

// Edge serves stale-then-revalidate via Next's data cache: every viewer's
// 20s poll collapses to ~one Supabase fan-out per `revalidate` window per
// region. With 500 concurrent viewers this drops DB load from ~1500 req/min
// to <10 req/min while the live counter stays within ~10s of truth.
const CACHE_REVALIDATE_SECONDS = 10;

const getCachedSnapshot = unstable_cache(
  async (slug: string) => getCampaignSnapshot(slug),
  ["campaign-progress-snapshot"],
  { revalidate: CACHE_REVALIDATE_SECONDS, tags: ["campaign-progress"] }
);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const snapshot = await getCachedSnapshot(slug);
  if (!snapshot) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json(
    { success: true, snapshot },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_REVALIDATE_SECONDS}, stale-while-revalidate=30`,
      },
    }
  );
}
