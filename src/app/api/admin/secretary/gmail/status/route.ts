import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient } from "@/lib/secretary/gmail-client";

const SETTINGS_KEYS = ["gmail_jre_access_token", "gmail_jre_refresh_token", "gmail_jre_token_expires_at", "gmail_jre_user_email"];

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", SETTINGS_KEYS);

    if (!data || data.length === 0) {
      return NextResponse.json({ connected: false, message: "No tokens stored. Click 'Connect Gmail (Gitty)' in the dashboard." });
    }

    const s = Object.fromEntries(data.map((r) => [r.key, r.value]));
    const hasRefreshToken = !!s.gmail_jre_refresh_token;
    const expiresAt = Number(s.gmail_jre_token_expires_at || 0);
    const userEmail = s.gmail_jre_user_email || "";

    if (!hasRefreshToken) {
      return NextResponse.json({ connected: false, message: "Access token found but no refresh token. Re-authorize to get offline access." });
    }

    // Live ping — actually call Gmail API to confirm credentials work
    const client = await getGmailClient();
    if (!client) {
      return NextResponse.json({ connected: false, message: "Token in DB but getGmailClient() returned null." });
    }

    const profile = await client.gmail.users.getProfile({ userId: "me" });

    return NextResponse.json({
      connected: true,
      userEmail,
      verifiedEmail: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
      expiresAt,
      hasRefreshToken: true,
      message: "Gmail connected and working.",
    });
  } catch (err) {
    return NextResponse.json({ connected: false, message: String(err) }, { status: 500 });
  }
}
