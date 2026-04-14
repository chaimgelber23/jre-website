-- ============================================
-- Fix RLS on CRM tables (flagged by Supabase Security Advisor)
-- Safe: all API routes use service role key (bypasses RLS)
-- ============================================

-- outreach_team_members — no public access needed
ALTER TABLE public.outreach_team_members ENABLE ROW LEVEL SECURITY;

-- outreach_contacts — no public access needed
ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;

-- outreach_interactions — no public access needed
ALTER TABLE public.outreach_interactions ENABLE ROW LEVEL SECURITY;

-- Also fix search_path on any CRM functions
CREATE OR REPLACE FUNCTION update_outreach_contacts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
