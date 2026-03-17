/**
 * Import Constant Contact CSV export into the outreach CRM.
 * Detects gender from first name, cleans data, deduplicates by email.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL  = 'https://yhckumlsxrvfvtwrluge.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_PATH      = 'C:/Users/chaim/Downloads/contact_export_1102986889166_031126_120719.csv';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ---- Gender detection from first name ----
const MALE_NAMES = new Set([
  'aaron','adam','alan','alex','alexander','alexei','alfred','andrew','andy','anthony',
  'ari','ariel','aryeh','asher','baruch','ben','benjamin','bernard','bob','brad','brian',
  'bruce','carl','charles','charlie','chaim','chris','christopher','daniel','dave','david',
  'dean','derek','donald','doug','douglas','dylan','ed','edward','eli','eliezer','eliyahu',
  'eric','ethan','evan','ezra','frank','fred','gary','george','greg','gregory','harold',
  'harris','harry','howard','isaac','israel','jack','jacob','james','jason','jay','jeff',
  'jeffrey','jeremy','jerome','jesse','joel','john','jon','jonathan','jordan','joseph',
  'josh','joshua','kenneth','kevin','larry','lee','levi','marc','mark','martin','matt',
  'matthew','max','michael','mike','mitchell','mordechai','morris','moshe','nathan','neil',
  'noah','paul','peter','philip','rafael','ralph','randy','raymond','richard','robert',
  'ron','ross','ryan','sam','samuel','scott','sean','seth','shim','shmuel','simon','sol',
  'stanley','stephen','steve','steven','stuart','thomas','tim','timothy','todd','tom',
  'tzvi','uri','victor','warren','william','yehuda','yitzchak','zachary','zach',
  'menachem','avi','dov','gavriel','gideon','hanoch','natan','pinchas','reuven','shimon',
  'shlomo','yaakov','yisrael','yosef','zechariah','zvika',
]);

const FEMALE_NAMES = new Set([
  'abby','abigail','adina','adrienne','alana','alexa','alexis','alice','alison','allison',
  'alyssa','amanda','amber','amy','andrea','angela','ann','anna','anne','ashley','avigail',
  'barbara','batya','becky','beth','beverly','bonnie','brenda','brooke','caren','carol',
  'carolyn','cathy','chana','chanie','cheryl','claire','dana','debbie','deborah','diana',
  'dina','donna','eden','eileen','elana','eleanor','elisa','elizabeth','ellen','emily',
  'erica','esther','eve','faigy','fran','frances','gail','gila','gloria','golda','hannah',
  'harriet','heather','helen','hillary','ilana','ina','iris','jackie','jacqueline',
  'jamie','janet','janice','jean','jenna','jennifer','jessica','jill','joann','joyce',
  'judith','julie','karen','kate','kathy','kim','kimberly','laura','lauren','leah',
  'lena','leslie','linda','lisa','lori','lynn','malka','marcia','margaret','marilyn',
  'marsha','marta','mary','maya','melissa','michal','michelle','miriam','molly','nancy',
  'naomi','natalie','nina','nomi','pamela','patricia','pearl','penny','phyllis','rachel',
  'raizy','rebecca','rena','renee','rivka','robin','rochelle','rose','ruth','sara',
  'sarah','sharon','shelley','sheryl','shira','shirley','stacy','stephanie','susan',
  'suzanne','tammy','tina','toby','vicki','victoria','wendy','yael','yvonne',
]);

function detectGender(firstName) {
  if (!firstName) return 'unknown';
  const name = firstName.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (MALE_NAMES.has(name)) return 'male';
  if (FEMALE_NAMES.has(name)) return 'female';
  return 'unknown';
}

function parseCSV(content) {
  const lines = content.split('\n');
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Handle quoted fields
    const values = [];
    let cur = '', inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    values.push(cur.trim());
    const obj = {};
    header.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

async function main() {
  console.log('Reading CSV...');
  const content = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(content);
  console.log(`Found ${rows.length} rows in CSV`);

  // Get existing contacts to avoid duplicates
  const { data: existing } = await supabase
    .from('outreach_contacts')
    .select('email');
  const existingEmails = new Set((existing || []).map(c => c.email?.toLowerCase()).filter(Boolean));
  console.log(`${existingEmails.size} contacts already in CRM`);

  let created = 0, skipped = 0, noEmail = 0;
  const genderStats = { male: 0, female: 0, unknown: 0 };

  // Process in batches of 50
  const toInsert = [];

  for (const row of rows) {
    const email = row['Email address']?.trim().toLowerCase();
    if (!email || email === '') { noEmail++; continue; }
    // Skip JRE's own email and clearly fake entries
    if (email.includes('thejre') || email.includes('example.com')) { skipped++; continue; }
    // Skip if already in CRM
    if (existingEmails.has(email)) { skipped++; continue; }

    const firstName = (row['First name'] || '').trim();
    const lastName  = (row['Last name']  || '').trim();

    // Extract first name from "First & Last Name" if first name is missing
    let fn = firstName, ln = lastName;
    if (!fn && row['First & Last Name']) {
      const parts = row['First & Last Name'].trim().split(' ');
      fn = parts[0] || '';
      ln = parts.slice(1).join(' ') || '';
    }

    // Skip internal/junk entries
    if (fn === 'JewishRenExperience' || email.startsWith('thejre')) { skipped++; continue; }

    const gender = detectGender(fn);
    genderStats[gender]++;

    // Determine source/how_met from source name
    const sourceName = row['Source Name'] || '';
    const howMet = sourceName.includes('Website') ? 'website signup'
                 : sourceName.includes('iOS')     ? 'phone/event'
                 : 'email list';

    // Determine engagement: Active = slightly higher score
    const isActive = row['Email status'] === 'Active';
    const createdAt = row['Created At']?.split(' ')[0] || null;

    toInsert.push({
      first_name:       fn || email.split('@')[0],
      last_name:        ln || '',
      email,
      phone:            row['Phone - mobile']?.trim() || row['Phone - home']?.trim() || null,
      gender,
      stage:            'new_contact',
      source:           'sheets_import',
      how_met:          howMet,
      engagement_score: isActive ? 10 : 3,
      created_at:       createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
    });

    existingEmails.add(email); // prevent duplicates within this batch
  }

  console.log(`\nTo insert: ${toInsert.length}`);
  console.log(`Gender breakdown: ${genderStats.male} male, ${genderStats.female} female, ${genderStats.unknown} unknown`);
  console.log(`Skipped: ${skipped} (already in CRM or invalid)`);
  console.log(`No email: ${noEmail}`);

  // Insert in batches of 100
  const BATCH = 100;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from('outreach_contacts').insert(batch);
    if (error) {
      console.error(`Error at batch ${i/BATCH + 1}:`, error.message);
    } else {
      created += batch.length;
      process.stdout.write(`\rInserted ${created}/${toInsert.length}...`);
    }
  }

  console.log(`\n\n✅ Done! ${created} contacts imported.`);

  // Final count
  const { count } = await supabase.from('outreach_contacts').select('*', { count: 'exact', head: true });
  console.log(`Total contacts in CRM: ${count}`);
}

main().catch(console.error);
