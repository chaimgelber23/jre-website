// Reset onfire campaign teams to the 4 real family teams:
// Hoffman, Oratz, Gelber, Freidberg — each with $50k goal.
//
// Also removes leftover e2e test data (TEST* matchers, test-*@jre-test.local
// donations) and retires the placeholder "Team Westchester".
//
// Run: SERVICE_KEY=... node scripts/setup-onfire-teams.mjs

const URL = "https://yhckumlsxrvfvtwrluge.supabase.co";
const KEY = process.env.SERVICE_KEY;
const CAMPAIGN_ID = "18dc277c-f8c5-4b39-9427-6cfee71773c4";
const TEAM_WESTCHESTER = "fd17572f-da88-4e12-8f0a-b02ddd0cedf0";

if (!KEY) { console.error("Missing SERVICE_KEY"); process.exit(1); }

const h = {
  apikey: KEY, Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json", Prefer: "return=representation",
};
async function db(method, path, body) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${txt}`);
  return txt ? JSON.parse(txt) : null;
}

console.log("=== Clean leftover test data ===");

// Delete test donations (those we seeded in the e2e script)
const delDonations = await db("DELETE",
  `campaign_donations?campaign_id=eq.${CAMPAIGN_ID}&email=like.test-*`);
console.log(`  deleted ${(delDonations ?? []).length} test donations`);

// Delete TEST matchers
const delMatchers = await db("DELETE",
  `campaign_matchers?campaign_id=eq.${CAMPAIGN_ID}&name=like.TEST*`);
console.log(`  deleted ${(delMatchers ?? []).length} TEST matchers`);

// Delete the placeholder Westchester team (no real donations point to it after above cleanup)
const westDonations = await db("GET",
  `campaign_donations?team_id=eq.${TEAM_WESTCHESTER}&select=id`);
if ((westDonations ?? []).length > 0) {
  console.log(`  ${westDonations.length} non-test donations still reference Westchester — soft-deleting instead`);
  await db("PATCH", `campaign_teams?id=eq.${TEAM_WESTCHESTER}`, { is_active: false });
} else {
  await db("DELETE", `campaign_teams?id=eq.${TEAM_WESTCHESTER}`);
  console.log(`  deleted Team Westchester placeholder`);
}

console.log("\n=== Upsert 4 real teams (Hoffman, Oratz, Gelber, Freidberg) ===");

const desired = [
  { slug: "hoffman",   name: "Team Hoffman",   sort_order: 0, goal_cents: 5000000 },
  { slug: "oratz",     name: "Team Oratz",     sort_order: 1, goal_cents: 5000000 },
  { slug: "gelber",    name: "Team Gelber",    sort_order: 2, goal_cents: 5000000 },
  { slug: "freidberg", name: "Team Freidberg", sort_order: 3, goal_cents: 5000000 },
];

const existing = await db("GET",
  `campaign_teams?campaign_id=eq.${CAMPAIGN_ID}&is_active=eq.true&select=id,slug,name`);
const bySlug = Object.fromEntries((existing ?? []).map((t) => [t.slug, t]));

for (const t of desired) {
  const existingTeam = bySlug[t.slug] ?? bySlug[`team-${t.slug}`];
  if (existingTeam) {
    const [updated] = await db("PATCH",
      `campaign_teams?id=eq.${existingTeam.id}`,
      { name: t.name, slug: t.slug, sort_order: t.sort_order, goal_cents: t.goal_cents, is_active: true });
    console.log(`  updated ${t.name} (${t.slug}) id=${updated.id}`);
  } else {
    const [created] = await db("POST", `campaign_teams`, [{
      campaign_id: CAMPAIGN_ID,
      slug: t.slug,
      name: t.name,
      leader_name: null,
      leader_email: null,
      avatar_url: null,
      story: null,
      goal_cents: t.goal_cents,
      sort_order: t.sort_order,
      is_active: true,
    }]);
    console.log(`  created ${t.name} (${t.slug}) id=${created.id}`);
  }
}

console.log("\n=== Final state ===");
const final = await db("GET",
  `campaign_teams?campaign_id=eq.${CAMPAIGN_ID}&is_active=eq.true&select=slug,name,goal_cents,sort_order&order=sort_order`);
for (const t of final) {
  console.log(`  ${t.sort_order}. ${t.name.padEnd(20)} slug=${t.slug.padEnd(12)} goal=$${t.goal_cents/100}`);
}

const progressAfter = await fetch("https://thejre.org/api/campaign/onfire/progress").then(r => r.json());
console.log(`\nCampaign raised=$${progressAfter.snapshot.progress.raised_cents/100} matched=$${progressAfter.snapshot.progress.matched_cents/100} donors=${progressAfter.snapshot.progress.donor_count}`);
