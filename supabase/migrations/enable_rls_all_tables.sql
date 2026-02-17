-- ============================================
-- Fix all Supabase Security Advisor flags
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Safe: all API routes use service role key (bypasses RLS)
-- ============================================


-- =====================
-- Enable RLS on all tables
-- =====================

-- 1. EVENTS - public can read (event listing pages)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on events"
  ON public.events
  FOR SELECT
  USING (true);

-- 2. EVENT_SPONSORSHIPS - public can read (shown on event pages)
ALTER TABLE public.event_sponsorships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on event_sponsorships"
  ON public.event_sponsorships
  FOR SELECT
  USING (true);

-- 3. EVENT_REGISTRATIONS - no public access (service role bypasses RLS)
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- 4. DONATIONS - no public access (service role bypasses RLS)
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- 5. EMAIL_SIGNUPS - no public access (service role bypasses RLS)
ALTER TABLE public.email_signups ENABLE ROW LEVEL SECURITY;


-- =====================
-- Fix Function Search Path Mutable warning
-- =====================

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
