-- Atomic matcher pool increment.
--
-- Replaces the read-then-write pattern in /api/campaign/[slug]/donate that
-- could lose concurrent updates and over-grant when many donors checked out
-- simultaneously during a match push.
--
-- Flow on the donate route:
--   1. Compute the requested match (amount * (multiplier - 1)).
--   2. Call apply_matcher_increment(matcher_id, requested) — returns the
--      amount actually applied after locking the row and clamping to cap.
--   3. Insert the donation with that actual amount as matched_cents.
--   4. If the donation insert fails, call revert_matcher_increment to undo.

CREATE OR REPLACE FUNCTION public.apply_matcher_increment(
  p_matcher_id UUID,
  p_requested  BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap    BIGINT;
  v_used   BIGINT;
  v_active BOOLEAN;
  v_actual BIGINT;
BEGIN
  IF p_requested IS NULL OR p_requested <= 0 THEN
    RETURN 0;
  END IF;

  -- SELECT FOR UPDATE serializes concurrent callers on this matcher row,
  -- which is what makes the increment safe under concurrent donation load.
  SELECT cap_cents, matched_cents, is_active
    INTO v_cap, v_used, v_active
    FROM public.campaign_matchers
   WHERE id = p_matcher_id
   FOR UPDATE;

  IF NOT FOUND OR NOT v_active THEN
    RETURN 0;
  END IF;

  IF v_cap IS NULL THEN
    v_actual := p_requested;
  ELSE
    v_actual := LEAST(p_requested, GREATEST(0, v_cap - v_used));
  END IF;

  IF v_actual > 0 THEN
    UPDATE public.campaign_matchers
       SET matched_cents = matched_cents + v_actual
     WHERE id = p_matcher_id;
  END IF;

  RETURN v_actual;
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_matcher_increment(
  p_matcher_id UUID,
  p_amount     BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.campaign_matchers
     SET matched_cents = GREATEST(0, matched_cents - p_amount)
   WHERE id = p_matcher_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_matcher_increment(UUID, BIGINT)
  TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.revert_matcher_increment(UUID, BIGINT)
  TO anon, authenticated, service_role;
