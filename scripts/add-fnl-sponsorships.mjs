import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: event } = await supabase.from("events").select("id").eq("slug", "friday-night-live-april-2026").single();
if (!event) { console.error("event not found"); process.exit(1); }

await supabase.from("event_sponsorships").delete().eq("event_id", event.id);

const tiers = [
  { name: "Feeling Lucky", price: 77 },
  { name: "Gotta Have Dessert", price: 180 },
  { name: "Buffet King", price: 360 },
  { name: "Raise The Bar", price: 500 },
  { name: "Pit Master", price: 720 },
  { name: "For The Love of Torah", price: 1000 },
].map((t) => ({ event_id: event.id, name: t.name, price: t.price, fair_market_value: 0 }));

const { error } = await supabase.from("event_sponsorships").insert(tiers);
if (error) { console.error(error); process.exit(1); }
console.log("inserted", tiers.length, "tiers for", event.id);
