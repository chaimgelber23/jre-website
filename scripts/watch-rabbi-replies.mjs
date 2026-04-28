#!/usr/bin/env node
/**
 * Watch Gmail for Rabbi Oratz's replies to reminder emails.
 *
 * For every Tasks-tab row that has a Thread ID (J):
 *   - Pull the latest message from Rabbi (yoratz@thejre.org) on that thread
 *   - If it's newer than the last time we processed this thread
 *     AND the body contains a done-indicator word → check the ✓ Done box,
 *     set Status = Done, and log the reply snippet in Notes.
 *   - Otherwise, append the reply snippet to Notes (so the sheet shows he
 *     acknowledged / asked / whatever, without auto-closing the task).
 *
 * Same logic also works for the Donor Pipeline: if Rabbi replies to a
 * follow-up reminder thread, we note it on the donor's row.
 *
 * Env flags:
 *   DRY_RUN=1    Print what would change, don't write.
 *
 * Usage:
 *   node scripts/watch-rabbi-replies.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import Anthropic from "@anthropic-ai/sdk";
import {
  getAuthedClient,
  getTrackerSheetId,
  RABBI_ORATZ_EMAIL,
} from "./campaign-tracker-lib.mjs";

const DRY_RUN = process.env.DRY_RUN === "1";
const USE_AI = !!process.env.ANTHROPIC_API_KEY;

const anthropic = USE_AI ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

// Legacy keyword path — used only if AI key missing
const DONE_PATTERNS = [
  /\bdone\b/i, /\bfinished\b/i, /\bcompleted?\b/i, /\bdid it\b/i,
  /\btook care of\b/i, /\bhandled\b/i, /\bsent\b/i, /\b(check|checked|✓|✔)/i,
];
function looksDone(text) { return DONE_PATTERNS.some((re) => re.test(text)); }

/**
 * Classify Rabbi's reply using Claude Haiku. Returns a structured action.
 * Categories:
 *   done       — task is completed (by him or someone else)
 *   in_progress — working on it, not yet done
 *   blocked    — can't proceed, needs something
 *   snooze     — push to a later date
 *   question   — Rabbi is asking for info / clarification
 *   declined   — not doing this
 *   ack        — bare acknowledgment, no action signal
 */
async function classifyReply({ taskName, whatToDo, replyBody }) {
  if (!USE_AI) {
    return { category: looksDone(replyBody) ? "done" : "ack", summary: "", snoozeDate: null, waitingFor: null, _source: "keywords" };
  }
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:
        `Today is ${new Date().toISOString().slice(0, 10)}. ` +
        "You classify short email replies from Rabbi Oratz about JRE campaign tasks. " +
        "Output ONLY a JSON object with keys: category, summary, snooze_date, waiting_for. " +
        "category MUST be one of: done, in_progress, blocked, snooze, question, declined, ack. " +
        "Mark 'done' even if someone else (Gitty, staff) did it. " +
        "Mark 'snooze' if Rabbi names a later date. " +
        "snooze_date is YYYY-MM-DD (in the future — use today's year or later) or null. " +
        "waiting_for is short string or null. summary is 1 sentence.",
      messages: [
        {
          role: "user",
          content:
            `TASK: ${taskName}\n` +
            `TASK CONTEXT: ${(whatToDo || "").slice(0, 400)}\n\n` +
            `RABBI'S REPLY:\n${replyBody.slice(0, 2000)}\n\n` +
            `Respond with a single JSON object, no other text.`,
        },
      ],
    });
    const text = msg.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no json in response");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      category: parsed.category || "ack",
      summary: parsed.summary || "",
      snoozeDate: parsed.snooze_date || null,
      waitingFor: parsed.waiting_for || null,
      _source: "claude-haiku",
    };
  } catch (e) {
    console.error(`  AI classify failed (${e.message}) — falling back to keywords`);
    return { category: looksDone(replyBody) ? "done" : "ack", summary: "", snoozeDate: null, waitingFor: null, _source: "keywords-fallback" };
  }
}

function decodePart(data) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractBody(msg) {
  let text = "";
  const walk = (p) => {
    if (!p) return;
    const data = p.body?.data;
    if (data) {
      const decoded = decodePart(data);
      if (p.mimeType === "text/plain") text += decoded + "\n";
      else if (p.mimeType === "text/html" && !text) {
        // Strip HTML as fallback
        text += decoded.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim() + "\n";
      }
    }
    (p.parts || []).forEach(walk);
  };
  walk(msg.payload);
  return text.trim();
}

function hdr(msg, name) {
  const h = msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return h?.value || "";
}

function snippet(text, n = 180) {
  return text.replace(/\s+/g, " ").slice(0, n).trim();
}

async function processTaskThreads(sheets, gmail, sheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Tasks!A2:N200",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values || [];

  let updates = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r[1]) continue; // no task
    const threadId = r[9];
    if (!threadId) continue;
    const alreadyDone = (r[10] || "").toUpperCase() === "TRUE" || r[5] === "Done";
    if (alreadyDone) continue;

    // Pull the thread
    let thread;
    try {
      thread = await gmail.users.threads.get({ userId: "me", id: threadId });
    } catch (e) {
      console.log(`  row ${i + 2} "${r[1]}": thread fetch failed — ${e.message}`);
      continue;
    }
    const messages = thread.data.messages || [];
    if (messages.length === 0) continue;

    // Find the latest message FROM Rabbi (not our outgoing reminders)
    const rabbiMessages = messages.filter((m) => {
      const from = hdr(m, "From").toLowerCase();
      return from.includes(RABBI_ORATZ_EMAIL.toLowerCase());
    });
    if (rabbiMessages.length === 0) continue;
    const latest = rabbiMessages[rabbiMessages.length - 1];
    const body = extractBody(latest);
    const date = hdr(latest, "Date");
    const snip = snippet(body);

    // Check if we already captured this one — avoid double-processing
    // (We store a marker in the Notes column: "[reply <Date>] ...")
    const existingNotes = r[6] || "";
    const markerKey = `reply ${date.slice(0, 16)}`;
    if (existingNotes.includes(markerKey)) continue;

    const cls = await classifyReply({ taskName: r[1], whatToDo: r[2], replyBody: body });
    console.log(`  row ${i + 2} "${r[1]}": ${cls.category.toUpperCase()} [${cls._source}] — ${cls.summary || snip}`);
    if (cls.snoozeDate) console.log(`    → snooze until ${cls.snoozeDate}`);
    if (cls.waitingFor) console.log(`    → waiting for: ${cls.waitingFor}`);

    if (DRY_RUN) continue;

    // Build notes entry — include classification for audit
    const noteLine = `[${markerKey} · ${cls.category}] ${cls.summary || snip}`;
    const newNotes = [existingNotes, noteLine].filter(Boolean).join("\n\n");
    const writes = [{ range: `Tasks!G${i + 2}`, values: [[newNotes]] }];

    switch (cls.category) {
      case "done":
        writes.push({ range: `Tasks!F${i + 2}`, values: [["Done"]] });
        writes.push({ range: `Tasks!K${i + 2}`, values: [[true]] });
        break;
      case "in_progress":
        writes.push({ range: `Tasks!F${i + 2}`, values: [["In Progress"]] });
        break;
      case "snooze":
        if (cls.snoozeDate) {
          writes.push({ range: `Tasks!D${i + 2}`, values: [[cls.snoozeDate]] });
          writes.push({ range: `Tasks!H${i + 2}`, values: [[""]] }); // reset stage so reminders fire fresh at new date
        }
        break;
      case "blocked":
        writes.push({ range: `Tasks!F${i + 2}`, values: [["In Progress"]] });
        // blocker captured in the notes; a human has to unstick
        break;
      case "declined":
        writes.push({ range: `Tasks!F${i + 2}`, values: [["Done"]] });
        writes.push({ range: `Tasks!K${i + 2}`, values: [[true]] });
        break;
      // question / ack — just log, no status change
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: writes },
    });
    updates++;
  }
  return updates;
}

async function processDonorThreads(sheets, gmail, sheetId) {
  // New schema (21 cols):
  //   r[0]=Name, r[5]=Grand Total, r[7]=Email, r[11]=Status, r[19]=Notes, r[20]=Thread ID
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Donor Pipeline!A2:U1000",
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = res.data.values || [];
  let updates = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    const threadId = r[20];
    if (!threadId) continue;
    const finalStatuses = new Set(["Gift Received", "Declined", "Parked"]);
    if (finalStatuses.has(r[11] || "")) continue;

    let thread;
    try {
      thread = await gmail.users.threads.get({ userId: "me", id: threadId });
    } catch { continue; }
    const msgs = (thread.data.messages || []).filter((m) =>
      hdr(m, "From").toLowerCase().includes(RABBI_ORATZ_EMAIL.toLowerCase())
    );
    if (!msgs.length) continue;
    const latest = msgs[msgs.length - 1];
    const body = extractBody(latest);
    const date = hdr(latest, "Date");
    const snip = snippet(body);
    const markerKey = `reply ${date.slice(0, 16)}`;
    const existingNotes = r[19] || "";
    if (existingNotes.includes(markerKey)) continue;

    console.log(`  donor row ${i + 2} "${r[0]}": Rabbi replied ${date}`);
    console.log(`    body: ${snip}`);

    if (DRY_RUN) continue;
    const newNotes = [existingNotes, `[${markerKey}] ${snip}`].filter(Boolean).join("\n\n");
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Donor Pipeline!T${i + 2}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[newNotes]] },
    });
    updates++;
  }
  return updates;
}

async function main() {
  console.log(`[${new Date().toISOString()}] Watching Rabbi's replies — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  const sheetId = await getTrackerSheetId();
  if (!sheetId) throw new Error("No tracker sheet id");
  const { sheets, gmail } = await getAuthedClient();

  console.log("\nTasks tab:");
  const taskUpdates = await processTaskThreads(sheets, gmail, sheetId);
  console.log(`  → ${taskUpdates} row(s) updated.`);

  console.log("\nDonor Pipeline tab:");
  const donorUpdates = await processDonorThreads(sheets, gmail, sheetId);
  console.log(`  → ${donorUpdates} row(s) updated.`);

  console.log(`\n✅ Done.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
