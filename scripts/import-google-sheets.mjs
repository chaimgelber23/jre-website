/**
 * Import historical event data from the JRE Google Sheet (all tabs)
 * Sheet: https://docs.google.com/spreadsheets/d/1NUOQLTodMTgl6zABdInE7RP5yfehYxKABCwaH5CUg0I
 *
 * Extracts every unique contact from all event tabs, deduplicates by email,
 * and imports into Supabase outreach_contacts (skipping already-imported contacts).
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = '1NUOQLTodMTgl6zABdInE7RP5yfehYxKABCwaH5CUg0I';
const SUPABASE_URL = 'https://yhckumlsxrvfvtwrluge.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Skip these tabs — not contacts
const SKIP_TABS = new Set(['ZoomLink', 'email_template', 'Babka', 'donations_test', 'Sheet25', 'Purim24', 'JunScotchnSteak', 'Blocks']);

// Map tab names to friendly event names and approximate dates
const TAB_META = {
  'omakase':        { name: 'JRE Omakase Dinner',          date: '2022-12-16', gender: 'mixed' },
  'sns':            { name: 'Saturday Night Spectacular',   date: '2023-01-28', gender: 'mixed' },
  'TUBShevat':      { name: 'Tu B\'Shevat Event',           date: '2023-01-27', gender: 'female' },
  'FebScotchnSteak':{ name: 'Scotch & Steak Dinner',       date: '2023-02-01', gender: 'mixed' },
  'purim':          { name: 'Purim Event 2023',             date: '2023-03-07', gender: 'mixed' },
  'MarScotchnSteak':{ name: 'Scotch & Steak Dinner',       date: '2023-03-05', gender: 'mixed' },
  'temple':         { name: 'Temple Event',                 date: '2023-07-18', gender: 'female' },
  'Sinai':          { name: 'Sinai Event',                  date: '2023-05-12', gender: 'mixed' },
  'LunchnLearn':    { name: 'Lunch & Learn',                date: '2023-08-23', gender: 'female' },
  'Mussar':         { name: 'Ladies Mussar Series',         date: '2023-09-07', gender: 'female' },
  'Siyum23':        { name: 'Siyum Event',                  date: '2023-10-24', gender: 'mixed' },
  'FaithnJoy':      { name: 'Faith & Joy Event',            date: '2023-12-25', gender: 'mixed' },
  'eventsignup':    { name: 'JRE Event',                    date: '2023-12-13', gender: 'mixed' },
  'LunchnLearn24':  { name: 'Lunch & Learn 2024',           date: '2024-01-11', gender: 'female' },
  'Mussar24':       { name: 'Ladies Mussar Series 2024',    date: '2024-01-18', gender: 'female' },
  'sns-2024':       { name: 'Saturday Night Spectacular 2024', date: '2024-02-03', gender: 'mixed' },
  'song':           { name: 'Purim Event 2024',             date: '2024-02-22', gender: 'female' },
  'Relationships':  { name: 'Relationships Series',         date: '2024-02-05', gender: 'female' },
  'Jerusalem':      { name: 'A Jerusalem Evening in Westchester', date: '2024-07-11', gender: 'mixed' },
};

const SKIP_NAMES = new Set(['tester tester', 'test', 'q q', 'gitty', 'gitty levi', 'tester', 'registrant']);
const SKIP_EMAILS = new Set(['test', 'glevi@thejre.org', 'jay@aklaunch.com', 'tester@gmail.com', 'n/a', '-', '']);

const MALE_NAMES = new Set(['aaron','adam','alan','alex','andrew','andy','ari','ariel','asher','barry','ben','benjamin','brad','brian','bruce','carl','charles','chris','daniel','dave','david','dean','donald','doug','eli','eric','ethan','evan','frank','fred','gabe','gary','george','greg','harold','howard','isaac','jack','jacob','james','jason','jay','jeff','jeffrey','jeremy','joel','jonathan','josh','joshua','kenneth','kevin','larry','marc','mark','martin','matt','michael','mitch','mordechai','moshe','nathan','neil','noah','paul','peter','philip','randy','richard','robert','ron','ross','russell','ryan','sam','scott','sean','seth','simon','sol','stanley','steve','steven','thomas','tim','todd','tom','warren','william','yehuda','zev','zusha','kenny','nechemia','zeev','menachem','avi','dov','eliyahu','gavriel','yitzchak','yosef','javier','bryan','joel','ouri','ravid','gene','michel','sergi','alexander','jeffrey','philip','neil','barry','joseph','simcha','jared','benjamin','jacob']);
const FEMALE_NAMES = new Set(['abby','abigail','adina','adrienne','alexa','alexis','alice','alison','allison','alyssa','amanda','amy','andrea','angela','ann','anna','anne','ashley','barbara','becky','beth','beverly','bonnie','brenda','carol','carolyn','cathy','chana','cheryl','claire','dana','debbie','deborah','diana','donna','eileen','elana','eleanor','elisa','elizabeth','ellen','emily','erica','esther','eve','esti','fran','gail','gloria','hannah','harriet','helen','ilana','ilissa','iris','jackie','jacqueline','janet','janice','jean','jenna','jennifer','jessica','jill','joann','joyce','judith','julie','karen','kate','kathy','kim','kirsti','laura','lauren','leah','lena','leslie','linda','lisa','lori','lynn','malka','marcia','margaret','marilyn','marsha','mary','maya','melissa','michelle','miriam','molly','nancy','naomi','nadine','natalie','nina','nomi','pamela','patricia','pearl','phyllis','rachel','rebecca','rena','renee','rivka','robin','rochelle','rose','ruth','sara','sarah','sharon','shelley','sheryl','shira','shirley','stacy','stephanie','susan','suzanne','tammy','tina','vicki','victoria','wendy','yael','yvonne','joanne','randi','elisheva','bess','rifkie','lara','batia','bella','betty','cynthia','bari','wendy','chanie','bess','jane','cindy']);

function detectGender(name) {
  if (!name) return 'unknown';
  const n = name.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (MALE_NAMES.has(n)) return 'male';
  if (FEMALE_NAMES.has(n)) return 'female';
  return 'unknown';
}

function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };
  const s = fullName.trim();
  // Handle "Amy & Jeremy Abramson" type names — take first person only
  const ampersand = s.match(/^(\w+)\s*(?:&|and)\s*\w+\s+(.+)/i);
  if (ampersand) return { firstName: ampersand[1], lastName: ampersand[2].trim() };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
}

function findNameEmail(row, headers) {
  // Try various header patterns
  const nameKeys  = ['Name', 'Registrant Name', 'Registrant Fullname', 'name', 'registrant_name'];
  const emailKeys = ['Email', 'Registrant Email', 'email', 'registrant_email'];
  const phoneKeys = ['Phone', 'Registrant Phone Number', 'phone', 'registrant_phone'];

  let name = null, email = null, phone = null;

  for (const key of nameKeys) {
    if (row[key] && String(row[key]).trim()) { name = String(row[key]).trim(); break; }
  }
  for (const key of emailKeys) {
    if (row[key] && String(row[key]).trim()) { email = String(row[key]).trim().toLowerCase(); break; }
  }
  for (const key of phoneKeys) {
    if (row[key] && String(row[key]).trim()) { phone = String(row[key]).replace(/\D/g, ''); break; }
  }

  return { name, email, phone };
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: 'jresignuptosheets@jresignuptosheets.iam.gserviceaccount.com',
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function main() {
  const sheets = google.sheets({ version: 'v4', auth });

  // Get all sheet names
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const allTabs = meta.data.sheets.map(s => s.properties.title);
  const tabs = allTabs.filter(t => !SKIP_TABS.has(t));
  console.log(`Reading ${tabs.length} event tabs from Google Sheet...`);

  // Collect all contacts: Map<email, { name, email, phone, events: [], firstName, lastName, gender }>
  const byEmail = new Map();
  const noEmail = []; // contacts without email — harder to dedup

  for (const tabName of tabs) {
    const meta2 = TAB_META[tabName];
    if (!meta2) {
      console.log(`  Skipping unknown tab: ${tabName}`);
      continue;
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: tabName,
    });
    const rows = res.data.values || [];
    if (rows.length < 2) { console.log(`  ${tabName}: empty, skip`); continue; }

    const headers = rows[0];
    const dataRows = rows.slice(1).filter(r => r.some(c => c && String(c).trim()));

    let found = 0;
    for (const row of dataRows) {
      // Build object from headers
      const obj = {};
      headers.forEach((h, j) => { obj[h] = row[j] || ''; });

      const { name, email, phone } = findNameEmail(obj, headers);
      if (!name) continue;
      const nameLower = name.toLowerCase().trim();
      if (SKIP_NAMES.has(nameLower)) continue;
      if (email && SKIP_EMAILS.has(email)) continue;
      if (!email && name.includes('@')) continue; // data shifted
      if (name === '>') continue;

      const { firstName, lastName } = parseName(name);
      if (!firstName || firstName.length < 2) continue;

      const gender = detectGender(firstName);
      const eventStr = `${meta2.name} (${meta2.date})`;

      if (email && !SKIP_EMAILS.has(email) && email.includes('@')) {
        if (byEmail.has(email)) {
          byEmail.get(email).events.push(eventStr);
          byEmail.get(email).eventCount++;
        } else {
          byEmail.set(email, { firstName, lastName, email, phone: phone || null, gender, events: [eventStr], eventCount: 1, source: 'sheets_import' });
        }
      } else {
        // No email — store by name for later
        noEmail.push({ firstName, lastName, phone: phone || null, gender, events: [eventStr], eventCount: 1, source: 'sheets_import' });
      }
      found++;
    }
    console.log(`  ${tabName}: ${found} contacts read`);
  }

  console.log(`\nUnique contacts WITH email: ${byEmail.size}`);
  console.log(`Contacts WITHOUT email: ${noEmail.length}`);

  // Get existing contacts to dedup
  const { data: existing } = await supabase
    .from('outreach_contacts')
    .select('id, email, first_name, last_name');

  const existingEmails = new Set((existing || []).map(c => (c.email || '').toLowerCase()).filter(Boolean));
  const existingByName = new Map();
  (existing || []).forEach(c => {
    const key = `${c.first_name.toLowerCase()} ${c.last_name.toLowerCase()}`.trim();
    existingByName.set(key, c.id);
  });

  console.log(`${existing?.length || 0} existing contacts in CRM`);

  // Build insert list — new emails only
  const toInsert = [];
  let alreadyExists = 0;

  for (const [email, c] of byEmail) {
    if (existingEmails.has(email)) {
      alreadyExists++;
      continue;
    }
    const eventCount = c.eventCount;
    const stage = eventCount >= 3 ? 'deepening' : eventCount >= 2 ? 'in_touch' : 'new_contact';
    const score = eventCount >= 3 ? 30 : eventCount >= 2 ? 20 : 10;
    const background = `Attended JRE events: ${c.events.slice(0, 3).join(', ')}${c.events.length > 3 ? ` +${c.events.length - 3} more` : ''}`;

    toInsert.push({
      first_name:       c.firstName,
      last_name:        c.lastName,
      email:            email,
      phone:            c.phone,
      gender:           c.gender,
      stage,
      source:           'sheets_import',
      engagement_score: score,
      background,
      how_met:          'event',
    });
  }

  // Also add no-email contacts not already in system by name
  let noEmailAdded = 0;
  for (const c of noEmail) {
    const nameKey = `${c.firstName.toLowerCase()} ${c.lastName.toLowerCase()}`.trim();
    if (existingByName.has(nameKey)) { alreadyExists++; continue; }
    const stage = 'new_contact';
    const background = `Attended JRE events: ${c.events.join(', ')}`;
    toInsert.push({
      first_name:       c.firstName,
      last_name:        c.lastName,
      email:            null,
      phone:            c.phone,
      gender:           c.gender,
      stage,
      source:           'sheets_import',
      engagement_score: 10,
      background,
      how_met:          'event',
    });
    noEmailAdded++;
  }

  console.log(`\nAlready in CRM: ${alreadyExists}`);
  console.log(`New to import: ${toInsert.length} (${toInsert.length - noEmailAdded} with email, ${noEmailAdded} without)`);

  if (toInsert.length === 0) {
    console.log('\n✅ No new contacts to add — everyone is already in the CRM!');
    return;
  }

  // Insert in batches of 50
  let created = 0;
  const BATCH = 50;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from('outreach_contacts').insert(batch);
    if (error) console.error(`Batch ${Math.floor(i/BATCH)+1} error:`, error.message);
    else { created += batch.length; process.stdout.write(`\rInserted ${created}/${toInsert.length}...`); }
  }

  const { count } = await supabase.from('outreach_contacts').select('*', { count: 'exact', head: true });
  console.log(`\n\n✅ Done!`);
  console.log(`Added: ${created} new contacts from Google Sheets`);
  console.log(`Total contacts in CRM: ${count}`);

  // Top event attendees
  console.log('\n📊 Repeat attendees from sheets (people who came to 2+ events):');
  const repeats = [...byEmail.values()].filter(c => c.eventCount >= 2).sort((a,b) => b.eventCount - a.eventCount);
  repeats.slice(0, 15).forEach(c => {
    console.log(`  ${c.firstName} ${c.lastName} (${c.email}) — ${c.eventCount} events`);
  });
}

main().catch(console.error);
