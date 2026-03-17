/**
 * Fix the 3 failed tabs (Mussar25, Retreat, Prayer) — they ARE header-first format
 * Also clean up any email duplicates from the limited deduplication.
 */
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = '1NUOQLTodMTgl6zABdInE7RP5yfehYxKABCwaH5CUg0I';
const SUPABASE_URL = 'https://yhckumlsxrvfvtwrluge.supabase.co';
const SERVICE_KEY = '';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SKIP_EMAILS = new Set(['test', 'glevi@thejre.org', 'jay@aklaunch.com', 'n/a', '-', '']);
const MALE_NAMES = new Set(['aaron','adam','alan','alex','andrew','andy','ari','ariel','asher','barry','ben','benjamin','brad','brian','bruce','carl','charles','chris','daniel','dave','david','dean','donald','doug','eli','eric','ethan','evan','frank','fred','gabe','gary','george','greg','harold','howard','isaac','jack','jacob','james','jason','jay','jeff','jeffrey','jeremy','joel','jonathan','josh','joshua','kenneth','kevin','larry','marc','mark','martin','matt','michael','mitch','mordechai','moshe','nathan','neil','noah','paul','peter','philip','randy','richard','robert','ron','ross','russell','ryan','sam','scott','sean','seth','simon','sol','stanley','steve','steven','thomas','tim','todd','tom','warren','william','yehuda','zev','zusha','kenny','nechemia','zeev','menachem','avi','dov','eliyahu','gavriel','yitzchak','yosef','javier','bryan','ouri','ravid','gene','michel','sergi','alexander','neil','barry','joseph','simcha','jared']);
const FEMALE_NAMES = new Set(['abby','abigail','adina','adrienne','alexa','alexis','alice','alison','allison','alyssa','amanda','amy','andrea','angela','ann','anna','anne','ashley','barbara','becky','beth','beverly','bonnie','brenda','carol','carolyn','cathy','chana','cheryl','claire','dana','debbie','deborah','diana','donna','eileen','elana','eleanor','elisa','elizabeth','ellen','emily','erica','esther','eve','esti','fran','gail','gloria','hannah','harriet','helen','ilana','ilissa','iris','jackie','jacqueline','janet','janice','jean','jenna','jennifer','jessica','jill','joann','joyce','judith','julie','karen','kate','kathy','kim','kirsti','laura','lauren','leah','lena','leslie','linda','lisa','lori','lynn','malka','marcia','margaret','marilyn','marsha','mary','maya','melissa','michelle','miriam','molly','nancy','naomi','nadine','natalie','nina','nomi','pamela','patricia','pearl','phyllis','rachel','rebecca','rena','renee','rivka','robin','rochelle','rose','ruth','sara','sarah','sharon','shelley','sheryl','shira','shirley','stacy','stephanie','susan','suzanne','tammy','tina','vicki','victoria','wendy','yael','yvonne','joanne','randi','elisheva','bess','rifkie','lara','batia','bella','betty','cynthia','bari','chanie','jane','cindy','maura','elise','dina','devorah','ahuva','mimi','tzippy','blimi','theresa','aitana','ilyssa','ella','edna','diane','annebeth','rivka']);

function detectGender(name) {
  const n = (name || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (MALE_NAMES.has(n)) return 'male';
  if (FEMALE_NAMES.has(n)) return 'female';
  return 'unknown';
}

function parseName(s) {
  s = String(s || '').trim();
  const amp = s.match(/^(\w+)\s*(?:&|and)\s*\w+\s+(.+)/i);
  if (amp) return { firstName: amp[1], lastName: amp[2].trim() };
  const parts = s.split(/\s+/);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

function isValidName(name) {
  if (!name || String(name).length < 2) return false;
  const lower = String(name).toLowerCase().trim();
  if (/^\d/.test(lower)) return false;
  if (lower.includes('@')) return false;
  if (lower.startsWith('<') || lower.startsWith('>')) return false;
  if (['tester tester','test','gitty','q q','sponsor','please','guest','spouse','kid','name','anon'].includes(lower)) return false;
  return true;
}

function isValidEmail(e) {
  if (!e) return false;
  const em = String(e).trim().toLowerCase();
  if (SKIP_EMAILS.has(em)) return false;
  return em.includes('@') && em.includes('.');
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: 'jresignuptosheets@jresignuptosheets.iam.gserviceaccount.com',
    private_key: `-----BEGIN PRIVATE KEY-----\nGOOGLE_PRIVATE_KEY_REMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\n-----END PRIVATE KEY-----`,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Fetch ALL contacts from Supabase with pagination
async function fetchAllContacts() {
  const all = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('outreach_contacts')
      .select('id, email, first_name, last_name, source, created_at')
      .range(offset, offset + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function main() {
  console.log('=== PHASE 1: Fix failed tabs (Mussar25, Retreat, Prayer) ===\n');

  const sheets = google.sheets({ version: 'v4', auth });

  const tabs = [
    { name: 'Mussar25', event: 'Ladies Mussar Series 2025', date: '2025-04-01', nameIdx: 8, emailIdx: 9 },
    { name: 'Retreat',  event: 'Ladies Retreat 2025',       date: '2025-03-03', nameIdx: 6, emailIdx: 7 },
    { name: 'Prayer',   event: 'Ladies Living on a Prayer', date: '2024-09-12', nameIdx: 8, emailIdx: 9 },
  ];

  // Fetch ALL existing contacts
  console.log('Fetching all contacts from Supabase...');
  const existing = await fetchAllContacts();
  console.log(`Total in CRM: ${existing.length}`);

  const existingEmails = new Set(existing.map(c => (c.email || '').toLowerCase()).filter(e => e && e.includes('@')));

  const toInsert = [];

  for (const tab of tabs) {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: tab.name });
    const allRows = res.data.values || [];
    if (allRows.length < 2) { console.log(`  ${tab.name}: empty`); continue; }

    const headers = allRows[0];
    const dataRows = allRows.slice(1).filter(r => r.some(c => c && String(c).trim()));
    const evStr = `${tab.event} (${tab.date})`;
    let count = 0;

    // First registrant from header row
    const h0name  = headers[tab.nameIdx]  || '';
    const h0email = headers[tab.emailIdx] || '';
    if (isValidName(h0name)) {
      const email = isValidEmail(h0email) ? h0email.toLowerCase() : null;
      if (!email || !existingEmails.has(email)) {
        const { firstName, lastName } = parseName(h0name);
        toInsert.push({ firstName, lastName, email, phone: null, gender: detectGender(firstName), events: [evStr] });
        if (email) existingEmails.add(email);
        count++;
      }
    }

    // Subsequent registrants
    for (const row of dataRows) {
      const rowType = (row[1] || '').toLowerCase();
      if (rowType === 'guest' || rowType === 'spouse' || row[0] === '>') continue;
      const name  = row[tab.nameIdx]  || '';
      const email = row[tab.emailIdx] ? row[tab.emailIdx].toLowerCase().trim() : null;
      if (!isValidName(name)) continue;
      if (email && existingEmails.has(email)) continue;
      const { firstName, lastName } = parseName(name);
      const validEmail = email && isValidEmail(email) ? email : null;
      toInsert.push({ firstName, lastName, email: validEmail, phone: null, gender: detectGender(firstName), events: [evStr] });
      if (validEmail) existingEmails.add(validEmail);
      count++;
    }
    console.log(`  ${tab.name}: ${count} new contacts`);
  }

  if (toInsert.length > 0) {
    const inserts = toInsert.map(c => ({
      first_name: c.firstName, last_name: c.lastName, email: c.email,
      phone: c.phone, gender: c.gender, stage: 'new_contact', source: 'sheets_import',
      engagement_score: 10, background: `JRE event: ${c.events[0]}`, how_met: 'event',
    }));
    let created = 0;
    for (let i = 0; i < inserts.length; i += 50) {
      const batch = inserts.slice(i, i + 50);
      const { error } = await supabase.from('outreach_contacts').insert(batch);
      if (error) console.error('Insert error:', error.message);
      else created += batch.length;
    }
    console.log(`\nInserted ${created} new contacts from fixed tabs`);
  }

  console.log('\n=== PHASE 2: Deduplicate by email ===\n');

  const all = await fetchAllContacts();
  console.log(`Total contacts before dedup: ${all.length}`);

  // Group by email — keep the one with more info (source != sheets_import preferred, earlier created_at)
  const emailGroups = new Map();
  for (const c of all) {
    if (!c.email || !c.email.includes('@')) continue;
    const email = c.email.toLowerCase();
    if (!emailGroups.has(email)) emailGroups.set(email, []);
    emailGroups.get(email).push(c);
  }

  const toDelete = [];
  for (const [email, group] of emailGroups) {
    if (group.length <= 1) continue;
    // Sort: prefer non-sheets_import, then prefer earlier created_at
    group.sort((a, b) => {
      const aScore = a.source === 'sheets_import' ? 0 : 1;
      const bScore = b.source === 'sheets_import' ? 0 : 1;
      if (aScore !== bScore) return bScore - aScore; // higher score = keep
      return new Date(a.created_at) - new Date(b.created_at); // earlier = keep
    });
    // Keep first, delete the rest
    const keep = group[0];
    const del = group.slice(1);
    console.log(`  Duplicate: ${email} (${group.length} copies) — keeping ${keep.first_name} ${keep.last_name} [${keep.source}], deleting ${del.length}`);
    toDelete.push(...del.map(d => d.id));
  }

  if (toDelete.length === 0) {
    console.log('✅ No duplicates found!');
  } else {
    console.log(`\nDeleting ${toDelete.length} duplicates...`);
    // Delete in batches
    for (let i = 0; i < toDelete.length; i += 50) {
      const batch = toDelete.slice(i, i + 50);
      const { error } = await supabase.from('outreach_contacts').delete().in('id', batch);
      if (error) console.error('Delete error:', error.message);
    }
    console.log(`✅ Deleted ${toDelete.length} duplicate contacts`);
  }

  const { count } = await supabase.from('outreach_contacts').select('*', { count: 'exact', head: true });
  console.log(`\n🎉 Final total in CRM: ${count}`);
}

main().catch(console.error);
