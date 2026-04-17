/**
 * JRE Tuesday speaker sheet — bidirectional sync.
 *
 * The Google Sheet (tab "2026") is what the boss checks. Supabase is canonical
 * for the app. Every class/payment write mirrors to the sheet; the Friday
 * payment-check also reads the sheet back so Rabbi Oratz can flip "Paid? Y/N"
 * by hand and the DB picks it up.
 *
 * Sheet URL: https://docs.google.com/spreadsheets/d/1p-YWN8h6Vf3XM2MtC15OlfcoI40LMLMKw_wMZzcEb_M/edit
 *
 * Column layout (tab "2026"):
 *   A  Date            (M/D/YY)
 *   B  Speaker         (full name)
 *   C  Pay Rate        ($X)
 *   D  Paid? Y/N
 *   E  Topic           (optional)
 *   F  Notes           (optional)
 *
 * We deliberately match the user's existing column layout — zero re-training
 * needed on the human side.
 */

import { google } from "googleapis";
import {
  getClassById,
  getClassByDate,
  getSpeakerById,
  getPaymentByClass,
  markPaid,
} from "@/lib/db/secretary";

const JRE_SPEAKER_SHEET_ID =
  process.env.JRE_SPEAKER_SHEET_ID || "1p-YWN8h6Vf3XM2MtC15OlfcoI40LMLMKw_wMZzcEb_M";

const DEFAULT_TAB = process.env.JRE_SPEAKER_SHEET_TAB || "2026";

function makeSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// ---- Types & helpers -------------------------------------------------------

export type SpeakerSheetRow = {
  rowIndex: number;            // 1-based sheet row (header at row 1)
  date: string;                // "M/D/YY" as stored
  dateISO: string | null;      // normalized YYYY-MM-DD
  speaker: string;
  payRateRaw: string;
  payRateNumeric: number | null;
  paid: boolean;
  topic: string;
  notes: string;
};

function parseDateCell(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // "4/28/26" or "04/28/2026" or "4/28"
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const mo = Number(m[1]);
    const day = Number(m[2]);
    let y = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (y < 100) y += 2000;
    const d = new Date(y, mo - 1, day);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // "28-Apr" / "4-28" style (fallback)
  return null;
}

function parseDollars(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatMMDDYY(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}/${String(y).slice(-2)}`;
}

// ---- Read ------------------------------------------------------------------

export async function readSheetRows(
  tab: string = DEFAULT_TAB
): Promise<SpeakerSheetRow[]> {
  const sheets = makeSheets();
  const range = `${tab}!A:F`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: JRE_SPEAKER_SHEET_ID,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const values: string[][] = (res.data.values as string[][]) ?? [];
  const out: SpeakerSheetRow[] = [];
  // Row 1 is the header; skip.
  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const dateRaw = String(row[0] ?? "").trim();
    const speaker = String(row[1] ?? "").trim();
    if (!dateRaw && !speaker) continue;
    const payRateRaw = String(row[2] ?? "").trim();
    const paidRaw = String(row[3] ?? "").trim().toLowerCase();
    out.push({
      rowIndex: i + 1,
      date: dateRaw,
      dateISO: parseDateCell(dateRaw),
      speaker,
      payRateRaw,
      payRateNumeric: parseDollars(payRateRaw),
      paid: paidRaw === "y" || paidRaw === "yes",
      topic: String(row[4] ?? ""),
      notes: String(row[5] ?? ""),
    });
  }
  return out;
}

/** All rows for a given speaker, most recent first. */
export async function historyForSpeaker(
  speakerFullName: string,
  tab?: string
): Promise<SpeakerSheetRow[]> {
  const rows = await readSheetRows(tab);
  const needle = speakerFullName.trim().toLowerCase();
  return rows
    .filter((r) => r.speaker.toLowerCase() === needle)
    .sort((a, b) => (b.dateISO ?? "").localeCompare(a.dateISO ?? ""));
}

export async function lastFeeForSpeaker(
  speakerFullName: string,
  tab?: string
): Promise<number | null> {
  const hist = await historyForSpeaker(speakerFullName, tab);
  for (const r of hist) {
    if (r.payRateNumeric != null && r.payRateNumeric > 0) return r.payRateNumeric;
  }
  return null;
}

// ---- Write -----------------------------------------------------------------

/**
 * Upsert a row for (classDate, speaker). If the date already has a row, we
 * overwrite it in place. Otherwise append.
 *
 * This is the hard requirement from the plan: "every DB write mirrors to the
 * sheet in the same transaction". Caller should await, and on failure roll
 * back the Supabase write + fire a critical Telegram alert.
 */
export async function mirrorClassToSheet(
  classId: string,
  tab: string = DEFAULT_TAB
): Promise<{ ok: true; rowIndex: number } | { ok: false; reason: string }> {
  const cls = await getClassById(classId);
  if (!cls) return { ok: false, reason: "class not found" };

  const speaker = cls.speaker_id ? await getSpeakerById(cls.speaker_id) : null;
  const speakerName = speaker?.full_name ?? "";
  const fee = cls.fee_usd ?? speaker?.last_fee_usd ?? null;
  const payment = await getPaymentByClass(classId);
  const paid = payment?.paid ?? false;

  const rowValues: (string | number)[] = [
    formatMMDDYY(cls.class_date),
    speakerName,
    fee ? `$${fee.toFixed(2)}` : "",
    paid ? "y" : "",
    cls.topic ?? "",
    "", // notes preserved if we're updating in place (see below)
  ];

  const sheets = makeSheets();
  const existing = await readSheetRows(tab);
  const match = existing.find((r) => r.dateISO === cls.class_date);

  if (match) {
    // Preserve caller's existing notes; only overwrite notes if we have content.
    rowValues[5] = match.notes;
    const range = `${tab}!A${match.rowIndex}:F${match.rowIndex}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: JRE_SPEAKER_SHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowValues] },
    });
    return { ok: true, rowIndex: match.rowIndex };
  }

  // Append a new row below existing content.
  await sheets.spreadsheets.values.append({
    spreadsheetId: JRE_SPEAKER_SHEET_ID,
    range: `${tab}!A:F`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [rowValues] },
  });
  // +1 over existing length because sheet is 1-indexed AND we appended.
  return { ok: true, rowIndex: existing.length + 2 };
}

/**
 * Reconcile direction 2: sheet → DB. Reads all rows where `Paid? Y/N` is "y"
 * and promotes those into jre_payments.paid = true. Used by the Fri 10am
 * payment-check cron.
 */
export async function reconcilePaidFromSheet(
  tab: string = DEFAULT_TAB
): Promise<{ promoted: number; skipped: number }> {
  const rows = await readSheetRows(tab);
  let promoted = 0;
  let skipped = 0;
  for (const r of rows) {
    if (!r.paid || !r.dateISO) continue;
    const cls = await getClassByDate(r.dateISO);
    if (!cls) {
      skipped++;
      continue;
    }
    const payment = await getPaymentByClass(cls.id);
    if (!payment || payment.paid) {
      skipped++;
      continue;
    }
    await markPaid(cls.id, "sheet");
    promoted++;
  }
  return { promoted, skipped };
}

// ---- Seeding ---------------------------------------------------------------

/**
 * Walk the full sheet history and return aggregated per-speaker stats.
 * Used by the one-time seed script to populate jre_speakers.
 */
export async function aggregateSpeakerHistory(
  tab?: string
): Promise<
  Array<{
    fullName: string;
    totalTalks: number;
    lastSpokeAt: string | null;
    lastFeeUsd: number | null;
    fees: number[];
  }>
> {
  const rows = await readSheetRows(tab);
  const map = new Map<
    string,
    {
      fullName: string;
      totalTalks: number;
      lastSpokeAt: string | null;
      lastFeeUsd: number | null;
      fees: number[];
    }
  >();
  for (const r of rows) {
    const name = r.speaker.trim();
    if (!name || /^(purim|retreat|holiday|rabbi oratz|rabbi hoffman|cancelled)/i.test(name)) {
      continue;
    }
    const key = name.toLowerCase();
    const entry = map.get(key) ?? {
      fullName: name,
      totalTalks: 0,
      lastSpokeAt: null,
      lastFeeUsd: null,
      fees: [],
    };
    entry.totalTalks += 1;
    if (r.payRateNumeric != null) entry.fees.push(r.payRateNumeric);
    if (r.dateISO && (entry.lastSpokeAt === null || r.dateISO > entry.lastSpokeAt)) {
      entry.lastSpokeAt = r.dateISO;
      if (r.payRateNumeric != null) entry.lastFeeUsd = r.payRateNumeric;
    }
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) =>
    (b.lastSpokeAt ?? "").localeCompare(a.lastSpokeAt ?? "")
  );
}
