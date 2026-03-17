import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/chaim/Downloads/Contacts.xlsx');
const ws = wb.Sheets['Contacts'];
const rows = XLSX.utils.sheet_to_json(ws);

function excelDate(serial) {
  if (!serial) return null;
  const d = new Date((serial - 25569) * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

const people = rows.filter(r => r['Last'] && String(r['Last']).trim());
const companies = rows.filter(r => !r['Last'] || !String(r['Last']).trim());

console.log('Total rows:', rows.length);
console.log('People (have Last name):', people.length);
console.log('Organizations/Companies:', companies.length);

console.log('\nSample PEOPLE (first 15):');
people.slice(0, 15).forEach(r => {
  console.log(` ${r['First']} ${r['Last']} | LTD: $${(r['DonationAmountLTD']||0).toFixed(2)} | Last gift: ${excelDate(r['DonationDateLast'])} | YTD: $${(r['DonationAmountYTD']||0).toFixed(2)}`);
});

const ltdAmounts = rows.map(r => r['DonationAmountLTD'] || 0);
const total = ltdAmounts.reduce((a, b) => a + b, 0);
console.log('\n=== GIVING STATS ===');
console.log('Total lifetime giving recorded:', '$' + total.toFixed(2));
console.log('Donors giving $100+:', rows.filter(r => (r['DonationAmountLTD']||0) >= 100).length);
console.log('Donors giving $500+:', rows.filter(r => (r['DonationAmountLTD']||0) >= 500).length);
console.log('Donors giving $1000+:', rows.filter(r => (r['DonationAmountLTD']||0) >= 1000).length);
console.log('Donors giving $5000+:', rows.filter(r => (r['DonationAmountLTD']||0) >= 5000).length);
console.log('Active YTD donors:', rows.filter(r => (r['DonationAmountYTD']||0) > 0).length);

console.log('\nTop 20 donors (by LTD):');
rows.sort((a, b) => (b['DonationAmountLTD']||0) - (a['DonationAmountLTD']||0))
    .slice(0, 20)
    .forEach(r => {
      const name = r['Last'] ? `${r['First']} ${r['Last']}` : r['First'] || r['Acknowledgement'];
      console.log(`  ${name} — $${(r['DonationAmountLTD']||0).toFixed(2)} LTD | Last: ${excelDate(r['DonationDateLast'])}`);
    });
