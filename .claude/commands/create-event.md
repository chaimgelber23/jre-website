# Create Event

Full event creation workflow for the JRE website. This command handles everything needed to create a new event so it's immediately live and functional.

## What you need to gather from the user

Ask for ALL of the following before doing anything:

1. **Event name** (title)
2. **Date** (YYYY-MM-DD)
3. **Start time** (and end time if applicable)
4. **Location** (default: "JRE Center - 1495 Weaver Street, Scarsdale, NY 10583")
5. **Description** (1-2 sentences)
6. **Price per adult** (number)
7. **Kids price** (0 = hidden, >0 = shown)
8. **Speaker** (optional — only set if there's a featured speaker)
9. **Theme color**: `null` (default orange), `"womens"` (dusty rose), `"black"` (dark/premium)
10. **Confetti colors**: 3-5 hex colors from the event flyer
11. **Sponsorship tiers** (name, price, fair_market_value for each — or none)
12. **Event image** (user provides file path or URL)

## Steps to execute (in order)

### Step 1: Create the event in Supabase
POST to `/api/admin/events` with all event data. The slug is auto-generated from the title.

### Step 2: Add sponsorship tiers
If sponsorships exist, add each via the Supabase `event_sponsorships` table tied to the event ID.

### Step 3: Upload the event image
Copy the image to `/public/images/events/[slug].jpg` (or .png).
Update the event's `image_url` in Supabase to `/images/events/[slug].jpg`.

### Step 4: Verify the Google Sheet tab
The sheet tab is auto-created on first registration. But verify the sheet name will be correct:
- `slugToSheetName(slug)` converts the slug to a tab name
- e.g., "scotch-steak-seder" → "ScotchSteakSeder", "purim-2026" → "Purim26"
- The columns are dynamic: Kids column only appears if `kids_price > 0`, Sponsorship columns only if tiers exist

### Step 5: Verify everything
- Hit `https://thejre.org/events/[slug]` and confirm the page loads
- Check that the event appears on `https://thejre.org/events`
- Confirm the registration form shows the correct pricing

## Sheet sync details (for reference)
- Sheets auto-sync on every registration — no manual step needed
- If something breaks, call `POST /api/admin/events/reset-sheet` with `{"slug": "the-slug"}` to wipe and re-sync the tab from Supabase
- The existing sync endpoint at `/api/admin/events/[eventId]/sync-sheets` can also backfill without wiping
- Columns are dynamic per event: Kids column hidden when `kids_price = 0`, Sponsorship columns hidden when no tiers

## Important rules
- NEVER use `syncRegistrationToSheets()` — ALWAYS use `appendEventRegistration()`
- Sponsorship tiers REPLACE base pricing (not added on top)
- Phone number is OPTIONAL for registrations
- Theme color should match the event flyer/banner colors
- CTA buttons must NOT have Lucide icons — text-only + shimmer animation
