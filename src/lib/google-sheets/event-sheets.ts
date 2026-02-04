import { sheets, SPREADSHEET_ID } from "./client";

// Standard headers for all event registration sheets
const EVENT_SHEET_HEADERS = [
  "Registration ID",
  "Timestamp",
  "Name",
  "Email",
  "Phone",
  "Spouse Name",
  "Spouse Email",
  "Spouse Phone",
  "Adults Count",
  "Kids Count",
  "All Attendees",
  "Sponsorship",
  "Sponsorship Amount",
  "Total Amount",
  "Payment Method",
  "Payment Status",
  "Payment Reference",
  "Message",
];

/**
 * Ensures a sheet tab exists for an event, creating it with headers if needed
 * @param sheetName - The name of the tab to create (e.g., "Purim25")
 * @returns true if successful
 */
async function ensureSheetExists(sheetName: string): Promise<boolean> {
  if (!SPREADSHEET_ID) {
    console.error("SPREADSHEET_ID not configured");
    return false;
  }

  try {
    // Get existing sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets || [];
    const sheetExists = existingSheets.some(
      (sheet) => sheet.properties?.title === sheetName
    );

    if (!sheetExists) {
      // Create the new sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      // Add headers to the new sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:R1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [EVENT_SHEET_HEADERS],
        },
      });

      // Format the header row (bold, frozen)
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
                  range: {
                    sheetId: sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.937, green: 0.502, blue: 0.275 }, // #EF8046
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
                    sheetId: sheetId,
                    gridProperties: {
                      frozenRowCount: 1,
                    },
                  },
                  fields: "gridProperties.frozenRowCount",
                },
              },
            ],
          },
        });
      }

      console.log(`Created new sheet tab: ${sheetName}`);
    }

    return true;
  } catch (error) {
    console.error(`Failed to ensure sheet exists: ${sheetName}`, error);
    return false;
  }
}

/**
 * Converts an event slug to a sheet tab name
 * @param slug - Event slug (e.g., "purim-2025")
 * @returns Sheet tab name (e.g., "Purim25")
 */
export function slugToSheetName(slug: string): string {
  // Remove the leading slash if present
  slug = slug.replace(/^\//, "");

  // Split by dash
  const parts = slug.split("-");

  if (parts.length >= 2) {
    // Capitalize first part and take last 2 digits of year
    const eventName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const year = parts[parts.length - 1];
    const shortYear = year.length === 4 ? year.slice(-2) : year;
    return `${eventName}${shortYear}`;
  }

  // Fallback: just capitalize
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/**
 * Appends a registration row to an event sheet, creating the sheet if needed
 * @param sheetName - The sheet tab name (e.g., "Purim25")
 * @param rowData - Array of values matching EVENT_SHEET_HEADERS order
 */
export async function appendEventRegistration(
  sheetName: string,
  rowData: (string | number)[]
): Promise<{ success: boolean; error?: string }> {
  if (!SPREADSHEET_ID) {
    return { success: false, error: "SPREADSHEET_ID not configured" };
  }

  try {
    // Ensure sheet exists (creates with headers if not)
    const sheetReady = await ensureSheetExists(sheetName);
    if (!sheetReady) {
      return { success: false, error: "Failed to prepare sheet" };
    }

    // Append the registration data
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:R`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowData] },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to append registration:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
