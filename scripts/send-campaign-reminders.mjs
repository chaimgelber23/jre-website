#!/usr/bin/env node
/**
 * Daily reminder sender for the Rabbi Oratz Campaign Task Tracker.
 *
 * Reads the Tasks tab, and for each row where Status ≠ Done:
 *   - Computes how many days until the due date.
 *   - Matches to a reminder stage: 7d, 3d, 1d, day-of, overdue-1, overdue-N.
 *   - If we haven't already sent at or past that stage, emails Rabbi Oratz.
 *   - Overdue 2+ days also CC's Chaim.
 *   - Appends a row to the Reminder Log tab.
 *   - Updates Last Reminder Stage / Last Reminder At / Thread ID on the task row.
 *
 * Threading: subsequent reminders for the same task reply into the same Gmail
 * thread so Rabbi Oratz sees the history.
 *
 * Env flags:
 *   DRY_RUN=1        Print what would be sent, don't send or write anything.
 *   SKIP_SHABBOS=0   Override the Shabbos/Yom Tov guard (default is on).
 *
 * Usage:
 *   node scripts/send-campaign-reminders.mjs
 *   DRY_RUN=1 node scripts/send-campaign-reminders.mjs
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

// Stage order: earliest first. Each task progresses through these as time passes.
// We only send stages we haven't sent yet.
const STAGES = [
  { key: "7d",          daysUntilDue: 7,  label: "Due in one week" },
  { key: "3d",          daysUntilDue: 3,  label: "Due in 3 days" },
  { key: "1d",          daysUntilDue: 1,  label: "Due tomorrow" },
  { key: "day-of",      daysUntilDue: 0,  label: "Due today" },
  { key: "overdue-1",   daysUntilDue: -1, label: "1 day overdue" },
  { key: "overdue-2",   daysUntilDue: -2, label: "2 days overdue" },
  { key: "overdue-3",   daysUntilDue: -3, label: "3 days overdue" },
  { key: "overdue-5",   daysUntilDue: -5, label: "5 days overdue" },
  { key: "overdue-7",   daysUntilDue: -7, label: "1 week overdue" },
  { key: "overdue-14",  daysUntilDue: -14, label: "2 weeks overdue" },
];

const STAGE_ORDER = STAGES.map((s) => s.key);
const ESCALATE_AT = "overdue-2"; // first stage that also CC's Chaim

function stageIndex(key) {
  return STAGE_ORDER.indexOf(key);
}

function daysBetween(fromDate, toDate) {
  const MS = 24 * 60 * 60 * 1000;
  const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();
  const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime();
  return Math.round((b - a) / MS);
}

function parseDueDate(cellValue) {
  if (!cellValue) return null;
  const s = String(cellValue).trim();
  if (!s) return null;
  // Expect YYYY-MM-DD or MM/DD/YYYY
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function pickStage(daysUntilDue) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (daysUntilDue <= STAGES[i].daysUntilDue) return STAGES[i];
  }
  return null;
}

function buildEmail({ task, whatToDo, dueDate, priority, stage, daysUntilDue, sheetUrl, notes }) {
  const overdue = daysUntilDue < 0;
  const urgencyTag =
    overdue ? `OVERDUE ${Math.abs(daysUntilDue)}d` :
    daysUntilDue === 0 ? "DUE TODAY" :
    daysUntilDue === 1 ? "DUE TOMORROW" :
    `Due in ${daysUntilDue}d`;

  const priorityBadge = priority === "High" ? "🔴 High priority · " : "";
  const subject = `${overdue ? "⚠️ " : ""}${priorityBadge}${task} — ${urgencyTag}`;

  const accent = overdue ? "#b91c1c" : daysUntilDue <= 1 ? "#b45309" : "#3d5389";

  const dueDateFmt = dueDate.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "America/New_York",
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;color:#111827;">
<div style="max-width:620px;margin:0 auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
  <div style="background:${accent};padding:22px 28px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.8);text-transform:uppercase;margin-bottom:6px;">JRE Campaign — Task Reminder</div>
    <h1 style="font-size:22px;font-weight:700;color:white;margin:0;">${escapeHtml(task)}</h1>
    <div style="font-size:13px;color:rgba(255,255,255,0.9);margin-top:6px;">${urgencyTag} · Due ${dueDateFmt}</div>
  </div>
  <div style="padding:26px 28px 8px;">
    <p style="font-size:15px;line-height:1.55;margin:0 0 16px;">Rabbi Oratz,</p>
    <p style="font-size:15px;line-height:1.55;margin:0 0 18px;">
      ${overdue
        ? `This task is <strong>${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} overdue</strong>. Quick heads up:`
        : daysUntilDue === 0 ? `This one is <strong>due today</strong>. Quick reminder:`
        : daysUntilDue === 1 ? `This one is <strong>due tomorrow</strong>. Quick reminder:`
        : `Heads up — this is coming up in <strong>${daysUntilDue} days</strong>.`
      }
    </p>
    <div style="background:#f9fafb;border-left:3px solid ${accent};padding:14px 18px;margin:0 0 20px;border-radius:4px;">
      <div style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">What to do</div>
      <div style="font-size:15px;line-height:1.55;color:#111827;">${escapeHtml(whatToDo || task)}</div>
    </div>
    ${notes ? `
    <div style="background:#fef9e7;border-left:3px solid #ca8a04;padding:12px 18px;margin:0 0 20px;border-radius:4px;">
      <div style="font-size:12px;font-weight:600;color:#854d0e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Notes</div>
      <div style="font-size:14px;line-height:1.5;color:#451a03;">${escapeHtml(notes)}</div>
    </div>` : ""}
    <p style="font-size:14px;line-height:1.55;margin:0 0 10px;color:#374151;">
      When it's done, mark the row <strong>Done</strong> in the tracker and the reminders stop:
    </p>
    <p style="margin:0 0 22px;">
      <a href="${sheetUrl}" style="display:inline-block;background:${accent};color:white;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Open the tracker →</a>
    </p>
    <p style="font-size:13px;line-height:1.5;color:#6b7280;margin:0 0 4px;">Or just reply to this email with any update or a blocker.</p>
  </div>
  <div style="padding:16px 28px 22px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af;">
    Automated reminder from the JRE coordinator system. Stage: ${stage.key}.
  </div>
</div>
</body></html>`;

  const text =
`Rabbi Oratz,

${overdue ? `This task is ${Math.abs(daysUntilDue)} day(s) overdue.` :
  daysUntilDue === 0 ? "This one is due today." :
  daysUntilDue === 1 ? "This one is due tomorrow." :
  `Heads up — due in ${daysUntilDue} days.`}

Task: ${task}
Due: ${dueDateFmt}
What to do: ${whatToDo || task}
${notes ? `Notes: ${notes}\n` : ""}
Mark it Done in the tracker when finished (that stops the reminders):
${sheetUrl}

Or reply to this email with any update.
`;

  return { subject, bodyHtml: html, bodyText: text };
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function readTasks(sheets, sheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Tasks!A2:N200",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values || [];
  return rows.map((r, i) => ({
    rowNumber: i + 2,
    num: r[0] || "",
    task: r[1] || "",
    whatToDo: r[2] || "",
    dueDateRaw: r[3] || "",
    priority: r[4] || "Medium",
    status: r[5] || "Not Started",
    notes: r[6] || "",
    lastReminderStage: r[7] || "",
    lastReminderAt: r[8] || "",
    threadId: r[9] || "",
    done: (r[10] || "").toString().toUpperCase() === "TRUE",
    type: r[11] || "",
    link: r[12] || "",
    draftCopy: r[13] || "",
  }));
}

async function appendLog(sheets, sheetId, row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Reminder Log!A:G",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

async function updateTaskRow(sheets, sheetId, rowNumber, stageKey, threadId) {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Tasks!H${rowNumber}:J${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[stageKey, now, threadId]] },
  });
}

async function main() {
  console.log(`[${new Date().toISOString()}] Campaign reminders — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  if (SKIP_SHABBOS) {
    const shab = await isShabbosOrYomTov();
    if (shab.blocked) {
      console.log(`⏭️  Skipped — ${shab.reason}`);
      return;
    }
  }

  const sheetId = await getTrackerSheetId();
  if (!sheetId) {
    console.error("No tracker sheet id in app_settings — run setup-campaign-tracker.mjs first.");
    process.exit(1);
  }
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

  const { sheets, gmail } = await getAuthedClient();
  const tasks = await readTasks(sheets, sheetId);
  const today = new Date();

  let sentCount = 0;
  let skippedCount = 0;

  for (const t of tasks) {
    if (!t.task || !t.dueDateRaw) { skippedCount++; continue; }
    if (t.status === "Done") { skippedCount++; continue; }
    if (t.done) { skippedCount++; continue; } // ✓ Done checkbox ticked

    const dueDate = parseDueDate(t.dueDateRaw);
    if (!dueDate) {
      console.log(`  row ${t.rowNumber}: could not parse due date "${t.dueDateRaw}" — skipping`);
      skippedCount++;
      continue;
    }

    const daysUntilDue = daysBetween(today, dueDate);
    const stage = pickStage(daysUntilDue);

    if (!stage) { skippedCount++; continue; } // task is more than 7 days out

    const alreadySent = t.lastReminderStage && stageIndex(t.lastReminderStage) >= stageIndex(stage.key);
    if (alreadySent) {
      console.log(`  row ${t.rowNumber} "${t.task}": already at stage ${t.lastReminderStage} (current = ${stage.key}) — skip`);
      skippedCount++;
      continue;
    }

    const shouldEscalate = stageIndex(stage.key) >= stageIndex(ESCALATE_AT);
    const cc = shouldEscalate ? [CHAIM_EMAIL] : undefined;
    const email = buildEmail({
      task: t.task, whatToDo: t.whatToDo, dueDate, priority: t.priority,
      stage, daysUntilDue, sheetUrl, notes: t.notes,
    });

    console.log(`  row ${t.rowNumber} "${t.task}": → stage ${stage.key} (daysUntilDue=${daysUntilDue})${shouldEscalate ? " [escalated, CC Chaim]" : ""}`);
    if (DRY_RUN) {
      console.log(`    subject: ${email.subject}`);
      sentCount++;
      continue;
    }

    try {
      const sendRes = await sendGmail(gmail, {
        to: [RABBI_ORATZ_EMAIL],
        cc,
        fromName: "Gitty Levi (JRE)",
        fromEmail: "glevi@thejre.org",
        subject: email.subject,
        bodyHtml: email.bodyHtml,
        bodyText: email.bodyText,
      }, t.threadId ? { threadId: t.threadId } : {});

      await updateTaskRow(sheets, sheetId, t.rowNumber, stage.key, sendRes.threadId || "");
      await appendLog(sheets, sheetId, [
        new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
        t.num || String(t.rowNumber - 1),
        t.task,
        stage.key,
        [RABBI_ORATZ_EMAIL, ...(cc || [])].join(", "),
        sendRes.messageId || "",
        "sent",
      ]);
      sentCount++;
    } catch (e) {
      console.error(`    ❌ send failed: ${e.message}`);
      await appendLog(sheets, sheetId, [
        new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
        t.num || String(t.rowNumber - 1),
        t.task,
        stage.key,
        RABBI_ORATZ_EMAIL,
        "",
        `error: ${e.message}`,
      ]);
    }
  }

  console.log(`\nDone — sent ${sentCount}, skipped ${skippedCount}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
