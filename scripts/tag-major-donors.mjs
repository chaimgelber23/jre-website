import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const supabase = createClient(
  'https://yhckumlsxrvfvtwrluge.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseFirstName(first) {
  if (!first) return { primary: '', spouse: null };
  const str = String(first).trim();
  const match = str.match(/^(\w+)\s*(?:&|and)\s*(\w+)/i);
  if (match) return { primary: match[1], spouse: match[2] };
  return { primary: str.split(/\s+/)[0], spouse: null };
}

async function main() {
  const wb = XLSX.readFile('C:/Users/chaim/Downloads/Contacts.xlsx');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Contacts']);
  const majorDonors = rows.filter(r => (r['DonationAmountLTD'] || 0) >= 1000);
  console.log(`Major donors ($1000+ LTD) in Banquest: ${majorDonors.length}`);

  // Fetch all contacts with pagination
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase.from('outreach_contacts').select('id, first_name, last_name').range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  const byName = new Map();
  all.forEach(c => byName.set(`${c.first_name.toLowerCase()} ${(c.last_name||'').toLowerCase()}`.trim(), c.id));
  console.log(`Total contacts in CRM: ${all.length}`);

  let updated = 0, notFound = 0;
  for (const row of majorDonors) {
    const firstName = String(row['First'] || '').trim();
    const lastName  = String(row['Last']  || '').trim();
    const { primary, spouse } = parseFirstName(firstName);
    const key = `${primary.toLowerCase()} ${lastName.toLowerCase()}`.trim();
    let id = byName.get(key);
    if (!id && spouse) id = byName.get(`${spouse.toLowerCase()} ${lastName.toLowerCase()}`.trim());
    if (id) {
      const { error } = await supabase.from('outreach_contacts').update({ group_name: 'Major Donors' }).eq('id', id);
      if (!error) updated++;
    } else {
      notFound++;
    }
  }

  console.log(`\nTagged: ${updated} Major Donors`);
  console.log(`Not found in CRM: ${notFound}`);
  const { count } = await supabase.from('outreach_contacts').select('*', { count: 'exact', head: true }).eq('group_name', 'Major Donors');
  console.log(`Total Major Donors in CRM: ${count}`);
}
main().catch(console.error);
