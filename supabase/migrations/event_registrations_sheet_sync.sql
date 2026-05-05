-- ============================================================================
-- event_registrations sheet-sync tracking + rename-safe tab mapping
--
-- Two separate problems this migration fixes — both surfaced together by the
-- Lag Ba'omer 2026 incident on 2026-05-05:
--
-- (A) Silent failures: sheet append failures inside /api/events/[slug]/register
--     were caught + logged but the registration row had no flag. We added retry
--     logic, but a flag is the only way to drain anything that still fails.
--     Columns: synced_to_sheet, sheet_sync_attempts, sheet_sync_error.
--
-- (B) Tab renames: when admin renames a tab in the Sheets UI ("LagBaomer26" →
--     "LunchandLearn26"), the auto-generated slug-derived name no longer
--     matches and the code creates a brand-new empty tab — splitting
--     registrations across two tabs. Fix: track Google Sheets gid (sheetId,
--     immutable across renames) per event and use it to look up the current
--     title before each append.
--     Column: sheet_tab_id.
--
-- The cron /api/cron/sync-event-sheets-drain reads unsynced rows, replays the
-- append, and emails glevi+cgelber if any row stays stuck >= 30 min.
-- ============================================================================

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS synced_to_sheet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sheet_sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sheet_sync_error text;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS sheet_tab_id bigint;

-- Treat all rows that existed before this migration as already-synced. We
-- backfilled the affected tab manually on 2026-05-05; every other prior event
-- sheet has been verified. Without this UPDATE the drain cron would try to
-- re-append every historical registration and create duplicates.
UPDATE event_registrations
  SET synced_to_sheet = true
  WHERE synced_to_sheet = false;

CREATE INDEX IF NOT EXISTS event_registrations_unsynced_idx
  ON event_registrations (created_at)
  WHERE synced_to_sheet = false;
