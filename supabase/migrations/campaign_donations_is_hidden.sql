-- Add is_hidden flag to campaign_donations so admins can remove a donation
-- from the public donor wall + totals without misreporting it as failed/refunded.
-- Charidy-parity feature: "hide from public but keep the record."

ALTER TABLE public.campaign_donations
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_campaign_donations_visible
  ON public.campaign_donations(campaign_id, created_at DESC)
  WHERE is_hidden = FALSE;

-- Rebuild aggregate views so hidden donations don't count toward raised/match/donor_count.

CREATE OR REPLACE VIEW public.campaign_progress AS
SELECT
  c.id AS campaign_id,
  c.slug,
  c.goal_cents,
  COALESCE(SUM(CASE WHEN d.payment_status IN ('completed', 'pledged') AND d.is_hidden = FALSE THEN d.amount_cents ELSE 0 END), 0) AS raised_cents,
  COALESCE(SUM(CASE WHEN d.payment_status IN ('completed', 'pledged') AND d.is_hidden = FALSE THEN d.matched_cents ELSE 0 END), 0) AS matched_cents,
  COUNT(DISTINCT CASE WHEN d.payment_status IN ('completed', 'pledged') AND d.is_hidden = FALSE THEN d.id END) AS donor_count,
  COUNT(DISTINCT CASE WHEN d.payment_status IN ('completed', 'pledged') AND d.is_hidden = FALSE THEN d.email END) AS unique_donors
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
  COALESCE(SUM(CASE WHEN d.payment_status IN ('completed', 'pledged') AND d.is_hidden = FALSE THEN d.amount_cents + d.matched_cents ELSE 0 END), 0) AS raised_cents,
  COUNT(DISTINCT CASE WHEN d.payment_status IN ('completed', 'pledged') AND d.is_hidden = FALSE THEN d.id END) AS donor_count
FROM public.campaign_teams t
LEFT JOIN public.campaign_donations d ON d.team_id = t.id
GROUP BY t.id, t.campaign_id, t.slug, t.name, t.goal_cents;
