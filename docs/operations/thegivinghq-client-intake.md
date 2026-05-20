# thegivinghq — new client intake checklist

When a nonprofit wants to fundraise on thegivinghq, this is **exactly** what you need to collect from them before they can take their first donation. Designed to be done in one phone call or Google Form.

---

## Hard prerequisite

Before you collect anything else, **confirm they have an OJC Fund account**.

- If yes → proceed below.
- If no → send them to <https://www.ojcfund.org> or 1-718-599-1400 to open one. We cannot onboard them on thegivinghq until OJC has issued them an org account.

---

## Info to collect (5 fields)

| Field | What it is | Why we need it | Where it goes |
|---|---|---|---|
| **Legal organization name** | Exactly as registered with the IRS (e.g. "Tomchei Shabbos of Lakewood Inc.") | Must match OJC's records or the auto key-lookup fails | `organizations.legal_name` |
| **Display name** | Short, friendly version (e.g. "Tomchei Lakewood") | Used in donor-facing copy: "Powered by [name]", receipts, tax notes | `organizations.name` |
| **EIN / Tax ID** | 9-digit federal tax ID. No dashes — we strip them. | Used to auto-fetch their OJC API key via OJC's lookup endpoint | `organizations.tax_id` |
| **Admin email** | The person on their side who handles donations/receipts | All payment-failure alerts and OJC issues route here | `organizations.contact_email` |
| **Admin phone** *(optional)* | Direct line for the admin | Fallback when email bounces | `organizations.contact_phone` |
| **Logo URL** *(optional)* | A hosted PNG/SVG, ~512px square | Branding on their campaign pages and receipts | `organizations.logo_url` |

---

## What happens after you submit the form

1. Our `/admin/organizations` UI calls `POST /api/admin/organizations` with the data.
2. The server calls `GET https://api.ojcfund.org:3391/api/organizations/orgapikey/{taxId}` to fetch their OJC API key.
3. **If OJC returns a key → status = `verified`. They can accept donations immediately.**
4. **If OJC can't auto-find them** (name mismatch, IRS data lag) → status = `pending`. The org row in the admin UI shows an "Ask OJC" panel with a pre-filled email to mk@ojcfund.org. Send it. When Mrs. Stein replies with the key, paste it into the manual-key field on the org row. Status flips to `verified`.

---

## Creating their first campaign

1. Open `/admin/campaigns` → **New campaign**.
2. Fill slug + title.
3. **Pick the owning org from the dropdown.** Orgs without an OJC key on file are disabled — they need to be verified first.
4. Submit. The system auto-populates the campaign's tax-deductible note and EIN from the org, so receipts and the public page show the correct nonprofit (not "JRE EIN 20-8978145").

---

## Going live for them

Their campaign URL is `https://thejre.org/campaign/{slug}` (once thegivinghq is its own domain, it'll be `https://thegivinghq.com/c/{slug}`). Share it with the org. Donations through the OJC Fund tile charge their OJC account directly.

---

## What we still need from OJC (one-time, platform-level)

These aren't per-client — they're platform-wide:

- **Production Basic Auth credentials** from Mrs. Stein. The `developers_test` / `6hjw8c0nx5y4v2ll` we have are sandbox-only and will 401 against any real org. Email mk@ojcfund.org to request.
- **Confirmation of the encrypted test OrgId** for sandbox end-to-end testing. The PDF gave us `2182` as the human-readable test orgID but examples use an encrypted form like `SRjLgmeLOyOnVg_JxkwYHw==`. Ask Mrs. Stein which to pass in `OrgId` for sandbox.

---

## What we do NOT need from clients

We sometimes ask too much — keep the intake tight. Things we **don't** need:

- ❌ Their OJC API key. We fetch it automatically via the EIN lookup. They only need to send it if our lookup fails.
- ❌ Bank info. OJC moves money directly between donor DAFs and the org's OJC account. We never touch bank rails.
- ❌ Stripe / Banquest details. Those are JRE-side credit-card processors — irrelevant to OJC-only clients.
- ❌ Their 501(c)(3) determination letter. OJC requires it on their side; we trust their verification.
