-- Add multi-image support to campaign heroes so the CampaignClient carousel
-- can cycle through several photos instead of just the single hero_image_url.
-- CampaignClient already falls back to the single column when the array is empty,
-- so this is additive and safe to deploy before repopulating data.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS hero_image_urls TEXT[] NOT NULL DEFAULT '{}';
