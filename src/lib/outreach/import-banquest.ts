// @ts-nocheck
/**
 * Phase 0: Banquest Donor CSV Import
 *
 * Parses a CSV exported from the Banquest dashboard and returns
 * a list of PartialContacts with donation interactions attached.
 *
 * Banquest CSV typically has columns like:
 *   Date, Name, Email, Phone, Amount, Recurring, Description, Status
 *
 * We handle flexible column naming since Banquest may vary.
 */

import type { PartialContact } from "@/lib/outreach/engagement";
import { parseName } from "@/lib/outreach/engagement";

// Flexible column name mapping (lowercase)
const COL_MAP: Record<string, string[]> = {
  date:      ["date", "transaction date", "payment date", "created"],
  name:      ["name", "full name", "donor name", "customer name", "cardholder"],
  firstName: ["first name", "firstname"],
  lastName:  ["last name", "lastname"],
  email:     ["email", "e-mail", "email address"],
  phone:     ["phone", "phone number", "mobile", "cell"],
  amount:    ["amount", "total", "charge amount", "donation amount"],
  recurring: ["recurring", "is recurring", "type", "frequency"],
  status:    ["status", "payment status"],
};

function findCol(headers: string[], keys: string[]): number {
  return headers.findIndex((h) => keys.includes(h.toLowerCase().trim()));
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export interface BanquestImportResult {
  contacts: PartialContact[];
  rowsProcessed: number;
  rowsSkipped: number;
  totalDonationAmount: number;
}

export function parseBanquestCSV(csvText: string): BanquestImportResult {
  const lines = csvText.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { contacts: [], rowsProcessed: 0, rowsSkipped: 0, totalDonationAmount: 0 };
  }

  const headers = parseCSVLine(lines[0]);
  const dataLines = lines.slice(1);

  // Map column indexes
  const colDate      = findCol(headers, COL_MAP.date);
  const colName      = findCol(headers, COL_MAP.name);
  const colFirst     = findCol(headers, COL_MAP.firstName);
  const colLast      = findCol(headers, COL_MAP.lastName);
  const colEmail     = findCol(headers, COL_MAP.email);
  const colPhone     = findCol(headers, COL_MAP.phone);
  const colAmount    = findCol(headers, COL_MAP.amount);
  const colRecurring = findCol(headers, COL_MAP.recurring);
  const colStatus    = findCol(headers, COL_MAP.status);

  const contacts: PartialContact[] = [];
  let rowsSkipped = 0;
  let totalDonationAmount = 0;

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const row = parseCSVLine(line);

    // Skip failed payments if status column exists
    if (colStatus >= 0) {
      const status = String(row[colStatus] || "").toLowerCase();
      if (status === "failed" || status === "declined" || status === "error") {
        rowsSkipped++;
        continue;
      }
    }

    // Parse name
    let firstName = "";
    let lastName = "";
    if (colFirst >= 0 || colLast >= 0) {
      firstName = colFirst >= 0 ? String(row[colFirst] || "").trim() : "";
      lastName  = colLast  >= 0 ? String(row[colLast]  || "").trim() : "";
    } else if (colName >= 0) {
      const parsed = parseName(String(row[colName] || ""));
      firstName = parsed.firstName;
      lastName  = parsed.lastName;
    }

    const email  = colEmail >= 0 ? String(row[colEmail] || "").trim()  : "";
    const phone  = colPhone >= 0 ? String(row[colPhone] || "").trim()  : "";
    const amount = colAmount >= 0 ? parseFloat(String(row[colAmount] || "0").replace(/[^0-9.]/g, "")) : 0;
    const dateStr = colDate >= 0 ? String(row[colDate] || "").trim() : "";
    const recurringRaw = colRecurring >= 0 ? String(row[colRecurring] || "").toLowerCase() : "";
    const isRecurring = recurringRaw.includes("recurring") || recurringRaw.includes("monthly") || recurringRaw.includes("weekly") || recurringRaw === "true" || recurringRaw === "yes";

    if (!firstName && !email) {
      rowsSkipped++;
      continue;
    }

    // Parse the date to YYYY-MM-DD
    let isoDate = new Date().toISOString().split("T")[0];
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        isoDate = parsed.toISOString().split("T")[0];
      }
    }

    if (amount > 0) totalDonationAmount += amount;

    contacts.push({
      firstName,
      lastName,
      email:             email || undefined,
      phone:             phone || undefined,
      source:            "banquest_import",
      donationCount:     1,
      donationTotal:     amount,
      isRecurringDonor:  isRecurring,
      interactions: [
        {
          type:           "donation",
          date:           isoDate,
          donationAmount: amount,
          notes:          `Banquest donation — $${amount.toFixed(2)}${isRecurring ? " (recurring)" : ""}`,
        },
      ],
    });
  }

  return {
    contacts,
    rowsProcessed: dataLines.length - rowsSkipped,
    rowsSkipped,
    totalDonationAmount,
  };
}
