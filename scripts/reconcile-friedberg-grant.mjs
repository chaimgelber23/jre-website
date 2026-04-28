// Reconstruct the campaign_donations row for Jonah Friedberg's $36 ON FIRE
// donation that was lost to the payment_method CHECK constraint bug
// (TDF grant 126995627 cleared at TDF on 2026-04-28, but our INSERT was
// rejected because 'donors_fund' wasn't in the CHECK list).
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const CAMPAIGN_SLUG = "onfire";
const TDF_CONFIRMATION = "126995627";

const { data: existing } = await supabase
  .from("campaign_donations")
  .select("id, name, amount_cents, payment_reference")
  .eq("payment_reference", `tdf_${TDF_CONFIRMATION}`)
  .maybeSingle();
if (existing) {
  console.log("Already reconciled — row exists:", existing);
  process.exit(0);
}

const { data: campaign, error: cErr } = await supabase
  .from("campaigns")
  .select("id, title")
  .eq("slug", CAMPAIGN_SLUG)
  .single();
if (cErr || !campaign) {
  console.error("Campaign lookup failed:", cErr);
  process.exit(1);
}

const { data, error } = await supabase
  .from("campaign_donations")
  .insert({
    campaign_id: campaign.id,
    amount_cents: 3600,
    matched_cents: 0,
    name: "Jonah Friedberg",
    display_name: "Jonah Friedberg",
    email: "jonah.friedberg.tdf@unknown.thejre.org",
    is_anonymous: false,
    payment_method: "donors_fund",
    payment_status: "completed",
    payment_reference: `tdf_${TDF_CONFIRMATION}`,
    daf_sponsor: "The Donors' Fund",
    daf_grant_id: TDF_CONFIRMATION,
    admin_notes: [
      "Reconstructed from TDF confirmation #126995627 (Grant received email 2026-04-28 16:42 UTC).",
      "Original form submission lost to payment_method CHECK constraint bug (donors_fund/fidelity not in list).",
      "Schema fixed: supabase/migrations/campaign_donations_payment_method_extend.sql",
      "Donor address (from TDF): 1 Meadowbrook Lane, Monsey, NY 10952.",
      "Donor email/phone NOT shared by TDF — replace placeholder email if you find the original.",
    ].join("\n"),
  })
  .select()
  .single();

if (error) {
  console.error("Insert failed:", error);
  process.exit(1);
}
console.log("Reconciled:", {
  id: data.id,
  donor: data.name,
  amount: `$${(data.amount_cents / 100).toFixed(2)}`,
  campaign: campaign.title,
  reference: data.payment_reference,
});
