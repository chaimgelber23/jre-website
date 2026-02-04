import { sheets, SPREADSHEET_ID } from "./client";
import type { EmailSignup, Donation, EventRegistration, Event } from "@/types/database";

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

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Donations!A:N",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    console.log("Donation synced to Google Sheets:", data.id);
  } catch (error) {
    console.error("Failed to sync donation to Google Sheets:", error);
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
    const eventYear = new Date(event.date).getFullYear();

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

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Event Registrations!A:N",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    console.log("Event registration synced to Google Sheets:", data.id);
  } catch (error) {
    console.error("Failed to sync event registration to Google Sheets:", error);
  }
}

// Update donation status in Google Sheets (for payment status updates)
export async function updateDonationStatusInSheets(
  donationId: string,
  newStatus: string
): Promise<void> {
  if (!SPREADSHEET_ID) return;

  try {
    // Get all donations to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Donations!A:N",
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === donationId);

    if (rowIndex === -1) return;

    // Update the payment_status column (column L, index 11)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Donations!L${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[newStatus]] },
    });

    console.log("Donation status updated in Google Sheets:", donationId);
  } catch (error) {
    console.error("Failed to update donation status in Google Sheets:", error);
  }
}
