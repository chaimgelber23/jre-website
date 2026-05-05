import { sheets, SPREADSHEET_ID } from "./client";

export interface EventSheetConfig {
  hasKids: boolean;
  hasSponsorships: boolean;
}

export interface EventRegistrationRow {
  id: string;
  timestamp: string;
  name: string;
  email: string;
  phone: string;
  adults: number;
  kids: number;
  allAttendees: string;
  sponsorshipName: string;
  sponsorshipAmount: number;
  fairMarketValue: number;
  taxDeductible: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentReference: string;
  notes: string;
}

function buildHeaders(config: EventSheetConfig): string[] {
  const headers = [
    "Registration ID",
    "Timestamp",
    "Name",
    "Email",
    "Phone",
    "Adults",
  ];
  if (config.hasKids) headers.push("Kids");
  headers.push("All Attendees");
  if (config.hasSponsorships) headers.push("Sponsorship", "Sponsorship Amount", "Fair Market Value", "Tax Deductible");
  headers.push("Total", "Payment Method", "Payment Status", "Payment Reference", "Notes");
  return headers;
}

function buildRow(data: EventRegistrationRow, config: EventSheetConfig): (string | number)[] {
  const row: (string | number)[] = [
    data.id,
    data.timestamp,
    data.name,
    data.email,
    data.phone,
    data.adults,
  ];
  if (config.hasKids) row.push(data.kids);
  row.push(data.allAttendees);
  if (config.hasSponsorships) row.push(data.sponsorshipName, data.sponsorshipAmount, data.fairMarketValue, data.taxDeductible);
  row.push(data.total, data.paymentMethod, data.paymentStatus, data.paymentReference, data.notes);
  return row;
}

/**
 * Resolves the current tab title from a known sheetId (gid). Sheet titles can
 * be renamed by an admin in the Sheets UI without changing the gid, so we use
 * gid as the durable handle once a tab has been created. Returns null if the
 * sheetId no longer exists in the spreadsheet (e.g. tab was deleted).
 */
async function resolveTabTitleById(sheetId: number): Promise<string | null> {
  if (!SPREADSHEET_ID) return null;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const found = (meta.data.sheets || []).find((s) => s.properties?.sheetId === sheetId);
  return found?.properties?.title ?? null;
}

/**
 * Ensures a sheet tab exists for an event, creating it with headers if needed.
 * Returns the sheetId (gid) of the existing or newly-created tab, or null on
 * failure. Callers should persist the gid back to events.sheet_tab_id so a
 * later admin rename in the Sheets UI doesn't break new registrations.
 */
async function ensureSheetExists(sheetName: string, config: EventSheetConfig): Promise<number | null> {
  if (!SPREADSHEET_ID) {
    console.error("SPREADSHEET_ID not configured");
    return null;
  }

  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets || [];
    const existing = existingSheets.find(
      (sheet) => sheet.properties?.title === sheetName
    );

    if (existing?.properties?.sheetId !== undefined) {
      return existing.properties.sheetId;
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });

    const headers = buildHeaders(config);
    const lastCol = String.fromCharCode(64 + headers.length); // A=1, B=2, etc.

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:${lastCol}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });

    // Format header row (bold, frozen, orange bg)
    const newSpreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const newSheet = newSpreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName
    );
    const sheetId = newSheet?.properties?.sheetId;

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
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                    },
                  },
                },
                fields: "userEnteredFormat(backgroundColor,textFormat)",
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: "gridProperties.frozenRowCount",
              },
            },
          ],
        },
      });
    }

    console.log(`Created sheet tab: ${sheetName} (gid=${sheetId}) with ${headers.length} columns`);
    return sheetId ?? null;
  } catch (error) {
    console.error(`Failed to ensure sheet exists: ${sheetName}`, error);
    return null;
  }
}

/**
 * Converts an event slug to a sheet tab name
 * e.g. "purim-2026" → "Purim26", "scotch-steak-seder" → "ScotchSteakSeder"
 */
export function slugToSheetName(slug: string): string {
  slug = slug.replace(/^\//, "");
  const parts = slug.split("-");

  // Check if last part is a year (4-digit number)
  const lastPart = parts[parts.length - 1];
  const hasYear = /^\d{4}$/.test(lastPart);

  if (hasYear) {
    // Capitalize all name parts, append 2-digit year
    const nameParts = parts.slice(0, -1);
    const name = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    const shortYear = lastPart.slice(-2);
    return `${name}${shortYear}`;
  }

  // No year — just capitalize all parts
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
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

/**
 * Appends a registration row to an event sheet, creating the sheet if needed.
 *
 * Resolution order for the destination tab:
 *   1. If `existingTabId` is provided, look up its current title in the
 *      spreadsheet metadata. This survives admin renames in the Sheets UI.
 *   2. Otherwise (or if the gid no longer exists), fall back to `sheetName`
 *      and auto-create with headers if missing.
 *
 * Returns `tabId` so the caller can persist it on events.sheet_tab_id and
 * future appends are immune to renames.
 *
 * Retries each Sheets API call up to 3x with exponential backoff (1s, 2s).
 * The cron drain at /api/cron/sync-event-sheets-drain catches anything still
 * missing via the synced_to_sheet flag on event_registrations.
 */
export async function appendEventRegistration(
  sheetName: string,
  rowData: EventRegistrationRow,
  config: EventSheetConfig,
  existingTabId?: number | null
): Promise<{ success: boolean; tabId?: number | null; error?: string }> {
  if (!SPREADSHEET_ID) {
    return { success: false, error: "SPREADSHEET_ID not configured" };
  }

  try {
    let resolvedTitle: string | null = null;
    let resolvedTabId: number | null = null;

    if (existingTabId != null) {
      try {
        resolvedTitle = await runWithRetry(() => resolveTabTitleById(existingTabId));
        if (resolvedTitle) resolvedTabId = existingTabId;
      } catch (e) {
        console.warn(`Could not resolve tab gid ${existingTabId}, falling back to name:`, e);
      }
    }

    if (!resolvedTitle) {
      const created = await runWithRetry(() => ensureSheetExists(sheetName, config));
      if (created == null) {
        return { success: false, error: "Failed to prepare sheet" };
      }
      resolvedTitle = sheetName;
      resolvedTabId = created;
    }

    const row = buildRow(rowData, config);
    const lastCol = String.fromCharCode(64 + row.length);

    await runWithRetry(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${resolvedTitle}!A:${lastCol}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      })
    );

    return { success: true, tabId: resolvedTabId };
  } catch (error) {
    console.error("Failed to append registration after retries:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
