-- ============================================================
-- Extend campaign_donations.payment_method CHECK to match what
-- the API actually accepts. The original migration only listed
-- ('card', 'daf', 'ojc_fund', 'check', 'zelle', 'other'), which
-- silently rejected donor selections of "donors_fund" (TDF) and
-- "fidelity" (Fidelity Charitable pledge). Result: gateway charged,
-- INSERT rejected, donor saw "Donation was processed but failed
-- to save", and even the failure-row safety net failed (same
-- constraint blocks both the success-path and failure-path inserts).
--
-- Idempotent: drops the named constraint if present, recreates
-- with the full set the TS PaymentMethod union allows.
-- ============================================================

ALTER TABLE public.campaign_donations
  DROP CONSTRAINT IF EXISTS campaign_donations_payment_method_check;

ALTER TABLE public.campaign_donations
  ADD CONSTRAINT campaign_donations_payment_method_check
  CHECK (payment_method IN (
    'card',
    'daf',
    'fidelity',
    'ojc_fund',
    'donors_fund',
    'check',
    'zelle',
    'other'
  ));

-- Verification:
--   SELECT con.conname, pg_get_constraintdef(con.oid)
--     FROM pg_constraint con
--     JOIN pg_class rel ON rel.oid = con.conrelid
--    WHERE rel.relname = 'campaign_donations'
--      AND con.conname = 'campaign_donations_payment_method_check';
-- Expect the new IN list.
