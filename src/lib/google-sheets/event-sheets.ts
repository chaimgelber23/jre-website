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
 * Ensures a sheet tab exists for an event, creating it with headers if needed
 */
async function ensureSheetExists(sheetName: string, config: EventSheetConfig): Promise<boolean> {
  if (!SPREADSHEET_ID) {
    console.error("SPREADSHEET_ID not configured");
    return false;
  }

  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets || [];
    const sheetExists = existingSheets.some(
      (sheet) => sheet.properties?.title === sheetName
    );

    if (!sheetExists) {
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

      console.log(`Created sheet tab: ${sheetName} with ${headers.length} columns`);
    }

    return true;
  } catch (error) {
    console.error(`Failed to ensure sheet exists: ${sheetName}`, error);
    return false;
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

/**
 * Appends a registration row to an event sheet, creating the sheet if needed.
 * Headers are built dynamically based on the event config.
 */
export async function appendEventRegistration(
  sheetName: string,
  rowData: EventRegistrationRow,
  config: EventSheetConfig
): Promise<{ success: boolean; error?: string }> {
  if (!SPREADSHEET_ID) {
    return { success: false, error: "SPREADSHEET_ID not configured" };
  }

  try {
    const sheetReady = await ensureSheetExists(sheetName, config);
    if (!sheetReady) {
      return { success: false, error: "Failed to prepare sheet" };
    }

    const row = buildRow(rowData, config);
    const lastCol = String.fromCharCode(64 + row.length);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:${lastCol}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to append registration:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
