-- ============================================================
-- JRE Fundraising Campaigns — Charidy-style page infrastructure
--
-- Tables:
--   campaigns             — one row per campaign (goal, dates, story)
--   campaign_causes       — "Donor Fund" / "OJC Fund" split (donor chooses)
--   campaign_tiers        — preset giving levels ($18, $360, etc.) w/ perks
--   campaign_matchers     — lead donors funding a match (multiplier + cap)
--   campaign_teams        — sub-teams/ambassadors with their own sub-goals
--   campaign_donations    — every donation (card, DAF pledge, OJC pledge)
--   campaign_updates      — admin-posted progress updates
--
-- All tables RLS-enabled; reads via service_role from API routes.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Shared updated_at trigger (created by earlier migration, recreated safely)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---- campaigns -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  tagline          TEXT,
  story_md         TEXT,

  hero_image_url   TEXT,
  video_url        TEXT,
  og_image_url     TEXT,

  goal_cents       BIGINT NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'USD',

  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ NOT NULL,

  status           TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'archived')),

  theme_color      TEXT,

  tax_id           TEXT DEFAULT '501(c)(3) nonprofit, EIN 20-8978145',
  tax_deductible_note TEXT DEFAULT 'JRE is a 501(c)(3) nonprofit. All donations are tax-deductible to the fullest extent permitted by law.',

  allow_anonymous  BOOLEAN NOT NULL DEFAULT TRUE,
  allow_dedication BOOLEAN NOT NULL DEFAULT TRUE,
  allow_team       BOOLEAN NOT NULL DEFAULT TRUE,
  allow_recurring  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Custom FAQ (array of {q, a})
  faq              JSONB DEFAULT '[]'::jsonb,

  share_text       TEXT,

  is_active        BOOLEAN NOT NULL DEFAULT TRUE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_slug ON public.campaigns(slug);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON public.campaigns(start_at, end_at);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- campaign_causes -------------------------------------------------------
-- "Donor Fund" vs "OJC Fund" selectable at donation time.

CREATE TABLE IF NOT EXISTS public.campaign_causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  slug             TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  icon             TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (campaign_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_campaign_causes_campaign
  ON public.campaign_causes(campaign_id, sort_order);

ALTER TABLE public.campaign_causes ENABLE ROW LEVEL SECURITY;

-- ---- campaign_tiers --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  amount_cents     BIGINT NOT NULL,
  label            TEXT NOT NULL,           -- e.g. "Partner", "Champion"
  description      TEXT,                    -- perks / what this level funds
  hebrew_value     TEXT,                    -- e.g. "חי", "כח"
  is_featured      BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order       INTEGER NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_tiers_campaign
  ON public.campaign_tiers(campaign_id, sort_order);

ALTER TABLE public.campaign_tiers ENABLE ROW LEVEL SECURITY;

-- ---- campaign_matchers -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_matchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  name             TEXT NOT NULL,
  logo_url         TEXT,
  story            TEXT,

  multiplier       NUMERIC(4,2) NOT NULL DEFAULT 1.00,  -- 2.00 = 2X, 3.00 = 3X
  cap_cents        BIGINT,                               -- NULL = uncapped
  matched_cents    BIGINT NOT NULL DEFAULT 0,            -- running total used

  active_from      TIMESTAMPTZ,
  active_until     TIMESTAMPTZ,

  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order       INTEGER NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_matchers_campaign
  ON public.campaign_matchers(campaign_id, sort_order);

ALTER TABLE public.campaign_matchers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_campaign_matchers_updated_at ON public.campaign_matchers;
CREATE TRIGGER trg_campaign_matchers_updated_at
  BEFORE UPDATE ON public.campaign_matchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- campaign_teams --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  slug             TEXT NOT NULL,
  name             TEXT NOT NULL,
  leader_name      TEXT,
  leader_email     TEXT,
  avatar_url       TEXT,
  story            TEXT,

  goal_cents       BIGINT,                   -- NULL = no sub-goal
  sort_order       INTEGER NOT NULL DEFAULT 0,

  is_active        BOOLEAN NOT NULL DEFAULT TRUE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (campaign_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_campaign_teams_campaign
  ON public.campaign_teams(campaign_id, sort_order);

ALTER TABLE public.campaign_teams ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_campaign_teams_updated_at ON public.campaign_teams;
CREATE TRIGGER trg_campaign_teams_updated_at
  BEFORE UPDATE ON public.campaign_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- campaign_donations ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  campaign_id      UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  cause_id         UUID REFERENCES public.campaign_causes(id) ON DELETE SET NULL,
  tier_id          UUID REFERENCES public.campaign_tiers(id) ON DELETE SET NULL,
  team_id          UUID REFERENCES public.campaign_teams(id) ON DELETE SET NULL,

  amount_cents     BIGINT NOT NULL,            -- gross donor amount
  matched_cents    BIGINT NOT NULL DEFAULT 0,  -- match layered on top
  currency         TEXT NOT NULL DEFAULT 'USD',

  -- Donor info
  name             TEXT NOT NULL,
  display_name     TEXT,                       -- "J. Smith" or "Anonymous"
  email            TEXT NOT NULL,
  phone            TEXT,
  address          TEXT,

  is_anonymous     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Dedication (in honor of / in memory of)
  dedication_type  TEXT CHECK (dedication_type IS NULL OR dedication_type IN ('honor', 'memory')),
  dedication_name  TEXT,
  dedication_email TEXT,

  -- Public message on donor wall
  message          TEXT,

  -- Payment
  payment_method   TEXT NOT NULL
    CHECK (payment_method IN ('card', 'daf', 'ojc_fund', 'check', 'zelle', 'other')),
  payment_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'pledged', 'completed', 'failed', 'refunded')),

  payment_reference TEXT,                      -- Banquest transaction id
  card_ref         TEXT,                       -- saved card token for recurring
  daf_sponsor      TEXT,                       -- "Fidelity Charitable", "OJC Fund", etc.
  daf_grant_id     TEXT,                       -- reconciliation id from DAF
  check_number     TEXT,
  failure_reason   TEXT,

  is_recurring     BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_frequency TEXT,                    -- 'monthly' | null
  next_charge_date DATE,

  admin_notes      TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_donations_campaign
  ON public.campaign_donations(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_donations_status
  ON public.campaign_donations(campaign_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_campaign_donations_team
  ON public.campaign_donations(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_donations_cause
  ON public.campaign_donations(cause_id) WHERE cause_id IS NOT NULL;

ALTER TABLE public.campaign_donations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_campaign_donations_updated_at ON public.campaign_donations;
CREATE TRIGGER trg_campaign_donations_updated_at
  BEFORE UPDATE ON public.campaign_donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- campaign_updates ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.campaign_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  title            TEXT NOT NULL,
  body_md          TEXT,
  image_url        TEXT,

  posted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_pinned        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_updates_campaign
  ON public.campaign_updates(campaign_id, posted_at DESC);

ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY;

-- ---- aggregate views -------------------------------------------------------

CREATE OR REPLACE VIEW public.campaign_progress AS
SELECT
  c.id AS campaign_id,
  c.slug,
  c.goal_cents,
  COALESCE(SUM(CASE WHEN d.payment_status IN ('completed', 'pledged') THEN d.amount_cents ELSE 0 END), 0) AS raised_cents,
  COALESCE(SUM(CASE WHEN d.payment_status IN ('completed', 'pledged') THEN d.matched_cents ELSE 0 END), 0) AS matched_cents,
  COUNT(DISTINCT CASE WHEN d.payment_status IN ('completed', 'pledged') THEN d.id END) AS donor_count,
  COUNT(DISTINCT CASE WHEN d.payment_status IN ('completed', 'pledged') THEN d.email END) AS unique_donors
FROM public.campaigns c
LEFT JOIN public.campaign_donations d ON d.campaign_id = c.id
GROUP BY c.id, c.slug, c.goal_cents;

CREATE OR REPLACE VIEW public.campaign_team_progress AS
SELECT
  t.id AS team_id,
  t.campaign_id,
  t.slug,
  t.name,
  t.goal_cents,
  COALESCE(SUM(CASE WHEN d.payment_status IN ('completed', 'pledged') THEN d.amount_cents + d.matched_cents ELSE 0 END), 0) AS raised_cents,
  COUNT(DISTINCT CASE WHEN d.payment_status IN ('completed', 'pledged') THEN d.id END) AS donor_count
FROM public.campaign_teams t
LEFT JOIN public.campaign_donations d ON d.team_id = t.id
GROUP BY t.id, t.campaign_id, t.slug, t.name, t.goal_cents;
