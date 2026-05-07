import { NextRequest, NextResponse } from "next/server";
import { sheets, SPREADSHEET_ID } from "@/lib/google-sheets/client";

const SHEET_TAB = "WomensIsraelTrip";
const HEADERS = ["Timestamp", "Name", "Email", "Status", "Comments"];

async function ensureTab() {
  if (!SPREADSHEET_ID) return false;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = (meta.data.sheets || []).find(
    (s) => s.properties?.title === SHEET_TAB
  );
  if (existing) return true;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A1:E1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [HEADERS] },
  });

  const refreshed = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetId = refreshed.data.sheets?.find(
    (s) => s.properties?.title === SHEET_TAB
  )?.properties?.sheetId;

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
                  backgroundColor: { red: 0.71, green: 0.514, blue: 0.553 },
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
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      },
    });
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    if (!SPREADSHEET_ID) {
      return NextResponse.json(
        { success: false, error: "Sheets not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const status = String(body.status || "").trim();
    const comments = String(body.comments || "").trim();

    if (!name || !email || !status) {
      return NextResponse.json(
        { success: false, error: "Name, email, and a selection are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    await ensureTab();

    const timestamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_TAB}!A:E`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[timestamp, name, email, status, comments]] },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Interest form submission failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Submission failed.",
      },
      { status: 500 }
    );
  }
}
