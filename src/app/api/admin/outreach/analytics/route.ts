// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
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
function parseYTD(bg) {
  if (!bg) return 0;
  const m = bg.match(/YTD: \$([0-9,.]+)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}

async function fetchAllContacts(supabase) {
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("outreach_contacts")
      .select("id, first_name, last_name, email, gender, stage, source, how_met, background, group_name, engagement_score, created_at, updated_at")
      .eq("is_active", true)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

export async function GET(request) {
  const supabase = createServerClient();

  const [contacts, { data: interactions }, { data: teamMembers }] = await Promise.all([
    fetchAllContacts(supabase),
    supabase.from("outreach_interactions").select("id, type, date, contact_id, team_member_id, stage_before, stage_after"),
    supabase.from("outreach_team_members").select("id, name, gender").eq("is_active", true),
  ]);

  // Enrich with parsed donation data
  const enriched = contacts.map((c) => ({
    ...c,
    ltd: parseLTD(c.background),
    lastGift: parseLastGift(c.background),
    donorSince: parseSince(c.background),
    ytd: parseYTD(c.background),
  }));

  const donors = enriched.filter((c) => c.ltd > 0);

  // Pipeline counts
  const stageCounts = {};
  for (const c of contacts) stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;

  const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff90 = new Date(); cutoff90.setDate(cutoff90.getDate() - 90);

  // Donor pyramid
  const pyramidDefs = [
    { label: "Founding Circle", sublabel: "$50,000+", min: 50000, max: Infinity, color: "#EF8046" },
    { label: "Major Partner",   sublabel: "$10,000+", min: 10000, max: 50000,    color: "#f59e0b" },
    { label: "Leadership",      sublabel: "$5,000+",  min: 5000,  max: 10000,    color: "#6366f1" },
    { label: "Major Donor",     sublabel: "$1,000+",  min: 1000,  max: 5000,     color: "#3b82f6" },
    { label: "Sustainer",       sublabel: "$500+",    min: 500,   max: 1000,     color: "#10b981" },
    { label: "Friend",          sublabel: "$100+",    min: 100,   max: 500,      color: "#64748b" },
  ];
  const pyramid = pyramidDefs.map((t) => ({
    ...t,
    count: donors.filter((c) => c.ltd >= t.min && c.ltd < t.max).length,
  }));

  // Lapsed major donors
  const lapsed = donors
    .filter((c) => c.ltd >= 500 && c.lastGift && c.lastGift < "2024-01-01")
    .sort((a, b) => b.ltd - a.ltd)
    .slice(0, 15)
    .map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, ltd: c.ltd, lastGift: c.lastGift, donorSince: c.donorSince }));

  // Active YTD donors
  const activeYTD = donors
    .filter((c) => c.ytd > 0)
    .sort((a, b) => b.ytd - a.ytd)
    .slice(0, 10)
    .map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, ytd: c.ytd, ltd: c.ltd }));

  // Upgrade candidates
  const upgradeCandidates = donors
    .filter((c) => c.ltd >= 500 && c.ltd < 3000 && c.lastGift && c.lastGift >= "2023-01-01")
    .sort((a, b) => b.ltd - a.ltd)
    .slice(0, 10)
    .map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, ltd: c.ltd, lastGift: c.lastGift, email: c.email }));

  // 2023 Re-engagement: gave in first campaign, haven't given since
  const reengagement2023 = donors
    .filter((c) => c.donorSince === 2023 && (!c.lastGift || c.lastGift < "2024-01-01"))
    .sort((a, b) => b.ltd - a.ltd)
    .slice(0, 25)
    .map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, ltd: c.ltd, lastGift: c.lastGift }));

  // Multi-year loyalists
  const loyalists = donors
    .filter((c) => c.donorSince && c.donorSince <= 2022 && c.lastGift && c.lastGift >= "2024-01-01")
    .sort((a, b) => b.ltd - a.ltd)
    .slice(0, 8)
    .map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, ltd: c.ltd, donorSince: c.donorSince, lastGift: c.lastGift }));

  // Event attenders who never donated
  const warmProspects = enriched
    .filter((c) => (c.how_met === "event" || (c.background && c.background.includes("Attended JRE"))) && c.ltd === 0 && c.email)
    .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
    .slice(0, 10)
    .map((c) => ({ id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, stage: c.stage }));

  // Donor cohorts
  const cohorts = {};
  donors.forEach((c) => { if (c.donorSince) cohorts[c.donorSince] = (cohorts[c.donorSince] || 0) + 1; });

  // Team activity
  const monthInteractions = (interactions || []).filter((i) => new Date(i.date) >= cutoff30);
  const teamActivity = (teamMembers || []).map((m) => ({
    id: m.id, name: m.name, gender: m.gender,
    interactions: monthInteractions.filter((i) => i.team_member_id === m.id).length,
    contacts: contacts.filter((c) => c.assigned_to === m.id).length,
  }));

  // Interaction breakdown
  const recentInteractions = (interactions || []).filter((i) => new Date(i.date) >= cutoff90);
  const typeCounts = {};
  for (const i of recentInteractions) typeCounts[i.type] = (typeCounts[i.type] || 0) + 1;

  // Conversion rates
  const stageAdvances = {};
  const stageAttempts = {};
  for (const i of interactions || []) {
    if (i.stage_before && i.stage_after && i.stage_before !== i.stage_after) {
      stageAttempts[i.type] = (stageAttempts[i.type] || 0) + 1;
      stageAdvances[i.type] = (stageAdvances[i.type] || 0) + 1;
    } else if (i.type) {
      stageAttempts[i.type] = (stageAttempts[i.type] || 0) + 1;
    }
  }

  return NextResponse.json({
    pipeline: {
      stageCounts,
      total: contacts.length,
      maleContacts: contacts.filter((c) => c.gender === "male").length,
      femaleContacts: contacts.filter((c) => c.gender === "female").length,
      unknownGender: contacts.filter((c) => c.gender === "unknown").length,
      overdueContacts: contacts.filter((c) => new Date(c.updated_at) < cutoff30).length,
      newLast30: contacts.filter((c) => new Date(c.created_at) >= cutoff30).length,
    },
    donors: {
      total: donors.length,
      pyramid,
      lapsed,
      activeYTD,
      upgradeCandidates,
      loyalists,
      reengagement2023,
      cohorts,
    },
    warmProspects,
    gaps: {
      noEmail: contacts.filter((c) => !c.email).length,
      noGender: contacts.filter((c) => c.gender === "unknown").length,
      noInteraction: contacts.filter((c) => c.stage === "new_contact").length,
    },
    interactions: {
      typeCounts,
      totalLast90Days: recentInteractions.length,
      conversionRates: Object.entries(stageAttempts).map(([type, total]) => ({
        type, total: total,
        advances: stageAdvances[type] || 0,
        rate: total > 0 ? Math.round(((stageAdvances[type] || 0) / (total)) * 100) : 0,
      })).sort((a, b) => b.rate - a.rate),
    },
    team: teamActivity,
  });
}
