-- JRE Kiruv CRM Tables
-- Run this in the Supabase SQL editor

-- ============================================================
-- TABLE 1: outreach_team_members
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,            -- WhatsApp number E.164: +1xxxxxxxxxx
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE 2: outreach_contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT NOT NULL DEFAULT 'unknown' CHECK (gender IN ('male', 'female', 'unknown')),
  stage TEXT NOT NULL DEFAULT 'new_contact' CHECK (stage IN (
    'new_contact', 'in_touch', 'event_connected', 'deepening', 'learning', 'inner_circle', 'multiplying'
  )),
  stage_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_to UUID REFERENCES outreach_team_members(id) ON DELETE SET NULL,
  background TEXT,
  how_met TEXT,
  spouse_name TEXT,
  event_registration_id UUID REFERENCES event_registrations(id) ON DELETE SET NULL,
  next_followup_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source TEXT DEFAULT 'manual' CHECK (source IN ('whatsapp', 'email_in', 'manual', 'event_import', 'email_signup_import', 'banquest_import', 'sheets_import')),
  engagement_score INTEGER NOT NULL DEFAULT 0,  -- computed on import, updated on interactions
  created_by UUID REFERENCES outreach_team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_contacts_email ON outreach_contacts(email);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_stage ON outreach_contacts(stage);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_assigned_to ON outreach_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_gender ON outreach_contacts(gender);

-- ============================================================
-- TABLE 3: outreach_interactions
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES outreach_contacts(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES outreach_team_members(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('met','call','text','coffee','shabbos','event','learning','email','donation','other')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  location TEXT,
  stage_before TEXT,
  stage_after TEXT,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  donation_amount NUMERIC,          -- for type='donation' from Banquest import
  parsed_by_ai BOOLEAN DEFAULT false,
  raw_input TEXT,                   -- original WhatsApp/email for audit trail
  whatsapp_message_sid TEXT,
  confirmation_status TEXT DEFAULT 'confirmed' CHECK (confirmation_status IN ('pending', 'confirmed', 'corrected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_interactions_contact_id ON outreach_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_interactions_date ON outreach_interactions(date);
CREATE INDEX IF NOT EXISTS idx_outreach_interactions_type ON outreach_interactions(type);
CREATE INDEX IF NOT EXISTS idx_outreach_interactions_team_member ON outreach_interactions(team_member_id);
CREATE INDEX IF NOT EXISTS idx_outreach_interactions_confirmation ON outreach_interactions(confirmation_status);

-- ============================================================
-- TRIGGER: auto-update outreach_contacts.updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_outreach_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outreach_contacts_updated_at ON outreach_contacts;
CREATE TRIGGER trg_outreach_contacts_updated_at
  BEFORE UPDATE ON outreach_contacts
  FOR EACH ROW EXECUTE FUNCTION update_outreach_contacts_updated_at();
