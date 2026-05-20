-- ============================================================
-- organizations — multi-tenant nonprofit registry for thegivinghq
--
-- Every campaign belongs to one organization. The OJC org API key
-- lives here, per-org, so each nonprofit charges donations against
-- their own OJC Fund account.
--
-- Basic Auth (OJC_BASIC_USER / OJC_BASIC_PASS) stays platform-wide
-- in env vars — only the org-specific key (OrgId in the OJC API)
-- is per-tenant.
--
-- Idempotent: safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Display
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  logo_url         TEXT,
  contact_email    TEXT,
  contact_phone    TEXT,

  -- IRS identity (used to look up OJC org key)
  tax_id           TEXT NOT NULL UNIQUE,        -- EIN, digits only (e.g. "208978145")
  legal_name       TEXT,                         -- name on file with IRS / OJC

  -- OJC Fund integration
  -- The org API key is a per-organization secret issued by OJC.
  -- Store as plain text inside a service_role-only table; rotate via admin UI.
  -- TODO(security): move to Supabase Vault when going GA on thegivinghq.
  ojc_org_api_key  TEXT,
  ojc_verified_at  TIMESTAMPTZ,                  -- last time we confirmed the key via OJC lookup
  ojc_last_error   TEXT,                         -- last OJC failure message for ops visibility

  -- Lifecycle
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'live', 'paused', 'archived')),

  -- Free-form metadata for thegivinghq-specific fields (plan tier, branding overrides, etc.)
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_tax_id ON public.organizations(tax_id);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON public.organizations(status);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Lock down by default. Public can read non-sensitive fields via a view (created below).
-- service_role bypasses RLS — that's what API routes use to read the ojc_org_api_key.
DROP POLICY IF EXISTS "deny all public access" ON public.organizations;
CREATE POLICY "deny all public access" ON public.organizations
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---- Public view: org name/slug/logo only — never the ojc key -----------------
-- Campaign pages can show "Powered by The JRE" / "Powered by Org X" safely.
CREATE OR REPLACE VIEW public.organizations_public AS
SELECT id, name, slug, logo_url, status
FROM public.organizations
WHERE status IN ('verified', 'live');

GRANT SELECT ON public.organizations_public TO anon, authenticated;

-- ---- Add org_id to campaigns --------------------------------------------------
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_campaigns_org_id ON public.campaigns(org_id);

-- ---- Seed JRE as the first organization ---------------------------------------
-- EIN 20-8978145 from existing campaigns.tax_id default.
-- ojc_org_api_key is the live JRE key from Mrs. Stein (2026-05-20).
INSERT INTO public.organizations (
  name, slug, legal_name, tax_id, ojc_org_api_key, status, contact_email
)
VALUES (
  'The Jewish Renaissance Experience',
  'jre',
  'Jewish Renaissance Experience Inc.',
  '208978145',
  '2bCDDAFIae8XX2XCbAvKhw==',
  'live',
  'glevi@thejre.org'
)
ON CONFLICT (slug) DO UPDATE
SET ojc_org_api_key  = EXCLUDED.ojc_org_api_key,
    legal_name       = EXCLUDED.legal_name,
    tax_id           = EXCLUDED.tax_id,
    status           = EXCLUDED.status,
    contact_email    = EXCLUDED.contact_email,
    updated_at       = NOW();

-- Backfill: every existing campaign belongs to JRE.
UPDATE public.campaigns
SET org_id = (SELECT id FROM public.organizations WHERE slug = 'jre')
WHERE org_id IS NULL;

-- Going forward, campaign creation MUST set org_id. Make it required:
-- (Skipped NOT NULL constraint until thegivinghq UI is shipped — campaigns table
-- has other code paths inserting without org_id today. Flip to NOT NULL once
-- create-campaign UI always sets it.)

COMMENT ON TABLE public.organizations IS
  'Multi-tenant nonprofit registry. Each campaign.org_id -> organizations.id. Holds per-org OJC API key.';
COMMENT ON COLUMN public.organizations.ojc_org_api_key IS
  'Per-org OJC Fund key (sent by OJC). Service-role only. Used as OrgId in /vouchers/processcharitycardtransaction.';
COMMENT ON COLUMN public.organizations.tax_id IS
  'EIN, digits only. Used to look up org via GET /api/organizations/orgapikey/{taxId} during onboarding.';
