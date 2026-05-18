import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const slug = "book-club-2026";

const { data: existing } = await supabase
  .from("events")
  .select("id,slug")
  .eq("slug", slug)
  .maybeSingle();

if (existing) {
  console.log("event already exists:", existing.id);
  process.exit(0);
}

// This event is hidden from /events via UNLISTED_EVENT_SLUGS in
// src/lib/unlisted-events.ts (link-only). Public location stays general
// (host + city); the full street address rides in the |||EMAIL||| block
// so it only reaches confirmed registrants.
const description = `The women of the JRE community are invited to a special book club evening with Chani Juravel — a beloved therapist and educator known for her warmth, sensitivity, and wisdom in approaching Torah and its application in our lives.

Together we'll reflect on and discuss Rachel Goldberg-Polin's new book, "When We See You Again" — raw and open, written in the same voice that moved the nation in the aftermath of October 7th. Rachel is an extraordinary role model of inspiration and resilience, and this conversation will be a chance to learn from her story in a meaningful way.

Our goal is to use the book as a springboard: to explore how we can lean into faith during challenging times, and to uncover the tenacity of the Jewish people that lives within each of us.

Women only. No charge — just bring yourself.

|||EMAIL|||<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #faf6f7; border-radius: 8px; padding: 24px; margin: 0 0 40px; border: 1px solid #ecdfe2;">
  <tr><td>
    <h3 style="color: #9B6B75; font-size: 11px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Venue Address</h3>
    <p style="color: #1a1a1a; font-size: 15px; margin: 0; line-height: 1.6;">Home of Joanne Dressner<br>27 Heatherbloom Road<br>Scarsdale, NY 10583</p>
  </td></tr>
</table>`;

const { data, error } = await supabase
  .from("events")
  .insert({
    slug,
    title: "Chani Juravel Book Club: When We Meet Again",
    description,
    date: "2026-06-09",
    start_time: "8:00 PM",
    end_time: null,
    location: "Home of Joanne Dressner, Scarsdale, NY",
    location_url: null,
    image_url: null,
    theme_color: "womens",
    speaker: "Chani Juravel",
    price_per_adult: 0,
    kids_price: 0,
    confetti_colors: ["#B5838D", "#D4A5AD", "#9B6B75", "#E8C8CE"],
    is_active: true,
  })
  .select()
  .single();

if (error) {
  console.error("insert failed:", error);
  process.exit(1);
}

console.log("created:", data.id, "/events/" + data.slug);
