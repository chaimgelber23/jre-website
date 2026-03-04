# Date Handling — Avoid UTC Timezone Bugs

## The Problem

`new Date("YYYY-MM-DD")` parses the string as **UTC midnight**. In US timezones (UTC-5 to UTC-8), this shifts the date **back one day** when displayed with `toLocaleDateString()` or `.getDay()` etc.

Example: `new Date("2026-03-10")` → shows as **March 9** in Eastern time.

## The Rule

**Never use `new Date(dateString)` with a date-only string (no time component).**

Always split and construct manually:

```ts
const [year, month, day] = dateStr.split("-").map(Number);
const date = new Date(year, month - 1, day); // local time, no UTC shift
```

## Where This Applies (check ALL of these)

- **Client-side formatting** — `formatDate()` helpers in page components
- **Server-side API routes** — confirmation emails, webhook payloads
- **SSR metadata** — `generateMetadata()` in Next.js page files (OpenGraph, meta descriptions)
- **Admin pages** — dashboard date displays
- **Google Sheets sync** — any date formatting before appending rows
- **Any `YYYY-MM-DD` string** from Supabase, APIs, or database queries

## ✅ Correct patterns

```ts
// Option 1: Split and construct (preferred)
const [y, m, d] = dateStr.split("-").map(Number);
const date = new Date(y, m - 1, d);

// Option 2: Append time to force local interpretation
const date = new Date(dateStr + "T00:00:00");
```

## ❌ Wrong — UTC interpretation shifts the day

```ts
new Date("2026-03-10")                    // BAD
new Date(event.date)                       // BAD
new Date(dateString).toLocaleDateString()  // BAD
```

## Checklist when writing date code

1. Search the file for `new Date(` before committing
2. If the input is a date-only string (`YYYY-MM-DD`), use the split pattern above
3. If the input is a full ISO datetime (`2026-03-10T19:30:00`), `new Date()` is fine

## Lesson Learned

This caused the confirmation popup AND the confirmation email on the event page to show "Monday, March 9" instead of "Tuesday, March 10" for the Springtime Renewal 2026 event. The bug existed in three separate locations (client component, API route, SSR metadata). Fixed Feb 2026.
