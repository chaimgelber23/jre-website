/**
 * One-shot seed that aggregates speaker stats across EVERY year tab, then
 * upserts once with true totals (avoiding the tab-by-tab clobber).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { aggregateSpeakerHistory } from "../src/lib/secretary/sheet-sync";
import { upsertSpeaker, listActiveSpeakers } from "../src/lib/db/secretary";

const TABS = ["2026", "2025", "2024", "2023", "2022", "2021", "2020"];

type Agg = {
  fullName: string;
  totalTalks: number;
  lastSpokeAt: string | null;
  lastFeeUsd: number | null;
};

async function main() {
  const merged = new Map<string, Agg>();
  for (const tab of TABS) {
    console.log(`[seed] reading ${tab}…`);
    const rows = await aggregateSpeakerHistory(tab);
    for (const r of rows) {
      const key = r.fullName.toLowerCase();
      const existing = merged.get(key) ?? {
        fullName: r.fullName,
        totalTalks: 0,
        lastSpokeAt: null,
        lastFeeUsd: null,
      };
      existing.totalTalks += r.totalTalks;
      if (
        r.lastSpokeAt &&
        (!existing.lastSpokeAt || r.lastSpokeAt > existing.lastSpokeAt)
      ) {
        existing.lastSpokeAt = r.lastSpokeAt;
        existing.lastFeeUsd = r.lastFeeUsd;
      }
      merged.set(key, existing);
    }
  }
  console.log(`[seed] aggregated ${merged.size} unique speakers across ${TABS.length} tabs`);

  let i = 0;
  for (const s of merged.values()) {
    await upsertSpeaker({
      full_name: s.fullName,
      total_talks: s.totalTalks,
      last_spoke_at: s.lastSpokeAt,
      last_fee_usd: s.lastFeeUsd,
      source: "sheet_seed_all_years",
      is_active: true,
    });
    i++;
    if (i % 10 === 0) console.log(`  upserted ${i}/${merged.size}`);
  }

  const final = await listActiveSpeakers();
  console.log(`[seed] done. total speakers in DB: ${final.length}`);
  console.log(`[seed] top 5 most recent:`);
  for (const s of final.slice(0, 5)) {
    console.log(
      `  · ${s.full_name.padEnd(40)} ${s.total_talks} talks · last $${s.last_fee_usd ?? "?"} on ${s.last_spoke_at ?? "?"}`
    );
  }
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
