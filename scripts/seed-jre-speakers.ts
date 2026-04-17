/**
 * One-time seed: walk the full JRE Tuesday-speaker Google Sheet and upsert
 * each unique speaker into jre_speakers.
 *
 * Run with: npm run seed:jre-speakers
 *   (requires .env.local with GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY,
 *    JRE_SPEAKER_SHEET_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *
 * Idempotent — safe to re-run.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { aggregateSpeakerHistory } from "../src/lib/secretary/sheet-sync";
import { upsertSpeaker, listActiveSpeakers } from "../src/lib/db/secretary";

// Sheet has a separate "roster" tab at the bottom with emails + phones that
// we can enrich onto each speaker. Structure observed:
//   | Name | Typical Pay Rate | Topics | Phone | Email | Notes |
// This script reads the primary sheet history for talk counts + fees, and
// doesn't attempt to fuzzy-match the roster tab (user can wire that later
// with a targeted mini-seed once the main roster is in).

async function main() {
  console.log("[seed] aggregating speaker history from sheet…");
  const agg = await aggregateSpeakerHistory();
  console.log(`[seed] found ${agg.length} unique speakers`);

  let upserted = 0;
  for (const s of agg) {
    await upsertSpeaker({
      full_name: s.fullName,
      last_fee_usd: s.lastFeeUsd,
      total_talks: s.totalTalks,
      last_spoke_at: s.lastSpokeAt,
      source: "sheet_seed",
      is_active: true,
    });
    upserted++;
    if (upserted % 10 === 0) console.log(`[seed]   upserted ${upserted}/${agg.length}`);
  }

  const final = await listActiveSpeakers();
  console.log(`[seed] done. jre_speakers now has ${final.length} active speakers.`);
  for (const s of final.slice(0, 10)) {
    console.log(
      `  · ${s.full_name} — ${s.total_talks} talks, last $${s.last_fee_usd ?? "?"} on ${s.last_spoke_at ?? "?"}`
    );
  }
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
