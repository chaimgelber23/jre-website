#!/usr/bin/env node
/**
 * Donor follow-up reminder — the "nothing falls through the cracks" piece.
 *
 * Reads the Donor Pipeline tab and, for every row where:
 *   - Next Step Date is set
 *   - Next Step Date is today or in the past
 *   - Status is NOT Gift Received / Declined / Parked
 * ... emails the Owner of that row (Chaim or Rabbi Oratz) with the donor card
 * and a "mark it done" nudge.
 *
 * The email goes to the Owner, CCs Chaim if the owner is Rabbi Oratz
 * and the follow-up is 2+ days overdue.
 *
 * Env flags:
 *   DRY_RUN=1        Print what would be sent, don't send.
 *   SKIP_SHABBOS=0   Disable the Shabbos guard.
 *
 * Usage:
 *   node scripts/send-donor-followup-reminders.mjs
 *   DRY_RUN=1 node scripts/send-donor-followup-reminders.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  getAuthedClient,
  getTrackerSheetId,
  sendGmail,
  isShabbosOrYomTov,
  RABBI_ORATZ_EMAIL,
  CHAIM_EMAIL,
} from "./campaign-tracker-lib.mjs";

const DRY_RUN = process.env.DRY_RUN === "1";
const SKIP_SHABBOS = process.env.SKIP_SHABBOS !== "0";

const FINAL_STATUSES = new Set(["Gift Received", "Declined", "Parked"]);

const OWNER_EMAIL = {
  "Chaim": CHAIM_EMAIL,
  "Rabbi Oratz": RABBI_ORATZ_EMAIL,
  "Gitty": "glevi@thejre.org",
};

function daysBetween(fromDate, toDate) {
  const MS = 24 * 60 * 60 * 1000;
  const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();
  const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime();
  return Math.round((b - a) / MS);
}

function parseDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (!str) return null;
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDollars(v) {
  const n = typeof v === "number" ? v : parseFloat(String(v || "").replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n === 0) return "";
  return `$${Math.round(n).toLocaleString()}`;
}

function buildEmail({ donors, ownerName, sheetUrl }) {
  const today = new Date();
  const dueToday = donors.filter((d) => d.daysOverdue === 0);
  const overdue = donors.filter((d) => d.daysOverdue > 0);
  const totalCount = donors.length;
  const subject =
    overdue.length > 0
      ? `${totalCount} donor follow-up${totalCount === 1 ? "" : "s"} — ${overdue.length} overdue`
      : `${totalCount} donor follow-up${totalCount === 1 ? "" : "s"} today`;

  const todayStr = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const row = (d) => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:10px 12px;font-size:14px;vertical-align:top;white-space:nowrap;">
        <strong>${escapeHtml(d.name)}</strong>
        ${d.ltd ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px;">LTD ${escapeHtml(formatDollars(d.ltd))}</div>` : ""}
      </td>
      <td style="padding:10px 12px;font-size:13px;vertical-align:top;">
        <div>${escapeHtml(d.nextStep || "(no next step written)")}</div>
        ${d.notes ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;">${escapeHtml(d.notes).slice(0, 120)}</div>` : ""}
      </td>
      <td style="padding:10px 12px;font-size:13px;vertical-align:top;white-space:nowrap;text-align:right;">
        <div style="color:${d.daysOverdue > 0 ? "#b91c1c" : "#b45309"};font-weight:600;">
          ${d.daysOverdue === 0 ? "Today" : `${d.daysOverdue}d overdue`}
        </div>
        <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${escapeHtml(d.email)}</div>
      </td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;color:#111827;">
<div style="max-width:680px;margin:0 auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
  <div style="background:#3d5389;padding:22px 28px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.8);text-transform:uppercase;margin-bottom:6px;">JRE Campaign — Daily Follow-Ups</div>
    <h1 style="font-size:22px;font-weight:700;color:white;margin:0;">${ownerName}, you have ${totalCount} donor${totalCount === 1 ? "" : "s"} to follow up with</h1>
    <div style="font-size:13px;color:rgba(255,255,255,0.9);margin-top:6px;">${todayStr}${overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}</div>
  </div>
  <div style="padding:22px 28px 8px;">
    ${overdue.length > 0 ? `
    <h2 style="font-size:14px;font-weight:700;color:#b91c1c;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em;">⚠️ Overdue (${overdue.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">${overdue.map(row).join("")}</table>
    ` : ""}
    ${dueToday.length > 0 ? `
    <h2 style="font-size:14px;font-weight:700;color:#b45309;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.05em;">Due Today (${dueToday.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">${dueToday.map(row).join("")}</table>
    ` : ""}
    <p style="font-size:14px;line-height:1.55;color:#374151;margin:0 0 10px;">
      When you've done a follow-up, open the tracker and update the row — either mark it Done (if the donor committed or declined) or write a new Next Step + Next Step Date:
    </p>
    <p style="margin:0 0 22px;">
      <a href="${sheetUrl}" style="display:inline-block;background:#3d5389;color:white;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Open the tracker →</a>
    </p>
    <p style="font-size:12px;color:#9ca3af;margin:0 0 8px;">These go out daily. If a donor's Next Step Date is still past, you'll see them here again tomorrow.</p>
  </div>
</div>
</body></html>`;

  const text = `${ownerName}, you have ${totalCount} donor follow-up(s) ${overdue.length ? `(${overdue.length} overdue)` : "today"}.

${donors.map((d) => `- ${d.name} (${d.email}) — ${d.daysOverdue === 0 ? "today" : `${d.daysOverdue}d overdue`} — ${d.nextStep || "(no next step)"}`).join("\n")}

Update in the tracker when done: ${sheetUrl}
`;

  return { subject, bodyHtml: html, bodyText: text };
}

async function main() {
  console.log(`[${new Date().toISOString()}] Donor follow-up reminders — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  if (SKIP_SHABBOS) {
    const shab = await isShabbosOrYomTov();
    if (shab.blocked) { console.log(`⏭️  Skipped — ${shab.reason}`); return; }
  }

  const sheetId = await getTrackerSheetId();
  if (!sheetId) throw new Error("No tracker sheet id");
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

  const { sheets, gmail } = await getAuthedClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Donor Pipeline!A2:U1000",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values || [];
  const today = new Date();

  // Group by owner
  const byOwner = {};
  for (const r of rows) {
    const [name, y2023, y2024, y2025, y2026, grandTotal, action, email, phone, tier, level, status, asked, pledged, received, owner, nextStep, nextStepDate, lastTouch, notes] = r;
    if (!name) continue;
    if (!owner || !OWNER_EMAIL[owner]) continue; // skip rows without an assigned owner
    if (FINAL_STATUSES.has(status)) continue;
    const d = parseDate(nextStepDate);
    if (!d) continue;
    const daysOverdue = -daysBetween(today, d); // positive = overdue
    if (daysOverdue < 0) continue; // future — skip
    byOwner[owner] = byOwner[owner] || [];
    byOwner[owner].push({ name, email, ltd: grandTotal, nextStep, notes, daysOverdue });
  }

  if (Object.keys(byOwner).length === 0) {
    console.log("No due / overdue follow-ups. 🎉");
    return;
  }

  for (const [owner, donors] of Object.entries(byOwner)) {
    donors.sort((a, b) => b.daysOverdue - a.daysOverdue);
    const email = buildEmail({ donors, ownerName: owner, sheetUrl });
    const toEmail = OWNER_EMAIL[owner];
    const maxOverdue = donors[0]?.daysOverdue ?? 0;
    const cc = owner === "Rabbi Oratz" && maxOverdue >= 2 ? [CHAIM_EMAIL] : undefined;

    console.log(`\n${owner} <${toEmail}>${cc ? ` + CC ${cc.join(",")}` : ""}`);
    console.log(`  ${donors.length} follow-ups, max overdue ${maxOverdue}d`);
    console.log(`  subject: ${email.subject}`);
    for (const d of donors) console.log(`    - ${d.name.padEnd(28)} ${(d.daysOverdue === 0 ? "today" : `${d.daysOverdue}d overdue`).padStart(10)}   ${d.nextStep || "(no next step)"}`);

    if (DRY_RUN) continue;

    try {
      await sendGmail(gmail, {
        to: [toEmail],
        cc,
        fromName: "Gitty Levi (JRE)",
        fromEmail: "glevi@thejre.org",
        subject: email.subject,
        bodyHtml: email.bodyHtml,
        bodyText: email.bodyText,
      });
    } catch (e) {
      console.error(`    ❌ send failed: ${e.message}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
