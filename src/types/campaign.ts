// Campaign types — mirror the Supabase schema in supabase/migrations/campaigns.sql.
// Kept separate from database.ts so the migration can evolve without touching
// the auto-style Database interface.

export type CampaignStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'archived';
export type PaymentMethod = 'card' | 'daf' | 'ojc_fund' | 'donors_fund' | 'check' | 'zelle' | 'other';
export type PaymentStatus = 'pending' | 'pledged' | 'completed' | 'failed' | 'refunded';
export type DedicationType = 'honor' | 'memory';

export interface FaqEntry {
  q: string;
  a: string;
}

export interface Campaign {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  story_md: string | null;
  hero_image_url: string | null;
  hero_image_urls: string[] | null;
  video_url: string | null;
  og_image_url: string | null;
  goal_cents: number;
  currency: string;
  start_at: string;
  end_at: string;
  status: CampaignStatus;
  theme_color: string | null;
  tax_id: string | null;
  tax_deductible_note: string | null;
  allow_anonymous: boolean;
  allow_dedication: boolean;
  allow_team: boolean;
  allow_recurring: boolean;
  faq: FaqEntry[] | null;
  share_text: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignCause {
  id: string;
  campaign_id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface CampaignTier {
  id: string;
  campaign_id: string;
  amount_cents: number;
  label: string;
  description: string | null;
  hebrew_value: string | null;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
}

export interface CampaignMatcher {
  id: string;
  campaign_id: string;
  name: string;
  logo_url: string | null;
  story: string | null;
  multiplier: number;
  cap_cents: number | null;
  matched_cents: number;
  active_from: string | null;
  active_until: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignTeam {
  id: string;
  campaign_id: string;
  slug: string;
  name: string;
  leader_name: string | null;
  leader_email: string | null;
  avatar_url: string | null;
  story: string | null;
  goal_cents: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignTeamWithProgress extends CampaignTeam {
  raised_cents: number;
  donor_count: number;
}

export interface CampaignDonation {
  id: string;
  campaign_id: string;
  cause_id: string | null;
  tier_id: string | null;
  team_id: string | null;
  amount_cents: number;
  matched_cents: number;
  currency: string;
  name: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  is_anonymous: boolean;
  dedication_type: DedicationType | null;
  dedication_name: string | null;
  dedication_email: string | null;
  message: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  card_ref: string | null;
  daf_sponsor: string | null;
  daf_grant_id: string | null;
  check_number: string | null;
  failure_reason: string | null;
  is_recurring: boolean;
  recurring_frequency: string | null;
  next_charge_date: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignUpdate {
  id: string;
  campaign_id: string;
  title: string;
  body_md: string | null;
  image_url: string | null;
  posted_at: string;
  is_pinned: boolean;
  created_at: string;
}

export interface CampaignProgress {
  campaign_id: string;
  slug: string;
  goal_cents: number;
  raised_cents: number;
  matched_cents: number;
  donor_count: number;
  unique_donors: number;
}

export interface CampaignSnapshot {
  campaign: Campaign;
  causes: CampaignCause[];
  tiers: CampaignTier[];
  matchers: CampaignMatcher[];
  teams: CampaignTeamWithProgress[];
  updates: CampaignUpdate[];
  progress: {
    raised_cents: number;
    matched_cents: number;
    donor_count: number;
    unique_donors: number;
    goal_cents: number;
    percent_to_goal: number;
  };
  recent_donations: PublicDonation[];
}

// Only safe-to-expose fields for the donor wall / ticker.
export interface PublicDonation {
  id: string;
  display_name: string;
  amount_cents: number;
  message: string | null;
  dedication_type: DedicationType | null;
  dedication_name: string | null;
  team_slug: string | null;
  team_name: string | null;
  cause_slug: string | null;
  created_at: string;
}
