#!/usr/bin/env node
/**
 * Daily campaign digest — one email to Chaim + Rabbi Oratz with the state of
 * the whole pipeline. Goes out once a day, morning. Complements the per-owner
 * follow-up reminder email by giving the bird's-eye view.
 *
 * Pulls from Donor Pipeline tab:
 *   - $ asked / $ pledged / $ received (+ gap to goal)
 *   - Status distribution
 *   - # overdue follow-ups per owner
 *   - Stale donors (no touch in 14+ days, not finalized)
 *   - Tasks tab: open tasks + overdue tasks
 *
 * Env flags:
 *   DRY_RUN=1        Print the HTML, don't send.
 *   SKIP_SHABBOS=0   Disable the Shabbos guard.
 *
 * Usage:
 *   node scripts/daily-campaign-digest.mjs
 *   DRY_RUN=1 node scripts/daily-campaign-digest.mjs
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
const GOAL_CENTS = 25_000_000; // $250k — matches seed-jre-june-campaign.mjs

const FINAL_STATUSES = new Set(["Gift Received", "Declined", "Parked"]);

function parseDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (!str) return null;
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / MS);
}

function parseDollars(v) {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmt$(n) {
  if (!n) return "$0";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildHtml({ pipeline, tasks, sheetUrl }) {
  const goal = GOAL_CENTS / 100;
  const pctToGoal = Math.min(100, Math.round((pipeline.totals.pledged / goal) * 100));

  const stat = (label, value, sub) => `
    <div style="background:#fafafa;border:1px solid #f3f4f6;border-radius:10px;padding:14px;">
      <div style="font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">${label}</div>
      <div style="font-size:22px;font-weight:800;color:#111827;">${value}</div>
      ${sub ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px;">${sub}</div>` : ""}
    </div>`;

  const ownerSummary = Object.entries(pipeline.byOwner)
    .sort(([, a], [, b]) => b.overdue - a.overdue)
    .map(([owner, v]) => `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px 12px;font-size:13px;"><strong>${esc(owner)}</strong></td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;">${v.active}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;color:${v.overdue > 0 ? "#b91c1c" : "#9ca3af"};"><strong>${v.overdue}</strong></td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;">${v.dueToday}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;color:#9ca3af;">${v.stale}</td>
      </tr>`).join("");

  const overdueRows = pipeline.overdue.slice(0, 10).map((d) => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:8px 12px;font-size:13px;"><strong>${esc(d.name)}</strong><div style="font-size:11px;color:#9ca3af;">${esc(d.email)}</div></td>
      <td style="padding:8px 12px;font-size:13px;">${esc(d.nextStep || "(no next step)")}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;color:#b91c1c;font-weight:600;">${d.daysOverdue}d</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;">${esc(d.owner || "(unassigned)")}</td>
    </tr>`).join("");

  const staleRows = pipeline.stale.slice(0, 10).map((d) => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:8px 12px;font-size:13px;"><strong>${esc(d.name)}</strong></td>
      <td style="padding:8px 12px;font-size:13px;">${esc(d.status)}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:right;">${d.daysStale}d</td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;">${esc(d.owner || "(unassigned)")}</td>
    </tr>`).join("");

  const taskRows = tasks.open.slice(0, 10).map((t) => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:8px 12px;font-size:13px;"><strong>${esc(t.task)}</strong></td>
      <td style="padding:8px 12px;font-size:13px;color:${t.daysUntil < 0 ? "#b91c1c" : t.daysUntil <= 1 ? "#b45309" : "#6b7280"};">
        ${t.daysUntil < 0 ? `${Math.abs(t.daysUntil)}d overdue` : t.daysUntil === 0 ? "Today" : t.daysUntil === 1 ? "Tomorrow" : `${t.daysUntil}d`}
      </td>
      <td style="padding:8px 12px;font-size:12px;color:#6b7280;">${esc(t.status)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;color:#111827;">
<div style="max-width:720px;margin:0 auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
  <div style="background:linear-gradient(135deg,#3d5389,#2a3c68);padding:28px 32px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.8);text-transform:uppercase;margin-bottom:6px;">JRE June Campaign · Daily Digest</div>
    <h1 style="font-size:22px;font-weight:700;color:white;margin:0;">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })}</h1>
    <div style="margin-top:16px;background:rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <div style="font-size:12px;color:rgba(255,255,255,0.8);">Pledged toward goal</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.8);">${pctToGoal}%</div>
      </div>
      <div style="background:rgba(255,255,255,0.2);border-radius:4px;height:8px;overflow:hidden;">
        <div style="background:#fff;height:100%;width:${pctToGoal}%;"></div>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:6px;">${fmt$(pipeline.totals.pledged)} of ${fmt$(goal)}</div>
    </div>
  </div>

  <div style="padding:28px 32px;">

    <!-- Money -->
    <h2 style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin:0 0 12px;">💰 Money</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:26px;">
      ${stat("Asked", fmt$(pipeline.totals.asked), `${pipeline.counts.Reached || 0} asks`)}
      ${stat("Pledged", fmt$(pipeline.totals.pledged), `${pipeline.counts["Pledge Made"] || 0} pledges`)}
      ${stat("Received", fmt$(pipeline.totals.received), `${pipeline.counts["Gift Received"] || 0} gifts`)}
      ${stat("Gap", fmt$(goal - pipeline.totals.pledged), "to $250k")}
    </div>

    <!-- Pipeline -->
    <h2 style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin:0 0 12px;">📋 Pipeline — ${pipeline.total} donors</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:26px;">
      ${[
        ["Not Contacted", pipeline.counts["Not Contacted"] || 0, "#9ca3af"],
        ["Reached Out", pipeline.counts["Reached Out"] || 0, "#3b82f6"],
        ["In Conversation", pipeline.counts["Conversation Had"] || 0, "#8b5cf6"],
        ["Pledge Made", pipeline.counts["Pledge Made"] || 0, "#b45309"],
        ["Gift Received", pipeline.counts["Gift Received"] || 0, "#059669"],
        ["Declined", pipeline.counts["Declined"] || 0, "#9ca3af"],
        ["No Response", pipeline.counts["No Response"] || 0, "#6b7280"],
        ["Parked", pipeline.counts["Parked"] || 0, "#d1d5db"],
      ].map(([label, count, color]) => `
        <div style="padding:10px 12px;background:#fafafa;border-left:3px solid ${color};border-radius:4px;">
          <div style="font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;">${label}</div>
          <div style="font-size:18px;font-weight:700;color:#111827;">${count}</div>
        </div>`).join("")}
    </div>

    <!-- Owner table -->
    <h2 style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin:0 0 12px;">👥 By Owner</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:26px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Owner</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Active</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Overdue</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Due Today</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Stale 14d+</th>
      </tr></thead>
      <tbody>${ownerSummary || `<tr><td colspan="5" style="padding:12px;color:#9ca3af;font-size:13px;text-align:center;">No owners assigned yet — open the sheet and set the Owner column.</td></tr>`}</tbody>
    </table>

    ${pipeline.overdue.length > 0 ? `
    <!-- Overdue -->
    <h2 style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#b91c1c;text-transform:uppercase;margin:0 0 12px;">⚠️ Overdue Follow-Ups (${pipeline.overdue.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:26px;">
      <tbody>${overdueRows}</tbody>
    </table>
    ${pipeline.overdue.length > 10 ? `<p style="font-size:12px;color:#9ca3af;margin:-12px 0 26px;">…and ${pipeline.overdue.length - 10} more. Open the sheet for full list.</p>` : ""}
    ` : ""}

    ${pipeline.stale.length > 0 ? `
    <h2 style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin:0 0 12px;">🌡️ Stale Donors (no touch 14d+)</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:26px;">
      <tbody>${staleRows}</tbody>
    </table>
    ` : ""}

    ${tasks.open.length > 0 ? `
    <h2 style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin:0 0 12px;">✅ Open Tasks (${tasks.open.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:26px;">
      <tbody>${taskRows}</tbody>
    </table>
    ` : ""}

    <p style="margin:0 0 8px;">
      <a href="${sheetUrl}" style="display:inline-block;background:#3d5389;color:white;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Open the tracker →</a>
    </p>

    <p style="font-size:11px;color:#d1d5db;margin-top:22px;">Daily digest · Generated ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} · Reply to this email with questions.</p>
  </div>
</div>
</body></html>`;
}

async function main() {
  console.log(`[${new Date().toISOString()}] Daily campaign digest — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  if (SKIP_SHABBOS) {
    const shab = await isShabbosOrYomTov();
    if (shab.blocked) { console.log(`⏭️  Skipped — ${shab.reason}`); return; }
  }

  const sheetId = await getTrackerSheetId();
  if (!sheetId) throw new Error("No tracker sheet id");
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

  const { sheets, gmail } = await getAuthedClient();

  // Load Donor Pipeline
  const pipelineRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId, range: "Donor Pipeline!A2:U1000", valueRenderOption: "FORMATTED_VALUE",
  });
  const pRows = pipelineRes.data.values || [];
  const today = new Date();

  const totals = { asked: 0, pledged: 0, received: 0 };
  const counts = {};
  const byOwner = {};
  const overdue = [];
  const stale = [];

  for (const r of pRows) {
    const [name, y2023, y2024, y2025, y2026, grandTotal, action, email, phone, tier, level, status, asked, pledged, received, owner, nextStep, nextStepDate, lastTouch] = r;
    if (!name) continue;

    totals.asked    += parseDollars(asked);
    totals.pledged  += parseDollars(pledged);
    totals.received += parseDollars(received);

    const s = status || "Not Contacted";
    counts[s] = (counts[s] || 0) + 1;

    if (owner) {
      byOwner[owner] = byOwner[owner] || { active: 0, overdue: 0, dueToday: 0, stale: 0 };
      if (!FINAL_STATUSES.has(s)) byOwner[owner].active++;
    }

    if (!FINAL_STATUSES.has(s)) {
      const nsd = parseDate(nextStepDate);
      if (nsd) {
        const diff = daysBetween(today, nsd); // positive = future
        if (diff < 0) {
          overdue.push({ name, email, owner, nextStep, daysOverdue: -diff });
          if (owner && byOwner[owner]) byOwner[owner].overdue++;
        } else if (diff === 0) {
          if (owner && byOwner[owner]) byOwner[owner].dueToday++;
        }
      }
      const lt = parseDate(lastTouch);
      if (lt && daysBetween(lt, today) >= 14) {
        stale.push({ name, status: s, owner, daysStale: daysBetween(lt, today) });
        if (owner && byOwner[owner]) byOwner[owner].stale++;
      }
    }
  }
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  stale.sort((a, b) => b.daysStale - a.daysStale);

  const pipeline = { total: pRows.filter((r) => r[1]).length, totals, counts, byOwner, overdue, stale };

  // Load Tasks tab
  const tasksRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId, range: "Tasks!A2:G200", valueRenderOption: "FORMATTED_VALUE",
  });
  const tRows = tasksRes.data.values || [];
  const taskOpen = [];
  for (const r of tRows) {
    const [num, task, whatToDo, dueDate, priority, status, notes] = r;
    if (!task) continue;
    if (status === "Done") continue;
    const d = parseDate(dueDate);
    const daysUntil = d ? daysBetween(today, d) : null;
    taskOpen.push({ task, status: status || "Not Started", priority, daysUntil });
  }
  taskOpen.sort((a, b) => (a.daysUntil ?? 999) - (b.daysUntil ?? 999));

  // Build + send
  const html = buildHtml({ pipeline, tasks: { open: taskOpen }, sheetUrl });
  const overdueCount = overdue.length;
  const subject =
    overdueCount > 0
      ? `JRE Campaign — ${overdueCount} overdue · ${fmt$(totals.pledged)} pledged · ${pipeline.total} donors`
      : `JRE Campaign — ${fmt$(totals.pledged)} pledged of $250k · ${pipeline.total} donors`;

  console.log(`Subject: ${subject}`);
  console.log(`Pipeline total: ${pipeline.total}`);
  console.log(`$ asked/pledged/received: ${fmt$(totals.asked)} / ${fmt$(totals.pledged)} / ${fmt$(totals.received)}`);
  console.log(`Overdue: ${overdueCount}, Stale: ${stale.length}, Open tasks: ${taskOpen.length}`);
  console.log(`Counts by status: ${JSON.stringify(counts)}`);
  console.log(`Owners: ${Object.keys(byOwner).join(", ") || "(none)"}`);

  if (DRY_RUN) {
    // Write the HTML to a temp file so we can visually check
    const fs = await import("node:fs");
    fs.writeFileSync("scripts/_digest-preview.html", html);
    console.log(`\n(DRY RUN — preview written to scripts/_digest-preview.html)`);
    return;
  }

  await sendGmail(gmail, {
    to: [CHAIM_EMAIL, RABBI_ORATZ_EMAIL],
    fromName: "Gitty Levi (JRE)",
    fromEmail: "glevi@thejre.org",
    subject,
    bodyHtml: html,
  });
  console.log(`\n✅ Sent digest to ${CHAIM_EMAIL}, ${RABBI_ORATZ_EMAIL}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
