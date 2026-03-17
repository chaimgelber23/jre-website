// @ts-nocheck
/**
 * Google Sheets sync for outreach CRM data.
 * Keeps two tabs in the main spreadsheet in sync:
 *   "Outreach Contacts" — full contact list
 *   "Outreach Interactions" — interaction log
 *
 * These tabs are "read-only" for the team (they see the data),
 * while the canonical store is Supabase.
 */

import { sheets, SPREADSHEET_ID } from "@/lib/google-sheets/client";
import type { OutreachContact, OutreachInteraction, OutreachTeamMember } from "@/types/database";
import { STAGE_LABELS, INTERACTION_LABELS } from "@/types/database";

const CONTACTS_TAB     = "Outreach Contacts";
const INTERACTIONS_TAB = "Outreach Interactions";

const CONTACT_HEADERS = [
  "ID", "First Name", "Last Name", "Email", "Phone", "Gender",
  "Stage", "Assigned To", "How Met", "Engagement Score",
  "Background", "Next Follow-up", "Source", "Created",
];

const INTERACTION_HEADERS = [
  "ID", "Contact Name", "Team Member", "Type", "Date",
  "Notes", "Location", "Stage Before", "Stage After", "Via", "Created",
];

async function ensureTabExists(tabName: string, headers: string[]) {
  if (!SPREADSHEET_ID) return;

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = (meta.data.sheets || []).some(
    (s) => s.properties?.title === tabName
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });

    // Write header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

/**
 * Append a single contact row to the "Outreach Contacts" tab.
 */
export async function appendContactToSheets(
  contact: OutreachContact,
  assignedMemberName?: string
) {
  if (!SPREADSHEET_ID) return;
  try {
    await ensureTabExists(CONTACTS_TAB, CONTACT_HEADERS);

    const row = [
      contact.id,
      contact.first_name,
      contact.last_name,
      contact.email || "",
      contact.phone || "",
      contact.gender,
      STAGE_LABELS[contact.stage] || contact.stage,
      assignedMemberName || "",
      contact.how_met || "",
      contact.engagement_score,
      contact.background || "",
      contact.next_followup_date || "",
      contact.source,
      contact.created_at.split("T")[0],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONTACTS_TAB}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  } catch {
    // Non-blocking — sheets sync failure should never break the main flow
  }
}

/**
 * Append a single interaction row to the "Outreach Interactions" tab.
 */
export async function appendInteractionToSheets(
  interaction: OutreachInteraction,
  contactName: string,
  teamMemberName?: string,
  via = "manual"
) {
  if (!SPREADSHEET_ID) return;
  try {
    await ensureTabExists(INTERACTIONS_TAB, INTERACTION_HEADERS);

    const row = [
      interaction.id,
      contactName,
      teamMemberName || "",
      INTERACTION_LABELS[interaction.type] || interaction.type,
      interaction.date,
      interaction.notes || "",
      interaction.location || "",
      interaction.stage_before || "",
      interaction.stage_after || "",
      via,
      interaction.created_at.split("T")[0],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INTERACTIONS_TAB}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  } catch {
    // Non-blocking
  }
}
