// Organizations data layer — multi-tenant nonprofit registry.
//
// Each campaign belongs to one organization. The donate routes load the org
// (via the campaign's org_id, or by slug "jre" for the general donate page)
// and pass `org.ojc_org_api_key` into OJC charge calls.
//
// Schema: supabase/migrations/organizations.sql.

import { createServerClient } from "@/lib/supabase/server";
import { getOrgApiKeyByTaxId } from "@/lib/ojc-fund";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  tax_id: string;
  legal_name: string | null;
  ojc_org_api_key: string | null;
  ojc_verified_at: string | null;
  ojc_last_error: string | null;
  status: "pending" | "verified" | "live" | "paused" | "archived";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const JRE_DEFAULT_SLUG = "jre";

/** Load an organization by id. Used after resolving campaign.org_id. */
export async function getOrganizationById(id: string): Promise<Organization | null> {
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getOrganizationById error:", error);
    return null;
  }
  return (data as Organization) ?? null;
}

/** Load an organization by slug. Used for general donate page (slug="jre"). */
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("getOrganizationBySlug error:", error);
    return null;
  }
  return (data as Organization) ?? null;
}

/**
 * Resolve the org that owns a campaign. If campaign.org_id is null
 * (legacy / not yet backfilled), fall back to JRE.
 */
export async function getOrganizationForCampaign(
  orgId: string | null | undefined,
): Promise<Organization | null> {
  if (orgId) {
    const org = await getOrganizationById(orgId);
    if (org) return org;
  }
  return getOrganizationBySlug(JRE_DEFAULT_SLUG);
}

/**
 * Onboard a new organization by tax ID — calls OJC to fetch the org key,
 * then inserts/updates the local row. Idempotent on (tax_id).
 *
 * Returns the saved org plus a verification flag the admin UI can display.
 */
export interface OnboardOrgInput {
  name: string;
  slug: string;
  taxId: string;
  contactEmail?: string;
  contactPhone?: string;
  logoUrl?: string;
}

export interface OnboardOrgResult {
  success: boolean;
  organization?: Organization;
  ojcKeyFound?: boolean;
  error?: string;
  ojcCandidates?: unknown[]; // raw OJC response when multiple orgs match the tax id
}

export async function onboardOrganization(
  input: OnboardOrgInput,
): Promise<OnboardOrgResult> {
  const taxIdDigits = input.taxId.replace(/\D/g, "");
  if (!/^\d{9}$/.test(taxIdDigits)) {
    return { success: false, error: "Tax ID must be 9 digits (EIN format)." };
  }
  if (!input.name?.trim() || !input.slug?.trim()) {
    return { success: false, error: "Name and slug are required." };
  }

  // Step 1: ask OJC for the org's API key.
  const lookup = await getOrgApiKeyByTaxId(taxIdDigits);
  if (!lookup.success) {
    return { success: false, error: lookup.error || "OJC lookup failed." };
  }

  // OJC returns an array of org records. Try to extract the api key from the
  // first match. Field names aren't documented — we try common variants.
  const rawCandidates = lookup.organizations ?? [];
  const ojcKey = extractApiKeyFromOjcResponse(rawCandidates);

  // Step 2: upsert the org. If we got a key, mark verified.
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const insertPayload = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    tax_id: taxIdDigits,
    legal_name: input.name.trim(),
    contact_email: input.contactEmail?.trim() ?? null,
    contact_phone: input.contactPhone?.trim() ?? null,
    logo_url: input.logoUrl?.trim() ?? null,
    ojc_org_api_key: ojcKey,
    ojc_verified_at: ojcKey ? now : null,
    ojc_last_error: ojcKey ? null : "OJC lookup returned no usable API key",
    status: ojcKey ? "verified" : "pending",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organizations")
    .upsert(insertPayload, { onConflict: "tax_id" })
    .select()
    .single();

  if (error) {
    console.error("onboardOrganization upsert error:", error);
    return { success: false, error: "Could not save organization." };
  }

  return {
    success: true,
    organization: data as Organization,
    ojcKeyFound: Boolean(ojcKey),
    ojcCandidates: ojcKey ? undefined : rawCandidates,
  };
}

function extractApiKeyFromOjcResponse(rows: unknown[]): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  // Try the most likely field names OJC might use.
  const candidates = ["ApiKey", "apiKey", "OrgApiKey", "orgApiKey", "OrgId", "orgId", "ApiId"];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    for (const key of candidates) {
      const val = r[key];
      if (typeof val === "string" && val.length > 0) return val;
    }
  }
  return null;
}
