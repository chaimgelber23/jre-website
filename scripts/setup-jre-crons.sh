#!/bin/bash
# ============================================================================
# JRE AI Secretary — cron-job.org setup
#
# Creates all 9 scheduled jobs that drive the Tuesday class pipeline. Each
# job fires a Vercel cron route; the route itself runs in <30s.
#
# All times below are in America/New_York (cron-job.org supports tz natively).
# Adjust for DST is automatic.
#
# Prereqs:
#   CRON_JOB_ORG_API_KEY — your cron-job.org API key
#   JRE_CRON_SECRET      — must match CRON_SECRET env var on Vercel
#   JRE_BASE_URL         — your deployed JRE URL (e.g. https://thejre.org)
#
# Usage:
#   CRON_JOB_ORG_API_KEY=xxx JRE_CRON_SECRET=yyy JRE_BASE_URL=https://thejre.org \
#     bash scripts/setup-jre-crons.sh
# ============================================================================

API_KEY="${CRON_JOB_ORG_API_KEY:?set CRON_JOB_ORG_API_KEY in env}"
CRON_SECRET="${JRE_CRON_SECRET:?set JRE_CRON_SECRET in env}"
BASE_URL="${JRE_BASE_URL:?set JRE_BASE_URL in env (e.g. https://thejre.org)}"
TZ="America/New_York"

create_cron() {
  local TITLE="$1"
  local URL="$2"
  local HOURS="$3"     # comma-separated for multi-hour (e.g. "9,12,15,18,21")
  local MINUTES="$4"   # e.g. "7"
  local WDAYS="$5"     # comma-separated; "1,2,3,4,5" = Mon-Fri, "2" = Tue only
  echo ""
  echo "  ▸ $TITLE   →   $HOURS:$MINUTES ($WDAYS) $TZ"
  sleep 6   # cron-job.org API throttle ~1 write/5s
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
          \"timezone\": \"$TZ\",
          \"minutes\": [$MINUTES],
          \"hours\": [$HOURS],
          \"mdays\": [-1],
          \"months\": [-1],
          \"wdays\": [$WDAYS]
        },
        \"requestMethod\": 0,
        \"extendedData\": {
          \"headers\": {
            \"Authorization\": \"Bearer $CRON_SECRET\"
          }
        }
      }
    }" | head -c 400
  echo ""
}

echo "Setting up JRE Secretary crons against $BASE_URL …"
echo "================================================================"

# 1. Monday 9:00 AM — ensure next Tuesday's class row
create_cron "JRE -ensure next class (Mon 9am)" \
  "$BASE_URL/api/cron/jre/ensure-next-class" \
  "9" "0" "1"

# 2. Inbox watch — every 3h Mon-Wed 6am-9pm
create_cron "JRE -inbox watch (Mon-Wed every 3h)" \
  "$BASE_URL/api/cron/jre/inbox-watch" \
  "6,9,12,15,18,21" "17" "1,2,3"

# 3. Thursday 10:00 AM — draft speaker confirmation email
create_cron "JRE -draft speaker email (Thu 10am)" \
  "$BASE_URL/api/cron/jre/draft-speaker-email" \
  "10" "7" "4"

# 4. Sunday 9:00 PM — draft CC email #1 (Mon 8am send)
create_cron "JRE -draft CC email 1 (Sun 9pm)" \
  "$BASE_URL/api/cron/jre/draft-cc-email-1" \
  "21" "13" "0"

# 5. Monday 9:00 PM — draft CC email #2 (Tue 9am send)
create_cron "JRE -draft CC email 2 (Mon 9pm)" \
  "$BASE_URL/api/cron/jre/draft-cc-email-2" \
  "21" "23" "1"

# 6. Tuesday 9:00 PM — draft payment request to Rabbi Oratz
create_cron "JRE -draft payment email (Tue 9pm)" \
  "$BASE_URL/api/cron/jre/draft-payment-email" \
  "21" "31" "2"

# 7. Send approved — every 15min, 7am-10pm, Sun-Fri (Shabbos guard handles Shabbat)
create_cron "JRE -send approved (hourly :43, 7am-10pm Sun-Fri)" \
  "$BASE_URL/api/cron/jre/send-approved" \
  "7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22" "43" "0,1,2,3,4,5"

# 8. Friday 10:00 AM — payment check + reminder
create_cron "JRE -payment check (Fri 10am)" \
  "$BASE_URL/api/cron/jre/payment-check" \
  "10" "51" "5"

# 9. Saturday 8:00 PM — weekly audit (motzei Shabbos; guard still applies)
create_cron "JRE -weekly audit (Sat 8pm)" \
  "$BASE_URL/api/cron/jre/weekly-audit" \
  "20" "7" "6"

echo ""
echo "================================================================"
echo "Done. Verify at: https://console.cron-job.org/jobs"
