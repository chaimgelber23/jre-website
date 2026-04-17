/**
 * Phase 3 seed: for every speaker in jre_speakers, find their most recent
 * two Constant Contact campaigns (Email #1 and Email #2) and store the
 * activity ids on jre_speakers.cc_last_campaign_id_{1,2}.
 *
 * Also extracts the canonical Zoom link from the most recent generic
 * campaign and pins it into app_settings.
 *
 * Requires Constant Contact OAuth already completed (see
 * /admin/constant-contact page for the consent flow).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { listActiveSpeakers, upsertSpeaker } from "../src/lib/db/secretary";
import {
  listRecentCampaigns,
  findLastCampaignBySpeaker,
  getCampaignActivity,
} from "../src/lib/secretary/cc-campaigns";
import { setCanonicalZoomLink, extractZoomLink } from "../src/lib/secretary/zoom-link-guard";

async function main() {
  console.log("[cc-seed] pulling most recent 100 CC campaigns…");
  const recent = await listRecentCampaigns(100);
  console.log(`[cc-seed] got ${recent.length}`);

  // 1) Canonical Zoom link from the most recent campaign whose content has one.
  let canonical: string | null = null;
  for (const c of recent) {
    if (!c.current_activity_id) continue;
    const activity = await getCampaignActivity(c.current_activity_id);
    if (!activity?.html_content) continue;
    const link = extractZoomLink(activity.html_content);
    if (link) {
      canonical = link;
      console.log(`[cc-seed] canonical Zoom link from "${c.name}": ${link}`);
      break;
    }
  }
  if (canonical) {
    await setCanonicalZoomLink(canonical);
  } else {
    console.warn("[cc-seed] no Zoom link found in recent campaigns — set manually");
  }

  // 2) Per-speaker: find last matching campaign(s).
  const speakers = await listActiveSpeakers();
  let matched = 0;
  for (const s of speakers) {
    const last = await findLastCampaignBySpeaker(s.full_name);
    if (last?.current_activity_id) {
      await upsertSpeaker({
        full_name: s.full_name,
        cc_last_campaign_id_1: last.current_activity_id,
        // Email #2 = look for another campaign same speaker around same date
        // (we won't try to be clever here — the drafter will fall back to
        //  #1 source if #2 isn't pre-seeded)
      });
      matched++;
    }
  }
  console.log(`[cc-seed] matched past campaigns for ${matched}/${speakers.length} speakers`);
}

main().catch((err) => {
  console.error("[cc-seed] FAILED:", err);
  process.exit(1);
});
