#!/usr/bin/env node
// Seed the JRE June 7–9, 2026 campaign.
// Usage: node scripts/seed-jre-june-campaign.mjs
// Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

const SLUG = "jre-june-2026";

async function main() {
  // -- Campaign ---------------------------------------------------------------
  const startAt = new Date("2026-06-07T09:00:00-04:00").toISOString(); // Sun 9 AM ET
  const endAt   = new Date("2026-06-09T21:00:00-04:00").toISOString(); // Tue 9 PM ET

  const campaignRow = {
    slug: SLUG,
    title: "Give JRE. Grow Westchester.",
    tagline: "36 hours. One community. Powering Torah, connection, and growth.",
    hero_image_url: null,
    video_url: null,
    goal_cents: 25_000_000, // $250,000 — placeholder
    currency: "USD",
    start_at: startAt,
    end_at: endAt,
    status: "scheduled",
    tax_id: "501(c)(3) EIN 20-8978145",
    tax_deductible_note: "JRE is a 501(c)(3) nonprofit. All donations are tax-deductible to the fullest extent permitted by law.",
    allow_anonymous: true,
    allow_dedication: true,
    allow_team: true,
    allow_recurring: false,
    share_text: "I just gave to JRE's June campaign. Join me — every dollar goes further during the match window.",
    story_md: [
      "For years, JRE has been the open door to Judaism for hundreds of families across Westchester — no barrier to entry, no judgment, just warmth, learning, and community.",
      "",
      "From our Tuesday morning Chumash classes to Friday night dinners that stretch past midnight, from Shabbatons that change lives to the weekly Mishmar — every program exists because of donors like you.",
      "",
      "This June 7–9, we're running a 36-hour campaign to power the next year of Torah, connection, and growth. Your gift — at every level — makes a real difference.",
    ].join("\n"),
    faq: [
      { q: "Is my donation tax-deductible?", a: "Yes. JRE is a registered 501(c)(3) nonprofit. You will receive a receipt by email immediately after your gift." },
      { q: "Can I give from my Donor-Advised Fund (DAF)?", a: "Absolutely. Choose 'Donor-Advised Fund' at checkout and we will email you prefilled grant instructions for your DAF sponsor." },
      { q: "Can I give from my OJC Fund account?", a: "Yes. Select 'OJC Fund' at checkout — we will email you a prefilled grant request link for JRE." },
      { q: "Can I dedicate my gift?", a: "Yes. At checkout you can dedicate your gift in honor of or in memory of a loved one, and optionally notify them by email." },
      { q: "Is my card information secure?", a: "Yes. All card payments are processed through Banquest, a PCI-DSS compliant payment processor. We never store your card details on our servers." },
    ],
    is_active: true,
  };

  const { data: existing } = await supabase.from("campaigns").select("id").eq("slug", SLUG).maybeSingle();

  let campaignId;
  if (existing?.id) {
    campaignId = existing.id;
    await supabase.from("campaigns").update(campaignRow).eq("id", campaignId);
    console.log(`Updated campaign ${SLUG} (${campaignId})`);
  } else {
    const { data, error } = await supabase.from("campaigns").insert(campaignRow).select("id").single();
    if (error) throw error;
    campaignId = data.id;
    console.log(`Created campaign ${SLUG} (${campaignId})`);
  }

  // -- Wipe + reseed sub-collections (idempotent) -----------------------------
  await supabase.from("campaign_tiers").delete().eq("campaign_id", campaignId);
  await supabase.from("campaign_causes").delete().eq("campaign_id", campaignId);
  await supabase.from("campaign_teams").delete().eq("campaign_id", campaignId);

  // Causes: Donor Fund vs OJC Fund
  await supabase.from("campaign_causes").insert([
    {
      campaign_id: campaignId,
      slug: "donor-fund",
      name: "Donor Fund",
      description: "Support JRE's general operating fund — classes, events, outreach.",
      sort_order: 0,
    },
    {
      campaign_id: campaignId,
      slug: "ojc-fund",
      name: "OJC Fund",
      description: "Earmark your gift for the Oratz Jewish Connection Fund programs.",
      sort_order: 1,
    },
  ]);

  // Tiers — classic Jewish giving amounts (multiples of chai)
  await supabase.from("campaign_tiers").insert([
    { campaign_id: campaignId, amount_cents: 1_800,    label: "Friend",     description: "Chai — every gift matters.", hebrew_value: "חי", sort_order: 0 },
    { campaign_id: campaignId, amount_cents: 3_600,    label: "Supporter",  description: "Double chai — join hundreds of monthly supporters.", hebrew_value: "לו", sort_order: 1 },
    { campaign_id: campaignId, amount_cents: 18_000,   label: "Partner",    description: "Sponsor a Friday night dinner for 40 guests.", hebrew_value: "", sort_order: 2, is_featured: true },
    { campaign_id: campaignId, amount_cents: 36_000,   label: "Champion",   description: "Underwrite a Shabbaton scholarship.", hebrew_value: "", sort_order: 3 },
    { campaign_id: campaignId, amount_cents: 72_000,   label: "Builder",    description: "Power a full month of weekly Torah classes.", hebrew_value: "", sort_order: 4 },
    { campaign_id: campaignId, amount_cents: 180_000,  label: "Visionary",  description: "Become a founding donor of this year's campaign.", hebrew_value: "", sort_order: 5 },
  ]);

  // Starter teams (empty goals — fill in via admin)
  await supabase.from("campaign_teams").insert([
    {
      campaign_id: campaignId, slug: "team-oratz", name: "Team Oratz",
      leader_name: "Rabbi Yossi & Elisheva Oratz", goal_cents: 5_000_000,
      is_active: true, sort_order: 0,
    },
    {
      campaign_id: campaignId, slug: "team-westchester", name: "Team Westchester",
      leader_name: "JRE Community", goal_cents: 10_000_000,
      is_active: true, sort_order: 1,
    },
  ]);

  console.log("Seeded causes, tiers, teams.");
  console.log(`\nCampaign ready: /campaign/${SLUG}`);
  console.log(`Admin: /admin/campaigns/${campaignId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
