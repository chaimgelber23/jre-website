/**
 * Set up cron-job.org schedules for JRE secretary BETA.
 *
 * Idempotent: by job title. If a job with the same title exists, updates it
 * instead of creating a duplicate.
 *
 * Usage: node scripts/setup-jre-crons.mjs [--dry-run]
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { readFileSync } from "node:fs";

// Allow CRON_JOB_ORG_API_KEY from seo-business as a fallback (it's the same account)
if (!process.env.CRON_JOB_ORG_API_KEY) {
  try {
    for (const line of readFileSync("c:/Users/chaim/seo-business/.env.local", "utf8").split("\n")) {
      const m = line.match(/^CRON_JOB_ORG_API_KEY\s*=\s*"?([^"\n]*)"?/);
      if (m) process.env.CRON_JOB_ORG_API_KEY = m[1];
    }
  } catch {}
}

const API_KEY = process.env.CRON_JOB_ORG_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = "https://thejre.org";
const DRY = process.argv.includes("--dry-run");

if (!API_KEY) { console.error("Missing CRON_JOB_ORG_API_KEY"); process.exit(1); }
if (!CRON_SECRET) { console.error("Missing CRON_SECRET"); process.exit(1); }

// Convert ET cron expression to UTC by adding 4-5 hours.
// We'll use UTC times; cron-job.org accepts a timezone field but to avoid
// drift across DST we just hardcode UTC-equivalents and label them.
// Currently EDT (April-November) = UTC-4 → 9am ET = 13:00 UTC.
// BETA SCOPE: only the cron that DRAFTS (no auto-send). The drafted email
// lands in the admin dashboard + Telegram for one-tap approval before it
// actually emails Elisheva. Other jobs (zelle-digest, inbox-watch) are
// commented out until user explicitly turns them on.
const JOBS = [
  {
    title: "JRE — ensure-next-class (Thu 9am ET)",
    url: `${BASE_URL}/api/cron/jre/ensure-next-class`,
    // Thursday 9am ET (currently EDT = 13:00 UTC)
    schedule: { hours: [13], minutes: [7], wdays: [4], months: [-1], mdays: [-1] },
  },
  {
    title: "JRE — chaim-daily-digest (7am ET)",
    url: `${BASE_URL}/api/cron/jre/chaim-daily-digest`,
    // Daily 7am ET = 11:00 UTC (during EDT)
    schedule: { hours: [11], minutes: [3], wdays: [-1], months: [-1], mdays: [-1] },
  },
  // {
  //   title: "JRE — zelle-digest (M/W/F 9:07am ET)",
  //   url: `${BASE_URL}/api/cron/jre/zelle-digest`,
  //   schedule: { hours: [13], minutes: [7], wdays: [1, 3, 5], months: [-1], mdays: [-1] },
  // },
  // {
  //   title: "JRE — inbox-watch (every 3h Mon-Fri)",
  //   url: `${BASE_URL}/api/cron/jre/inbox-watch`,
  //   schedule: { hours: [12, 15, 18, 21], minutes: [13], wdays: [1, 2, 3, 4, 5], months: [-1], mdays: [-1] },
  // },
];

async function listJobs() {
  const r = await fetch("https://api.cron-job.org/jobs", {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const json = await r.json();
  return json.jobs ?? [];
}

async function createOrUpdate(spec) {
  const all = await listJobs();
  const existing = all.find((j) => j.title === spec.title);

  const body = {
    job: {
      url: spec.url,
      enabled: true,
      saveResponses: true,
      requestTimeout: 30,
      title: spec.title,
      schedule: { timezone: "UTC", ...spec.schedule, expiresAt: 0 },
      requestMethod: 0, // GET
      extendedData: {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      },
    },
  };

  if (existing) {
    if (DRY) { console.log(`[DRY] would UPDATE job ${existing.jobId} — ${spec.title}`); return; }
    const r = await fetch(`https://api.cron-job.org/jobs/${existing.jobId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.error(`UPDATE failed for "${spec.title}": ${r.status}`, await r.text());
    else console.log(`✅ UPDATED #${existing.jobId} — ${spec.title}`);
  } else {
    if (DRY) { console.log(`[DRY] would CREATE — ${spec.title}`); return; }
    const r = await fetch("https://api.cron-job.org/jobs", {
      method: "PUT",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.error(`CREATE failed for "${spec.title}": ${r.status}`, await r.text());
    else {
      const j = await r.json();
      console.log(`✅ CREATED #${j.jobId} — ${spec.title}`);
    }
  }
}

console.log(`Setting up ${JOBS.length} cron-job.org jobs (mode: ${DRY ? "DRY RUN" : "LIVE"})...\n`);
for (const j of JOBS) await createOrUpdate(j);
console.log(`\nDone. View at https://console.cron-job.org/jobs`);
