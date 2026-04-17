# JRE AI Secretary — Phase 1 Setup Guide

This is the end-to-end setup for the Tuesday class automation (speaker →
Email #1 → CC emails → payment → reminder → audit). Built in this repo on
top of existing Next.js + Supabase + Resend + Constant Contact + Google
Workspace infrastructure.

Plan reference: `C:\Users\chaim\.claude\plans\swift-roaming-dewdrop.md`

## What got built

**Data model** (`supabase/migrations/jre_secretary_tables.sql`)
- `jre_speakers` — master roster (name, email, phone, fee, headshot, cc anchors)
- `jre_weekly_classes` — one row per Tuesday, lifecycle state machine
- `jre_email_drafts` — every draft with v1 snapshot + audit fields
- `jre_payments` — Zelle request + reminder tracking
- `jre_audit_log` — per-draft outcome, powers the weekly report
- `jre_automation_flags` — which draft-types are upgraded to auto-send

**Lib** (`src/lib/`)
- `db/secretary.ts` — DB helpers for all 5 tables
- `telegram/sender.ts` — JRE channel + inline keyboards
- `shabbos-guard.ts` — Hebcal guard (White Plains, NY default)
- `secretary/cc-campaigns.ts` — clone past CC campaign, swap date, schedule
- `secretary/gmail-client.ts` — OAuth + send + Sent-folder search + inbox watch
- `secretary/email-drafter.ts` — clone-past-everything pattern
- `secretary/zoom-link-guard.ts` — validates against canonical link
- `secretary/sheet-sync.ts` — bidirectional sync with the 2026 tab
- `secretary/audit-engine.ts` — diff scoring + weekly report + auto-send gate
- `secretary/send-executor.ts` — actual send for approved drafts
- `secretary/cron-guard.ts` — CRON_SECRET + Shabbos checks

**Routes** (`src/app/api/`)
- 9 cron routes under `/api/cron/jre/*`
- 6 admin/approval routes under `/api/secretary/*`
- Gmail OAuth at `/api/secretary/gmail/authorize` + `/callback`
- Telegram webhook at `/api/secretary/telegram-callback`

**Admin UI** (`src/app/admin/secretary/`)
- `/admin/secretary` — this-week dashboard with approve/hold buttons
- `/admin/secretary/drafts/[id]` — preview + edit + approve
- `/admin/secretary/speakers` — speaker tracker
- `/admin/secretary/audit` — weekly accuracy + upgrade offers

**Scripts** (`scripts/`)
- `seed-jre-speakers.ts` — sheet → jre_speakers
- `seed-jre-speaker-contacts.ts` — roster tab → emails/phones
- `seed-jre-cc-history.ts` — CC campaign anchors + canonical Zoom link
- `setup-jre-crons.sh` — cron-job.org scheduling

## Setup order

### 1. Install new deps

```bash
cd jre-website
npm install
```

New deps added: `@hebcal/core`, `tsx`.

### 2. Env vars (`.env.local`)

```bash
# Already present in the repo — verify:
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...
CONSTANT_CONTACT_CLIENT_ID=...

# NEW — add these:
CRON_SECRET=<pick a random string>
NEXT_PUBLIC_BASE_URL=https://thejre.org

# JRE roster
JRE_COORDINATOR_NAME="Gitty Levi"
JRE_COORDINATOR_EMAIL=glevi@thejre.org
MRS_ORATZ_EMAIL=elishevaoratz@gmail.com
RABBI_ORATZ_EMAIL=yoratz@thejre.org

# Google Sheet
JRE_SPEAKER_SHEET_ID=1p-YWN8h6Vf3XM2MtC15OlfcoI40LMLMKw_wMZzcEb_M
JRE_SPEAKER_SHEET_TAB=2026

# Gmail OAuth (create an OAuth 2.0 Web client in Google Cloud Console)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://thejre.org/api/secretary/gmail/callback

# Telegram
JRE_TELEGRAM_BOT_TOKEN=...       # from @BotFather
TELEGRAM_CHAT_JRE=...            # chat id of your JRE Ops group
TELEGRAM_WEBHOOK_SECRET=<random> # locks down the webhook

# Shabbos guard (defaults to White Plains; override if you travel)
SHABBOS_GUARD_LAT=41.034
SHABBOS_GUARD_LNG=-73.7629
SHABBOS_GUARD_TZID=America/New_York
```

### 3. Database migration

In Supabase Dashboard → SQL Editor, paste the full contents of
`supabase/migrations/jre_secretary_tables.sql` and run. It's idempotent.

### 4. Seed speakers (one-time)

```bash
npm run seed:jre-all
```

This runs three scripts in order:
1. `seed:jre-speakers` — aggregates the 2026 tab + prior years → jre_speakers
2. `seed:jre-speaker-contacts` — scans the roster tab → emails/phones
3. `seed:jre-cc-history` — matches each speaker to their most recent CC
   campaign + pins the canonical Zoom link

After: `/admin/secretary/speakers` should show ~40 speakers.

### 5. Connect Constant Contact OAuth (if not already)

Visit `https://thejre.org/admin/constant-contact` and click Connect. Already
wired in the existing repo — this just refreshes/seeds tokens to
`app_settings.cc_access_token`.

### 6. Connect Gmail as Gitty

Visit `https://thejre.org/api/secretary/gmail/authorize` **while logged in
as `glevi@thejre.org`**. Consent to gmail.send + gmail.readonly + gmail.modify.
You'll land back on `/admin/secretary?gmail=connected`.

The refresh token is stored in `app_settings.gmail_jre_refresh_token` and
gets auto-refreshed by googleapis whenever it's close to expiry.

### 7. Wire Telegram bot

1. Create a bot at @BotFather → `/newbot`, save the token into
   `JRE_TELEGRAM_BOT_TOKEN`.
2. Create a Telegram group "JRE Ops", add your bot as admin.
3. Send any message in the group, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` to find the chat id
   (starts with `-100…`). Save as `TELEGRAM_CHAT_JRE`.
4. Set the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://thejre.org/api/secretary/telegram-callback&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

### 8. Schedule the 9 cron jobs

On cron-job.org (create a new free account if you're maxed out on the old one):

```bash
CRON_JOB_ORG_API_KEY=xxx \
JRE_CRON_SECRET=<same value as CRON_SECRET on Vercel> \
JRE_BASE_URL=https://thejre.org \
bash scripts/setup-jre-crons.sh
```

Verify at https://console.cron-job.org/jobs — you should see 9 jobs.

### 9. Week 0 dry run

Fake the Monday morning path end-to-end without real sends:

```bash
# From your machine, simulate the cron firing:
curl -H "Authorization: Bearer $CRON_SECRET" https://thejre.org/api/cron/jre/ensure-next-class

# Open /admin/secretary — confirm a class row exists for next Tuesday.
# Manually confirm a speaker from the UI (or let the inbox watcher do it).
# Run the other drafters in order, holding everything:
curl -H "Authorization: Bearer $CRON_SECRET" https://thejre.org/api/cron/jre/draft-speaker-email
curl -H "Authorization: Bearer $CRON_SECRET" https://thejre.org/api/cron/jre/draft-cc-email-1
curl -H "Authorization: Bearer $CRON_SECRET" https://thejre.org/api/cron/jre/draft-cc-email-2
curl -H "Authorization: Bearer $CRON_SECRET" https://thejre.org/api/cron/jre/draft-payment-email
```

At each step: preview the draft in the dashboard, confirm the subject/body
look right. If a CC clone looks off, open the source campaign in CC to see
what the drafter started from.

### 10. Week 1 go-live

Flip every cron on cron-job.org to enabled and let it run. Every draft still
requires your tap on Telegram (or dashboard) to ship — zero surprises.

## Auto-send upgrades

After 4 consecutive perfect weeks for a draft-type (diff score < 5%, no
human intervention, sent on time), the Saturday 8 PM audit will offer to
flip that draft-type to full auto-send. Safest first candidates:
- `email_payment` (deterministic template)
- `email_reminder` (deterministic template)
- `email_elisheva_ask` (deterministic template)

Once stable, the weekly CC clones become candidates too.

## Kill switch

If anything feels wrong, flip `jre_automation_flags.kill_switch = true` in
Supabase. Every cron will go through the motions of drafting but nothing
ships until you flip it back. Alternatively, disable the
`JRE — send approved` cron on cron-job.org.

## Troubleshooting

- **"No access token"** from CC: re-run the OAuth flow at `/admin/constant-contact`.
- **"No refresh token"** from Gmail: re-run `/api/secretary/gmail/authorize`
  while signed in as glevi@thejre.org.
- **Sheet sync failures**: ensure `GOOGLE_SERVICE_ACCOUNT_EMAIL` has Editor
  on the sheet (File → Share).
- **Shabbos guard fires at wrong times**: check `SHABBOS_GUARD_LAT`/`LNG`/`TZID`.
- **Telegram webhook not working**: check `getWebhookInfo`:
  `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

## Phase 2 (not in Phase 1 scope)

Tracked in the plan file for after 4+ perfect weeks on Phase 1:
- June fundraising campaign builder
- DonorSnap reformatter
- Pledge tracker
- Check intake
- Inbox triage AI (full inbox classification)
