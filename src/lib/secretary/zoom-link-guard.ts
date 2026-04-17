/**
 * Zoom link validator.
 *
 * Handoff brief warned an old wrong link is floating around. We store the
 * canonical link in app_settings (seeded from the most recent CC campaign).
 * Anything that doesn't exactly match OR doesn't appear in the expected
 * shape (https://zoom.us/j/<id>?pwd=<token>) is held for human review.
 */

import { createClient } from "@supabase/supabase-js";

export const ZOOM_URL_REGEX =
  /https:\/\/(?:us\d+|www\.)?zoom\.us\/j\/\d{9,12}(?:\?pwd=[A-Za-z0-9_.-]+)?/;

const SETTING_KEY = "jre_canonical_zoom_link";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getCanonicalZoomLink(): Promise<string | null> {
  const { data } = await db()
    .from("app_settings")
    .select("value")
    .eq("key", SETTING_KEY)
    .maybeSingle();
  return (data?.value as string | undefined) ?? process.env.JRE_ZOOM_LINK ?? null;
}

export async function setCanonicalZoomLink(url: string): Promise<void> {
  await db()
    .from("app_settings")
    .upsert({ key: SETTING_KEY, value: url, updated_at: new Date().toISOString() });
}

export async function assertZoomLinkValid(
  url: string | null | undefined
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!url) return { ok: false, reason: "missing zoom link" };
  if (!ZOOM_URL_REGEX.test(url)) return { ok: false, reason: "zoom link format" };
  const canonical = await getCanonicalZoomLink();
  if (canonical && canonical !== url) {
    return { ok: false, reason: "zoom link does not match canonical" };
  }
  return { ok: true };
}

/**
 * Extract a Zoom link from arbitrary HTML/text. Used by the CC-seed script to
 * pick up the current canonical link from the most recent past campaign.
 */
export function extractZoomLink(text: string): string | null {
  const m = text.match(ZOOM_URL_REGEX);
  return m ? m[0] : null;
}
