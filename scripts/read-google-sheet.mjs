/**
 * Read the JRE outreach Google Sheet and extract all contacts
 * Sheet: https://docs.google.com/spreadsheets/d/1NUOQLTodMTgl6zABdInE7RP5yfehYxKABCwaH5CUg0I
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { google } from 'googleapis';

const SHEET_ID = '1NUOQLTodMTgl6zABdInE7RP5yfehYxKABCwaH5CUg0I';

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
  const sheetNames = meta.data.sheets.map(s => s.properties.title);
  console.log(`\n=== SPREADSHEET: ${meta.data.properties.title} ===`);
  console.log(`Tabs (${sheetNames.length}): ${sheetNames.join(', ')}\n`);

  // Read every tab
  for (const name of sheetNames) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: name,
      });
      const rows = res.data.values || [];
      if (rows.length === 0) {
        console.log(`\n--- Tab: "${name}" ---`);
        console.log('  (empty)');
        continue;
      }

      const headers = rows[0];
      const dataRows = rows.slice(1).filter(r => r.some(c => c && c.trim()));

      console.log(`\n--- Tab: "${name}" ---`);
      console.log(`  Rows: ${dataRows.length} | Columns: ${headers.length}`);
      console.log(`  Headers: ${headers.join(' | ')}`);
      console.log(`  Sample (first 5 rows):`);
      dataRows.slice(0, 5).forEach((row, i) => {
        const obj = {};
        headers.forEach((h, j) => { if (row[j]) obj[h] = row[j]; });
        console.log(`    [${i+1}] ${JSON.stringify(obj)}`);
      });

      // Count non-empty rows with useful data
      console.log(`  Total data rows: ${dataRows.length}`);
    } catch (e) {
      console.log(`  Error reading tab "${name}": ${e.message}`);
    }
  }
}

main().catch(console.error);
