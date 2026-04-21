import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const slug = "challah-bake-2026";

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
    title: "Challah Bake",
    description:
      "|||UNLISTED|||Join us for a warm evening of challah baking at the Oratz Home. No charge — just bring yourself. Women only.",
    date: "2026-05-13",
    start_time: "8:00 PM",
    end_time: null,
    location: "Oratz Home",
    location_url: null,
    image_url: null,
    theme_color: "womens",
    speaker: null,
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
