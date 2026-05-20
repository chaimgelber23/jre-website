# OJC Fund integration — operating guide

Status: built 2026-05-20. Multi-tenant (JRE + thegivinghq clients).

OJC Fund is a Jewish donor-advised-fund. Donors hold a "Charity Card"; we charge
it; OJC moves the money from the donor's DAF account into the receiving
nonprofit's OJC org account. No bank fees, no credit-card fees.

## How donations flow

```
Donor enters card no + MMYY on /donate or /campaign/[slug]
   ↓
Our donate API route
   ↓
processCharityCardTransaction({ cardNo, expDate, amount, externalReferenceId, orgApiKey })
   ↓                                                        └── per-org, loaded from organizations table
POST https://api.ojcfund.org:3391/api/vouchers/processcharitycardtransaction
   ↓
200 + referenceNumber  →  saved as payment_reference="ojc_<refnum>"  →  receipt email sent
non-200  →  user-friendly error from OJC_ERROR_MESSAGES
```

## Env vars (set in `.env.local` and Vercel)

| Var | Scope | Value |
|---|---|---|
| `OJC_BASIC_USER` | Platform-wide | OJC's Basic Auth username |
| `OJC_BASIC_PASS` | Platform-wide | OJC's Basic Auth password |
| `OJC_ORG_API_KEY` | Fallback (JRE only) | JRE's org key — used by `/donate` (non-campaign) page |

The `OJC_BASIC_USER` / `OJC_BASIC_PASS` Mrs. Stein sent (developers_test /
6hjw8c0nx5y4v2ll) are **dev creds only**. To go live, email her at
mk@ojcfund.org and request production Basic Auth. Swap the values in
`.env.local` AND Vercel → Project → Settings → Environment Variables.

## Going live — checklist

1. ✅ Run migration: `supabase/migrations/organizations.sql`. Creates `organizations` table, adds `campaigns.org_id`, seeds JRE.
2. ✅ Paste env vars into Vercel (Production + Preview).
3. ⬜ Email Mrs. Stein for production Basic Auth creds.
4. ⬜ Replace dev Basic Auth in `.env.local` + Vercel once received.
5. ⬜ Manual smoke test: open `/donate`, select OJC Fund, charge $1 against a real OJC card. Expect `payment_reference="ojc_<refnum>"` in the donations table.

## Onboarding a new client to thegivinghq

Goal: ~5 minutes from "new nonprofit wants in" to "they can accept money on their campaign."

### Info to collect from the client
- **Legal name** of the nonprofit (must match what's on file with OJC)
- **EIN / Tax ID** (9 digits)
- **Contact email + phone** for the org admin
- *(Optional)* logo URL for campaign branding

### Steps
1. Have the client confirm with OJC that they have an account. If they don't, point them to OJC: <https://www.ojcfund.org> / office@ojcfund.org / 1-718-599-1400.
2. Open `/admin/organizations` in our admin panel.
3. Fill the onboarding form (name, slug, EIN, contact). Submit.
4. Behind the scenes our API calls `GET /api/organizations/orgapikey/{taxId}` against OJC. If OJC returns the org's API key, we save it and mark status="verified" — they can accept donations immediately.
5. If OJC can't auto-find the key (older/different name on file), we save the org as "pending". Then:
   - Email Mrs. Stein at mk@ojcfund.org with "Please send the OJC API key for {Org Name}, EIN {tax_id}".
   - When she replies with the key, paste it into the "Paste OJC API key" field on the org row and click "Save key". Status flips to "verified".
6. Create the client's campaign in `/admin/campaigns`. The campaign creator MUST set `org_id` to the new org's id (currently done via the SQL editor or by setting it on insert — TODO: surface in the campaign UI).
7. Send the client their campaign URL. Donations on that page now charge their OJC account directly.

### What "live" means per org
- `status="pending"` → org saved, OJC key not on file → OJC donations on their campaigns return a friendly error.
- `status="verified"` → key on file, ready to accept donations.
- `status="live"` → same as verified for charging; used by the admin to distinguish orgs in active production.
- `status="paused"` / `status="archived"` → OJC donations rejected at the donate route.

## File map

| File | Purpose |
|---|---|
| `src/lib/ojc-fund.ts` | OJC API client. `processCharityCardTransaction`, `voidCharityCardTransaction`, `validateCharityCard`, `getOrgApiKeyByTaxId`. Now accepts `orgApiKey` param for multi-tenant. |
| `src/lib/organizations.ts` | Org data layer + `onboardOrganization()` (calls OJC lookup, saves key). |
| `supabase/migrations/organizations.sql` | `organizations` table + `campaigns.org_id` FK + JRE seed row. |
| `src/app/api/donate/route.ts` | thejre.org/donate route. Loads JRE org, passes its key. |
| `src/app/api/campaign/[slug]/donate/route.ts` | Campaign donate route. Loads `campaign.org_id` → org → passes that org's key. |
| `src/app/api/admin/organizations/route.ts` | List + onboard endpoint. |
| `src/app/api/admin/organizations/[id]/route.ts` | Update endpoint (status changes, manual key paste, tax-id re-lookup). |
| `src/app/admin/organizations/page.tsx` | Admin UI. |

## OJC error codes (mapped in `OJC_ERROR_MESSAGES`)

| Code | Meaning | Donor sees |
|---|---|---|
| 451 | Amount exceeds donor's approved max | "Try a smaller amount." |
| 452 | Donor hit daily limit | "Try again tomorrow." |
| 453 | Missing OJC org id (server bug) | "Please contact us — this is on us to fix." |
| 454 | Transaction not found | "We couldn't find that OJC transaction." |
| 461 | Org not found in OJC | "JRE isn't set up correctly. Please contact us." |
| 462 | Card not valid / not activated | "Card isn't valid or activated yet." |
| 406 | Bad card number or expiry | "Card number or expiry isn't valid." |

## TODO

- Add `org_id` selector to the create-campaign admin UI (today it defaults to JRE via DB backfill, but new clients need to pick their own org).
- Move `ojc_org_api_key` into Supabase Vault before going GA on thegivinghq.
- Build a public `/org/[slug]/onboard` self-serve page where new nonprofits can submit their own EIN without going through the JRE admin.
- Switch dev Basic Auth → prod Basic Auth in Vercel once Mrs. Stein sends prod creds.
