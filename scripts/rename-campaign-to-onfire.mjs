#!/usr/bin/env node
/**
 * Rename the June 2026 campaign → "ON FIRE" and refresh goal/dates/copy.
 *
 * - Slug: jre-june-2026 → onfire   (so URL becomes /campaign/onfire)
 * - Title: "ON FIRE — JRE June Campaign 2026"
 * - Goal: $300,000
 * - Dates: 2026-06-07 → 2026-06-08
 * - story_md: verbatim Rabbi's doc sectioned by Brochure / Easel Poster /
 *   General Flier / Matcher Flier (First Side + Second Side), plus matcher tiers.
 *
 * Idempotent: safe to re-run. Will update the existing campaign row
 * (matched by either new or old slug) in place.
 *
 * Usage: node scripts/rename-campaign-to-onfire.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);

const OLD_SLUG = "jre-june-2026";
const NEW_SLUG = "onfire";

// About copy pulled from thejre.org/about (Mission section).
const STORY_MD = [
  "## Empower. Engage. Inspire.",
  "",
  "The JRE was founded with a clear mission: to enable Jews of all backgrounds to access the deep and meaningful wisdom of Judaism in a way that is relevant to their daily lives.",
  "",
  "We believe that Judaism is alive, vibrant, and incredibly relevant. Our goal is to create experiences — classes, events, and community gatherings — that inspire, educate, and connect.",
  "",
  "Whether you're exploring your heritage for the first time or deepening your existing practice, there's a place for you at the JRE.",
  "",
  "Since 2009, the JRE has been providing engaging events, sophisticated classes, and all-around meaningful Jewish experiences — building a connected community from across Westchester who come to connect, learn, and be inspired.",
].join("\n");

// Homepage "About The JRE" video — same one shown on the main site.
const VIDEO_URL = "https://www.youtube.com/embed/-pmAhUobfUM";

// Hero carousel images — JRE event photography from the main site.
const HERO_IMAGE_URLS = [
  "/images/events/JREBensoussan.jpeg",
  "/images/events/JREevent.jpg",
  "/images/events/Dinner.jpg",
  "/images/events/ScotchNSteak.jpg",
  "/images/events/Israel.jpg",
];

const OG_IMAGE_URL = "/images/events/JREBensoussan.jpeg";

async function main() {
  // Find the campaign row by either old or new slug
  const { data: rows, error: findErr } = await supabase
    .from("campaigns")
    .select("id, slug, title")
    .or(`slug.eq.${OLD_SLUG},slug.eq.${NEW_SLUG}`);
  if (findErr) throw findErr;

  if (!rows || rows.length === 0) {
    console.error(`No campaign found with slug "${OLD_SLUG}" or "${NEW_SLUG}". Run seed-jre-june-campaign.mjs first.`);
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error(`Found multiple campaigns matching — resolve manually:`, rows);
    process.exit(1);
  }

  const campaign = rows[0];
  console.log(`Updating campaign "${campaign.title}" (slug=${campaign.slug}, id=${campaign.id})`);

  const startAt = new Date("2026-06-07T09:00:00-04:00").toISOString(); // Sun 9 AM ET
  const endAt   = new Date("2026-06-08T21:00:00-04:00").toISOString(); // Mon 9 PM ET

  const basePatch = {
    slug: NEW_SLUG,
    title: "ON FIRE — JRE June Campaign 2026",
    tagline: "Bringing you experiences that are On Fire. Torah. Events. Teachers. Brisket. All On Fire.",
    goal_cents: 30_000_000, // $300,000
    start_at: startAt,
    end_at: endAt,
    story_md: STORY_MD,
    video_url: VIDEO_URL,
    hero_image_url: HERO_IMAGE_URLS[0],
    og_image_url: OG_IMAGE_URL,
    theme_color: "#EF8046", // JRE brand orange — matches main site
    share_text: "JRE is ON FIRE this June 7–8. Join us in raising $300,000 to power Torah, Events, and Experiences that are On Fire.",
  };

  // Try with hero_image_urls (requires migration campaigns_hero_image_urls.sql).
  // Fall back to single-image patch if the column doesn't exist yet.
  let { error: updErr } = await supabase
    .from("campaigns")
    .update({ ...basePatch, hero_image_urls: HERO_IMAGE_URLS })
    .eq("id", campaign.id);

  if (updErr && updErr.message?.includes("hero_image_urls")) {
    console.warn("⚠️  hero_image_urls column missing — apply supabase/migrations/campaigns_hero_image_urls.sql to enable the carousel. Falling back to single hero_image_url.");
    ({ error: updErr } = await supabase.from("campaigns").update(basePatch).eq("id", campaign.id));
  }
  if (updErr) throw updErr;

  console.log(`\n✅ Campaign renamed.`);
  console.log(`   New slug: ${NEW_SLUG}`);
  console.log(`   URL:      /campaign/${NEW_SLUG}`);
  console.log(`   Goal:     $300,000`);
  console.log(`   Dates:    2026-06-07 → 2026-06-08`);
  console.log(`\n   Admin:    /admin/campaigns/${campaign.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
