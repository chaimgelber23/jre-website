/**
 * Import ALL remaining Google Sheet tabs into the CRM.
 * Handles multiple formats:
 *   1. "header-first": first registrant's name/email is IN the header row
 *   2. Standard: has Name/Email column headers
 *   3. Simple: Monsey-style with clean Name/Email columns
 *   4. donations: Donor Name / Donor Email columns
 */
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = '1NUOQLTodMTgl6zABdInE7RP5yfehYxKABCwaH5CUg0I';
const SUPABASE_URL = 'https://yhckumlsxrvfvtwrluge.supabase.co';
const SERVICE_KEY = '';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const TAB_EVENTS = {
  'donations':             { name: 'JRE Donation',                  date: '2022-12-16', format: 'donations' },
  'marriage':              { name: 'Marriage Event',                 date: '2025-07-04', format: 'header-first', nameIdx: 4, emailIdx: 5 },
  'Pre-Shavous':           { name: 'Pre-Shavuos Event',              date: '2025-05-09', format: 'header-first', nameIdx: 4, emailIdx: 5 },
  'Mussar25':              { name: 'Ladies Mussar Series 2025',      date: '2025-04-01', format: 'standard', nameCol: 'Name', emailCol: 'Email' },
  'Purim25':               { name: 'Purim 2025',                     date: '2025-02-28', format: 'header-first', nameIdx: 4, emailIdx: 5 },
  'Yossi Purim 2025 Invites': { name: 'Purim 2025 Invites',         date: '2025-03-01', format: 'names-only' },
  'Retreat':               { name: 'Ladies Retreat 2025',            date: '2025-02-19', format: 'standard', nameCol: 'Name', emailCol: 'Email' },
  'Coal':                  { name: 'Coal Event',                     date: '2024-12-31', format: 'header-first', nameIdx: 4, emailIdx: 5 },
  'NextLevel':             { name: 'Next Level Event',               date: '2024-12-07', format: 'header-first', nameIdx: 4, emailIdx: 5 },
  'Monsey':                { name: 'Monsey Event',                   date: '2024-12-11', format: 'simple' },
  'Marathon':              { name: 'Marathon Event',                 date: '2024-11-01', format: 'marathon' },
  'Siyum24':               { name: 'Siyum 2024',                     date: '2024-10-28', format: 'siyum24' },
  'LunchnLearnOct24':      { name: 'Lunch & Learn Oct 2024',         date: '2024-10-06', format: 'lunchlearn24' },
  'Prayer':                { name: 'Ladies Living on a Prayer',      date: '2024-09-12', format: 'standard', nameCol: 'Name', emailCol: 'Email' },
  'FiredUp':               { name: 'Fired Up Event',                 date: '2024-09-23', format: 'header-first', nameIdx: 4, emailIdx: 5 },
};

const SKIP_EMAILS = new Set(['test', 'glevi@thejre.org', 'jay@aklaunch.com', 'tester@gmail.com', 'n/a', '-', '', 'email', 'N/A', 'rachel@aklaunch.com']);
const SKIP_NAME_FRAGMENTS = ['tester', 'test', 'gitty', 'please note', 'cover', 'gotta', 'sponsor', 'feeling lucky', '>', '-', 'spouse', 'guest', 'kid'];

const MALE_NAMES = new Set(['aaron','adam','alan','alex','andrew','andy','ari','ariel','asher','barry','ben','benjamin','brad','brian','bruce','carl','charles','chris','daniel','dave','david','dean','donald','doug','eli','eric','ethan','evan','frank','fred','gabe','gary','george','greg','harold','howard','isaac','jack','jacob','james','jason','jay','jeff','jeffrey','jeremy','joel','jonathan','josh','joshua','kenneth','kevin','larry','marc','mark','martin','matt','michael','mitch','mordechai','moshe','nathan','neil','noah','paul','peter','philip','randy','richard','robert','ron','ross','russell','ryan','sam','scott','sean','seth','simon','sol','stanley','steve','steven','thomas','tim','todd','tom','warren','william','yehuda','zev','zusha','kenny','nechemia','zeev','menachem','avi','dov','eliyahu','gavriel','yitzchak','yosef','javier','bryan','joel','ouri','ravid','gene','michel','sergi','alexander','jeffrey','philip','neil','barry','joseph','simcha','jared','benjamin','jacob','yossi','chaim','shmuel','tzvi','pinchas','leon','howard','daniel','jeff','sam']);
const FEMALE_NAMES = new Set(['abby','abigail','adina','adrienne','alexa','alexis','alice','alison','allison','alyssa','amanda','amy','andrea','angela','ann','anna','anne','ashley','barbara','becky','beth','beverly','bonnie','brenda','carol','carolyn','cathy','chana','cheryl','claire','dana','debbie','deborah','diana','donna','eileen','elana','eleanor','elisa','elizabeth','ellen','emily','erica','esther','eve','esti','fran','gail','gloria','hannah','harriet','helen','ilana','ilissa','iris','jackie','jacqueline','janet','janice','jean','jenna','jennifer','jessica','jill','joann','joyce','judith','julie','karen','kate','kathy','kim','kirsti','laura','lauren','leah','lena','leslie','linda','lisa','lori','lynn','malka','marcia','margaret','marilyn','marsha','mary','maya','melissa','michelle','miriam','molly','nancy','naomi','nadine','natalie','nina','nomi','pamela','patricia','pearl','phyllis','rachel','rebecca','rena','renee','rivka','robin','rochelle','rose','ruth','sara','sarah','sharon','shelley','sheryl','shira','shirley','stacy','stephanie','susan','suzanne','tammy','tina','vicki','victoria','wendy','yael','yvonne','joanne','randi','elisheva','bess','rifkie','lara','batia','bella','betty','cynthia','bari','chanie','jane','cindy','maura','elise','dina','devorah','ahuva','mimi','tzippy','blimi','theresa','aitana','ilyssa','rifkie','ella','dina','leah','randi','edna','diane']);

function detectGender(name) {
  if (!name) return 'unknown';
  const n = name.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (MALE_NAMES.has(n)) return 'male';
  if (FEMALE_NAMES.has(n)) return 'female';
  return 'unknown';
}

function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };
  const s = String(fullName).trim().replace(/[^\w\s'-]/g, '').trim();
  // "Amy & Jeremy Abramson" → just Amy
  const amp = s.match(/^(\w+)\s*(?:&|and)\s*\w+\s+(.+)/i);
  if (amp) return { firstName: amp[1], lastName: amp[2].trim() };
  // "Thomas and Edna Krausz" → Thomas Krausz
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function isValidName(name) {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (lower.length < 2) return false;
  for (const frag of SKIP_NAME_FRAGMENTS) {
    if (lower.startsWith(frag) || lower === frag) return false;
  }
  if (/^\d/.test(lower)) return false;
  if (lower.includes('@')) return false;
  if (lower.startsWith('<')) return false;
  return true;
}

function isValidEmail(email) {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (SKIP_EMAILS.has(e)) return false;
  if (!e.includes('@') || !e.includes('.')) return false;
  return true;
}

function addContact(byEmail, noEmail, name, email, phone, eventStr) {
  if (!isValidName(name)) return;
  const emailNorm = email ? email.toLowerCase().trim() : null;
  if (emailNorm && !isValidEmail(emailNorm)) return;

  const { firstName, lastName } = parseName(name);
  if (!firstName || firstName.length < 2) return;
  const gender = detectGender(firstName);

  if (emailNorm && isValidEmail(emailNorm)) {
    if (byEmail.has(emailNorm)) {
      byEmail.get(emailNorm).events.push(eventStr);
      byEmail.get(emailNorm).eventCount++;
    } else {
      byEmail.set(emailNorm, { firstName, lastName, email: emailNorm, phone: phone || null, gender, events: [eventStr], eventCount: 1 });
    }
  } else {
    const nameKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()}`.trim();
    noEmail.push({ firstName, lastName, nameKey, phone: phone || null, gender, events: [eventStr], eventCount: 1 });
  }
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: 'jresignuptosheets@jresignuptosheets.iam.gserviceaccount.com',
    private_key: `-----BEGIN PRIVATE KEY-----\nGOOGLE_PRIVATE_KEY_REMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\nREMOVED\n-----END PRIVATE KEY-----`,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function main() {
  const sheets = google.sheets({ version: 'v4', auth });
  const byEmail = new Map();
  const noEmail = [];

  for (const [tabName, meta] of Object.entries(TAB_EVENTS)) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: tabName,
      });
      const allRows = res.data.values || [];
      if (allRows.length < 2) { console.log(`  ${tabName}: empty`); continue; }

      const headers = allRows[0];
      const dataRows = allRows.slice(1).filter(r => r.some(c => c && String(c).trim()));
      let count = 0;
      const evStr = `${meta.name} (${meta.date})`;

      if (meta.format === 'donations') {
        // "Donor Name" / "Donor Email" columns
        for (const row of dataRows) {
          const obj = {};
          headers.forEach((h, j) => { obj[h] = row[j] || ''; });
          const name  = obj['Donor Name']  || obj['Name']  || '';
          const email = obj['Donor Email'] || obj['Email'] || '';
          const phone = '';
          if (isValidName(name)) { addContact(byEmail, noEmail, name, email, phone, evStr); count++; }
        }

      } else if (meta.format === 'header-first') {
        // First registrant is IN the header row
        const firstName  = headers[meta.nameIdx]  || '';
        const firstEmail = headers[meta.emailIdx] || '';
        if (isValidName(firstName)) { addContact(byEmail, noEmail, firstName, firstEmail, null, evStr); count++; }

        // Subsequent registrants are in data rows at same column positions
        for (const row of dataRows) {
          const name  = row[meta.nameIdx]  || '';
          const email = row[meta.emailIdx] || '';
          const phone = row[meta.emailIdx + 1] ? String(row[meta.emailIdx + 1]).replace(/\D/g, '') : null;
          // Skip "Guest" / "Spouse" sub-rows
          const rowType = row[1] || '';
          if (String(rowType).toLowerCase() === 'guest' || String(rowType).toLowerCase() === 'spouse') continue;
          if (name === '>') continue;
          if (isValidName(name)) { addContact(byEmail, noEmail, name, email, phone, evStr); count++; }
        }

      } else if (meta.format === 'standard') {
        // Columns are properly labeled — the sheet has Name/Email at the right positions
        // Standard format: [timestamp, eventDate, time, link, eventName, registrants, sheet, note, Name, Email, ...]
        // Find Name/Email column positions
        const nameIdx  = headers.findIndex(h => h === meta.nameCol);
        const emailIdx = headers.findIndex(h => h === meta.emailCol);
        if (nameIdx < 0) { console.log(`  ${tabName}: no Name column found (${headers.join(',')})`); continue; }

        for (const row of dataRows) {
          const name  = row[nameIdx]  || '';
          const email = emailIdx >= 0 ? (row[emailIdx] || '') : '';
          const phone = '';
          if (isValidName(name)) { addContact(byEmail, noEmail, name, email, phone, evStr); count++; }
        }

      } else if (meta.format === 'simple') {
        // Monsey style: "Name" and "Email" as actual column headers
        const nameIdx  = headers.findIndex(h => h === 'Name');
        const emailIdx = headers.findIndex(h => h === 'Email');
        if (nameIdx < 0) { console.log(`  ${tabName}: no Name col`); continue; }

        for (const row of dataRows) {
          const name  = row[nameIdx]  || '';
          const email = emailIdx >= 0 ? (row[emailIdx] || '') : '';
          // Strip trailing annotation like "- can't come >"
          const cleanName = name.replace(/-.*$/, '').trim();
          if (isValidName(cleanName)) { addContact(byEmail, noEmail, cleanName, email, null, evStr); count++; }
        }

      } else if (meta.format === 'marathon') {
        // Marathon: email in column index 4 (the "" column), name not present in a clean column
        // Row example: [timestamp, ">", "-", "Guest", "-"] or [1, timestamp, "Adult", "Offline Payment", "Joanne Dresner", "joannedresner@gmail.com"]
        // Based on preview: col index 4 = name, col index 5 = email (different from other header-first)
        for (const row of dataRows) {
          if (!row[4]) continue;
          const name  = row[4] || '';
          const email = row[5] || '';
          const rowType = row[2] || '';
          if (String(rowType) === 'Guest' || String(rowType) === '-') continue;
          if (isValidName(name)) { addContact(byEmail, noEmail, name, email, null, evStr); count++; }
        }

      } else if (meta.format === 'lunchlearn24') {
        // LunchnLearnOct24: email appears in "" column, no name column visible
        // From preview: col 4 = email. No name visible — skip this tab, limited data
        console.log(`  ${tabName}: format too sparse, extracting emails only`);
        for (const row of dataRows) {
          const emailCandidate = (row[4] || '').trim().toLowerCase();
          if (isValidEmail(emailCandidate)) {
            const emailPart = emailCandidate.split('@')[0].replace(/[._]/g, ' ');
            addContact(byEmail, noEmail, emailPart || 'Unknown', emailCandidate, null, evStr);
            count++;
          }
        }

      } else if (meta.format === 'siyum24') {
        // Very messy — extract any cell that looks like an email
        for (const row of dataRows) {
          for (const cell of row) {
            if (cell && String(cell).includes('@') && isValidEmail(String(cell).trim().toLowerCase())) {
              addContact(byEmail, noEmail, '?', String(cell).trim().toLowerCase(), null, evStr);
              count++;
            }
          }
        }

      } else if (meta.format === 'names-only') {
        // Yossi Purim Invites: just names, no emails
        for (const row of dataRows) {
          const name = row[0] || '';
          if (isValidName(name)) { addContact(byEmail, noEmail, name, null, null, evStr); count++; }
        }
      }

      console.log(`  ${tabName}: ${count} contacts`);
    } catch (e) {
      console.log(`  ${tabName}: ERROR — ${e.message}`);
    }
  }

  console.log(`\nTotal unique emails: ${byEmail.size}`);
  console.log(`Contacts without email: ${noEmail.length}`);

  // Get existing contacts
  const { data: existing } = await supabase.from('outreach_contacts').select('id, email, first_name, last_name');
  const existingEmails = new Set((existing || []).map(c => (c.email || '').toLowerCase()).filter(Boolean));
  const existingByName = new Map();
  (existing || []).forEach(c => {
    const key = `${c.first_name.toLowerCase()} ${(c.last_name || '').toLowerCase()}`.trim();
    existingByName.set(key, c.id);
  });
  console.log(`${existing?.length || 0} contacts currently in CRM`);

  const toInsert = [];
  let alreadyExists = 0;

  for (const [email, c] of byEmail) {
    if (existingEmails.has(email)) { alreadyExists++; continue; }
    const eventCount = c.eventCount;
    const stage = eventCount >= 5 ? 'inner_circle' : eventCount >= 3 ? 'deepening' : eventCount >= 2 ? 'in_touch' : 'new_contact';
    const score = eventCount >= 5 ? 50 : eventCount >= 3 ? 30 : eventCount >= 2 ? 20 : 10;
    const background = `JRE event history: ${c.events.slice(0, 3).join(', ')}${c.events.length > 3 ? ` +${c.events.length - 3} more` : ''}`;
    toInsert.push({
      first_name: c.firstName, last_name: c.lastName, email,
      phone: c.phone, gender: c.gender, stage, source: 'sheets_import',
      engagement_score: score, background, how_met: 'event',
    });
  }

  for (const c of noEmail) {
    if (existingByName.has(c.nameKey)) { alreadyExists++; continue; }
    if (c.firstName === '?' || c.firstName.includes('@')) continue;
    const background = `JRE event: ${c.events[0]}`;
    toInsert.push({
      first_name: c.firstName, last_name: c.lastName, email: null,
      phone: c.phone, gender: c.gender, stage: 'new_contact', source: 'sheets_import',
      engagement_score: 10, background, how_met: 'event',
    });
  }

  console.log(`\nAlready in CRM: ${alreadyExists}`);
  console.log(`New to import: ${toInsert.length}`);

  if (toInsert.length === 0) {
    console.log('✅ Everyone already in CRM!');
    return;
  }

  let created = 0;
  const BATCH = 50;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH);
    const { error } = await supabase.from('outreach_contacts').insert(batch);
    if (error) console.error(`Batch error:`, error.message, batch.slice(0, 2));
    else { created += batch.length; process.stdout.write(`\rInserted ${created}/${toInsert.length}...`); }
  }

  const { count } = await supabase.from('outreach_contacts').select('*', { count: 'exact', head: true });
  console.log(`\n\n✅ Done! Added ${created} new contacts`);
  console.log(`Total in CRM: ${count}`);
}

main().catch(console.error);
