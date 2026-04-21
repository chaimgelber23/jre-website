/**
 * Unlisted events: accessible by direct URL /events/{slug} but hidden from
 * /events listing, /api/events, and the sitemap. Used for private/invite-only
 * events where we want the registration pipeline (Supabase + Sheets + email)
 * but not public discovery.
 *
 * To un-list an event, remove its slug from this Set.
 * To list a new event as unlisted, add its slug here.
 */
export const UNLISTED_EVENT_SLUGS = new Set<string>([
  "challah-bake-2026",
]);

export function isUnlistedSlug(slug: string | null | undefined): boolean {
  return !!slug && UNLISTED_EVENT_SLUGS.has(slug);
}
