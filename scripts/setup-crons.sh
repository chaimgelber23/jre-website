#!/bin/bash
# ============================================================================
# Migrate JRE cron jobs from vercel.json (paid) to cron-job.org (free).
# Run once after deploying to production with CRON_SECRET set.
#
# Usage:
#   CRON_JOB_ORG_API_KEY=xxx CRON_SECRET=yyy BASE_URL=https://thejre.org \
#     bash scripts/setup-crons.sh
# ============================================================================

API_KEY="${CRON_JOB_ORG_API_KEY:?set CRON_JOB_ORG_API_KEY in env}"
CRON_SECRET="${CRON_SECRET:?set CRON_SECRET in env}"
BASE_URL="${BASE_URL:-https://thejre.org}"

create_cron() {
  local TITLE="$1"
  local URL="$2"
  local HOURS_JSON="$3"   # e.g. "[14]" or "[11]"
  local MINS_JSON="$4"    # e.g. "[0]"
  local MDAYS_JSON="$5"   # "[-1]" = every day
  local WDAYS_JSON="$6"   # "[-1]" = every weekday; "[1]" = Mondays; etc.

  echo ""
  echo "Creating: $TITLE → $URL"
  curl -s -X PUT "https://api.cron-job.org/jobs" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"job\": {
        \"title\": \"$TITLE\",
        \"url\": \"$URL\",
        \"enabled\": true,
        \"saveResponses\": true,
        \"schedule\": {
          \"timezone\": \"UTC\",
          \"minutes\": $MINS_JSON,
          \"hours\": $HOURS_JSON,
          \"mdays\": $MDAYS_JSON,
          \"months\": [-1],
          \"wdays\": $WDAYS_JSON
        },
        \"requestMethod\": 0,
        \"extendedData\": {
          \"headers\": {
            \"Authorization\": \"Bearer $CRON_SECRET\"
          }
        }
      }
    }"
  echo ""
}

# Mirrors the previous vercel.json schedules (UTC).
# 1) Recurring donations — daily at 14:00 UTC (was "0 14 * * *")
create_cron "JRE: Process Recurring Donations" \
  "$BASE_URL/api/cron/process-recurring-donations" "[14]" "[0]" "[-1]" "[-1]"

# 2) Gallery sync — daily at 08:00 UTC (was "0 8 * * *")
create_cron "JRE: Sync Gallery" \
  "$BASE_URL/api/cron/sync-gallery" "[8]" "[0]" "[-1]" "[-1]"

# 3) Weekly outreach digest — Mondays at 11:00 UTC (was "0 11 * * 1")
create_cron "JRE: Weekly Outreach Digest" \
  "$BASE_URL/api/cron/weekly-outreach-digest" "[11]" "[0]" "[-1]" "[1]"

# 4) Monthly outreach report — 1st of month at 11:00 UTC (was "0 11 1 * *")
create_cron "JRE: Monthly Outreach Report" \
  "$BASE_URL/api/cron/monthly-outreach-report" "[11]" "[0]" "[1]" "[-1]"

echo ""
echo "Done. Verify at https://console.cron-job.org/jobs"
