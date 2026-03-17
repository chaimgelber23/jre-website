// @ts-nocheck
/**
 * Phase 0: Google Sheets Audit
 *
 * Reads ALL tabs in the JRE Google Sheets spreadsheet and extracts
 * every unique person (name, email, phone) along with what events
 * they attended. Called once from the admin import UI.
 */

import { sheets, SPREADSHEET_ID } from "@/lib/google-sheets/client";
import type { PartialContact } from "@/lib/outreach/engagement";
import { parseName } from "@/lib/outreach/engagement";

export interface SheetAuditResult {
  contacts: PartialContact[];
  tabsSummary: Array<{ name: string; rows: number; peopleFound: number }>;
  totalRows: number;
}

// Columns we look for (case-insensitive) to identify name/email/phone
const EMAIL_HEADERS = ["email", "e-mail", "emailaddress", "email address"];
const NAME_HEADERS = ["name", "full name", "fullname", "registrant", "registrant name"];
const FIRST_NAME_HEADERS = ["first name", "firstname", "first"];
const LAST_NAME_HEADERS = ["last name", "lastname", "last"];
const PHONE_HEADERS = ["phone", "phone number", "cell", "mobile", "telephone"];
const EVENT_HEADERS = ["event", "event name", "eventtitle"];

function findColIndex(headers: string[], targets: string[]): number {
  return headers.findIndex((h) => targets.includes(h.toLowerCase().trim()));
}

export async function auditGoogleSheets(): Promise<SheetAuditResult> {
  if (!SPREADSHEET_ID) throw new Error("GOOGLE_SHEETS_ID not set");

  // 1. Get list of all sheet tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetTabs = (meta.data.sheets || []).map((s) => s.properties?.title || "");

  const allContacts: PartialContact[] = [];
  const tabsSummary: Array<{ name: string; rows: number; peopleFound: number }> = [];
  let totalRows = 0;

  for (const tabName of sheetTabs) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: tabName,
      });

      const rows = res.data.values || [];
      if (rows.length < 2) {
        tabsSummary.push({ name: tabName, rows: 0, peopleFound: 0 });
        continue;
      }

      const headers = rows[0].map((h: string) => String(h || ""));
      const dataRows = rows.slice(1);
      totalRows += dataRows.length;

      // Detect column positions
      const emailIdx = findColIndex(headers, EMAIL_HEADERS);
      const nameIdx = findColIndex(headers, NAME_HEADERS);
      const firstIdx = findColIndex(headers, FIRST_NAME_HEADERS);
      const lastIdx = findColIndex(headers, LAST_NAME_HEADERS);
      const phoneIdx = findColIndex(headers, PHONE_HEADERS);

      // If we can't find any name or email column, skip this tab
      if (emailIdx === -1 && nameIdx === -1 && firstIdx === -1) {
        tabsSummary.push({ name: tabName, rows: dataRows.length, peopleFound: 0 });
        continue;
      }

      let peopleFound = 0;

      for (const row of dataRows) {
        const email = emailIdx >= 0 ? String(row[emailIdx] || "").trim() : "";
        let firstName = "";
        let lastName = "";

        if (firstIdx >= 0 || lastIdx >= 0) {
          firstName = firstIdx >= 0 ? String(row[firstIdx] || "").trim() : "";
          lastName = lastIdx >= 0 ? String(row[lastIdx] || "").trim() : "";
        } else if (nameIdx >= 0) {
          const parsed = parseName(String(row[nameIdx] || ""));
          firstName = parsed.firstName;
          lastName = parsed.lastName;
        }

        const phone = phoneIdx >= 0 ? String(row[phoneIdx] || "").trim() : "";

        // Skip rows with no usable identity
        if (!email && !firstName) continue;

        const contact: PartialContact = {
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          source: "sheets_import",
          eventCount: 1, // each tab row = 1 event interaction
          interactions: [
            {
              type: "event",
              date: new Date().toISOString().split("T")[0],
              eventTitle: tabName,
              notes: `Imported from Google Sheets tab: ${tabName}`,
            },
          ],
        };

        allContacts.push(contact);
        peopleFound++;
      }

      tabsSummary.push({ name: tabName, rows: dataRows.length, peopleFound });
    } catch {
      tabsSummary.push({ name: tabName, rows: 0, peopleFound: 0 });
    }
  }

  return { contacts: allContacts, tabsSummary, totalRows };
}
