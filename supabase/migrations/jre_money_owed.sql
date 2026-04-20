-- ============================================================================
-- jre_money_owed — Generalized "money JRE owes someone" tracker
--
-- Mirrors the manual email Gitty sends (e.g. "Zelle Payments - IMPORTANT"
-- on 2026-04-20 with Yocheved Bakst $1200, Shaimos $200, Esther Wein $250,
-- Rebbetzin Fink $800).
--
-- Different from jre_payments (one row per class). This table covers
-- non-class items too: shaimos, vendors, holiday helpers, reimbursements.
--
-- The cron /api/cron/jre/zelle-digest reads OPEN rows and emails a single
-- digest to the configured payer (default elishevaoratz@gmail.com). The
-- inbox-watch cron parses "paid X" replies with Claude Haiku and flips
-- items to status='paid'.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jre_money_owed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  recipient_name      TEXT NOT NULL,
  recipient_phone     TEXT,
  recipient_email     TEXT,

  amount_usd          INTEGER NOT NULL CHECK (amount_usd > 0),
  reason              TEXT,                    -- e.g. "Purim 2026", "4/14/26 class"

  payee_email         TEXT NOT NULL DEFAULT 'elishevaoratz@gmail.com',

  status              TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'paid', 'cancelled')),

  paid_at             TIMESTAMPTZ,
  paid_method         TEXT,                    -- 'zelle' | 'check' | 'cash' | 'other'
  paid_reference      TEXT,                    -- e.g. confirmation #, last 4 of check
  paid_source         TEXT,                    -- 'inbox_reply' | 'admin' | 'manual'

  digest_send_count   INTEGER NOT NULL DEFAULT 0,
  last_digest_at      TIMESTAMPTZ,

  related_class_id    UUID REFERENCES public.jre_weekly_classes(id) ON DELETE SET NULL,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jre_money_owed_open
  ON public.jre_money_owed(payee_email)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_jre_money_owed_status
  ON public.jre_money_owed(status, created_at DESC);

ALTER TABLE public.jre_money_owed ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_jre_money_owed_updated_at ON public.jre_money_owed;
CREATE TRIGGER trg_jre_money_owed_updated_at
  BEFORE UPDATE ON public.jre_money_owed
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
