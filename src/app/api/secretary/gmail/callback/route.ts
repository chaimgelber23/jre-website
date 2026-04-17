/**
 * GET /api/secretary/gmail/callback
 *
 * OAuth2 redirect target. Google sends ?code=... after consent. We exchange
 * for a refresh token and pin the authenticated account email.
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/secretary/gmail-client";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(new URL(`/admin/secretary?gmail_error=${encodeURIComponent(err)}`, req.url));
  }
  if (!code) {
    return NextResponse.json({ error: "missing code" }, { status: 400 });
  }
  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(new URL("/admin/secretary?gmail=connected", req.url));
  } catch (e) {
    console.error("[gmail/callback] exchange failed:", e);
    return NextResponse.json(
      { error: "token exchange failed", detail: String(e).slice(0, 300) },
      { status: 500 }
    );
  }
}
