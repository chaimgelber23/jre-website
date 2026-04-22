import { NextResponse } from "next/server";
import { getCampaignSnapshot } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const snapshot = await getCampaignSnapshot(slug);
  if (!snapshot) {
    return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, snapshot });
}
