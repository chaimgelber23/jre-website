// @ts-nocheck
/**
 * POST /api/admin/outreach/migrate
 *
 * One-time route: creates the CRM tables in Supabase.
 * Called once from the admin import page to bootstrap the database.
 * Safe to call multiple times — all statements use CREATE TABLE IF NOT EXISTS.
 *
 * DELETE THIS FILE after the migration has been run successfully.
 */

import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Each statement must be run separately via the REST API RPC trick
// We use the Supabase pg_net extension via direct fetch to the Management API
// Fall back to trying each table creation via a special pg function if available
async function runSQL(sql: string): Promise<{ error?: string }> {
  // Try via Supabase's undocumented query endpoint (works with service role on some versions)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
    method: "POST",
    headers: {
      "apikey":        SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) return {};
  const text = await res.text();
  return { error: text };
}

export async function POST(_request: NextRequest) {
  // Use Supabase Management API via fetch
  // This requires a personal access token — but let's try with service role first
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];
  if (!projectRef) {
    return NextResponse.json({ error: "Cannot determine project ref" }, { status: 500 });
  }

  const sql = `
-- TABLE 1: outreach_team_members
CREATE TABLE IF NOT EXISTS outreach_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TABLE 2: outreach_contacts
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
  source TEXT DEFAULT 'manual',
  engagement_score INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES outreach_team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_contacts_email ON outreach_contacts(email);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_stage ON outreach_contacts(stage);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_assigned_to ON outreach_contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_outreach_contacts_gender ON outreach_contacts(gender);

-- TABLE 3: outreach_interactions
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
  donation_amount NUMERIC,
  parsed_by_ai BOOLEAN DEFAULT false,
  raw_input TEXT,
  whatsapp_message_sid TEXT,
  confirmation_status TEXT DEFAULT 'confirmed' CHECK (confirmation_status IN ('pending', 'confirmed', 'corrected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_interactions_contact_id ON outreach_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_interactions_date ON outreach_interactions(date);
CREATE INDEX IF NOT EXISTS idx_outreach_interactions_team_member ON outreach_interactions(team_member_id);
CREATE INDEX IF NOT EXISTS idx_outreach_interactions_confirmation ON outreach_interactions(confirmation_status);
  `.trim();

  // Try calling Supabase Management API
  const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (mgmtRes.ok) {
    return NextResponse.json({ success: true, message: "Migration ran successfully via Management API" });
  }

  const mgmtError = await mgmtRes.text();

  // If management API fails, return the SQL for manual execution
  return NextResponse.json({
    success: false,
    message: "Cannot run migration automatically — management API requires a personal access token.",
    manualSteps: [
      "1. Go to https://supabase.com and sign in",
      "2. Click your JRE project",
      "3. Click SQL Editor in the left sidebar",
      "4. Click New query",
      "5. Paste the SQL below and click Run",
    ],
    sql,
    mgmtApiError: mgmtError,
  }, { status: 200 });
}
