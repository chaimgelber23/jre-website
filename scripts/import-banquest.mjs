/**
 * Import Banquest donor history (Contacts.xlsx) into outreach CRM.
 * Handles couples ("Mark & Kirsti Pesso"), sets engagement scores,
 * and assigns pipeline stages based on giving history.
 */
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const SUPABASE_URL = 'https://yhckumlsxrvfvtwrluge.supabase.co';
const SERVICE_KEY  = '';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const MALE_NAMES = new Set(['aaron','adam','alan','alex','andrew','andy','ari','ariel','asher','barry','ben','benjamin','brad','brian','bruce','carl','charles','chris','daniel','dave','david','dean','donald','doug','eli','eric','ethan','evan','frank','fred','gabe','gary','george','greg','harold','howard','isaac','jack','jacob','james','jason','jay','jeff','jeffrey','jeremy','joel','jonathan','josh','joshua','kenneth','kevin','larry','marc','mark','martin','matt','michael','mitch','mordechai','moshe','nathan','neil','noah','paul','peter','philip','randy','richard','robert','ron','ross','russel','ryan','sam','scott','sean','seth','shim','simon','sol','stanley','steve','steven','thomas','tim','todd','tom','warren','william','yehuda','zev','zusha','mitch','kenny','nechemia','zeev','menachem','avi','dov','eliyahu','gavriel','yitzchak','yosef','javier','bryan','adam','joel','joel','ouri','ravid','zev']);
const FEMALE_NAMES = new Set(['abby','abigail','adina','adrienne','alexa','alexis','alice','alison','allison','alyssa','amanda','amy','andrea','angela','ann','anna','anne','ashley','barbara','becky','beth','beverly','bonnie','brenda','carol','carolyn','cathy','chana','cheryl','claire','dana','debbie','deborah','diana','donna','eileen','elana','eleanor','elisa','elizabeth','ellen','emily','erica','esther','eve','esti','fran','gail','gloria','hannah','harriet','helen','ilana','ilissa','iris','jackie','jacqueline','janet','janice','jean','jenna','jennifer','jessica','jill','joann','joyce','judith','julie','karen','kate','kathy','kim','kirsti','laura','lauren','leah','lena','leslie','linda','lisa','lori','lynn','malka','marcia','margaret','marilyn','marsha','mary','maya','melissa','michelle','miriam','molly','nancy','naomi','nadine','natalie','nina','nomi','pamela','patricia','pearl','phyllis','rachel','rebecca','rena','renee','rivka','robin','rochelle','rose','ruth','sara','sarah','sharon','shelley','sheryl','shira','shirley','stacy','stephanie','susan','suzanne','tammy','tina','vicki','victoria','wendy','yael','yvonne']);

function detectGender(name) {
  if (!name) return 'unknown';
  const n = name.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (MALE_NAMES.has(n)) return 'male';
  if (FEMALE_NAMES.has(n)) return 'female';
  return 'unknown';
}

function excelDate(serial) {
  if (!serial || typeof serial !== 'number') return null;
  return new Date((serial - 25569) * 86400 * 1000).toISOString().split('T')[0];
}

// Parse "Mark & Kirsti" or "Ronnie and Nancy" → { primary: 'Mark', spouse: 'Kirsti' }
function parseFirstName(first) {
  if (!first) return { primary: '', spouse: null };
  const str = String(first).trim();
  const match = str.match(/^(\w+)\s*(?:&|and)\s*(\w+)/i);
  if (match) return { primary: match[1], spouse: match[2] };
  // Single name — may have middle initial
  const single = str.split(/\s+/)[0];
  return { primary: single, spouse: null };
}

function getStage(ltd, lastDate) {
  if (!lastDate) return 'new_contact';
  const lastYear = new Date(lastDate).getFullYear();
  const yearsSince = 2026 - lastYear;
  if (ltd >= 5000 && yearsSince <= 2) return 'inner_circle';
  if (ltd >= 1000) return yearsSince <= 3 ? 'deepening' : 'in_touch';
  if (ltd >= 500)  return 'in_touch';
  if (ltd >= 100)  return 'in_touch';
  return 'new_contact';
}

function getEngagementScore(ltd, ytd) {
  let score = 0;
  if (ltd >= 50000) score = 90;
  else if (ltd >= 10000) score = 75;
  else if (ltd >= 5000)  score = 60;
  else if (ltd >= 1000)  score = 45;
  else if (ltd >= 500)   score = 30;
  else if (ltd >= 100)   score = 20;
  else score = 10;
  if (ytd > 0) score += 10; // active this year
  return Math.min(score, 100);
}

async function main() {
  const wb = XLSX.readFile('C:/Users/chaim/Downloads/Contacts.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Contacts']);
  console.log(`Read ${rows.length} rows from Banquest export`);

  // Get existing contacts to match against
  const { data: existing } = await supabase
    .from('outreach_contacts')
    .select('id, first_name, last_name, email');

  const byName = new Map();
  (existing || []).forEach(c => {
    const key = `${c.first_name.toLowerCase()} ${c.last_name.toLowerCase()}`;
    byName.set(key, c.id);
  });
  console.log(`${existing?.length || 0} existing contacts to match against`);

  let created = 0, updated = 0, skipped = 0;

  const toInsert = [];
  const toUpdate = []; // { id, engagement_score, stage, background }

  for (const row of rows) {
    const firstName = String(row['First'] || '').trim();
    const lastName  = String(row['Last']  || '').trim();
    if (!firstName) { skipped++; continue; }

    const { primary, spouse } = parseFirstName(firstName);
    const gender = detectGender(primary);

    const ltd      = row['DonationAmountLTD']   || 0;
    const ytd      = row['DonationAmountYTD']   || 0;
    const lastDate = excelDate(row['DonationDateLast']);
    const firstDate = excelDate(row['DonationDateFirst']);

    const stage  = getStage(ltd, lastDate);
    const score  = getEngagementScore(ltd, ytd);

    const background = [
      `Donor since ${firstDate ? firstDate.slice(0,4) : 'unknown'}`,
      `Total giving: $${ltd.toFixed(2)}`,
      lastDate ? `Last gift: ${lastDate}` : null,
      ytd > 0 ? `YTD: $${ytd.toFixed(2)}` : null,
      row['City'] ? `Location: ${row['City']}, ${row['State/Province'] || ''}` : null,
    ].filter(Boolean).join(' | ');

    // Try to match existing contact by name
    const nameKey = `${primary.toLowerCase()} ${lastName.toLowerCase()}`;
    const existingId = byName.get(nameKey);

    if (existingId) {
      toUpdate.push({ id: existingId, engagement_score: score, stage, background, group_name: ltd >= 1000 ? 'Major Donors' : null });
      continue;
    }

    // Check for couple match (e.g., existing "Kirsti Pesso" → match "Mark & Kirsti Pesso")
    if (spouse) {
      const spouseKey = `${spouse.toLowerCase()} ${lastName.toLowerCase()}`;
      const spouseId = byName.get(spouseKey);
      if (spouseId) {
        toUpdate.push({ id: spouseId, engagement_score: score, stage, background, group_name: ltd >= 1000 ? 'Major Donors' : null });
        continue;
      }
    }

    toInsert.push({
      first_name:       primary,
      last_name:        lastName,
      gender,
      stage,
      source:           'banquest_import',
      engagement_score: score,
      background,
      spouse_name:      spouse ? `${spouse} ${lastName}` : null,
      how_met:          'donor',
    });

    // Track name for dedup within this batch
    byName.set(nameKey, 'pending');
  }

  console.log(`\nTo insert: ${toInsert.length} new contacts`);
  console.log(`To update: ${toUpdate.length} existing contacts (add donor data)`);
  console.log(`Skipped:   ${skipped}`);

  // Insert in batches
  const BATCH = 100;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from('outreach_contacts').insert(batch);
    if (error) console.error(`Insert error at batch ${Math.floor(i/BATCH)+1}:`, error.message);
    else { created += batch.length; process.stdout.write(`\rInserted ${created}/${toInsert.length}...`); }
  }

  // Update existing contacts
  for (const u of toUpdate) {
    const { error } = await supabase
      .from('outreach_contacts')
      .update({ engagement_score: u.engagement_score, stage: u.stage, background: u.background })
      .eq('id', u.id);
    if (!error) updated++;
  }

  console.log(`\n\n✅ Done!`);
  console.log(`Created: ${created} new donor contacts`);
  console.log(`Updated: ${updated} existing contacts with donor data`);

  // Final totals
  const { count } = await supabase.from('outreach_contacts').select('*', { count: 'exact', head: true });
  console.log(`Total contacts in CRM: ${count}`);

  // Count how many would be Major Donors
  const majorDonorCount = toInsert.filter(c => c.engagement_score >= 45).length + toUpdate.filter(u => u.group_name === 'Major Donors').length;
  console.log(`Donors with $1,000+ LTD (will be Major Donors after column added): ${majorDonorCount}`);
}

main().catch(console.error);
