# Create Campaign

Full Charidy-style fundraising campaign creation for the JRE website. Orchestrates the campaign record, sponsor tiers, matchers, teams, causes, and FAQ so everything is ready to accept donations the moment you flip status to `live`. All data lives in Supabase — no code deploy is needed to spin up a new campaign.

> **Before flipping any new campaign to `live`, run the "Before flipping any campaign to `live`" checklist near the bottom of this file** (matcher RPC migration applied, progress endpoint cached, optional load test on a preview). The infra is hardened to absorb a 500-viewer + concurrent-checkout rush, but only if those gates are in place. Verified end-to-end on prod 2026-04-25.

## What you need to gather from the user

Ask for the essentials first; the rest can come in follow-up or be edited in `/admin/campaigns/<id>`:

**Required**
1. **Campaign title** (e.g. "ON FIRE — JRE June 2026")
2. **Slug** (URL tail — lowercase, dashes, no spaces; auto-generate from title if missing)
3. **Goal** — dollar amount (stored as `goal_cents = dollars × 100`)
4. **Start date/time** (ISO — determines countdown & when donations are accepted)
5. **End date/time** (ISO — campaign ends)
6. **Theme color** — hex string (e.g. `#DA98B1` dusty rose, `#EF8046` JRE orange). Tints hero band, arc, accent buttons, tier popular badge.

**Strongly recommended**
7. **Tagline** — single short line under the title
8. **Story** — markdown for the About tab (long copy)
9. **Hero image(s)** — one URL, or an array for the autoplay carousel
10. **Video URL** (optional — opens inline modal; YouTube/Vimeo/MP4 auto-detected)
11. **Sponsor tiers** — list of `{amount, label, hebrew_value?, description?, is_featured?}`. Rendered as card grid with "becomes $X with match" line when a matcher is active.
12. **Matchers** — list of `{name, multiplier, cap_cents?, active_from?, active_until?, story?, logo_url?}`. When active, a `xN MATCH` badge appears above the raised $ and the donate modal shows live match math.
13. **FAQ** — array of `{q, a}` shown on the About tab as accordions.

**Optional (can be added later in admin)**
14. **Teams** — seed a few if you know them: `{slug, name, leader_name, goal_cents}`. Team pages are unlisted at `/campaign/<slug>/team/<team-slug>`.
15. **Causes** — if a single campaign splits between multiple funds
16. **Contact email / phone** — per-campaign overrides (default to office@thejre.org / 914-359-2200)
17. **Tax ID / tax-deductible note** — shown on the share band footer

**Status**: default to `draft` (page loads but no donations), flip to `scheduled` once content is final, then `live` when accepting gifts. The donate route rejects unless status is `live` or `scheduled`.

## Steps to execute (in order)

### 1. Create the campaign row
```
POST /api/admin/campaigns
```
Body: title, slug, tagline, story_md, hero_image_url, hero_image_urls (array), video_url, og_image_url, goal_cents, currency="USD", start_at, end_at, status="draft", theme_color, tax_id, tax_deductible_note, allow_anonymous=true, allow_dedication=true, allow_team=true, allow_recurring=false, share_text, is_active=true.

Response gives back `campaign.id` — capture for subsequent calls.

### 2. Add sponsor tiers
For each tier: `POST /api/admin/campaigns/<id>/tiers` with `{amount_cents, label, description, hebrew_value, is_featured, sort_order}`.

### 3. Add matchers
For each: `POST /api/admin/campaigns/<id>/matchers` with `{name, multiplier, cap_cents, active_from, active_until, story, logo_url, is_active, sort_order}`.

### 4. Add teams (if seeded at creation time)
For each: `POST /api/admin/campaigns/<id>/teams` with `{slug, name, leader_name, goal_cents, is_active=true, sort_order}`.

### 5. Add causes (if multi-fund)
For each: `POST /api/admin/campaigns/<id>/causes` with `{slug, name, description, sort_order}`.

### 6. Write FAQ (stored on the campaign row itself)
`PATCH /api/admin/campaigns/<id>` with `{ faq: [{q, a}, ...] }`.

### 7. Upload hero images
If the user provides local images, copy them to `public/campaigns/<slug>/hero-N.jpg` then `PATCH /api/admin/campaigns/<id>` with `hero_image_urls: ["/campaigns/<slug>/hero-1.jpg", ...]`. If they give URLs (S3, Rackspace, etc.), just paste them into `hero_image_urls`.

### 8. Verify
- Hit `https://thejre.org/campaign/<slug>` and confirm the page loads (hero carousel, title band, tier cards, progress arc, countdown, tabs).
- Hit `https://thejre.org/admin/campaigns/<id>` and confirm tiers/matchers/teams/FAQ rendered.
- Place a `$1` test donation if card processing is configured. Receipt email should land from `noreply@beta.thejre.org`.

### 9. Flip to live when ready
`PATCH /api/admin/campaigns/<id>` with `{ status: "live" }`.

## How the campaign page was built (architecture explainer)

If the user asks "what did you build" or wants to understand the stack, walk through this — no fluff, just the map.

**Public page** (`src/app/campaign/[slug]/page.tsx` → `CampaignClient.tsx`):
- Full-width **hero carousel** ([HeroCarousel.tsx](jre-website/src/app/campaign/%5Bslug%5D/HeroCarousel.tsx)) — autoplay, dots, video play overlay
- **Title band** in the theme accent color with campaign name + org + "About Campaign" pill
- **Sponsor tier strip** — grid of tier cards ($180/$360/..., Hebrew value, "Popular" badge, "becomes $X with match" line)
- **Progress block** — arc progress semicircle + giant $ raised + matcher badge ("xN Match")
- **Countdown strip** — D/H/M or H/M/S, decrementing client-side
- **3-col donation widget** — share / amount preview / donate
- **Tabs** — Donors (search+sort, Default/Latest/Oldest/Highest), Matchers, About (story + FAQ accordions), Teams (leaderboard), Communities
- **Donor cards** ([DonorCard.tsx](jre-website/src/app/campaign/%5Bslug%5D/DonorCard.tsx)) — avatar initials, name, amount, message (RTL-aware), dedication, time-ago, "Donated to: <team>" label
- **Share band** — Facebook / X / WhatsApp / Email / Copy link
- **Sticky mobile bar** — progress + donate
- **VideoModal.tsx** — YouTube/Vimeo/MP4 inline player
- Polls `/api/campaign/<slug>/progress` every 20s to keep totals + wall live

**Donate modal** ([DonateModal.tsx](jre-website/src/app/campaign/%5Bslug%5D/DonateModal.tsx)) — 4-step flow (amount → details → payment → success):
- Amount step: tier buttons, custom input, live "Your $X becomes $Y with xN matcher" preview
- Details step: name, email, phone, anonymous toggle, dedication (honor/memory + honoree email for notification), wall message
- Payment step: Card (Banquest) / DAF pledge / OJC Fund / Donor's Fund (TDF direct charge) / Fidelity — all methods in one modal
- Success step: confetti-free confirmation, mentions receipt email

**Team pages** (unlisted) — `src/app/campaign/[slug]/team/[teamSlug]/`:
- Breadcrumb back to main
- Team hero + name + leader
- Team-scoped progress arc + donate button (pre-fills team)
- Team-filtered donor wall
- Own share URL
- `robots: noindex, nofollow` — reachable only by direct link; main page does not link to team pages by design.

**Donate API** ([route.ts](jre-website/src/app/api/campaign/%5Bslug%5D/donate/route.ts)):
- Validates + processes card via Banquest (completed) or Donor's Fund via `createGrant` (completed), else stores pledge
- Computes match against active matcher, increments matcher pool
- Inserts into `campaign_donations`
- Fires `sendDonationConfirmation` (Resend) to donor; `sendHonoreeNotification` if dedication email set. FROM `noreply@beta.thejre.org` (Resend-verified), images link to `thejre.org`.

**Admin editor** (`src/app/admin/campaigns/[id]/page.tsx` + `DonationsPanel.tsx`):
- Core details / Story / Causes / Tiers / Matchers / Teams / FAQ — all editable via generic `CollectionEditor`
- **Donations dashboard** — stats (Paid $ / Pledged $ / Failed / Hidden / Total), search, status + visibility filters, "+ Add pledge" form for offline/manual gifts, per-row quick actions: Mark paid / Mark failed / Refund / Edit / Hide / Unhide / Note.

**Data model** (`supabase/migrations/campaigns.sql`): `campaigns`, `campaign_tiers`, `campaign_matchers`, `campaign_teams`, `campaign_causes`, `campaign_donations`, `campaign_updates` + two aggregate views (`campaign_progress`, `campaign_team_progress`) that exclude `is_hidden = true` from totals (added in `campaign_donations_is_hidden.sql`).

**Polling endpoint**: `/api/campaign/<slug>/progress` returns a fresh `CampaignSnapshot`. Called every 20s from both `CampaignClient` and `TeamClient`.

## Rules / gotchas

- **No code deploy needed** to create a campaign — all data is in Supabase. Creating rows via the admin API is enough; the next page load reflects the change.
- **hero_image_urls is an array** for the carousel; `hero_image_url` (singular) is the legacy/fallback single-image field. If both are set, the array wins.
- **Team slugs must be unique per campaign** (`(campaign_id, slug)`). Always lowercase + dashes. The team page URL is `/campaign/<slug>/team/<teamSlug>`.
- **Matcher multipliers are numeric** (2, 2.5, 3). The match formula is `matched_cents = round(amount_cents × (multiplier − 1))`, capped at `(cap_cents − matched_cents)` so the pool doesn't overflow.
- **Goal is stored in cents.** Always `dollars × 100`. Same for every `*_cents` field.
- **Donation status** values: `pending | pledged | completed | failed | refunded`. Public totals only count `completed + pledged AND is_hidden = false`.
- **Hide vs. Refund**: Hide removes a gift from the public wall + totals while preserving the record (use for test donations, duplicates, donor-requested removal). Refund is for actual money returned.
- **Unlisted team pages**: do NOT add links from the main campaign page's TeamsPanel to team pages — the whole point is that the URL is a shareable secret for team captains. `robots` is noindex.
- **Email FROM stays on `beta.thejre.org`** (that's the Resend-verified sender). Image URLs in emails point to `thejre.org` (the real site).
- **Before a donation can be tested**: campaign status must be `live` OR `scheduled`. Donate route rejects on `draft`.
- **Banquest is the card processor** (direct card input, no redirect). Donor's Fund is a separate TDF /Create grant path. Both charge immediately and set `payment_status = completed`. DAF/OJC/check/zelle/other paths go straight to `pledged`.
- **Per portfolio-wide cost discipline**: do NOT add Vercel crons for campaign-side jobs. If a scheduled job is needed (e.g. "email all donors on day 3"), use cron-job.org → POST to a campaign endpoint with `maxDuration = 60`.

## Donation-page UX gotchas (learned the hard way)

The DB orchestration (this command) is stable. The donation *page* keeps catching us. Rules:

- **Modal must reset on close, not just hide.** `DonateModal` is mounted once and toggled by `open`; without a reset effect, a donor who completes a gift and clicks Donate again lands back on the thank-you screen. Fix: a `useEffect` on `open` that clears `step`, form state, amount, tier, team, frequency, payment method when the modal closes. See [DonateModal.tsx:158-194](../../src/app/campaign/[slug]/DonateModal.tsx).
- **No icons on the Donate submit button.** Donors read "♥ Donate $36" as emoji-y / unprofessional. Keep the submit label pure text. Same rule for pill labels — "One-time / Monthly" beats any iconography.
- **No focus ring on money inputs.** A 4px `box-shadow` ring around the inline amount input clips past the adjacent Donate button on mobile and looks cheap. Use plain `border border-gray-200`, drop the `focus:` shadow. Same in the modal — no `focus-within:border-[#EF8046]` on the amount container.
- **Address autocomplete needs a real backend.** Bare Nominatim returns a lot of street-only rows ("Avenue J, Brooklyn") that aren't actual addresses a donor can pick. Filter to hits with `house_number` + `road`. Run a US-biased query in parallel with a global one. Short-circuit to Google Places or Mapbox if `GOOGLE_PLACES_API_KEY` / `MAPBOX_ACCESS_TOKEN` is set. Client: 150ms debounce, min 2 chars, AbortController to kill stale requests. See `src/app/api/geocode/route.ts`.
- **Monthly is gated, not absent.** The infra exists end-to-end (`setupRecurringPayment` → `card_ref` → `process-recurring-donations` cron appends new donation rows to the wall every 30 days). UI is behind `campaign.allow_recurring`. Flip that column `true` per campaign when ready. Before flipping, confirm: (a) cron-job.org has a daily job hitting `/api/cron/process-recurring-donations`, (b) your first real monthly donor was test-charged successfully and the card_ref saved in Banquest, (c) you have a cancel-recurring path ready.

## Before testing donations end-to-end

`USE_SANDBOX = false` in `src/lib/banquest.ts` and **stays that way**. Owner preference: never flip to sandbox for testing — the code paths/envs diverge subtly, and "it worked in sandbox" bites on switchover. Test with real charges on your own card, voided afterward.

**Canonical test plan:**
1. 2–3 real small charges ($1 each) on a card you own, covering the three charge paths that matter: credit card, DAF pledge, Donor's Fund Giving Card.
2. Verify each: row in `campaign_donations`, tile on the donor wall, receipt email arrived, honoree notification (if dedication set), Banquest Control Panel shows the txn.
3. Void every test txn in Banquest before it settles (same-day window) — voids are free; refunds after settlement cost a fee.
4. Mark the `campaign_donations` rows `is_hidden = true` or delete them so they don't pollute the public wall/totals.

**Never** put through 20+ test donations at once — Banquest has duplicate-detection on same card + same amount in a short window, and the public donor wall updates in real time on prod. A good test suite is 3 well-varied charges, not 20 copies.

## Recent additions (2026-04-24)

Things learned shipping the heart-icon removal + Donor's Fund / OJC additions to `/donate` and the campaign donate modal. Read these before scaffolding the next campaign.

### Strip emojis from every free-text donor field
Donors will paste ❤ into "in memory of" and similar dedication fields. On a memorial line that reads as flippant. **Apply the strip in two layers** — onChange (so the character never lands in state) AND at submit (defense-in-depth for any stale value that snuck through):

```ts
const EMOJI_RE = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{FE00}-\u{FE0F}\u{200D}]/gu;
const stripEmojis = (s: string) => s.replace(EMOJI_RE, "");
```

Apply to: `fullName`, `displayName`, `message`, `dedicationName`. NOT to email (`@` would survive anyway) or numeric/card fields (already digit-only). The regex catches compound ZWJ emoji and skin-tone modifiers without touching Hebrew/accented Latin. Reference: [DonateModal.tsx:34-35](../../src/app/campaign/%5Bslug%5D/DonateModal.tsx) and [donate/page.tsx](../../src/app/donate/page.tsx).

### `MethodTile` is the canonical payment-method tile
Both `/campaign/[slug]` (modal) and `/donate` (single-page) use the same 3-up grid: square card, logo or icon at top, bold label, faded subtitle, and a radio-dot in the top-left that fills with the brand orange when active. To add a new payment method (Apple Pay, Givebutter, Stripe Link, whatever), clone the tile shape — don't reinvent.

```tsx
// Tile shape — see DonateModal.tsx PaymentStep
<button onClick={() => setPaymentMethod(m)} aria-pressed={active}
  className={`relative p-3 pt-7 rounded-xl border min-h-[128px] flex flex-col items-center gap-1.5 ${
    active ? "border-[#EF8046] bg-[#fff5f0] shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
  }`}>
  <span className="absolute top-2.5 left-2.5 w-4 h-4 rounded-full border-2 ..." />
  <img src={logo} className="h-8 max-w-[110px] object-contain" />
  <div className="text-sm font-semibold">{label}</div>
  <div className="text-[11px] text-gray-500">{subtitle}</div>
</button>
```

Logo assets already in repo (don't re-source): `/public/logos/donors-fund.svg`, `/public/logos/ojc-fund.png`, `/public/logos/fidelity-charitable.png`.

### `payment_reference` prefix encodes the gateway
The simple `donations` table (used by `/donate`) doesn't have a `payment_method` column — the gateway is encoded in the `payment_reference` value: `bq_<txnid>` for Banquest, `tdf_<confirmationNumber>` for Donor's Fund, `ojc_<referenceNumber>` for OJC. The campaign-side `campaign_donations` table DOES have `payment_method`, so this prefix-only convention is just for the legacy donate flow. Any future reporting that mixes the two tables needs to handle both.

### Recurring is card-only — enforce server-side too
The "Make this monthly" toggle is hidden on the UI when the donor switches to TDF/OJC, but the server must also defensively force `is_recurring=false` on non-card payloads. Saved-card-and-our-cron is the only recurring path; never use Banquest's recurring schedules (that's a memory-locked rule). Reference: [api/donate/route.ts](../../src/app/api/donate/route.ts).

### TDF + OJC env vars are required for those branches
- `TDF_TAX_ID`, `TDF_ACCOUNT_NUMBER` — without these the donors_fund branch returns 500 "isn't fully configured." Both must be in Vercel prod env.
- OJC creds (see `lib/ojc-fund.ts`) — same deal.

When spinning up a new campaign that wants TDF/OJC, verify these env vars exist BEFORE flipping status to `live`, or the donate route will surface a confusing 500 instead of a polite "use a different method."

## Load hardening — non-negotiables (2026-04-25 audit)

A campaign goes from "a few donors trickling in" to "500 viewers + dozens of concurrent checkouts" the moment it goes live. The page-and-checkout infra has been hardened to absorb that. **These rules are now baseline — every new campaign and every code change to campaign code must follow them.** Verified end-to-end on prod 2026-04-25 (200-way RPC concurrency proof passed; 50-way viewer fan-out cached at edge).

### What's already in place — verify before launch

- ✅ **Atomic matcher pool** via Postgres RPC `apply_matcher_increment(uuid, bigint)` + `revert_matcher_increment`. The donate route never reads-then-writes `matched_cents` directly. Migration: `supabase/migrations/campaign_matcher_atomic_rpc.sql`. Verify both functions exist:
  ```sql
  SELECT proname FROM pg_proc WHERE proname IN ('apply_matcher_increment','revert_matcher_increment');
  -- Expect 2 rows
  ```
  If either is missing, the donate route logs `apply_matcher_increment failed:` and quietly drops match credit (donor pays, no match applied). Apply the migration in Supabase SQL editor before flipping status to `live`.
- ✅ **Progress endpoint cached** via `unstable_cache` (10s window) + `Cache-Control: public, s-maxage=10, stale-while-revalidate=30`. Drops Supabase load by ~99% under viewer fan-out. Verify with `curl -I https://thejre.org/api/campaign/<slug>/progress` — `X-Vercel-Cache: HIT` and `Age:` incrementing means it's working.
- ✅ **Donate route ceiling** — `export const maxDuration = 30` so a hung gateway can't pin a function instance.
- ✅ **Banquest 25s AbortController** on every gateway call (`bqFetch` wrapper in `src/lib/banquest.ts`). A slow gateway returns a clean "try again" error instead of consuming 30s of compute.
- ✅ **Visibility-aware client polling** — `CampaignClient` pauses polling while the tab is hidden, refreshes on return. Cadence 30s (down from 20s).

### Rules for any code change to the campaign surface

1. **Any new aggregate / read endpoint that gets polled by the campaign page MUST use `unstable_cache`** with a 10–30s revalidate window and an explicit `Cache-Control: s-maxage=N, stale-while-revalidate=…` header. No exceptions. Without this, every viewer hammers Supabase on every poll.
2. **Any new payment-gateway integration MUST wrap its `fetch` calls in an `AbortController` with a ≤25s timeout.** Mirror the `bqFetch` helper in `src/lib/banquest.ts`. OJC and TDF currently lack this — if the campaign starts using them at scale, retrofit them to a shared `gatewayFetch` helper.
3. **Any new counter / pool / quota mutation MUST be done via a Postgres RPC with `SELECT … FOR UPDATE`.** Never `read-then-write` from Node — that's the lost-update race the matcher RPC fixes. If you need a new pool counter (e.g. per-cause cap, per-team match), add a sibling RPC to `campaign_matcher_atomic_rpc.sql` and follow the same compensate-on-failure pattern.
4. **Any new client-side polling loop MUST pause while `document.hidden`** and refresh on `visibilitychange`. Pattern is in `CampaignClient.tsx` — copy it, don't reinvent.
5. **Any new route under `/api/campaign/[slug]/*` that does external I/O MUST set `export const maxDuration = N` (≤30).** Keep the kill switch in place.
6. **Never put a `crons: [...]` block in `vercel.json`** — campaign-side scheduled jobs (recurring donations, daily digests, reminder emails) go on cron-job.org, hitting a route that has `maxDuration = 60` or less. (Portfolio-wide rule, not just campaign.)

### Before flipping any campaign to `live`

Run this checklist. Don't trust "it worked last time" — every campaign pulls in different volumes and matcher configurations.

1. **Verify migration is applied** (above SQL).
2. **Smoke the cached progress endpoint:**
   ```bash
   curl -I https://thejre.org/api/campaign/<slug>/progress
   # Expect 200, Cache-Control: public, X-Vercel-Cache: HIT after first call
   ```
3. **Smoke the live page render:**
   ```bash
   curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://thejre.org/campaign/<slug>
   ```
4. **(Optional but recommended) Run the load test against a Vercel preview** of the same branch. Refuses to run against `thejre.org` by design:
   ```bash
   SITE=https://<preview>.vercel.app \
   SUPABASE_SERVICE_ROLE_KEY=... \
   NEXT_PUBLIC_SUPABASE_URL=https://yhckumlsxrvfvtwrluge.supabase.co \
   CONCURRENCY=100 \
   node scripts/load-test-campaign.mjs
   ```
   PASS criteria: success rate ≥99%, p95 latency <3s, "matcher counter == sum of donation rows" line prints `✓`. Test rows are auto-tagged `email LIKE 'load-%@jre-test.local'` and cleaned up.
5. **Confirm match cap is what you want.** A `null` cap means uncapped — fine for a "the more donors, the bigger the match" structure, but bad if your matcher actually has a budget. Set `cap_cents` accordingly.

### The proof, for posterity / for the boss

- 200 parallel `apply_matcher_increment` calls against a $1000-cap matcher → sum of returned actuals = exactly $1000, no over-grant. (Test in this file's history; run again any time with `node --input-type=module` against Supabase.)
- 50 parallel viewer fan-outs at the live progress endpoint → all 200, edge cache absorbs them at 70–150ms (vs 0.4–2.6s on a cold cache).
- Live deploy `9c989c3` — 2026-04-25.

If the audit ever needs to be re-run, the canonical script is at `scripts/load-test-campaign.mjs`. The matcher-RPC unit test is a one-off node block; happy to be re-codified into a script if it gets re-run more than twice.

## Recent additions (2026-04-28)

### `payment_method` lives in THREE places — keep them in sync

A donor selecting Donor's Fund got their TDF grant charged but the `campaign_donations` INSERT was rejected because `'donors_fund'` wasn't in the table's CHECK constraint. The donor saw "Donation was processed but failed to save"; we never heard about it (even the failure-row safety net hit the same constraint and silently failed too). One donor's $36 had to be reconciled by hand from a TDF confirmation email.

**The lesson — `payment_method` is duplicated across three sources of truth:**

| Source | Where | Must include every method |
|---|---|---|
| TS union | `src/types/campaign.ts` → `PaymentMethod` | yes |
| Server-side allow-list | `validMethods` in `src/app/api/campaign/[slug]/donate/route.ts` | yes |
| DB CHECK constraint | `campaign_donations.payment_method` | yes |

When adding ANY new payment method (Apple Pay, Stripe Link, Givebutter, whatever), update **all three** in the same PR. Schema is the one most likely to drift because the migration has to be pasted into Supabase Studio separately. Use the existing extension migration as a template: `supabase/migrations/campaign_donations_payment_method_extend.sql`.

Also, the `donations` table (used by `/donate`, the simple path) has no `payment_method` column at all — gateway is encoded in the `payment_reference` prefix (`bq_…`, `tdf_…`, `ojc_…`). When wiring a new gateway into that path, add a new prefix; no schema change needed.

### Donate route now alerts on post-charge save-failures

[src/app/api/campaign/[slug]/donate/route.ts](../../src/app/api/campaign/%5Bslug%5D/donate/route.ts) catch block fires `sendDonationSaveFailedAlert` whenever the INSERT fails after the gateway moved money. Email subject is `[JRE URGENT] CHARGE SUCCEEDED but DB save FAILED — $X from {donor}`, includes the gateway reference for manual reconciliation, and goes to `office@thejre.org` + `cgelber@thejre.org`. **Don't remove this alert.** It's the safety net that makes future schema/RLS drift loud instead of silent. If you fork the donate route for a new campaign type, port the catch block as-is.

### Reconciling a lost grant — the playbook

If a donor reports "donation processed but failed to save" and the row really isn't in `campaign_donations`:
1. **Search Gitty's inbox** (`scripts/find-tdf-freedberg.mjs` template) for `from:thedonorsfund.org subject:"Grant received"` around the timestamp. The TDF confirmation email has name, amount, confirmation number, address.
2. **Reconstruct the row** (`scripts/reconcile-friedberg-grant.mjs` template) with `payment_status='completed'`, `payment_reference='tdf_<conf#>'`, `daf_grant_id=<conf#>`, `daf_sponsor='The Donors\' Fund'`, and an `admin_notes` block explaining the reconstruction.
3. **Send a manual receipt** (TDF doesn't send one on the charity's behalf — the donor only got the TDF system email).

For Banquest charges, the equivalent path is the Banquest Control Panel — there's no programmatic search API in `src/lib/banquest.ts`. For OJC, same deal.

## Skill Chain

After creating a campaign: remind the user they can call `/manage-sponsorships` to edit tiers in bulk, or visit `/admin/campaigns/<id>` for full control. If they want to add teams, ask if the pages should be linked publicly (no — default is unlisted) or shared individually. **Before flipping the new campaign to `live`, run the "Before flipping any campaign to `live`" checklist above — it takes 60 seconds and catches infra drift.**
