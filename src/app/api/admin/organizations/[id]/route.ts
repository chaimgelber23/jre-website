import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getOrgApiKeyByTaxId } from "@/lib/ojc-fund";

export const maxDuration = 25;

// PATCH — update org fields. If taxId changes, re-run OJC lookup.
// Also accepts an explicit ojcOrgApiKey override (admin paste from OJC email).
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let body: {
    name?: string;
    slug?: string;
    taxId?: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    logoUrl?: string | null;
    ojcOrgApiKey?: string;
    status?: "pending" | "verified" | "live" | "paused" | "archived";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const supabase = createServerClient();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.slug !== undefined) updates.slug = body.slug.trim().toLowerCase();
  if (body.contactEmail !== undefined) updates.contact_email = body.contactEmail;
  if (body.contactPhone !== undefined) updates.contact_phone = body.contactPhone;
  if (body.logoUrl !== undefined) updates.logo_url = body.logoUrl;
  if (body.status !== undefined) updates.status = body.status;

  // Manual OJC key override — admin pastes the key from OJC's email.
  if (body.ojcOrgApiKey !== undefined && body.ojcOrgApiKey.trim()) {
    updates.ojc_org_api_key = body.ojcOrgApiKey.trim();
    updates.ojc_verified_at = new Date().toISOString();
    updates.ojc_last_error = null;
    if (!body.status) updates.status = "verified";
  }

  // Tax ID change — re-look up via OJC.
  if (body.taxId !== undefined) {
    const taxIdDigits = body.taxId.replace(/\D/g, "");
    if (!/^\d{9}$/.test(taxIdDigits)) {
      return NextResponse.json(
        { success: false, error: "Tax ID must be 9 digits (EIN format)." },
        { status: 400 },
      );
    }
    updates.tax_id = taxIdDigits;

    // Only re-fetch if admin didn't also paste a key manually in the same request.
    if (body.ojcOrgApiKey === undefined) {
      const lookup = await getOrgApiKeyByTaxId(taxIdDigits);
      if (lookup.success && Array.isArray(lookup.organizations) && lookup.organizations.length) {
        // Best-effort extraction — same logic as onboardOrganization helper.
        const rows = lookup.organizations;
        const candidates = ["ApiKey", "apiKey", "OrgApiKey", "orgApiKey", "OrgId", "orgId", "ApiId"];
        let found: string | null = null;
        for (const row of rows) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, unknown>;
          for (const key of candidates) {
            const val = r[key];
            if (typeof val === "string" && val.length > 0) {
              found = val;
              break;
            }
          }
          if (found) break;
        }
        if (found) {
          updates.ojc_org_api_key = found;
          updates.ojc_verified_at = new Date().toISOString();
          updates.ojc_last_error = null;
        }
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organizations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("admin/organizations PATCH error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    organization: { ...data, ojc_org_api_key: undefined, has_ojc_key: Boolean(data.ojc_org_api_key) },
  });
}

// DELETE — soft-archive an org (sets status="archived"). Hard delete requires
// removing campaigns first because of the FK ON DELETE RESTRICT.
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("organizations")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
