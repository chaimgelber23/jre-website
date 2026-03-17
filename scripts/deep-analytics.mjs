import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://yhckumlsxrvfvtwrluge.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchAll() {
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await s.from('outreach_contacts')
      .select('first_name,last_name,engagement_score,background,stage,group_name,how_met,gender,source,email')
      .eq('is_active', true)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

function parseLTD(bg) {
  if (!bg) return 0;
  const m = bg.match(/Total giving: \$([0-9,.]+)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
}
function parseLastGift(bg) {
  if (!bg) return null;
  const m = bg.match(/Last gift: (\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
function parseSince(bg) {
  if (!bg) return null;
  const m = bg.match(/Donor since (\d{4})/);
  return m ? parseInt(m[1]) : null;
}
function parseYTD(bg) {
  if (!bg) return 0;
  const m = bg.match(/YTD: \$([0-9,.]+)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
}

async function main() {
  console.log('Fetching all contacts...');
  const all = await fetchAll();
  console.log(`Total contacts: ${all.length}\n`);

  // Enrich with parsed donation data
  const enriched = all.map(c => ({
    ...c,
    ltd: parseLTD(c.background),
    lastGift: parseLastGift(c.background),
    donorSince: parseSince(c.background),
    ytd: parseYTD(c.background),
  }));

  const donors = enriched.filter(c => c.ltd > 0);
  const eventAttenders = enriched.filter(c => c.how_met === 'event' || (c.background && c.background.includes('Attended JRE')));

  // ===== DONOR TIERS =====
  console.log('=== DONOR PYRAMID ===');
  const tiers = [
    { label: '$50,000+  (Founding Circle)', min: 50000 },
    { label: '$10,000+  (Major Partner)',   min: 10000 },
    { label: ' $5,000+  (Leadership)',      min: 5000  },
    { label: ' $1,000+  (Major Donor)',     min: 1000  },
    { label: '   $500+  (Sustainer)',       min: 500   },
    { label: '   $100+  (Friend)',          min: 100   },
  ];
  let prev = Infinity;
  for (const t of tiers) {
    const count = donors.filter(c => c.ltd >= t.min && c.ltd < prev).length;
    console.log(`  ${t.label}: ${count} people`);
    prev = t.min;
  }
  console.log(`  Under $100:               ${donors.filter(c => c.ltd > 0 && c.ltd < 100).length} people`);

  // ===== LAPSED DONORS =====
  console.log('\n=== LAPSED DONORS (gave $500+ but not since 2024) ===');
  console.log('These are your most urgent calls — they already believe in the mission:');
  const lapsed = donors
    .filter(c => c.ltd >= 500 && c.lastGift && c.lastGift < '2024-01-01')
    .sort((a, b) => b.ltd - a.ltd);
  lapsed.slice(0, 20).forEach(c => {
    console.log(`  $${c.ltd.toFixed(0).padStart(7)} LTD | last gift: ${c.lastGift} | ${c.first_name} ${c.last_name}${c.email ? ' <' + c.email + '>' : ' (no email)'}`);
  });
  console.log(`  ... and ${Math.max(0, lapsed.length - 20)} more`);

  // ===== ACTIVE YTD =====
  const active = donors.filter(c => c.ytd > 0).sort((a, b) => b.ytd - a.ytd);
  console.log(`\n=== ACTIVE THIS YEAR (YTD > 0): ${active.length} donors ===`);
  active.slice(0, 10).forEach(c => {
    console.log(`  $${c.ytd.toFixed(0).padStart(6)} YTD | $${c.ltd.toFixed(0).padStart(7)} LTD | ${c.first_name} ${c.last_name}`);
  });

  // ===== UPGRADE CANDIDATES =====
  console.log('\n=== UPGRADE CANDIDATES (gave $500-2000, active, could go higher) ===');
  const upgradeable = donors
    .filter(c => c.ltd >= 500 && c.ltd < 2000 && c.lastGift && c.lastGift >= '2023-01-01')
    .sort((a, b) => b.ltd - a.ltd);
  upgradeable.slice(0, 15).forEach(c => {
    console.log(`  $${c.ltd.toFixed(0).padStart(6)} LTD | ${c.first_name} ${c.last_name} | last: ${c.lastGift}`);
  });

  // ===== DONOR COHORTS =====
  console.log('\n=== NEW DONORS BY YEAR (when they first gave) ===');
  const byYear = {};
  donors.forEach(c => { if (c.donorSince) byYear[c.donorSince] = (byYear[c.donorSince] || 0) + 1; });
  Object.entries(byYear).sort().forEach(([yr, ct]) => {
    const bar = '█'.repeat(Math.round(ct / 2));
    console.log(`  ${yr}: ${String(ct).padStart(3)} donors  ${bar}`);
  });

  // ===== EVENT ATTENDERS WHO HAVEN'T DONATED =====
  console.log('\n=== EVENT ATTENDERS WHO HAVE NEVER DONATED (warm prospects) ===');
  const eventNonDonors = eventAttenders.filter(c => c.ltd === 0 && c.email);
  console.log(`  ${eventNonDonors.length} people came to events but have no donation history`);
  console.log('  These are your most natural ask pool — they already show up.');
  eventNonDonors.slice(0, 10).forEach(c => {
    console.log(`  ${c.first_name} ${c.last_name} | stage: ${c.stage} | ${c.email}`);
  });

  // ===== LIKELY SPONSORS =====
  console.log('\n=== LIKELY SPONSORS (gave $180+ in event sponsorship pattern) ===');
  const likelySponsors = donors.filter(c => {
    // $180, $360, $500, $72 are common sponsorship amounts — high LTD suggests repeat sponsoring
    return c.ltd >= 500 && c.lastGift >= '2023-01-01';
  }).sort((a, b) => b.ltd - a.ltd);
  console.log(`  ${likelySponsors.length} contacts fit the profile of repeat event sponsors`);
  likelySponsors.slice(0, 15).forEach(c => {
    console.log(`  $${c.ltd.toFixed(0).padStart(7)} | ${c.first_name} ${c.last_name} | since ${c.donorSince} | last: ${c.lastGift}`);
  });

  // ===== GENDER BREAKDOWN OF DONORS =====
  console.log('\n=== DONOR GENDER BREAKDOWN ===');
  const dg = { male: 0, female: 0, unknown: 0 };
  donors.forEach(c => dg[c.gender] = (dg[c.gender] || 0) + 1);
  console.log(`  Male donors:    ${dg.male}`);
  console.log(`  Female donors:  ${dg.female}`);
  console.log(`  Unknown gender: ${dg.unknown}`);

  // ===== RETENTION: WHO GAVE MULTIPLE YEARS =====
  console.log('\n=== MULTI-YEAR DONORS (highest retention signal) ===');
  // We don't have year-by-year breakdown but high LTD + recent gift = multi-year
  const multiYear = donors.filter(c => c.ltd >= 300 && c.donorSince && c.donorSince <= 2022 && c.lastGift >= '2024-01-01');
  console.log(`  ${multiYear.length} donors gave their first gift in 2022 or earlier AND gave in 2024+`);
  console.log('  These are your most loyal donors — they have stayed through everything.');
  multiYear.slice(0, 10).forEach(c => {
    console.log(`  ${c.first_name} ${c.last_name} | since ${c.donorSince} | $${c.ltd.toFixed(0)} LTD | last: ${c.lastGift}`);
  });

  // ===== WHAT WE'RE MISSING =====
  console.log('\n=== WHAT WE ARE MISSING ===');
  const noEmail = all.filter(c => !c.email).length;
  const noGender = all.filter(c => c.gender === 'unknown').length;
  const noStage = all.filter(c => c.stage === 'new_contact').length;
  console.log(`  ${noEmail} contacts have NO email address — can't reach them digitally`);
  console.log(`  ${noGender} contacts have UNKNOWN gender — can't assign to men's/women's team`);
  console.log(`  ${noStage} contacts at "new_contact" — no real interaction ever logged`);
  console.log(`  0 interactions logged yet — the log@ email pipeline hasn't started`);
  console.log(`  0 team members set up — nobody is assigned to anything`);
}

main().catch(console.error);
