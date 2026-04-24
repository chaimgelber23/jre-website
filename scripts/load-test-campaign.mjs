// Concurrent-donation load test for /api/campaign/:slug/donate.
//
// Fires N pledge donations in parallel (no real card charges — uses the
// "zelle" payment method which goes through the same code path as card
// donations except it skips the gateway). Measures latency, success rate,
// and verifies the matcher pool ends up exactly correct (no lost-update
// over-grant from concurrent writes).
//
// Run against a preview/staging URL — NOT production — so test rows don't
// pollute the live counter. Test rows are tagged with `email LIKE 'load-%'`
// and cleaned up at the end.
//
// Env:
//   SITE                  — base URL, e.g. https://jre-preview.vercel.app
//   SUPABASE_SERVICE_ROLE_KEY — for cleanup + verification
//   NEXT_PUBLIC_SUPABASE_URL  — Supabase project URL
//   CAMPAIGN_SLUG         — defaults to "onfire"
//   CONCURRENCY           — number of parallel donations (default 100)
//   AMOUNT_DOLLARS        — per-donation amount (default 100)
//
// Turnstile note:
//   The donate route enforces Turnstile when TURNSTILE_SECRET_KEY is set on
//   the server. To run this load test against a deployment that has it set,
//   point TURNSTILE_SECRET_KEY at Cloudflare's dummy-pass secret in your
//   preview env: `1x0000000000000000000000000000000AA` (any token is
//   accepted). Real prod keeps its real secret.
//
//   Easiest path: run against a preview Vercel deployment without
//   TURNSTILE_SECRET_KEY at all — the lib logs a warning and lets requests
//   through.
//
// Usage:
//   SITE=https://jre-preview.vercel.app \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   NEXT_PUBLIC_SUPABASE_URL=https://yhckumlsxrvfvtwrluge.supabase.co \
//   CONCURRENCY=100 \
//   node scripts/load-test-campaign.mjs

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SITE = process.env.SITE;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SLUG = process.env.CAMPAIGN_SLUG || "onfire";
const N = parseInt(process.env.CONCURRENCY || "100", 10);
const AMOUNT = parseInt(process.env.AMOUNT_DOLLARS || "100", 10);

if (!SITE || !KEY || !SB_URL) {
  console.error("Missing env: SITE, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}
if (SITE.includes("thejre.org")) {
  console.error("Refusing to load-test against the production domain (thejre.org).");
  console.error("Set SITE to a preview/staging deployment.");
  process.exit(1);
}

const sb = createClient(SB_URL, KEY);

// ---- Look up the campaign so we can verify the matcher state ---------------

const { data: campaign, error: cErr } = await sb
  .from("campaigns")
  .select("id, title, slug")
  .eq("slug", SLUG)
  .single();

if (cErr || !campaign) {
  console.error("Campaign lookup failed:", cErr);
  process.exit(1);
}

const { data: matchers } = await sb
  .from("campaign_matchers")
  .select("*")
  .eq("campaign_id", campaign.id)
  .eq("is_active", true);

const activeMatcher = (matchers ?? [])
  .filter((m) => m.cap_cents == null || m.matched_cents < m.cap_cents)
  .sort((a, b) => Number(b.multiplier) - Number(a.multiplier))[0];

const matcherStartCents = activeMatcher?.matched_cents ?? 0;
const matcherCap = activeMatcher?.cap_cents ?? null;
const multiplier = activeMatcher ? Number(activeMatcher.multiplier) : 1;

console.log(`\n=== Load test: ${SITE}/api/campaign/${SLUG}/donate ===`);
console.log(`  campaign:    ${campaign.title} (${campaign.id})`);
console.log(`  concurrency: ${N}`);
console.log(`  per-donation:$${AMOUNT}`);
if (activeMatcher) {
  console.log(`  matcher:     ${activeMatcher.name} (${multiplier}x), used=${matcherStartCents}, cap=${matcherCap ?? "uncapped"}`);
} else {
  console.log(`  matcher:     none active`);
}

// ---- Fire N donations in parallel -------------------------------------------

function makePayload(i) {
  return {
    amount_cents: AMOUNT * 100,
    tier_id: null,
    cause_id: null,
    team_id: null,
    payment_method: "zelle",
    name: `Load Test ${i}`,
    email: `load-${Date.now()}-${i}@jre-test.local`,
    phone: null,
    is_anonymous: false,
    message: null,
    dedication_type: null,
    dedication_name: null,
    dedication_email: null,
    card: null,
    daf_sponsor: null,
    ojc_account_id: null,
    ojc: null,
    donors_fund: null,
    is_recurring: false,
    recurring_frequency: null,
    turnstile_token: "load-test",
  };
}

async function fireOne(i) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${SITE}/api/campaign/${SLUG}/donate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makePayload(i)),
    });
    const body = await r.json().catch(() => ({}));
    return { i, ok: r.ok && body.success, status: r.status, ms: Date.now() - t0, body };
  } catch (err) {
    return { i, ok: false, status: 0, ms: Date.now() - t0, error: String(err) };
  }
}

console.log(`\nFiring ${N} concurrent donations…`);
const wallStart = Date.now();
const results = await Promise.all(Array.from({ length: N }, (_, i) => fireOne(i)));
const wallMs = Date.now() - wallStart;

// ---- Stats ------------------------------------------------------------------

const okCount = results.filter((r) => r.ok).length;
const failCount = N - okCount;
const lats = results.map((r) => r.ms).sort((a, b) => a - b);
const p = (q) => lats[Math.min(lats.length - 1, Math.floor(lats.length * q))];

console.log(`\n=== Results ===`);
console.log(`  wall:        ${wallMs}ms`);
console.log(`  throughput:  ${(N / (wallMs / 1000)).toFixed(1)} req/s`);
console.log(`  success:     ${okCount}/${N}`);
console.log(`  failed:      ${failCount}/${N}`);
console.log(`  p50 latency: ${p(0.5)}ms`);
console.log(`  p95 latency: ${p(0.95)}ms`);
console.log(`  p99 latency: ${p(0.99)}ms`);
console.log(`  max latency: ${lats[lats.length - 1]}ms`);

if (failCount > 0) {
  console.log(`\n  failure breakdown:`);
  const byErr = new Map();
  for (const r of results.filter((r) => !r.ok)) {
    const key = `status=${r.status} ${r.body?.error || r.error || "unknown"}`;
    byErr.set(key, (byErr.get(key) || 0) + 1);
  }
  for (const [k, v] of byErr) console.log(`    ${v}x ${k}`);
}

// ---- Verify matcher pool ----------------------------------------------------

if (activeMatcher) {
  // Re-read the matcher row and the actual sum of matched_cents on the
  // donations we just inserted, then check they line up.
  const { data: m2 } = await sb
    .from("campaign_matchers")
    .select("matched_cents, cap_cents")
    .eq("id", activeMatcher.id)
    .single();

  const { data: rows } = await sb
    .from("campaign_donations")
    .select("matched_cents, amount_cents")
    .eq("campaign_id", campaign.id)
    .like("email", "load-%@jre-test.local");

  const actualMatchSum = (rows ?? []).reduce((s, r) => s + (r.matched_cents ?? 0), 0);
  const matcherDelta = (m2?.matched_cents ?? 0) - matcherStartCents;
  const expectedRequested = okCount * AMOUNT * 100 * Math.max(0, multiplier - 1);
  const capRoom = matcherCap != null ? Math.max(0, matcherCap - matcherStartCents) : Infinity;
  const expectedActual = Math.min(expectedRequested, capRoom);

  console.log(`\n=== Matcher pool integrity ===`);
  console.log(`  matcher delta:          ${matcherDelta}  (started ${matcherStartCents}, now ${m2?.matched_cents ?? 0})`);
  console.log(`  sum(donations.matched): ${actualMatchSum}`);
  console.log(`  expected requested:     ${expectedRequested}  (${okCount} × $${AMOUNT} × ${(multiplier - 1).toFixed(2)})`);
  console.log(`  expected actual (cap):  ${expectedActual}`);
  if (matcherDelta === actualMatchSum) {
    console.log(`  ✓ matcher counter == sum of donation rows (no lost updates)`);
  } else {
    console.log(`  ✗ MISMATCH: matcher counter (${matcherDelta}) != sum (${actualMatchSum}). Possible race.`);
  }
  if (matcherCap != null && (m2?.matched_cents ?? 0) > matcherCap) {
    console.log(`  ✗ OVER-CAP: matcher used ${m2?.matched_cents} > cap ${matcherCap}`);
  } else {
    console.log(`  ✓ under cap`);
  }
}

// ---- Cleanup ----------------------------------------------------------------

console.log(`\nCleaning up test rows…`);
const { error: delErr, count } = await sb
  .from("campaign_donations")
  .delete({ count: "exact" })
  .eq("campaign_id", campaign.id)
  .like("email", "load-%@jre-test.local");

if (delErr) {
  console.log(`  delete error: ${delErr.message}`);
} else {
  console.log(`  deleted ${count} load-test donations`);
}

if (activeMatcher && okCount > 0) {
  // Restore matcher.matched_cents to its pre-test value so the live counter
  // doesn't show fake match credit. Direct write is fine here — no donation
  // rows are pointing at it now.
  await sb
    .from("campaign_matchers")
    .update({ matched_cents: matcherStartCents })
    .eq("id", activeMatcher.id);
  console.log(`  restored matcher ${activeMatcher.name} to ${matcherStartCents}`);
}

const exitCode = failCount > 0 ? 1 : 0;
console.log(`\nDone. ${exitCode === 0 ? "PASS" : "FAIL"}`);
process.exit(exitCode);
