# Reset Event Google Sheet

Wipes and rebuilds a Google Sheet tab for an event from Supabase data.

## When to use
- Sheet data looks wrong or has duplicate rows
- Columns are mismatched (e.g., event config changed after first registration)
- Sheet tab was accidentally deleted or corrupted
- Need a clean sheet for an existing event

## How to run

Ask the user which event (by name or slug), then call:

```
POST https://thejre.org/api/admin/events/reset-sheet
Body: {"slug": "the-event-slug"}
```

This will:
1. Delete the existing Google Sheet tab for that event
2. Recreate it with correct headers (dynamic based on event config)
3. Re-add every registration from Supabase in chronological order

## What the response looks like
```json
{"success": true, "sheetName": "ScotchSteakSeder", "totalRegistrations": 6, "synced": 6}
```

## Column logic
- **Kids column**: Only appears if `kids_price > 0` for that event
- **Sponsorship columns** (Sponsorship, Amount, FMV, Tax Deductible): Only appear if the event has sponsorship tiers
- **Base columns always present**: Registration ID, Timestamp, Name, Email, Phone, Adults, All Attendees, Total, Payment Method, Payment Status, Payment Reference, Notes
