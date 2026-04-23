# Create Campaign

Full Charidy-style fundraising campaign creation for the JRE website. Orchestrates the campaign record, sponsor tiers, matchers, teams, causes, and FAQ so everything is ready to accept donations the moment you flip status to `live`. All data lives in Supabase — no code deploy is needed to spin up a new campaign.

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

## Skill Chain

After creating a campaign: remind the user they can call `/manage-sponsorships` to edit tiers in bulk, or visit `/admin/campaigns/<id>` for full control. If they want to add teams, ask if the pages should be linked publicly (no — default is unlisted) or shared individually.
