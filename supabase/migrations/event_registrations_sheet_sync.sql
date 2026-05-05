-- ============================================================================
-- event_registrations sheet-sync tracking
--
-- Adds three columns so we can durably track whether a registration has been
-- written to its per-event Google Sheet tab. Without this, sheet append
-- failures inside /api/events/[slug]/register are caught + logged but the
-- registration row has no flag — it sits in the DB forever, invisibly
-- out-of-sync with the sheet (this exact bug hit Lag Ba'omer 2026: 16 of 19
-- registrations silently failed to reach the LagBaomer26 tab).
--
-- The cron /api/cron/sync-event-sheets-drain reads rows where
-- synced_to_sheet = false and replays the append. If a row's age > 30 min
-- after multiple attempts, it fires a Telegram + email alert to Gitty.
-- ============================================================================

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS synced_to_sheet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sheet_sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sheet_sync_error text;

CREATE INDEX IF NOT EXISTS event_registrations_unsynced_idx
  ON event_registrations (created_at)
  WHERE synced_to_sheet = false;
