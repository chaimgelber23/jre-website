import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [campaignsRes, progressRes] = await Promise.all([
    db.from("campaigns").select("*").order("created_at", { ascending: false }),
    db.from("campaign_progress").select("*"),
  ]);

  return NextResponse.json({
    success: true,
    campaigns: campaignsRes.data ?? [],
    progress: progressRes.data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Safety net: every campaign must have an org_id. If caller didn't set one,
  // default to JRE so legacy / programmatic inserts keep working.
  if (!body.org_id) {
    const { data: jre } = await db
      .from("organizations")
      .select("id")
      .eq("slug", "jre")
      .maybeSingle();
    if (jre?.id) {
      body.org_id = jre.id;
    }
  }

  // Auto-populate tax fields from the owning org so non-JRE campaigns don't
  // accidentally show "JRE EIN 20-8978145" on their public page or receipt.
  if (body.org_id && (!body.tax_id || !body.tax_deductible_note)) {
    const { data: org } = await db
      .from("organizations")
      .select("name, legal_name, tax_id")
      .eq("id", body.org_id)
      .maybeSingle();
    if (org) {
      const displayName: string = (org as { legal_name?: string | null; name?: string }).legal_name
        || (org as { name?: string }).name
        || "this organization";
      const ein: string | undefined = (org as { tax_id?: string }).tax_id;
      const formattedEin = ein && /^\d{9}$/.test(ein) ? `${ein.slice(0, 2)}-${ein.slice(2)}` : ein;
      if (!body.tax_id && formattedEin) {
        body.tax_id = `501(c)(3) nonprofit, EIN ${formattedEin}`;
      }
      if (!body.tax_deductible_note) {
        body.tax_deductible_note = `${displayName} is a registered 501(c)(3) nonprofit. All donations are tax-deductible to the fullest extent permitted by law.`;
      }
    }
  }

  const { data, error } = await db.from("campaigns").insert(body).select().single();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, campaign: data });
}
