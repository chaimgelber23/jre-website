import { createServerClient } from "@/lib/supabase/server";
import type {
  Campaign,
  CampaignCause,
  CampaignTier,
  CampaignMatcher,
  CampaignTeam,
  CampaignTeamWithProgress,
  CampaignUpdate,
  CampaignSnapshot,
  CampaignDonation,
  PublicDonation,
} from "@/types/campaign";

export interface CampaignTeamSnapshot {
  campaign: Campaign;
  team: CampaignTeamWithProgress;
  tiers: CampaignTier[];
  causes: CampaignCause[];
  matchers: CampaignMatcher[];
  recent_donations: PublicDonation[];
}

const RECENT_DONATIONS_LIMIT = 50;

export function formatUsd(cents: number, opts: { fractionDigits?: number } = {}): string {
  const digits = opts.fractionDigits ?? 0;
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function centsFromDollars(dollars: number): number {
  return Math.round(dollars * 100);
}

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isEnded: boolean;
  hasStarted: boolean;
}

export function getTimeRemaining(startAt: string, endAt: string, now: Date = new Date()): TimeRemaining {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const current = now.getTime();
  const hasStarted = current >= start;
  const targetMs = hasStarted ? end - current : start - current;
  const clamped = Math.max(0, targetMs);
  const days = Math.floor(clamped / (1000 * 60 * 60 * 24));
  const hours = Math.floor((clamped % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((clamped % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((clamped % (1000 * 60)) / 1000);
  return {
    days,
    hours,
    minutes,
    seconds,
    totalMs: clamped,
    isEnded: hasStarted && current >= end,
    hasStarted,
  };
}

export function getActiveMatcher(matchers: CampaignMatcher[], now: Date = new Date()): CampaignMatcher | null {
  const current = now.getTime();
  const active = matchers.filter((m) => {
    if (!m.is_active) return false;
    if (m.active_from && new Date(m.active_from).getTime() > current) return false;
    if (m.active_until && new Date(m.active_until).getTime() < current) return false;
    if (m.cap_cents != null && m.matched_cents >= m.cap_cents) return false;
    return true;
  });
  if (active.length === 0) return null;
  return active.reduce((best, m) => (m.multiplier > best.multiplier ? m : best), active[0]);
}

export function computeMatchedAmount(amountCents: number, matcher: CampaignMatcher | null): number {
  if (!matcher) return 0;
  const multiplier = Number(matcher.multiplier);
  if (multiplier <= 1) return 0;
  const matched = Math.round(amountCents * (multiplier - 1));
  if (matcher.cap_cents != null) {
    const remaining = Math.max(0, matcher.cap_cents - matcher.matched_cents);
    return Math.min(matched, remaining);
  }
  return matched;
}

export function maskDonorName(fullName: string, anonymous: boolean): string {
  if (anonymous) return "Anonymous";
  const trimmed = fullName.trim();
  if (!trimmed) return "Anonymous";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

export function publicizeDonation(
  d: CampaignDonation,
  teams: { id: string; slug: string; name: string }[],
  causes: { id: string; slug: string }[]
): PublicDonation {
  const team = d.team_id ? teams.find((t) => t.id === d.team_id) : null;
  const cause = d.cause_id ? causes.find((c) => c.id === d.cause_id) : null;
  return {
    id: d.id,
    display_name: d.is_anonymous ? "Anonymous" : (d.display_name || maskDonorName(d.name, false)),
    amount_cents: d.amount_cents,
    message: d.message,
    dedication_type: d.dedication_type,
    dedication_name: d.dedication_name,
    team_slug: team?.slug ?? null,
    team_name: team?.name ?? null,
    cause_slug: cause?.slug ?? null,
    created_at: d.created_at,
  };
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | null> {
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("campaigns")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.error("getCampaignBySlug error:", error);
    return null;
  }
  return (data as Campaign) ?? null;
}

export async function getCampaignTeamSnapshot(
  campaignSlug: string,
  teamSlug: string
): Promise<CampaignTeamSnapshot | null> {
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const campaign = await getCampaignBySlug(campaignSlug);
  if (!campaign) return null;

  const { data: teamRow } = await db
    .from("campaign_teams")
    .select("*")
    .eq("campaign_id", campaign.id)
    .eq("slug", teamSlug)
    .eq("is_active", true)
    .maybeSingle();
  const teamBase = teamRow as CampaignTeam | null;
  if (!teamBase) return null;

  const [causesRes, tiersRes, matchersRes, teamProgressRes, donationsRes] = await Promise.all([
    db.from("campaign_causes").select("*").eq("campaign_id", campaign.id).order("sort_order", { ascending: true }),
    db.from("campaign_tiers").select("*").eq("campaign_id", campaign.id).order("sort_order", { ascending: true }),
    db.from("campaign_matchers").select("*").eq("campaign_id", campaign.id).eq("is_active", true).order("sort_order", { ascending: true }),
    db.from("campaign_team_progress").select("*").eq("team_id", teamBase.id).maybeSingle(),
    db
      .from("campaign_donations")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("team_id", teamBase.id)
      .eq("is_hidden", false)
      .in("payment_status", ["completed", "pledged"])
      .order("created_at", { ascending: false })
      .limit(RECENT_DONATIONS_LIMIT),
  ]);

  const causes: CampaignCause[] = (causesRes.data ?? []) as CampaignCause[];
  const tiers: CampaignTier[] = (tiersRes.data ?? []) as CampaignTier[];
  const matchers: CampaignMatcher[] = (matchersRes.data ?? []) as CampaignMatcher[];
  const teamProgress = (teamProgressRes.data ?? { raised_cents: 0, donor_count: 0 }) as {
    raised_cents: number;
    donor_count: number;
  };

  const team: CampaignTeamWithProgress = {
    ...teamBase,
    raised_cents: teamProgress.raised_cents ?? 0,
    donor_count: teamProgress.donor_count ?? 0,
  };

  const donations = (donationsRes.data ?? []) as CampaignDonation[];
  const recent = donations.map((d) =>
    publicizeDonation(d, [{ id: team.id, slug: team.slug, name: team.name }], causes)
  );

  return {
    campaign,
    team,
    tiers,
    causes,
    matchers,
    recent_donations: recent,
  };
}

export async function getCampaignSnapshot(slug: string): Promise<CampaignSnapshot | null> {
  const supabase = createServerClient();
  const campaign = await getCampaignBySlug(slug);
  if (!campaign) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [
    causesRes,
    tiersRes,
    matchersRes,
    teamsRes,
    teamProgressRes,
    updatesRes,
    progressRes,
    donationsRes,
  ] = await Promise.all([
    db.from("campaign_causes").select("*").eq("campaign_id", campaign.id).order("sort_order", { ascending: true }),
    db.from("campaign_tiers").select("*").eq("campaign_id", campaign.id).order("sort_order", { ascending: true }),
    db.from("campaign_matchers").select("*").eq("campaign_id", campaign.id).eq("is_active", true).order("sort_order", { ascending: true }),
    db.from("campaign_teams").select("*").eq("campaign_id", campaign.id).eq("is_active", true).order("sort_order", { ascending: true }),
    db.from("campaign_team_progress").select("*").eq("campaign_id", campaign.id),
    db.from("campaign_updates").select("*").eq("campaign_id", campaign.id).order("is_pinned", { ascending: false }).order("posted_at", { ascending: false }).limit(10),
    db.from("campaign_progress").select("*").eq("campaign_id", campaign.id).maybeSingle(),
    db
      .from("campaign_donations")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("is_hidden", false)
      .in("payment_status", ["completed", "pledged"])
      .order("created_at", { ascending: false })
      .limit(RECENT_DONATIONS_LIMIT),
  ]);

  const causes: CampaignCause[] = (causesRes.data ?? []) as CampaignCause[];
  const tiers: CampaignTier[] = (tiersRes.data ?? []) as CampaignTier[];
  const matchers: CampaignMatcher[] = (matchersRes.data ?? []) as CampaignMatcher[];
  const teamsBase = (teamsRes.data ?? []) as CampaignTeamWithProgress[];
  const teamProgress = (teamProgressRes.data ?? []) as Array<{
    team_id: string;
    raised_cents: number;
    donor_count: number;
  }>;

  const teams: CampaignTeamWithProgress[] = teamsBase.map((t) => {
    const p = teamProgress.find((x) => x.team_id === t.id);
    return {
      ...t,
      raised_cents: p?.raised_cents ?? 0,
      donor_count: p?.donor_count ?? 0,
    };
  });

  const updates = (updatesRes.data ?? []) as CampaignUpdate[];

  const rawProgress = (progressRes.data ?? {
    raised_cents: 0,
    matched_cents: 0,
    donor_count: 0,
    unique_donors: 0,
  }) as { raised_cents: number; matched_cents: number; donor_count: number; unique_donors: number };

  const total = (rawProgress.raised_cents ?? 0) + (rawProgress.matched_cents ?? 0);
  const percent = campaign.goal_cents > 0 ? Math.min(100, (total / campaign.goal_cents) * 100) : 0;

  const donations = (donationsRes.data ?? []) as CampaignDonation[];
  const recent = donations.map((d) => publicizeDonation(d, teams, causes));

  return {
    campaign,
    causes,
    tiers,
    matchers,
    teams,
    updates,
    progress: {
      goal_cents: campaign.goal_cents,
      raised_cents: rawProgress.raised_cents ?? 0,
      matched_cents: rawProgress.matched_cents ?? 0,
      donor_count: rawProgress.donor_count ?? 0,
      unique_donors: rawProgress.unique_donors ?? 0,
      percent_to_goal: Math.round(percent * 10) / 10,
    },
    recent_donations: recent,
  };
}
