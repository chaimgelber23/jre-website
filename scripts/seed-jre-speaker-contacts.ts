/**
 * Phase 2 seed: read the "roster" tab at the bottom of the JRE Tuesday sheet
 * (Name / Pay / Topic / Phone / Email / Notes) and patch each speaker with
 * their email + phone + typical pay rate.
 *
 * We do this with a fuzzy name match against existing jre_speakers rows
 * (same names sometimes appear with slight spelling variations — e.g.
 *  "Rebbetzin Golshevksy" vs "Yehudis Golshevsky").
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { google } from "googleapis";
import { upsertSpeaker, getSpeakerByName, listActiveSpeakers } from "../src/lib/db/secretary";

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

function tokenize(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !["rabbi", "rebbetzin", "rebbetzen", "mrs", "mr", "dr"].includes(w))
  );
}

function matchScore(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(1, Math.min(ta.size, tb.size));
}

async function main() {
  console.log("[seed-contacts] reading roster tab…");
  const sheets = makeSheets();

  // Find the last tab — roster usually lives after the weekly logs.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: JRE_SPEAKER_SHEET_ID });
  const tabs = meta.data.sheets?.map((s) => s.properties?.title).filter(Boolean) as string[];
  console.log(`[seed-contacts] tabs: ${tabs.join(", ")}`);

  // Strategy: scan every tab for a "Name / Email / Phone" header.
  const candidates: Array<{ name: string; phone: string; email: string; payRate: number | null }> = [];
  for (const tab of tabs) {
    const range = `${tab}!A:F`;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: JRE_SPEAKER_SHEET_ID,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const values = (res.data.values as string[][]) ?? [];
    for (let i = 0; i < values.length; i++) {
      const row = values[i] ?? [];
      const header = row.map((c) => String(c ?? "").trim().toLowerCase());
      if (header.includes("email") && header.includes("phone")) {
        const idxName = header.indexOf("name");
        const idxPay = header.findIndex((h) => h.includes("pay"));
        const idxPhone = header.indexOf("phone");
        const idxEmail = header.indexOf("email");
        for (let j = i + 1; j < values.length; j++) {
          const r = values[j] ?? [];
          const name = String(r[idxName] ?? "").trim();
          if (!name) continue;
          const payRaw = String(r[idxPay] ?? "").replace(/[$,]/g, "").trim();
          const pay = payRaw ? Number(payRaw) : null;
          candidates.push({
            name,
            phone: String(r[idxPhone] ?? "").trim(),
            email: String(r[idxEmail] ?? "").trim(),
            payRate: Number.isFinite(pay) ? pay : null,
          });
        }
        break;
      }
    }
  }
  console.log(`[seed-contacts] pulled ${candidates.length} contact rows`);

  const existing = await listActiveSpeakers();
  let updated = 0;
  for (const c of candidates) {
    // Exact match first
    let target = await getSpeakerByName(c.name);
    if (!target) {
      // Fuzzy match
      const scored = existing
        .map((s) => ({ s, score: matchScore(s.full_name, c.name) }))
        .sort((a, b) => b.score - a.score);
      if (scored[0]?.score >= 0.66) target = scored[0].s;
    }
    if (!target) continue;
    await upsertSpeaker({
      full_name: target.full_name,
      email: c.email || target.email,
      phone: c.phone || target.phone,
      last_fee_usd: target.last_fee_usd ?? c.payRate,
    });
    updated++;
  }
  console.log(`[seed-contacts] enriched ${updated} speakers with email/phone`);
}

main().catch((err) => {
  console.error("[seed-contacts] FAILED:", err);
  process.exit(1);
});
