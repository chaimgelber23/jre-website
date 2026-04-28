import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const slug = "onfire-launch-2026";

const { data: existing } = await supabase
  .from("events")
  .select("id,slug")
  .eq("slug", slug)
  .maybeSingle();

if (existing) {
  console.log("event already exists:", existing.id);
  process.exit(0);
}

const { data, error } = await supabase
  .from("events")
  .insert({
    slug,
    title: "On Fire Campaign Launch",
    description:
      "Join us at Young Israel of Scarsdale as Rabbi Farhi launches the JRE On Fire campaign — an evening of vision, inspiration, and what's ahead for our community. Adults welcome.",
    date: "2026-06-03",
    start_time: "8:00 PM",
    end_time: null,
    location: "Young Israel of Scarsdale, 1313 Weaver St, Scarsdale, NY 10583",
    location_url:
      "https://www.google.com/maps/search/?api=1&query=Young+Israel+of+Scarsdale+1313+Weaver+St+Scarsdale+NY+10583",
    image_url: null,
    theme_color: null,
    speaker: "Rabbi Farhi",
    price_per_adult: 0,
    kids_price: 0,
    confetti_colors: null,
    is_active: true,
  })
  .select()
  .single();

if (error) {
  console.error("insert failed:", error);
  process.exit(1);
}

console.log("created:", data.id, "/events/" + data.slug);
