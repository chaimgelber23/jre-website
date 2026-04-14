import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CC_API_KEY = "99aae6aa-e950-4d6e-9182-8f31dc2d0abe";

/**
 * OAuth callback for Constant Contact PKCE flow.
 * Exchanges the auth code for access + refresh tokens,
 * stores them in Supabase, and redirects to admin page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const codeVerifier = searchParams.get("state"); // We pass verifier in state for simplicity

  if (!code || !codeVerifier) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/admin/constant-contact/callback`;

  try {
    // Exchange code for tokens using PKCE (no client secret needed)
    const tokenRes = await fetch("https://authz.constantcontact.com/oauth2/default/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: CC_API_KEY,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[CC OAuth] Token exchange failed:", err);
      return NextResponse.redirect(
        `${origin}/admin/constant-contact?error=${encodeURIComponent("Token exchange failed: " + err)}`
      );
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokens;
    const expiresAt = String(Date.now() + expires_in * 1000);

    // Store tokens in Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from("app_settings").upsert([
      { key: "cc_access_token", value: access_token, updated_at: new Date().toISOString() },
      { key: "cc_refresh_token", value: refresh_token, updated_at: new Date().toISOString() },
      { key: "cc_token_expires_at", value: expiresAt, updated_at: new Date().toISOString() },
    ]);

    console.log("[CC OAuth] Tokens stored successfully. Refresh token acquired — auto-refresh enabled.");

    return NextResponse.redirect(`${origin}/admin/constant-contact?success=true`);
  } catch (err) {
    console.error("[CC OAuth] Error:", err);
    return NextResponse.redirect(
      `${origin}/admin/constant-contact?error=${encodeURIComponent(String(err))}`
    );
  }
}
