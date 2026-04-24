import { sheets, SPREADSHEET_ID } from "./client";
import { sendTelegram } from "@/lib/telegram/sender";
import type { EmailSignup, Donation, EventRegistration, Event } from "@/types/database";

const SHEET_URL = SPREADSHEET_ID
  ? `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`
  : "";

const TAB_HEADERS = {
  "Donations": [
    "ID", "Amount", "Recurring", "Frequency", "Name", "Email", "Phone",
    "Honor Name", "Honor Email", "Sponsorship", "Message",
    "Payment Status", "Payment Reference", "Timestamp",
  ],
  "Event Registrations": [
    "ID", "Event", "Event Date", "Year", "Name", "Email", "Phone",
    "Adults", "Kids", "Sponsorship", "Subtotal",
    "Payment Status", "Payment Reference", "Timestamp",
  ],
  "Email Signups": [
    "ID", "Name", "Email", "Phone", "Subject", "Message", "Timestamp", "Source",
  ],
} as const;

const ensuredTabs = new Set<string>();

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function ensureTab(tabName: keyof typeof TAB_HEADERS): Promise<void> {
  if (!SPREADSHEET_ID || ensuredTabs.has(tabName)) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === tabName);

  if (!exists) {
    const headers = TAB_HEADERS[tabName];
    const lastCol = colLetter(headers.length);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1:${lastCol}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [Array.from(headers)] },
    });

    const refreshed = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheetId = refreshed.data.sheets?.find((s) => s.properties?.title === tabName)?.properties?.sheetId;
    if (sheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.937, green: 0.502, blue: 0.275 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  },
                },
                fields: "userEnteredFormat(backgroundColor,textFormat)",
              },
            },
            {
              updateSheetProperties: {
                properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                fields: "gridProperties.frozenRowCount",
              },
            },
          ],
        },
      });
    }
    console.log(`Created sheet tab: ${tabName}`);
  }

  ensuredTabs.add(tabName);
}

async function runWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastErr;
}

async function alertSheetSyncFailure(context: {
  kind: "donation" | "registration" | "status-update";
  id: string;
  amount?: number;
  name?: string;
  email?: string;
  extra?: string;
  error: unknown;
}): Promise<void> {
  const errMsg = context.error instanceof Error ? context.error.message : String(context.error);
  const lines = [
    `<b>Sheet sync failed</b> — ${context.kind} saved in DB but missing from Sheets.`,
    "",
    context.amount !== undefined ? `<b>Amount:</b> $${context.amount}` : "",
    context.name ? `<b>Name:</b> ${context.name}` : "",
    context.email ? `<b>Email:</b> ${context.email}` : "",
    `<b>ID:</b> <code>${context.id}</code>`,
    context.extra || "",
    `<b>Error:</b> ${errMsg}`,
    "",
    SHEET_URL ? `<a href="${SHEET_URL}">Open sheet</a> to add manually.` : "",
  ].filter(Boolean);

  await sendTelegram("jre", lines.join("\n"), {
    severity: "warning",
    parseMode: "HTML",
  });
}

// Sync contact form submission to Google Sheets
export async function syncContactToSheets(data: EmailSignup): Promise<void> {
  if (!SPREADSHEET_ID) {
    console.warn("Google Sheets ID not configured, skipping sync");
    return;
  }

  try {
    const values = [
      [
        data.id,
        data.name,
        data.email,
        data.phone || "",
        data.subject || "",
        data.message || "",
        new Date(data.created_at).toLocaleString(),
        data.source,
      ],
    ];

    await ensureTab("Email Signups");
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Email Signups!A:H",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    console.log("Contact synced to Google Sheets:", data.id);
  } catch (error) {
    console.error("Failed to sync contact to Google Sheets:", error);
    // Don't throw - we don't want to fail the main operation
  }
}

// Sync donation to Google Sheets
export async function syncDonationToSheets(data: Donation): Promise<void> {
  if (!SPREADSHEET_ID) {
    console.warn("Google Sheets ID not configured, skipping sync");
    return;
  }

  try {
    const values = [
      [
        data.id,
        data.amount,
        data.is_recurring ? "Yes" : "No",
        data.recurring_frequency || "",
        data.name,
        data.email,
        data.phone || "",
        data.honor_name || "",
        data.honor_email || "",
        data.sponsorship || "",
        data.message || "",
        data.payment_status,
        data.payment_reference || "",
        new Date(data.created_at).toLocaleString(),
      ],
    ];

    await ensureTab("Donations");
    await runWithRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Donations!A:N",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      })
    );

    console.log("Donation synced to Google Sheets:", data.id);
  } catch (error) {
    console.error("Failed to sync donation to Google Sheets after retries:", error);
    await alertSheetSyncFailure({
      kind: "donation",
      id: data.id,
      amount: data.amount,
      name: data.name,
      email: data.email,
      extra: `<b>Status:</b> ${data.payment_status}`,
      error,
    });
  }
}

// Sync event registration to Google Sheets
export async function syncRegistrationToSheets(
  data: EventRegistration,
  event: Event
): Promise<void> {
  if (!SPREADSHEET_ID) {
    console.warn("Google Sheets ID not configured, skipping sync");
    return;
  }

  try {
    const eventYear = new Date(event.date + "T00:00:00").getFullYear();

    const values = [
      [
        data.id,
        event.title,
        event.date,
        eventYear,
        data.name,
        data.email,
        data.phone || "",
        data.adults,
        data.kids,
        data.sponsorship_id || "None",
        data.subtotal,
        data.payment_status,
        data.payment_reference || "",
        new Date(data.created_at).toLocaleString(),
      ],
    ];

    await ensureTab("Event Registrations");
    await runWithRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "Event Registrations!A:N",
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      })
    );

    console.log("Event registration synced to Google Sheets:", data.id);
  } catch (error) {
    console.error("Failed to sync event registration to Google Sheets after retries:", error);
    await alertSheetSyncFailure({
      kind: "registration",
      id: data.id,
      amount: data.subtotal,
      name: data.name,
      email: data.email,
      extra: `<b>Event:</b> ${event.title}`,
      error,
    });
  }
}

// Update donation status in Google Sheets (for payment status updates)
export async function updateDonationStatusInSheets(
  donationId: string,
  newStatus: string
): Promise<void> {
  if (!SPREADSHEET_ID) return;

  try {
    const response = await runWithRetry(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Donations!A:N",
      })
    );

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === donationId);

    if (rowIndex === -1) return;

    await runWithRetry(() =>
      sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Donations!L${rowIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[newStatus]] },
      })
    );

    console.log("Donation status updated in Google Sheets:", donationId);
  } catch (error) {
    console.error("Failed to update donation status in Google Sheets after retries:", error);
    await alertSheetSyncFailure({
      kind: "status-update",
      id: donationId,
      extra: `<b>New status:</b> ${newStatus}`,
      error,
    });
  }
}
