# Date Handling — Avoid UTC Timezone Bugs

## The Problem

`new Date("YYYY-MM-DD")` parses the string as **UTC midnight**. In US timezones (UTC-5 to UTC-8), this shifts the date **back one day** when displayed with `toLocaleDateString()`.

Example: `new Date("2026-03-10")` → shows as **March 9** in Eastern time.

## The Rule

**Never use `new Date(dateString)` with a date-only string (no time component).**

### ✅ Correct — parse parts manually

```ts
const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day); // local time, no UTC shift
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};
```

### ❌ Wrong — UTC interpretation shifts the day

```ts
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-US", { ... });
};
```

## When This Applies

- Any time you format a date from the database (event dates, deadlines, etc.)
- Any `YYYY-MM-DD` string from an API or Supabase
- Both client-side and server-side rendering (SSR timezone may differ from user)

## Lesson Learned

This caused the "You're All Set" confirmation popup on the event page to show "Monday, March 9" instead of "Tuesday, March 10" for the Springtime Renewal 2026 event. Fixed Feb 2026.
