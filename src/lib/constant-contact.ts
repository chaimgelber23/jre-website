/**
 * Constant Contact integration for JRE event registrations.
 * Automatically adds new contacts to the "Event registrants" list.
 * Tokens are stored in Supabase and auto-refreshed when expired.
 */

import { createClient } from "@supabase/supabase-js";

const CC_API_BASE = "https://api.cc.email/v3";
const CC_API_KEY = "99aae6aa-e950-4d6e-9182-8f31dc2d0abe";
const EVENT_REGISTRANTS_LIST_ID = "1d428982-a215-11ef-8ed0-fa163ecc5ca4";
const LADIES_LIST_ID = "209a8790-1df5-11e6-a66f-d4ae527536ce";
const GENERAL_LIST_ID = "2f54efd0-f55f-11e2-b111-d4ae529a8250";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Get a valid access token, auto-refreshing if expired. */
async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();

  // Read tokens from Supabase
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["cc_access_token", "cc_refresh_token", "cc_token_expires_at"]);

  if (!data || data.length === 0) return null;

  const settings = Object.fromEntries(data.map((r) => [r.key, r.value]));
  const accessToken = settings.cc_access_token;
  const refreshToken = settings.cc_refresh_token;
  const expiresAt = Number(settings.cc_token_expires_at || 0);

  // If no refresh token, fall back to env var (initial setup)
  if (!refreshToken) {
    return process.env.CONSTANT_CONTACT_ACCESS_TOKEN || null;
  }

  // If access token is still valid (with 5 min buffer), use it
  if (accessToken && expiresAt > Date.now() + 5 * 60 * 1000) {
    return accessToken;
  }

  // Token expired — refresh it
  console.log("[Constant Contact] Access token expired, refreshing...");
  try {
    const res = await fetch("https://authz.constantcontact.com/oauth2/default/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CC_API_KEY,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Constant Contact] Refresh failed:", err);
      return null;
    }

    const tokens = await res.json();
    const newExpiresAt = String(Date.now() + tokens.expires_in * 1000);

    // Store new tokens
    await supabase.from("app_settings").upsert([
      { key: "cc_access_token", value: tokens.access_token, updated_at: new Date().toISOString() },
      { key: "cc_token_expires_at", value: newExpiresAt, updated_at: new Date().toISOString() },
      // Update refresh token too if a new one was issued
      ...(tokens.refresh_token
        ? [{ key: "cc_refresh_token", value: tokens.refresh_token, updated_at: new Date().toISOString() }]
        : []),
    ]);

    console.log("[Constant Contact] Token refreshed successfully");
    return tokens.access_token;
  } catch (err) {
    console.error("[Constant Contact] Refresh error:", err);
    return null;
  }
}

/** Split "First Last" into { first_name, last_name } */
function splitName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  const first_name = parts[0];
  const last_name = parts.slice(1).join(" ");
  return { first_name, last_name };
}

/**
 * Add or update a contact in Constant Contact.
 * Uses the "create or update" endpoint — if the email exists, it adds
 * the list; if new, it creates the contact.
 */
export async function syncContactToConstantContact(contact: {
  email: string;
  name: string;
  phone?: string;
  eventTitle?: string;
  /** "womens" = add to JRE Ladies list, "mens" = add to General Interest, undefined = Event registrants only */
  eventType?: "womens" | "mens";
}): Promise<{ success: boolean; action?: string; error?: string }> {
  const token = await getAccessToken();
  if (!token) {
    console.warn("[Constant Contact] No access token available — skipping sync");
    return { success: false, error: "No access token" };
  }

  const { first_name, last_name } = splitName(contact.name);

  // Always add to Event registrants, plus gender-specific list
  const lists = [EVENT_REGISTRANTS_LIST_ID];
  if (contact.eventType === "womens") lists.push(LADIES_LIST_ID);
  else if (contact.eventType === "mens") lists.push(GENERAL_LIST_ID);

  try {
    const res = await fetch(`${CC_API_BASE}/contacts/sign_up_form`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: contact.email.toLowerCase().trim(),
        first_name,
        last_name,
        phone_number: contact.phone || undefined,
        list_memberships: lists,
        create_source: "Account",
        update_source: "Account",
      }),
    });

    if (res.status === 200 || res.status === 201) {
      const action = res.status === 200 ? "updated" : "created";
      console.log(`[Constant Contact] Contact ${action}: ${contact.email}`);
      return { success: true, action };
    }

    if (res.status === 409) {
      console.log(`[Constant Contact] Contact already on list: ${contact.email}`);
      return { success: true, action: "already_exists" };
    }

    if (res.status === 401) {
      console.error("[Constant Contact] Token invalid even after refresh — re-authorize at /admin/constant-contact");
      return { success: false, error: "Token expired — re-authorize at /admin/constant-contact" };
    }

    const errorBody = await res.text();
    console.error(`[Constant Contact] API error ${res.status}:`, errorBody);
    return { success: false, error: `API error ${res.status}: ${errorBody}` };
  } catch (err) {
    console.error("[Constant Contact] Network error:", err);
    return { success: false, error: String(err) };
  }
}
