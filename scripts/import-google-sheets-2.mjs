/**
 * Second pass — read the additional tabs we skipped from the JRE Google Sheet
 * These are newer 2024-2025 events not initially mapped.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = '1NUOQLTodMTgl6zABdInE7RP5yfehYxKABCwaH5CUg0I';
const SUPABASE_URL = 'https://yhckumlsxrvfvtwrluge.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// These were previously skipped — now read them
const TARGET_TABS = [
  'donations', 'marriage', 'Heart', 'Pre-Shavous', 'Mussar25', 'Purim25',
  'Yossi Purim 2025 Invites', 'Retreat', 'Coal', 'NextLevel',
  'Monsey', 'Marathon', 'Siyum24', 'LunchnLearnOct24', 'Prayer', 'FiredUp'
];

const SKIP_NAMES = new Set(['tester tester', 'test', 'q q', 'gitty', 'gitty levi', 'tester', 'registrant', 'spouse', 'kid', 'guest', 'name']);
const SKIP_EMAILS = new Set(['test', 'glevi@thejre.org', 'jay@aklaunch.com', 'tester@gmail.com', 'n/a', '-', '', 'email', 'N/A']);
const SKIP_NAME_STARTS = ['<', '>', 'please', 'to ', 'feel', 'cover', 'gotta'];

const MALE_NAMES = new Set(['aaron','adam','alan','alex','andrew','andy','ari','ariel','asher','barry','ben','benjamin','brad','brian','bruce','carl','charles','chris','daniel','dave','david','dean','donald','doug','eli','eric','ethan','evan','frank','fred','gabe','gary','george','greg','harold','howard','isaac','jack','jacob','james','jason','jay','jeff','jeffrey','jeremy','joel','jonathan','josh','joshua','kenneth','kevin','larry','marc','mark','martin','matt','michael','mitch','mordechai','moshe','nathan','neil','noah','paul','peter','philip','randy','richard','robert','ron','ross','russell','ryan','sam','scott','sean','seth','simon','sol','stanley','steve','steven','thomas','tim','todd','tom','warren','william','yehuda','zev','zusha','kenny','nechemia','zeev','menachem','avi','dov','eliyahu','gavriel','yitzchak','yosef','javier','bryan','joel','ouri','ravid','gene','michel','sergi','alexander','jeffrey','philip','neil','barry','joseph','simcha','jared','benjamin','jacob','yossi','chaim','shmuel','tzvi','pinchas','moshe']);
const FEMALE_NAMES = new Set(['abby','abigail','adina','adrienne','alexa','alexis','alice','alison','allison','alyssa','amanda','amy','andrea','angela','ann','anna','anne','ashley','barbara','becky','beth','beverly','bonnie','brenda','carol','carolyn','cathy','chana','cheryl','claire','dana','debbie','deborah','diana','donna','eileen','elana','eleanor','elisa','elizabeth','ellen','emily','erica','esther','eve','esti','fran','gail','gloria','hannah','harriet','helen','ilana','ilissa','iris','jackie','jacqueline','janet','janice','jean','jenna','jennifer','jessica','jill','joann','joyce','judith','julie','karen','kate','kathy','kim','kirsti','laura','lauren','leah','lena','leslie','linda','lisa','lori','lynn','malka','marcia','margaret','marilyn','marsha','mary','maya','melissa','michelle','miriam','molly','nancy','naomi','nadine','natalie','nina','nomi','pamela','patricia','pearl','phyllis','rachel','rebecca','rena','renee','rivka','robin','rochelle','rose','ruth','sara','sarah','sharon','shelley','sheryl','shira','shirley','stacy','stephanie','susan','suzanne','tammy','tina','vicki','victoria','wendy','yael','yvonne','joanne','randi','elisheva','bess','rifkie','lara','batia','bella','betty','cynthia','bari','wendy','chanie','bess','jane','cindy','maura','elise','dina','devorah','ahuva','mimi','tzippy','blimi']);

function detectGender(name) {
  if (!name) return 'unknown';
  const n = name.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (MALE_NAMES.has(n)) return 'male';
  if (FEMALE_NAMES.has(n)) return 'female';
  return 'unknown';
}

function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '' };
  const s = String(fullName).trim();
  const ampersand = s.match(/^(\w+)\s*(?:&|and)\s*\w+\s+(.+)/i);
  if (ampersand) return { firstName: ampersand[1], lastName: ampersand[2].trim() };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function extractContact(row) {
  // Try many possible column name patterns
  const nameKeys  = ['Name', 'name', 'Full Name', 'Registrant Name', 'Registrant Fullname', 'Contact Name', 'Guest Name'];
  const emailKeys = ['Email', 'email', 'Registrant Email', 'Email Address', 'E-mail'];
  const phoneKeys = ['Phone', 'phone', 'Registrant Phone Number', 'Phone Number', 'Cell'];

  let name = null, email = null, phone = null;
  for (const k of nameKeys)  { if (row[k] && String(row[k]).trim() && String(row[k]).trim().length > 1) { name = String(row[k]).trim(); break; } }
  for (const k of emailKeys) { if (row[k] && String(row[k]).trim()) { email = String(row[k]).trim().toLowerCase(); break; } }
  for (const k of phoneKeys) { if (row[k] && String(row[k]).trim()) { phone = String(row[k]).replace(/\D/g, '').substring(0, 15); break; } }

  return { name, email: email || null, phone: phone || null };
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

  console.log(`Reading additional tabs from Google Sheet...`);

  // First, let's just show what's in each tab so we know what we're dealing with
  for (const tabName of TARGET_TABS) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: tabName,
      });
      const rows = res.data.values || [];
      if (rows.length === 0) { console.log(`\n${tabName}: EMPTY`); continue; }
      const headers = rows[0];
      const dataRows = rows.slice(1).filter(r => r.some(c => c && String(c).trim()));
      console.log(`\n${tabName} (${dataRows.length} rows):`);
      console.log(`  Headers: ${headers.slice(0, 8).join(' | ')}`);
      dataRows.slice(0, 3).forEach((row, i) => {
        const obj = {};
        headers.forEach((h, j) => { if (row[j] && String(row[j]).trim()) obj[h] = String(row[j]).trim().substring(0, 40); });
        console.log(`  [${i+1}] ${JSON.stringify(obj).substring(0, 200)}`);
      });
    } catch (e) {
      console.log(`\n${tabName}: ERROR — ${e.message}`);
    }
  }
}

main().catch(console.error);
