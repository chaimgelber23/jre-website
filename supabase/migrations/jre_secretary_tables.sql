-- ============================================================
-- JRE AI Secretary — Phase 1 tables
-- Weekly Tuesday class automation:
--   speaker tracking, email draft lifecycle, payment follow-up,
--   self-learning audit log.
--
-- Safe to run multiple times (IF NOT EXISTS everywhere).
-- All tables use service_role via API routes (RLS enabled, no public policies).
-- ============================================================

-- ---- prerequisites ---------------------------------------------------------

-- Reuse the existing updated_at trigger function if present; create if not.
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

-- Extend existing outreach_team_members with JRE role tag so Phase 1 can
-- resolve "who sends which email" without a new people table.
ALTER TABLE public.outreach_team_members
  ADD COLUMN IF NOT EXISTS jre_role TEXT
    CHECK (jre_role IS NULL OR jre_role IN (
      'coordinator',        -- Gitty Levi (glevi@thejre.org)
      'speaker_picker',     -- Elisheva Oratz
      'payment_contact',    -- Rabbi Yossi Oratz
      'cc_sender_a',        -- from-name on Monday 8am CC email
      'cc_sender_b',        -- from-name on Tuesday 9am CC email
      'member'
    ));

-- ---- jre_speakers ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.jre_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,

  last_fee_usd    INTEGER,                    -- auto-pulled from last class
  total_talks     INTEGER NOT NULL DEFAULT 0,
  last_spoke_at   DATE,

  has_bio         BOOLEAN NOT NULL DEFAULT FALSE,
  has_headshot    BOOLEAN NOT NULL DEFAULT FALSE,
  bio             TEXT,
  headshot_url    TEXT,

  -- Clone-past-everything anchors (set by seed + post-send updates)
  cc_last_campaign_id_1    TEXT,              -- most recent Monday CC campaign
  cc_last_campaign_id_2    TEXT,              -- most recent Tuesday CC campaign
  gmail_last_message_id    TEXT,              -- Gitty's most recent confirm email

  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  source          TEXT DEFAULT 'seed',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jre_speakers_full_name
  ON public.jre_speakers(full_name);
CREATE INDEX IF NOT EXISTS idx_jre_speakers_last_spoke_at
  ON public.jre_speakers(last_spoke_at DESC NULLS LAST);

ALTER TABLE public.jre_speakers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_jre_speakers_updated_at ON public.jre_speakers;
CREATE TRIGGER trg_jre_speakers_updated_at
  BEFORE UPDATE ON public.jre_speakers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- jre_weekly_classes ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.jre_weekly_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  class_date      DATE NOT NULL UNIQUE,        -- the Tuesday
  class_time      TIME NOT NULL DEFAULT '10:00:00',
  speaker_id      UUID REFERENCES public.jre_speakers(id) ON DELETE SET NULL,
  fee_usd         INTEGER,
  zoom_link       TEXT,                        -- verified against canonical on save
  topic           TEXT,
  dedication      TEXT,

  status          TEXT NOT NULL DEFAULT 'awaiting_speaker'
    CHECK (status IN (
      'awaiting_speaker',
      'drafts_pending',
      'approved',
      'scheduled',
      'sent',
      'class_complete',
      'paid',
      'held_for_human',
      'cancelled'
    )),

  -- Draft pointers (one per email in the weekly flow)
  email_speaker_draft_id   UUID,               -- Thu Gmail to speaker
  email_cc_1_draft_id      UUID,               -- Mon 8am CC Email #1
  email_cc_2_draft_id      UUID,               -- Tue 9am CC Email #2
  email_payment_draft_id   UUID,               -- Tue night Gmail to Rabbi Oratz
  email_reminder_draft_id  UUID,               -- Fri payment reminder

  -- Automation state flags
  elisheva_asked_at        TIMESTAMPTZ,        -- when we emailed Elisheva "who's speaking?"
  elisheva_replied_at      TIMESTAMPTZ,        -- when watcher detected her reply
  held_reason              TEXT,               -- if held_for_human

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jre_weekly_classes_class_date
  ON public.jre_weekly_classes(class_date DESC);
CREATE INDEX IF NOT EXISTS idx_jre_weekly_classes_status
  ON public.jre_weekly_classes(status);

ALTER TABLE public.jre_weekly_classes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_jre_weekly_classes_updated_at ON public.jre_weekly_classes;
CREATE TRIGGER trg_jre_weekly_classes_updated_at
  BEFORE UPDATE ON public.jre_weekly_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- jre_email_drafts ------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.jre_email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  class_id         UUID NOT NULL REFERENCES public.jre_weekly_classes(id) ON DELETE CASCADE,

  draft_type       TEXT NOT NULL
    CHECK (draft_type IN (
      'email_speaker',       -- Thu Gmail confirm to speaker
      'email_cc_1',          -- Mon 8am CC email (default sender)
      'email_cc_2',          -- Tue 9am CC email (sender = Gitty)
      'email_payment',       -- Tue night Gmail to Rabbi Oratz
      'email_reminder',      -- Fri Gmail reminder to Rabbi Oratz
      'email_elisheva_ask'   -- Sun morning ask Elisheva for speaker
    )),

  delivery_channel TEXT NOT NULL
    CHECK (delivery_channel IN ('gmail', 'constant_contact')),

  from_name        TEXT NOT NULL,
  from_email       TEXT NOT NULL,
  reply_to         TEXT,
  to_list          TEXT[] NOT NULL DEFAULT '{}',
  cc_list          TEXT[] NOT NULL DEFAULT '{}',
  bcc_list         TEXT[] NOT NULL DEFAULT '{}',

  subject          TEXT NOT NULL,
  body_html        TEXT NOT NULL,
  body_text        TEXT,                       -- optional plain-text fallback

  -- Audit trail: immutable v1 snapshot at AI creation time
  draft_v1_subject   TEXT NOT NULL,
  draft_v1_body_html TEXT NOT NULL,

  -- Provenance: what we cloned from
  cloned_from_provider     TEXT,              -- 'gmail' | 'constant_contact'
  cloned_from_id           TEXT,              -- source message/campaign id

  scheduled_send_at  TIMESTAMPTZ,             -- when we intend to send
  sent_at            TIMESTAMPTZ,
  sent_provider_id   TEXT,                    -- Gmail message id or CC campaign id

  status             TEXT NOT NULL DEFAULT 'drafted'
    CHECK (status IN (
      'drafted',
      'approved',
      'scheduled',
      'sent',
      'held',
      'cancelled',
      'failed'
    )),

  approved_at        TIMESTAMPTZ,
  approved_by        TEXT,
  approval_channel   TEXT,                    -- 'dashboard' | 'telegram'

  -- Self-learning audit score (filled at send time)
  edit_diff_score    REAL,                    -- 0 = perfect, 1 = rewritten
  edit_is_meaningful BOOLEAN,                 -- Claude Haiku judgment

  failure_reason     TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jre_email_drafts_class_id
  ON public.jre_email_drafts(class_id);
CREATE INDEX IF NOT EXISTS idx_jre_email_drafts_status
  ON public.jre_email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_jre_email_drafts_scheduled_pending
  ON public.jre_email_drafts(scheduled_send_at)
  WHERE status IN ('approved', 'scheduled');

ALTER TABLE public.jre_email_drafts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_jre_email_drafts_updated_at ON public.jre_email_drafts;
CREATE TRIGGER trg_jre_email_drafts_updated_at
  BEFORE UPDATE ON public.jre_email_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- jre_payments ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.jre_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  class_id              UUID NOT NULL REFERENCES public.jre_weekly_classes(id) ON DELETE CASCADE,
  speaker_id            UUID REFERENCES public.jre_speakers(id) ON DELETE SET NULL,

  amount_usd            INTEGER NOT NULL,
  payment_method        TEXT NOT NULL DEFAULT 'zelle'
    CHECK (payment_method IN ('zelle', 'check', 'other')),

  request_sent_at       TIMESTAMPTZ,          -- Tue night email to Rabbi Oratz
  paid                  BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at               TIMESTAMPTZ,
  paid_source           TEXT,                 -- 'sheet' | 'dashboard' | 'oratz_reply'

  reminder_count        INTEGER NOT NULL DEFAULT 0,
  last_reminder_at      TIMESTAMPTZ,

  notes                 TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (class_id)
);

CREATE INDEX IF NOT EXISTS idx_jre_payments_unpaid
  ON public.jre_payments(request_sent_at)
  WHERE paid = FALSE;

ALTER TABLE public.jre_payments ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_jre_payments_updated_at ON public.jre_payments;
CREATE TRIGGER trg_jre_payments_updated_at
  BEFORE UPDATE ON public.jre_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- jre_audit_log ---------------------------------------------------------
-- One row per draft outcome per week, used by the Saturday 8pm weekly report
-- and by the "upgrade to auto-send" eligibility engine.

CREATE TABLE IF NOT EXISTS public.jre_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  week_of            DATE NOT NULL,           -- Monday of the class week
  class_id           UUID REFERENCES public.jre_weekly_classes(id) ON DELETE SET NULL,
  draft_id           UUID REFERENCES public.jre_email_drafts(id) ON DELETE SET NULL,
  draft_type         TEXT NOT NULL,           -- denormalized for fast aggregation

  was_edited           BOOLEAN NOT NULL,
  edit_diff_score      REAL,
  edit_is_meaningful   BOOLEAN,

  was_sent_on_time     BOOLEAN,
  was_sent_at_all      BOOLEAN,
  human_intervention   BOOLEAN NOT NULL DEFAULT FALSE,

  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jre_audit_log_week_of
  ON public.jre_audit_log(week_of DESC);
CREATE INDEX IF NOT EXISTS idx_jre_audit_log_draft_type_week
  ON public.jre_audit_log(draft_type, week_of DESC);

ALTER TABLE public.jre_audit_log ENABLE ROW LEVEL SECURITY;

-- ---- jre_automation_flags --------------------------------------------------
-- Single-row table (id=1) tracking which draft_types have been upgraded to
-- full auto-send after hitting 4+ perfect-week streak.

CREATE TABLE IF NOT EXISTS public.jre_automation_flags (
  id INT PRIMARY KEY DEFAULT 1,

  email_speaker_auto   BOOLEAN NOT NULL DEFAULT FALSE,
  email_cc_1_auto      BOOLEAN NOT NULL DEFAULT FALSE,
  email_cc_2_auto      BOOLEAN NOT NULL DEFAULT FALSE,
  email_payment_auto   BOOLEAN NOT NULL DEFAULT FALSE,
  email_reminder_auto  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Global kill switch — if flipped TRUE, all auto-send disabled, everything
  -- goes back to dashboard/Telegram approval queue.
  kill_switch          BOOLEAN NOT NULL DEFAULT FALSE,
  kill_switch_reason   TEXT,

  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (id = 1)
);

INSERT INTO public.jre_automation_flags (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.jre_automation_flags ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_jre_automation_flags_updated_at ON public.jre_automation_flags;
CREATE TRIGGER trg_jre_automation_flags_updated_at
  BEFORE UPDATE ON public.jre_automation_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- Foreign keys from jre_weekly_classes back to jre_email_drafts ---------
-- (Created here after both tables exist; optional, helps referential integrity
--  but we keep them nullable so a class can be created before drafts exist.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_weekly_classes_speaker_draft'
  ) THEN
    ALTER TABLE public.jre_weekly_classes
      ADD CONSTRAINT fk_weekly_classes_speaker_draft
      FOREIGN KEY (email_speaker_draft_id)
      REFERENCES public.jre_email_drafts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_weekly_classes_cc1_draft'
  ) THEN
    ALTER TABLE public.jre_weekly_classes
      ADD CONSTRAINT fk_weekly_classes_cc1_draft
      FOREIGN KEY (email_cc_1_draft_id)
      REFERENCES public.jre_email_drafts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_weekly_classes_cc2_draft'
  ) THEN
    ALTER TABLE public.jre_weekly_classes
      ADD CONSTRAINT fk_weekly_classes_cc2_draft
      FOREIGN KEY (email_cc_2_draft_id)
      REFERENCES public.jre_email_drafts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_weekly_classes_payment_draft'
  ) THEN
    ALTER TABLE public.jre_weekly_classes
      ADD CONSTRAINT fk_weekly_classes_payment_draft
      FOREIGN KEY (email_payment_draft_id)
      REFERENCES public.jre_email_drafts(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_weekly_classes_reminder_draft'
  ) THEN
    ALTER TABLE public.jre_weekly_classes
      ADD CONSTRAINT fk_weekly_classes_reminder_draft
      FOREIGN KEY (email_reminder_draft_id)
      REFERENCES public.jre_email_drafts(id) ON DELETE SET NULL;
  END IF;
END
$$;
