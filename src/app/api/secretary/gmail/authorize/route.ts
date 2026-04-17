/**
 * GET /api/secretary/gmail/authorize
 *
 * Redirects the admin to Google's OAuth consent screen, scoped to gmail.send
 * + gmail.readonly + gmail.modify. On consent, Google hits the callback
 * route which exchanges the code for tokens and stores them in Supabase.
 */

import { NextResponse } from "next/server";
import { buildGmailAuthUrl } from "@/lib/secretary/gmail-client";

export async function GET() {
  const url = buildGmailAuthUrl();
  return NextResponse.redirect(url);
}
