# Event Detail Page — Hero Pattern

## Rule
- **With photo**: Show full-height image hero → followed by a dark info bar with the event title, date (calendar icon), time (clock icon), and teacher/speaker (person icon).
- **Without photo**: Show the `EventPlaceholder` component (which already displays the event title and date) → followed by the same dark info bar.

## Key Points
- The placeholder hero is a fallback — it only gets replaced when a real event image exists.
- Do NOT duplicate the title/date/time info in a separate "Quick Info Bar" further down the page. One info bar below the hero is enough.
- The info bar always shows: **Date** (with Calendar icon), **Time** (with Clock icon), and **Teacher/Speaker** (with Users icon, defaults to "Mrs. Mizrahi" if no speaker is set on the event).

## File
- `src/app/events/[slug]/EventDetailClient.tsx`
