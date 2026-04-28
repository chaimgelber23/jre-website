-- Simple key-value store for app-wide configuration and OAuth tokens.
-- Referenced by:
--   - src/lib/constant-contact.ts (cc_access_token, cc_refresh_token, cc_token_expires_at)
--   - src/lib/secretary/cc-campaigns.ts (same)
--   - src/lib/secretary/gmail-client.ts (gmail_jre_access_token, gmail_jre_refresh_token,
--     gmail_jre_token_expires_at, gmail_jre_user_email)
--   - src/lib/secretary/zoom-link-guard.ts (jre_canonical_zoom_link)
--   - src/app/api/cron/jre/inbox-watch/route.ts (jre_last_mrs_oratz_check,
--     jre_last_rabbi_oratz_check)
--
-- Service role writes + reads; RLS is enabled so anon key has no access.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
