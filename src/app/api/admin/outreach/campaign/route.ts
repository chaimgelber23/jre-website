// @ts-nocheck
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

function parseLTD(bg) {
  if (!bg) return 0;
  const m = bg.match(/Total giving: \$([0-9,.]+)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}
function parseLastGift(bg) {
  if (!bg) return null;
  const m = bg.match(/Last gift: (\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
function parseSince(bg) {
  if (!bg) return null;
  const m = bg.match(/Donor since (\d{4})/);
  return m ? parseInt(m[1]) : null;
}

async function fetchAllContacts(supabase) {
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("outreach_contacts")
      .select("id, first_name, last_name, email, phone, gender, stage, source, how_met, background, group_name, engagement_score, created_at, updated_at")
      .eq("is_active", true)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

export async function GET() {
  const supabase = createServerClient();
  const contacts = await fetchAllContacts(supabase);

  const enriched = contacts.map((c) => ({
    ...c,
    ltd: parseLTD(c.background),
    lastGift: parseLastGift(c.background),
    donorSince: parseSince(c.background),
  }));

  const donors = enriched.filter((c) => c.ltd > 0);
  const nonDonors = enriched.filter((c) => c.ltd === 0);

  // TIER 1A — 2023 first-timers who haven't given since (first campaign, slipped away)
  const tier1a = donors
    .filter((c) => c.donorSince === 2023 && (!c.lastGift || c.lastGift < "2024-01-01"))
    .sort((a, b) => b.ltd - a.ltd)
    .map((c) => ({ ...pick(c), tier: "1a", tierLabel: "2023 First-Timer", reason: `Gave ${fmt(c.ltd)} in your first campaign — hasn't given since. They said yes before.` }));

  // TIER 1B — Lapsed major donors (gave $500+ before 2024)
  const tier1b = donors
    .filter((c) => c.ltd >= 500 && c.lastGift && c.lastGift < "2024-01-01" && c.donorSince !== 2023)
    .sort((a, b) => b.ltd - a.ltd)
    .slice(0, 20)
    .map((c) => ({ ...pick(c), tier: "1b", tierLabel: "Lapsed Major Donor", reason: `Gave ${fmt(c.ltd)} total, last gift ${c.lastGift}. Still believes in the mission.` }));

  // TIER 1C — Upgrade candidates (gave $500–$3k, still active)
  const tier1c = donors
    .filter((c) => c.ltd >= 500 && c.ltd < 5000 && c.lastGift && c.lastGift >= "2023-01-01")
    .sort((a, b) => b.ltd - a.ltd)
    .slice(0, 15)
    .map((c) => ({ ...pick(c), tier: "1c", tierLabel: "Ready to Upgrade", reason: `Gave ${fmt(c.ltd)} LTD, still active. A personal conversation about impact could move them to the next level.` }));

  // TIER 2A — Event regulars who never donated
  const tier2a = nonDonors
    .filter((c) => c.engagement_score >= 3 && c.email && (c.how_met === "event" || (c.background && c.background.includes("Attended JRE"))))
    .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
    .slice(0, 20)
    .map((c) => ({ ...pick(c), tier: "2a", tierLabel: "Event Regular — Never Asked", reason: `Engagement score ${c.engagement_score}. They show up. They've never been asked to give.` }));

  // TIER 2B — Deeply engaged, no donation record
  const tier2b = nonDonors
    .filter((c) => ["deepening", "learning", "inner_circle", "multiplying"].includes(c.stage) && c.email && !(c.how_met === "event"))
    .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
    .slice(0, 15)
    .map((c) => ({ ...pick(c), tier: "2b", tierLabel: "Deeply Engaged — No Ask Yet", reason: `Stage: ${c.stage}. Deep relationship, no financial ask ever made.` }));

  // TIER 3 — Cultivation (invite to June event first, ask after)
  const tier3 = enriched
    .filter((c) => ["in_touch", "event_connected"].includes(c.stage) && c.email && c.ltd < 100)
    .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
    .slice(0, 25)
    .map((c) => ({ ...pick(c), tier: "3", tierLabel: "Invite First", reason: `Still warming up. Invite them to the June event — make the ask after they attend.` }));

  // Summary numbers
  const totalReachable = new Set([...tier1a, ...tier1b, ...tier1c, ...tier2a, ...tier2b].filter(c => c.email).map(c => c.id)).size;
  const potentialRevenue = {
    conservative: tier1a.reduce((s, c) => s + c.ltd * 0.4, 0) + tier1b.reduce((s, c) => s + c.ltd * 0.2, 0),
    optimistic: tier1a.reduce((s, c) => s + c.ltd * 0.7, 0) + tier1b.reduce((s, c) => s + c.ltd * 0.4, 0) + tier1c.reduce((s, c) => s + c.ltd * 0.3, 0),
  };

  return NextResponse.json({
    summary: {
      totalInSystem: contacts.length,
      totalDonors: donors.length,
      totalReachableHighPriority: totalReachable,
      potentialRevenue,
    },
    tiers: {
      tier1a,
      tier1b,
      tier1c,
      tier2a,
      tier2b,
      tier3,
    },
  });
}

function pick(c) {
  return {
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    phone: c.phone,
    stage: c.stage,
    ltd: c.ltd,
    lastGift: c.lastGift,
    donorSince: c.donorSince,
    engagement_score: c.engagement_score,
    how_met: c.how_met,
  };
}

function fmt(n) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`;
}
