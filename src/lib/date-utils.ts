/**
 * Parse a YYYY-MM-DD date string as local time (not UTC).
 *
 * new Date("2026-03-24") → midnight UTC → shows as March 23 in US Eastern.
 * This function appends T00:00:00 so it's parsed as local midnight instead.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // If it's already a full ISO string with time, just parse it
  if (dateStr.includes("T")) return new Date(dateStr);
  // YYYY-MM-DD → local midnight
  return new Date(dateStr + "T00:00:00");
}

/**
 * Format a YYYY-MM-DD date string for display, avoiding the UTC timezone shift.
 * e.g. "2026-03-24" → "March 24, 2026"
 */
export function formatEventDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const defaults: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };
  return parseLocalDate(dateStr).toLocaleDateString("en-US", options || defaults);
}
