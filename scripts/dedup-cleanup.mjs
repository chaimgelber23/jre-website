/**
 * Full deduplication — by email AND by name (for Banquest contacts with no email).
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yhckumlsxrvfvtwrluge.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Source priority — higher = keep
const PRIORITY = { 'banquest_import': 5, 'manual': 4, 'event_import': 3, 'email_signup_import': 2, 'sheets_import': 1 };

function sourcePriority(s) { return PRIORITY[s] || 0; }

async function fetchAll() {
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('outreach_contacts')
      .select('id, email, first_name, last_name, source, created_at, engagement_score, background')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function main() {
  console.log('Fetching all contacts...');
  const all = await fetchAll();
  console.log(`Total: ${all.length}`);

  const toDelete = new Set();

  // 1. Dedup by email
  const emailGroups = new Map();
  for (const c of all) {
    if (!c.email || !c.email.includes('@')) continue;
    const e = c.email.toLowerCase();
    if (!emailGroups.has(e)) emailGroups.set(e, []);
    emailGroups.get(e).push(c);
  }
  let emailDups = 0;
  for (const [email, group] of emailGroups) {
    if (group.length <= 1) continue;
    group.sort((a, b) => {
      const sp = sourcePriority(b.source) - sourcePriority(a.source);
      if (sp !== 0) return sp;
      return new Date(a.created_at) - new Date(b.created_at);
    });
    const del = group.slice(1).map(c => c.id).filter(id => !toDelete.has(id));
    del.forEach(id => toDelete.add(id));
    emailDups += del.length;
  }
  console.log(`Email duplicates to delete: ${emailDups}`);

  // 2. Dedup by name (for contacts without email)
  const nameGroups = new Map();
  for (const c of all) {
    if (toDelete.has(c.id)) continue;
    const key = `${c.first_name.toLowerCase().trim()} ${(c.last_name || '').toLowerCase().trim()}`;
    if (!nameGroups.has(key)) nameGroups.set(key, []);
    nameGroups.get(key).push(c);
  }
  let nameDups = 0;
  for (const [name, group] of nameGroups) {
    if (group.length <= 1) continue;
    group.sort((a, b) => {
      // Prefer the one with email
      const ae = a.email ? 1 : 0;
      const be = b.email ? 1 : 0;
      if (ae !== be) return be - ae;
      // Then by source priority
      const sp = sourcePriority(b.source) - sourcePriority(a.source);
      if (sp !== 0) return sp;
      // Then earlier created
      return new Date(a.created_at) - new Date(b.created_at);
    });
    const del = group.slice(1).map(c => c.id).filter(id => !toDelete.has(id));
    if (del.length > 0) {
      console.log(`  Name dup: "${name}" (${group.length} copies) — keeping [${group[0].source}], deleting ${del.length}`);
    }
    del.forEach(id => toDelete.add(id));
    nameDups += del.length;
  }
  console.log(`Name duplicates to delete: ${nameDups}`);
  console.log(`Total to delete: ${toDelete.size}`);

  if (toDelete.size === 0) {
    console.log('✅ No duplicates!');
    return;
  }

  // Delete in batches
  const ids = [...toDelete];
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const { error } = await supabase.from('outreach_contacts').delete().in('id', batch);
    if (error) console.error('Delete error:', error.message);
    else deleted += batch.length;
  }

  const { count } = await supabase.from('outreach_contacts').select('*', { count: 'exact', head: true });
  console.log(`\n✅ Deleted ${deleted} duplicates`);
  console.log(`🎉 Clean total: ${count}`);

  // Major Donors count
  const { count: md } = await supabase.from('outreach_contacts').select('*', { count: 'exact', head: true }).eq('group_name', 'Major Donors');
  console.log(`Major Donors tagged: ${md}`);
}
main().catch(console.error);
