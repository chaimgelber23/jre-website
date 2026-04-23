// End-to-end test of the /campaign/onfire funnel.
// - Seeds 2x and 3x matchers + tiers
// - Puts donations through the REAL /api/campaign/:slug/donate endpoint using
//   non-card pledge methods (so no Banquest charge happens)
// - Flips matcher activation between phases so we exercise 1x, 2x, 3x paths
// - Reads the public progress API + DB to verify totals/match/team rollups
//
// Run:
//   SERVICE_KEY="..." node scripts/e2e-campaign-test.mjs

const URL = "https://yhckumlsxrvfvtwrluge.supabase.co";
const KEY = process.env.SERVICE_KEY;
const SITE = process.env.SITE_URL || "https://thejre.org";
const CAMPAIGN_ID = "18dc277c-f8c5-4b39-9427-6cfee71773c4";
const CAMPAIGN_SLUG = "onfire";
const TEAM_ORATZ = "702a1a84-4c8d-40c0-8f2f-40f570094e84";
const TEAM_WESTCHESTER = "fd17572f-da88-4e12-8f0a-b02ddd0cedf0";

if (!KEY) {
  console.error("Missing SERVICE_KEY env var");
  process.exit(1);
}

const h = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function db(method, path, body) {
  const r = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${txt}`);
  return txt ? JSON.parse(txt) : null;
}

async function post(path, body) {
  const r = await fetch(`${SITE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

function pad(s, n) {
  s = String(s);
  return s + " ".repeat(Math.max(0, n - s.length));
}

// ---- PHASE 1: clean + seed --------------------------------------------------
console.log("\n=== PHASE 1: clean old test data & seed matchers + tiers ===");

await db("DELETE", `campaign_donations?campaign_id=eq.${CAMPAIGN_ID}&email=like.test-*`);
await db("DELETE", `campaign_matchers?campaign_id=eq.${CAMPAIGN_ID}&name=like.TEST*`);
await db("DELETE", `campaign_tiers?campaign_id=eq.${CAMPAIGN_ID}`);

const now = new Date();
const in30 = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

const matchers = await db("POST", `campaign_matchers`, [
  {
    campaign_id: CAMPAIGN_ID,
    name: "TEST 2x Match (Sponsor A)",
    multiplier: 2.0,
    cap_cents: 5000000,
    matched_cents: 0,
    active_from: now.toISOString(),
    active_until: in30,
    is_active: true,
    sort_order: 0,
  },
  {
    campaign_id: CAMPAIGN_ID,
    name: "TEST 3x Match (Sponsor B)",
    multiplier: 3.0,
    cap_cents: 5000000,
    matched_cents: 0,
    active_from: now.toISOString(),
    active_until: in30,
    is_active: false,
    sort_order: 1,
  },
]);
const m2x = matchers[0];
const m3x = matchers[1];
console.log(`Matchers seeded: 2x=${m2x.id}  3x=${m3x.id}`);

const tiers = await db("POST", `campaign_tiers`, [
  { campaign_id: CAMPAIGN_ID, amount_cents: 3600, label: "Chai", sort_order: 0, is_featured: false, hebrew_value: "18", description: null },
  { campaign_id: CAMPAIGN_ID, amount_cents: 18000, label: "Double Chai", sort_order: 1, is_featured: true, hebrew_value: "180", description: null },
  { campaign_id: CAMPAIGN_ID, amount_cents: 36000, label: "Shalom", sort_order: 2, is_featured: false, hebrew_value: null, description: null },
  { campaign_id: CAMPAIGN_ID, amount_cents: 100000, label: "Shomer", sort_order: 3, is_featured: false, hebrew_value: null, description: null },
]);
console.log(`Tiers seeded: ${tiers.length}`);

// ---- helper to hit donate endpoint ------------------------------------------
const donated = [];
async function donate(label, body) {
  const r = await post(`/api/campaign/${CAMPAIGN_SLUG}/donate`, body);
  const line = `  ${pad(label, 38)} status=${r.status} matched=$${((r.body.matched_cents ?? 0) / 100).toFixed(2)} id=${r.body.id ?? "—"}${r.body.error ? " ERR=" + r.body.error : ""}`;
  console.log(line);
  donated.push({ label, ...r.body });
  return r;
}

// ---- PHASE 2: 2x match active ------------------------------------------------
console.log("\n=== PHASE 2: 2x match active ===");

await donate("T1 $36 no-team pledge", {
  amount_cents: 3600, tier_id: tiers[0].id, cause_id: null, team_id: null,
  payment_method: "zelle",
  name: "Test One NoTeam", email: "test-one@jre-test.local", phone: null,
  is_anonymous: false, message: null,
  dedication_type: null, dedication_name: null, dedication_email: null,
  card: null, daf_sponsor: null, ojc_account_id: null, donors_fund: null,
});

await donate("T2 $180 Team Oratz", {
  amount_cents: 18000, tier_id: tiers[1].id, cause_id: null, team_id: TEAM_ORATZ,
  payment_method: "check",
  name: "Test Two Oratz", email: "test-two@jre-test.local", phone: null,
  is_anonymous: false, message: "Go Team Oratz!",
  dedication_type: null, dedication_name: null, dedication_email: null,
  card: null, daf_sponsor: null, ojc_account_id: null, donors_fund: null,
});

await donate("T3 $100 Anon Westchester in-honor", {
  amount_cents: 10000, tier_id: null, cause_id: null, team_id: TEAM_WESTCHESTER,
  payment_method: "other",
  name: "Test Three Hidden", email: "test-three@jre-test.local", phone: null,
  is_anonymous: true, message: "In honor of Rabbi Oratz",
  dedication_type: "honor", dedication_name: "Rabbi Oratz", dedication_email: null,
  card: null, daf_sponsor: null, ojc_account_id: null, donors_fund: null,
});

// ---- PHASE 3: flip to 3x ----------------------------------------------------
console.log("\n=== PHASE 3: 2x OFF, 3x ON ===");
await db("PATCH", `campaign_matchers?id=eq.${m2x.id}`, { is_active: false });
await db("PATCH", `campaign_matchers?id=eq.${m3x.id}`, { is_active: true });

await donate("T4 $250 Team Oratz 3x", {
  amount_cents: 25000, tier_id: tiers[2].id, cause_id: null, team_id: TEAM_ORATZ,
  payment_method: "zelle",
  name: "Test Four Oratz", email: "test-four@jre-test.local", phone: null,
  is_anonymous: false, message: null,
  dedication_type: "memory", dedication_name: "Beloved Parent", dedication_email: null,
  card: null, daf_sponsor: null, ojc_account_id: null, donors_fund: null,
});

await donate("T5 $500 Team Westchester 3x", {
  amount_cents: 50000, tier_id: null, cause_id: null, team_id: TEAM_WESTCHESTER,
  payment_method: "check",
  name: "Test Five Westchester", email: "test-five@jre-test.local", phone: null,
  is_anonymous: false, message: "For the kids!",
  dedication_type: null, dedication_name: null, dedication_email: null,
  card: null, daf_sponsor: null, ojc_account_id: null, donors_fund: null,
});

// ---- PHASE 4: no match ------------------------------------------------------
console.log("\n=== PHASE 4: both matchers OFF ===");
await db("PATCH", `campaign_matchers?id=eq.${m3x.id}`, { is_active: false });

await donate("T6 $72 unmatched", {
  amount_cents: 7200, tier_id: null, cause_id: null, team_id: null,
  payment_method: "other",
  name: "Test Six NoMatch", email: "test-six@jre-test.local", phone: null,
  is_anonymous: false, message: null,
  dedication_type: null, dedication_name: null, dedication_email: null,
  card: null, daf_sponsor: null, ojc_account_id: null, donors_fund: null,
});

// Leave 2x active at end so page demo shows an active match
await db("PATCH", `campaign_matchers?id=eq.${m2x.id}`, { is_active: true });
await db("PATCH", `campaign_matchers?id=eq.${m3x.id}`, { is_active: true });

// ---- PHASE 5: verification --------------------------------------------------
console.log("\n=== PHASE 5: verify DB + public APIs ===");

const rows = await db(
  "GET",
  `campaign_donations?campaign_id=eq.${CAMPAIGN_ID}&email=like.test-*` +
    `&select=name,email,amount_cents,matched_cents,payment_status,payment_method,team_id,is_anonymous,dedication_type,dedication_name,message,tier_id` +
    `&order=created_at.asc`
);
console.log("\nDB rows (test-*):");
console.log(pad("NAME", 22) + pad("AMT", 6) + pad("MATCH", 7) + pad("STATUS", 10) + pad("METHOD", 8) + pad("TEAM", 8) + "FLAGS");
for (const d of rows) {
  const team = d.team_id === TEAM_ORATZ ? "Oratz" : d.team_id === TEAM_WESTCHESTER ? "Westch" : "-";
  const flags = [
    d.is_anonymous ? "ANON" : null,
    d.dedication_type ? `${d.dedication_type}:${d.dedication_name}` : null,
    d.message ? `msg:"${d.message.slice(0, 18)}"` : null,
  ].filter(Boolean).join(" ");
  console.log(
    pad(d.name, 22) +
      pad(`$${d.amount_cents / 100}`, 6) +
      pad(`$${d.matched_cents / 100}`, 7) +
      pad(d.payment_status, 10) +
      pad(d.payment_method, 8) +
      pad(team, 8) +
      flags
  );
}

const sumAmt = rows.reduce((s, d) => s + d.amount_cents, 0);
const sumMatch = rows.reduce((s, d) => s + d.matched_cents, 0);
console.log(`\nSum of test rows:  raised=$${sumAmt / 100}  matched=$${sumMatch / 100}`);

const expected = [
  { label: "T1", amt: 3600, match: 3600 }, // 2x
  { label: "T2", amt: 18000, match: 18000 }, // 2x
  { label: "T3", amt: 10000, match: 10000 }, // 2x
  { label: "T4", amt: 25000, match: 50000 }, // 3x
  { label: "T5", amt: 50000, match: 100000 }, // 3x
  { label: "T6", amt: 7200, match: 0 }, // none
];
console.log("\nExpected vs actual:");
for (let i = 0; i < expected.length; i++) {
  const e = expected[i];
  const r = rows[i];
  const ok = r && r.amount_cents === e.amt && r.matched_cents === e.match;
  console.log(
    `  ${e.label}: expect amt=$${e.amt / 100} match=$${e.match / 100} -> ${
      r ? `got amt=$${r.amount_cents / 100} match=$${r.matched_cents / 100}` : "MISSING"
    } ${ok ? "OK" : "FAIL"}`
  );
}

console.log("\nPublic /api/campaign/onfire/progress snapshot:");
const progress = await fetch(`${SITE}/api/campaign/${CAMPAIGN_SLUG}/progress`).then((r) => r.json());
const p = progress.snapshot.progress;
console.log(`  goal:    $${p.goal_cents / 100}`);
console.log(`  raised:  $${p.raised_cents / 100}`);
console.log(`  matched: $${p.matched_cents / 100}`);
console.log(`  donors:  ${p.donor_count}`);
console.log(`  unique:  ${p.unique_donors}`);
console.log(`  % goal:  ${p.percent_to_goal}%  (uses raised+matched / goal)`);

console.log("\nTeam rollups from public API:");
for (const t of progress.snapshot.teams) {
  console.log(`  ${pad(t.name, 18)} raised=$${t.raised_cents / 100}  donors=${t.donor_count}  goal=$${(t.goal_cents ?? 0) / 100}`);
}

console.log("\nDonor wall (top 10 recent public):");
for (const d of progress.snapshot.recent_donations.slice(0, 10)) {
  const team = d.team_name ? ` [${d.team_name}]` : "";
  const ded = d.dedication_type ? ` (in ${d.dedication_type} of ${d.dedication_name})` : "";
  console.log(`  ${pad(d.display_name, 22)} $${d.amount_cents / 100}${team}${ded}`);
}

const finalMatchers = await db(
  "GET",
  `campaign_matchers?campaign_id=eq.${CAMPAIGN_ID}&name=like.TEST*&select=name,multiplier,matched_cents,is_active,cap_cents&order=sort_order`
);
console.log("\nMatcher pool balances:");
for (const m of finalMatchers) {
  console.log(`  ${pad(m.name, 30)} multiplier=${m.multiplier}  pool=$${m.matched_cents / 100} / cap $${(m.cap_cents ?? 0) / 100}  active=${m.is_active}`);
}

// ---- Receipt email (separate — pledges don't trigger email in route) --------
console.log("\n=== PHASE 6: send receipt email via Resend ===");
const RESEND_KEY = process.env.RESEND_API_KEY;
if (!RESEND_KEY) {
  console.log("  SKIPPED — RESEND_API_KEY not set");
} else {
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The JRE <noreply@beta.thejre.org>",
      reply_to: "office@thejre.org",
      to: "chaimtgelber@gmail.com",
      subject: "[E2E TEST] JRE campaign receipt — On Fire",
      html: `<p>End-to-end test receipt from /campaign/onfire.</p>
<p>If you are reading this, the Resend chain works for donation confirmations.</p>
<p>Test amount: $180 (2x match applied) = $360 total impact.</p>
<p>Transaction: e2e-test-${Date.now()}</p>`,
    }),
  });
  const ej = await emailRes.json();
  console.log(`  Resend status=${emailRes.status}  id=${ej.id ?? "—"}  err=${ej.message ?? ""}`);
}

console.log("\n=== DONE — campaign page: " + SITE + "/campaign/" + CAMPAIGN_SLUG + " ===");
