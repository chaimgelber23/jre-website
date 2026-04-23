/**
 * Build the JRE Women's Events Workflow Sheet in Gitty's Drive.
 *
 * Tabs:
 *   1. README           — what this sheet is, who uses it
 *   2. Tuesday Class    — full week-by-week workflow with status, links, templates
 *   3. Women Events     — Mussar / Siyum / special programs (non-Tuesday)
 *   4. Templates        — every email template in copy-paste form (her real style)
 *   5. Resources        — links to all source sheets/folders/docs
 *
 * Creates in glevi@thejre.org's Drive, shares editor with cgelber@thejre.org.
 *
 * Run: node scripts/build-workflow-sheet.mjs
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const KEYS = {
  accessToken: "gmail_jre_access_token",
  refreshToken: "gmail_jre_refresh_token",
  expiresAt: "gmail_jre_token_expires_at",
};

const SHARE_WITH = process.env.JRE_WORKFLOW_SHARE_WITH || "cgelber@thejre.org";

// ----- Auth -----
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: tokens } = await sb.from("app_settings").select("key,value").in("key", Object.values(KEYS));
const t = Object.fromEntries(tokens.map((r) => [r.key, r.value]));

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI
);
oauth2.setCredentials({
  access_token: t[KEYS.accessToken],
  refresh_token: t[KEYS.refreshToken],
  expiry_date: Number(t[KEYS.expiresAt]),
});
oauth2.on("tokens", async (refreshed) => {
  if (!refreshed.access_token) return;
  const now = new Date().toISOString();
  const rows = [{ key: KEYS.accessToken, value: refreshed.access_token, updated_at: now }];
  if (refreshed.expiry_date) rows.push({ key: KEYS.expiresAt, value: String(refreshed.expiry_date), updated_at: now });
  if (refreshed.refresh_token) rows.push({ key: KEYS.refreshToken, value: refreshed.refresh_token, updated_at: now });
  await sb.from("app_settings").upsert(rows);
});

const sheets = google.sheets({ version: "v4", auth: oauth2 });
const drive = google.drive({ version: "v3", auth: oauth2 });

// ============================================================================
// CONTENT
// ============================================================================

// All times are ET. Statuses:
//   AUTO ✅       runs without anyone touching it (cron + send happen automatically)
//   SEMI 📝      system drafts, Chaim approves with one tap before send
//   BETA 🧪      code is built but NOT yet scheduled / not yet firing in production
//   MANUAL ✋    Gitty / Chaim still does this by hand
const TUESDAY_CLASS_ROWS = [
  ["#", "Day / Time", "Task", "Status", "Channel", "Recipient", "Source data", "Template (see Templates tab)", "Notes"],
  ["1", "Thursday 9:07am ET", "Ask Elisheva who's speaking next Tuesday — ONLY if no speaker yet booked in the Tuesday Speakers sheet", "SEMI 📝 (LIVE)", "Gmail", "elishevaoratz@gmail.com", "Tuesday Morning/Ladies Class Speakers sheet (source of truth)", "T1 — Ask Elisheva", "WIRED 2026-04-23: cron-job.org #7519185 (Thu 13:07 UTC). Code at /api/cron/jre/ensure-next-class now reads Speakers sheet FIRST — if a name is filled in, imports the speaker into DB and skips the ask. Drafted email goes to admin dashboard + Telegram for one-tap approval (no auto-send). State today: 4/28 = Rebbetzin Fink (skipped), 5/5 empty (ask fires Thu 5/1), 5/12-5/26 already booked (skipped)."],
  ["2", "Sunday-Monday", "When Elisheva replies with name → look up speaker in past CC campaigns + Speakers sheet", "BETA 🧪", "—", "(internal)", "Tuesday Morning/Ladies Class Speakers sheet", "—", "Inbox-watch + Haiku reply parser built. Not yet scheduled."],
  ["3", "Thursday (after Elisheva replies)", "Send speaker initial confirmation w/ Zoom link + payment-info request", "MANUAL ✋", "Gmail (from glevi@thejre.org)", "{speaker email}", "jre_speakers (last_fee_usd, email, phone)", "T2 — Speaker confirmation (Thu)", "Per Gitty 2026-04-23: she sends this Thursday from her personal email, NOT Monday. Until June: she pre-scheduled all of these for known speakers. May 5 is the exception — Chaim must do this manually after Elisheva confirms speaker."],
  ["4", "Mon 8am", "Constant Contact email #1 (date + speaker + bio + Zoom link)", "PRE-SCHEDULED IN CC ✅", "Constant Contact", "JRE Ladies list", "CC platform (already loaded)", "T3 — CC #1 (clone of past)", "Per Gitty 2026-04-23: CC #1 is scheduled in the Constant Contact platform itself for every Tuesday through June EXCEPT May 5. For May 5, Chaim must build & send manually in CC."],
  ["5", "Tuesday 7am", "Day-of speaker reminder w/ Zoom link (personal email)", "MANUAL ✋", "Gmail (from glevi@thejre.org)", "{speaker email}", "jre_speakers + canonical zoom", "T4a — Speaker day-of reminder", "Per Gitty 2026-04-23: 7am (NOT 8am as I'd guessed). She pre-scheduled these through June except May 5. For May 5, Chaim must do manually."],
  ["6", "Tuesday 8am", "Constant Contact email #2 to ladies w/ Zoom link", "PRE-SCHEDULED IN CC ✅", "Constant Contact", "JRE Ladies list", "CC platform (already loaded)", "T4b — CC #2 (day-of, ladies)", "Per Gitty 2026-04-23: CC #2 is scheduled in Constant Contact through June EXCEPT May 5. For May 5, Chaim must build & send manually in CC."],
  ["7", "Tuesday 10am", "Class happens", "—", "Zoom", "—", "Canonical Zoom link in app_settings", "—", "Live event."],
  ["8", "Tuesday PM", "Send Zelle payment request to Rabbi Oratz", "BETA 🧪", "Gmail", "yoratz@thejre.org (cc Elisheva)", "jre_speakers fee + jre_payments", "T5 — Payment request to Yossi", "Code at /api/cron/jre/draft-payment-email. Subject includes amount + speaker for easy scan. NOT YET scheduled."],
  ["9", "Wed-Thu", "Watch inbox for Yossi's \"paid\" reply → mark paid", "BETA 🧪", "Gmail watch", "—", "jre_payments table", "—", "Code at /api/cron/jre/inbox-watch. Detects \"paid / zelled / sent\" near speaker name; Telegram one-tap to confirm. NOT YET scheduled."],
  ["10", "Friday 10am", "Payment reminder if not yet paid", "BETA 🧪", "Gmail", "yoratz@thejre.org", "jre_payments WHERE paid=FALSE", "T6 — Payment reminder Friday", "Code at /api/cron/jre/draft-payment-reminder. Skipped if already marked paid. NOT YET scheduled."],
  ["11", "M/W/F 9:07 AM", "Zelle digest (all open money_owed grouped by payee)", "BETA 🧪", "Gmail", "elishevaoratz@gmail.com (or per item)", "jre_money_owed WHERE status='open'", "T7 — Zelle digest", "Code at /api/cron/jre/zelle-digest. Auto-stops when zero open. Reply parser marks items paid. NOT YET scheduled."],
  ["12", "Saturday 8pm", "Weekly self-audit of every draft (was it edited? sent on time? meaningful?)", "BETA 🧪", "Telegram report", "Chaim", "jre_audit_log", "—", "Code at /api/cron/jre/weekly-audit. After 4 perfect weeks per draft type, system asks if you want to flip to full auto-send. NOT YET scheduled."],
];

const WOMEN_EVENTS_ROWS = [
  ["#", "Event", "Cadence", "Status", "Tasks", "Source data", "Template", "Notes"],
  ["1", "Mussar / Faith — What Does It Mean for Me? class", "Special / one-off", "MANUAL ✋", "Flyer prep with Rachel Leah → CC blast → speaker confirmation → payment", "Mussar event row in jre_weekly_classes (or new table)", "T8 — Designer follow-up (Rachel Leah)", "Currently 100% manual. Needs same treatment as Tuesday class. NEXT TO AUTOMATE."],
  ["2", "Siyum (every few months)", "Quarterly-ish", "MANUAL ✋", "Research gifts → edit invitation → labels with Rachel Leah → order/wrap/assemble packages", "—", "—", "Per Training Manual section 'Ladies Programming → siyum planning'."],
  ["3", "Bat Mitzvah class series", "As needed", "MANUAL ✋", "Meet parents → schedule sessions → teach → speech edit + practice", "—", "—", "Per Training Manual. Optional based on her job description."],
  ["4", "Surveys for ladies programming", "As needed by Elisheva", "MANUAL ✋", "Google Forms → linked sheet → share with Elisheva", "—", "T9 — Survey share with Elisheva", "Quick automation candidate: template Google Form + auto-share."],
  ["5", "Resubscribe emails to lapsed members", "As needed", "MANUAL ✋", "Find member → run CC resubscribe flow", "Constant Contact lapsed list", "—", "Per Training Manual."],
  ["6", "Birthday / touchpoint reminders to community", "Daily/weekly", "MANUAL ✋", "Pull birthday → email Judy Friedberg with contact info", "Banquest / member CRM", "T10 — Birthday alert to Judy", "Saw her send Aitana Perlmutter birthday on 2026-04-18."],
];

const TEMPLATES = [
  {
    id: "T1",
    name: "Thu — Ask Elisheva who's speaking next Tuesday",
    when: "Thursday AM (5 days before class). SKIP if Tuesday Speakers sheet already has a name in the row for that date.",
    to: "elishevaoratz@gmail.com",
    subject: "Who's speaking Tuesday {mm/dd}?",
    body: `Hi Elisheva,

Just checking in — who is speaking at next Tuesday's class ({mm/dd} at 10am)?

If you can send over the speaker's name, email, and fee, I'll take it from there and send out the confirmation and Ladies emails.

Thank you!

Gitty Levi`,
  },
  {
    id: "T2",
    name: "Mon — Speaker confirmation w/ Zoom link (initial)",
    when: "Monday AM",
    to: "{speaker email}",
    subject: "JRE Tuesday {mm/dd} — Zoom confirmation",
    body: `Hi {first name},

I hope you are doing well! We are excited for your upcoming class at the JRE this {Tuesday, Month DD} at 10am. Click the link below to join the Zoom.

Join Zoom Meeting
https://zoom.us/j/91985942050?pwd=NW5LWHRKeEZBaGZvOFNqVHB1ZGpxdz09
Meeting ID: 919 8594 2050
Passcode: 101643

Please provide your updated billing information in reply to this email to ensure prompt payment. Thank you!

All the best,

Gitty Levi
1495 Weaver Street
Scarsdale, NY 10583
(323) 329-9445`,
  },
  {
    id: "T4a",
    name: "Tue 8am — Speaker day-of reminder w/ Zoom link",
    when: "Tuesday 8am (day of class)",
    to: "{speaker email}",
    subject: "JRE Class TODAY — Zoom link",
    body: `Hi {first name},

Looking forward to your class at 10am today! Here's the Zoom link one more time so you have it handy:

Join Zoom Meeting
https://zoom.us/j/91985942050?pwd=NW5LWHRKeEZBaGZvOFNqVHB1ZGpxdz09
Meeting ID: 919 8594 2050
Passcode: 101643

Please join a few minutes early so we can let you in on time. Talk soon!

All the best,

Gitty Levi
1495 Weaver Street
Scarsdale, NY 10583
(323) 329-9445`,
  },
  {
    id: "T2b",
    name: "Speaker invitation (when first booking)",
    when: "When booking a new speaker",
    to: "{speaker email}",
    subject: "JRE Parsha Class teaching availability? – {Date 1} & {Date 2}",
    body: `Dear Mrs. {Last name},

I hope you're doing well. I wanted to ask if you might be available to teach our JRE Ladies Parsha class on Tuesday, {Month DDth}, at 10 am, and the following Tuesday, {Month DDth}, also at 10 am? The ladies truly enjoy learning from you, and we would be delighted to have you teach these sessions.

Please let me know if this can work for your schedule.

All the best,

Gitty Levi
1495 Weaver Street
Scarsdale, NY 10583
(323) 329-9445`,
  },
  {
    id: "T3",
    name: "CC #1 — Monday morning broadcast",
    when: "Sun night → schedule for Mon 8am",
    to: "JRE Ladies (Constant Contact list)",
    subject: "{Speaker name} — JRE Tuesday Class {Month DD}",
    body: `(Constant Contact campaign — clones speaker's most recent CC campaign, swaps date)

Subject pattern: "Lisa Aiken — JRE Tuesday Class June 8" or "Suri Weingot — JRE Tuesday Class May 19"

Body: speaker bio + photo + topic + Zoom link + dedication

Build pattern: duplicate the speaker's prior CC email, change date, change Zoom link if needed, schedule for 8am Monday.`,
  },
  {
    id: "T4b",
    name: "CC #2 — Tuesday 8am day-of (ladies)",
    when: "Tuesday 8am (day of class)",
    to: "JRE Ladies (Constant Contact list)",
    subject: "{Speaker name} Live on Zoom Today",
    body: `(Constant Contact campaign — duplicate of CC #1 with day-of subject + Zoom link prominent)

Sender: Gitty Levi
From email: glevi@thejre.org
Subject pattern: "{Speaker} Live on Zoom Today" (was previously "...In One Hour" at 9am, now 8am)

Body: same speaker bio + Zoom link, copy edited for "today" / "this morning".

NOTE: Old SOP / Training Manual says 9am 1-hour-before. Current practice is 8am day-of so ladies have time to plan their morning. Codify the 8am time in the cron schedule.`,
  },
  {
    id: "T5",
    name: "Tuesday PM — Payment request to Yossi",
    when: "Tuesday evening",
    to: "yoratz@thejre.org (cc elishevaoratz@gmail.com)",
    subject: "Please Zelle ${fee} to {Speaker name} — {mm/dd}",
    body: `Hi Rabbi Oratz,

Please Zelle $${"fee"} to {Speaker name} for {Tuesday, Month DD}'s Tuesday class.
Phone: {speaker phone}

Thanks!

Gitty Levi`,
  },
  {
    id: "T6",
    name: "Friday — Payment reminder to Yossi",
    when: "Friday 10am if unpaid",
    to: "yoratz@thejre.org",
    subject: "Reminder: Zelle ${fee} to {Speaker name} ({mm/dd})",
    body: `Hi Rabbi Oratz,

Gentle reminder — still need to Zelle $${"fee"} to {Speaker name} from Tuesday {mm/dd}'s class.

Thanks!

Gitty Levi`,
  },
  {
    id: "T7",
    name: "Zelle digest (multi-item)",
    when: "M/W/F 9:07 AM (only if open items exist)",
    to: "elishevaoratz@gmail.com (or per-item payee)",
    subject: "Zelle Payments - IMPORTANT (N items, $X total)",
    body: `Hi,

The following payments are pending:

1) Yocheved Bakst (Purim 2026)
*845-263-7241*
*$1,200*

2) Shaimos (Before Pesach)
*347-907-3550*
*$200*

3) Esther Wein (4/14/26)
*estwein@gmail.com*
*$250*

When sent, please reply with "paid <name>" or "paid all" so I can mark them off.

Thank you!

--
All the best,

Gitty Levi
1495 Weaver Street
Scarsdale, NY 10583
(323) 329-9445`,
  },
  {
    id: "T8",
    name: "Designer follow-up (Rachel Leah Black)",
    when: "48-72h after a design request with no reply",
    to: "rachel@chaiandbeyond.com",
    subject: "Re: {original subject}",
    body: `Hi Rachel Leah,

Just following up to see when you think you'll have a moment to take care of this?

Thanks,

Gitty`,
  },
  {
    id: "T9",
    name: "Survey share with Elisheva",
    when: "Per Elisheva request",
    to: "elishevaoratz@gmail.com",
    subject: "Survey — {topic}",
    body: `Hi Elisheva,

Here's the survey for {topic}:

Form: {Google Form URL}
Responses sheet: {linked sheet URL}

I've shared both with you for editing. Please take the form yourself first to confirm it looks right.

Thank you!

Gitty`,
  },
  {
    id: "T10",
    name: "Birthday alert to Judy Friedberg",
    when: "Day before birthday",
    to: "friedbergjudy1@gmail.com",
    subject: "{Member name} Birthday {tomorrow / today}",
    body: `{Phone}
{Email}

--
All the best,

Gitty Levi
1495 Weaver Street
Scarsdale, NY 10583
(323) 329-9445`,
  },
];

const RESOURCES = [
  ["Resource", "URL", "Use for", "Owner"],
  ["Tuesday Morning/Ladies Class Speakers (sheet)", "https://drive.google.com/drive/search?q=Tuesday%20Morning%2FLadies%20Class%20Speakers", "Master speaker roster, fees, paid status, dates", "glevi@thejre.org"],
  ["Next Level Pledges (sheet)", "https://drive.google.com/drive/search?q=Next%20Level%20Pledges", "Donor pledge tracking ($300K+ open)", "glevi@thejre.org"],
  ["NEXT LEVEL campaign projections (sheet)", "https://drive.google.com/drive/search?q=NEXT%20LEVEL%20campaign%20projections", "Donor meeting status (Met/Pledged/Reached Out/Not Started)", "yossioratz@thejre.org"],
  ["$500+ 2023-2026 (sheet)", "https://drive.google.com/drive/search?q=%24500%2B%202023-2026", "Year-over-year giving history", "glevi@thejre.org"],
  ["JRE Supplies and Food (sheet)", "https://drive.google.com/drive/search?q=JRE%20Supplies%20and%20Food", "Restocking checklist", "glevi@thejre.org"],
  ["Training Manual (doc)", "https://drive.google.com/drive/search?q=JRE%20Program%20Coordinator%20Training%20Manual", "Authoritative job spec — weekly/monthly/annual tasks", "glevi@thejre.org"],
  ["JRE Secretary Admin Dashboard", "https://thejre.org/admin/secretary", "Approve drafts, see week-at-a-glance, kill switch", "Chaim"],
  ["Constant Contact", "https://app.constantcontact.com/", "CC #1 + CC #2 broadcasts to JRE Ladies list", "JRE"],
  ["cron-job.org dashboard", "https://console.cron-job.org/", "Schedules for all JRE crons", "Chaim"],
  ["GitHub repo (jre-website)", "https://github.com/chaimgelber23/jre-website", "Source code for everything above", "Chaim"],
];

// ============================================================================
// BUILD
// ============================================================================

// Mode: update existing sheet if SHEET_ID env var set, otherwise create new
const EXISTING_SHEET_ID = process.env.SHEET_ID;

let sheetId, sheetUrl, created;
if (EXISTING_SHEET_ID) {
  console.log(`Updating existing sheet ${EXISTING_SHEET_ID}...`);
  sheetId = EXISTING_SHEET_ID;
  sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  // Clear all five tabs first so stale rows don't linger
  for (const tab of ["README", "Tuesday Class", "Women Events", "Templates", "Resources"]) {
    try {
      await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: tab });
    } catch (err) {
      console.warn(`   could not clear ${tab}: ${err.message}`);
    }
  }
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  created = { data: { spreadsheetId: sheetId, spreadsheetUrl: sheetUrl, properties: meta.data.properties } };
} else {
  console.log("Creating new spreadsheet...");
  created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "JRE Women's Events — Workflow & Templates" },
      sheets: [
        { properties: { title: "README", gridProperties: { rowCount: 30, columnCount: 4 } } },
        { properties: { title: "Tuesday Class", gridProperties: { rowCount: 25, columnCount: 9, frozenRowCount: 1 } } },
        { properties: { title: "Women Events", gridProperties: { rowCount: 20, columnCount: 8, frozenRowCount: 1 } } },
        { properties: { title: "Templates", gridProperties: { rowCount: 80, columnCount: 5, frozenRowCount: 1 } } },
        { properties: { title: "Resources", gridProperties: { rowCount: 25, columnCount: 4, frozenRowCount: 1 } } },
      ],
    },
  });
  sheetId = created.data.spreadsheetId;
  sheetUrl = created.data.spreadsheetUrl;
  console.log(`✅ Created sheet ${sheetId}`);
}
console.log(`   ${sheetUrl}\n`);

// ----- Populate -----
console.log("Writing README tab...");
await sheets.spreadsheets.values.update({
  spreadsheetId: sheetId,
  range: "README!A1",
  valueInputOption: "RAW",
  requestBody: {
    values: [
      ["JRE Women's Events — Workflow & Templates"],
      [`Generated ${new Date().toISOString().slice(0, 10)} from Gitty's automation system`],
      [""],
      ["What this is:"],
      ["A live map of every recurring task for the Tuesday Ladies Class + other women's events."],
      ["Each task shows: when it runs, who does it (auto vs manual vs needs-approval), where the data lives, and a copy-paste template in Gitty's voice."],
      [""],
      ["How to use it:"],
      ["• Tuesday Class tab — week-by-week task flow"],
      ["• Women Events tab — Mussar / Siyum / surveys (all currently manual)"],
      ["• Templates tab — every email body in copy-paste form (her real style)"],
      ["• Resources tab — links to source sheets, dashboard, cron schedules"],
      [""],
      ["Status legend:"],
      ["• AUTO ✅      — runs without anyone touching it (cron firing + sending in production)"],
      ["• SEMI 📝      — system drafts, Chaim approves with one tap (Telegram or admin dashboard)"],
      ["• BETA 🧪     — code is built but NOT yet scheduled. Nothing is firing yet."],
      ["• MANUAL ✋    — Gitty / Chaim still does it by hand. May or may not be planned for automation."],
      [""],
      ["⚠️  Current overall state: BETA. Nothing is sending live yet. Phase 1 code exists; cron-job.org schedules need to be wired up before anything actually fires."],
      [""],
      ["Source of truth:"],
      ["JRE secretary repo: https://github.com/chaimgelber23/jre-website"],
      ["Admin dashboard: https://thejre.org/admin/secretary"],
      ["This sheet auto-updates? NO — re-run scripts/build-workflow-sheet.mjs to refresh."],
    ],
  },
});

console.log("Writing Tuesday Class tab...");
await sheets.spreadsheets.values.update({
  spreadsheetId: sheetId,
  range: "Tuesday Class!A1",
  valueInputOption: "RAW",
  requestBody: { values: TUESDAY_CLASS_ROWS },
});

console.log("Writing Women Events tab...");
await sheets.spreadsheets.values.update({
  spreadsheetId: sheetId,
  range: "Women Events!A1",
  valueInputOption: "RAW",
  requestBody: { values: WOMEN_EVENTS_ROWS },
});

console.log("Writing Templates tab...");
const tplRows = [["ID", "Template name", "When", "To / Subject", "Body (copy-paste)"]];
for (const t of TEMPLATES) {
  tplRows.push([t.id, t.name, t.when, `To: ${t.to}\nSubject: ${t.subject}`, t.body]);
  tplRows.push(["", "", "", "", ""]); // spacer
}
await sheets.spreadsheets.values.update({
  spreadsheetId: sheetId,
  range: "Templates!A1",
  valueInputOption: "RAW",
  requestBody: { values: tplRows },
});

console.log("Writing Resources tab...");
await sheets.spreadsheets.values.update({
  spreadsheetId: sheetId,
  range: "Resources!A1",
  valueInputOption: "RAW",
  requestBody: { values: RESOURCES },
});

// ----- Format: bold headers, wrap text, freeze first row already done in create -----
console.log("Applying formatting...");
const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
const tabIdByName = Object.fromEntries(
  sheetMeta.data.sheets.map((s) => [s.properties.title, s.properties.sheetId])
);

const formatRequests = [];
for (const tab of ["Tuesday Class", "Women Events", "Templates", "Resources"]) {
  formatRequests.push({
    repeatCell: {
      range: { sheetId: tabIdByName[tab], startRowIndex: 0, endRowIndex: 1 },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.18, green: 0.27, blue: 0.50 },
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
          horizontalAlignment: "LEFT",
          verticalAlignment: "MIDDLE",
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
    },
  });
  // Wrap text in all data
  formatRequests.push({
    repeatCell: {
      range: { sheetId: tabIdByName[tab], startRowIndex: 1 },
      cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
      fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
    },
  });
}

await sheets.spreadsheets.batchUpdate({
  spreadsheetId: sheetId,
  requestBody: { requests: formatRequests },
});

// ----- Share with cgelber@thejre.org -----
// Note: current OAuth grant is drive.readonly, which can't create permissions.
// Attempt the share; swallow the error and give manual instructions.
let sharedOk = false;
try {
  await drive.permissions.create({
    fileId: sheetId,
    sendNotificationEmail: false,
    requestBody: { role: "writer", type: "user", emailAddress: SHARE_WITH },
  });
  sharedOk = true;
} catch (err) {
  if (err.code !== 403) throw err;
}

console.log("\n========== DONE ==========");
console.log(`\n📊 ${created.data.properties.title}`);
console.log(`🔗 ${sheetUrl}`);
console.log(`📧 Owner: glevi@thejre.org`);
if (sharedOk) {
  console.log(`👤 Shared with: ${SHARE_WITH} (editor)\n`);
} else {
  console.log(`⚠️  Auto-share failed (drive.readonly scope). Gitty should manually:`);
  console.log(`     Open the link → Share → add ${SHARE_WITH} (Editor)\n`);
}
