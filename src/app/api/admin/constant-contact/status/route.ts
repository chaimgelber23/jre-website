import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["cc_access_token", "cc_refresh_token", "cc_token_expires_at"]);

    if (!data || data.length === 0) {
      return NextResponse.json({ connected: false, message: "No tokens stored. Click below to authorize." });
    }

    const settings = Object.fromEntries(data.map((r) => [r.key, r.value]));
    const hasRefreshToken = !!settings.cc_refresh_token;
    const expiresAt = Number(settings.cc_token_expires_at || 0);

    if (!hasRefreshToken) {
      return NextResponse.json({ connected: false, message: "No refresh token. Click below to authorize with PKCE." });
    }

    return NextResponse.json({
      connected: true,
      expiresAt,
      hasRefreshToken: true,
      message: "Auto-refresh is active.",
    });
  } catch (err) {
    return NextResponse.json({ connected: false, message: String(err) }, { status: 500 });
  }
}
