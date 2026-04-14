import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: e } = await sb.from("events").select("id").eq("slug", "friday-night-live-april-2026").single();
const { error, count } = await sb.from("event_sponsorships").delete({ count: "exact" }).eq("event_id", e.id).lt("price", 300);
if (error) { console.error(error); process.exit(1); }
console.log("deleted", count, "low-price tiers");
