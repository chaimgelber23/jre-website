import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { onboardOrganization } from "@/lib/organizations";

export const maxDuration = 25;

// GET — list all organizations (admin view, includes ojc key existence flag only)
export async function GET() {
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("organizations")
    .select(
      "id, name, slug, legal_name, tax_id, contact_email, contact_phone, logo_url, status, ojc_verified_at, ojc_last_error, created_at, updated_at, ojc_org_api_key",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("admin/organizations GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Hide the raw OJC key from the response — just expose a boolean.
  const sanitized = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    ojc_org_api_key: undefined,
    has_ojc_key: typeof row.ojc_org_api_key === "string" && (row.ojc_org_api_key as string).length > 0,
  }));

  return NextResponse.json({ success: true, organizations: sanitized });
}

// POST — onboard a new organization by tax ID (calls OJC lookup, saves key)
export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    slug?: string;
    taxId?: string;
    contactEmail?: string;
    contactPhone?: string;
    logoUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.name || !body.slug || !body.taxId) {
    return NextResponse.json(
      { success: false, error: "name, slug, and taxId are required." },
      { status: 400 },
    );
  }

  const result = await onboardOrganization({
    name: body.name,
    slug: body.slug,
    taxId: body.taxId,
    contactEmail: body.contactEmail,
    contactPhone: body.contactPhone,
    logoUrl: body.logoUrl,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  // Strip the raw key from the response — UI just needs to know it's saved.
  const org = result.organization;
  return NextResponse.json({
    success: true,
    ojcKeyFound: result.ojcKeyFound,
    ojcCandidates: result.ojcCandidates,
    organization: org
      ? {
          ...org,
          ojc_org_api_key: undefined,
          has_ojc_key: Boolean(org.ojc_org_api_key),
        }
      : null,
  });
}
