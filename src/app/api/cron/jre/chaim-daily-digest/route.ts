/**
 * GET /api/cron/jre/chaim-daily-digest
 *
 * Runs daily 7am ET via cron-job.org. Tells Chaim via Telegram what JRE
 * tasks need attention today — and AUTO-CREATES the relevant drafts in
 * the admin dashboard so he can one-tap approve+send.
 *
 * Built for Gitty's transition (2026-04-23). Through June, the only weekly
 * recurring tasks are the payment cycle (Tue PM Zelle → Fri follow-up →
 * mark Y when paid). May 5 is the exception — no pre-scheduled emails.
 *
 * Each weekday → different action set:
 *
 *   Sun      — preview week ahead
 *   Mon      — verify CC #1 went out (today 8am)
 *   Tue 7am  — auto-draft "send link to speaker" personal email
 *   Tue 4pm  — auto-draft "Zelle ${fee} to {speaker}" to Rabbi Oratz
 *   Wed/Thu  — nudge: was speaker paid?
 *   Fri      — auto-draft payment reminder if still unpaid
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth, enforceShabbos } from "@/lib/secretary/cron-guard";
import {
  getNextUpcomingClass,
  getClassByDate,
  getSpeakerById,
  listUnpaidPayments,
  nextTuesdayISO,
} from "@/lib/db/secretary";
import {
  draftPaymentRequest,
  draftPaymentReminder,
} from "@/lib/secretary/email-drafter";
import { sendTelegram } from "@/lib/telegram/sender";

export const maxDuration = 60;

const DASHBOARD_URL = "https://thejre.org/admin/secretary";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1t9lwzRSG5lIbNi9JAxhe8fZlQ17V9AFdgP60E6IyMMk/edit";

function todayInfo() {
  // Use ET to compute day-of-week
  const now = new Date();
  const etStr = now.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" });
  // etStr format: "Wednesday, 04/23/2026"
  const [weekday, dateStr] = etStr.split(", ");
  return { weekday, dateStr };
}

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  const shabbos = enforceShabbos();
  if (shabbos) return shabbos;

  const { weekday, dateStr } = todayInfo();
  const upcoming = await getNextUpcomingClass();
  const tasks = [];
  const draftsCreated = [];
  let dashboardLinkNeeded = false;

  // Header — always include current upcoming class context
  let header = `📅 <b>JRE Daily Digest — ${weekday} ${dateStr}</b>\n`;
  if (upcoming) {
    const speaker = upcoming.speaker_id ? await getSpeakerById(upcoming.speaker_id) : null;
    header += `\nNext class: <b>Tue ${upcoming.class_date}</b>`;
    if (speaker) {
      header += ` — ${speaker.full_name} ($${upcoming.fee_usd ?? speaker.last_fee_usd ?? "?"})\n`;
    } else {
      header += ` — <i>no speaker yet booked</i>\n`;
    }
  }

  // ---- Day-of-week routing ----
  switch (weekday) {
    case "Sunday": {
      tasks.push("👀 Preview the week. Check the Tuesday Speakers sheet for the upcoming class.");
      tasks.push(`📊 Workflow sheet: <a href="${SHEET_URL}">open</a>`);
      break;
    }

    case "Monday": {
      tasks.push("📧 Constant Contact #1 should fire at 8am (Gitty pre-scheduled through June, except May 5).");
      tasks.push("🔍 Spot check: confirm the CC email went out as expected.");
      if (upcoming?.class_date === "2026-05-05") {
        tasks.push("⚠️  <b>MAY 5 EXCEPTION</b>: Gitty did NOT schedule CC #1 for May 5. You must build + send it manually in Constant Contact.");
      }
      break;
    }

    case "Tuesday": {
      // Tuesday is the big day. Two key actions: 7am link, 4pm Zelle request.
      if (upcoming?.class_date && new Date(upcoming.class_date).toDateString() === new Date().toDateString()) {
        const speaker = upcoming.speaker_id ? await getSpeakerById(upcoming.speaker_id) : null;
        tasks.push(`🎙️ <b>Class TODAY at 10am</b> — ${speaker?.full_name ?? "(no speaker?)"}`);
        tasks.push(`📧 <b>7am</b> — Send personal email to speaker with Zoom link.`);
        tasks.push(`📧 <b>8am</b> — CC #2 should fire automatically (Gitty pre-scheduled).`);
        if (upcoming.class_date === "2026-05-05") {
          tasks.push("⚠️  MAY 5 EXCEPTION: build + send CC #2 manually in Constant Contact.");
        }
        tasks.push(`💰 <b>After class</b> — Send Zelle request to Rabbi Oratz. <i>Auto-drafted below ↓</i>`);

        // Auto-create the payment request draft so it's ready in the dashboard
        if (upcoming.speaker_id && !upcoming.email_payment_draft_id) {
          try {
            const draft = await draftPaymentRequest(upcoming.id);
            if (draft) {
              draftsCreated.push(`✏️ Payment request draft ready (${speaker?.full_name})`);
            }
          } catch (err) {
            tasks.push(`(could not auto-draft payment request: ${String(err).slice(0, 80)})`);
          }
        }

        dashboardLinkNeeded = true;
      }
      break;
    }

    case "Wednesday":
    case "Thursday": {
      // Did Yossi pay yet?
      const unpaid = await listUnpaidPayments();
      if (unpaid.length > 0) {
        tasks.push(`⏳ Awaiting payment confirmation from Rabbi Oratz for ${unpaid.length} class(es). The inbox watcher will catch his "paid" reply automatically.`);
        for (const p of unpaid.slice(0, 3)) {
          const cls = await getClassByDate(p.class_id ? "" : "");
          // Just list amount; cls lookup adds detail
          tasks.push(`   • $${p.amount_usd}`);
        }
      } else {
        tasks.push(`✅ All recent classes marked paid. Nothing to chase.`);
      }
      // Thursday is also when ensure-next-class fires (9:07am). Surface result.
      if (weekday === "Thursday") {
        tasks.push(`🔄 9:07am cron #7519185 will check who's speaking next Tuesday (${nextTuesdayISO()}). If sheet has a name → auto-imports. If empty → drafts ask-Elisheva.`);
      }
      break;
    }

    case "Friday": {
      const unpaid = await listUnpaidPayments();
      if (unpaid.length > 0) {
        tasks.push(`💰 <b>${unpaid.length} unpaid class(es)</b> — auto-drafting reminders to Rabbi Oratz now.`);
        for (const p of unpaid) {
          try {
            const draft = await draftPaymentReminder(p.class_id, (p.reminder_count ?? 0) + 1);
            if (draft) {
              const cls = await getClassByDate("");
              draftsCreated.push(`✏️ Reminder draft ready ($${p.amount_usd})`);
            }
          } catch {}
        }
        dashboardLinkNeeded = true;
      } else {
        tasks.push(`✅ All paid. Quiet Friday.`);
      }
      break;
    }
  }

  // ---- Send Telegram ----
  let body = header + "\n";
  if (tasks.length === 0) {
    body += "\n<i>Nothing on deck for you today. Enjoy.</i>";
  } else {
    body += tasks.map((t) => "• " + t).join("\n");
  }
  if (draftsCreated.length > 0) {
    body += "\n\n<b>Drafts auto-created:</b>\n" + draftsCreated.join("\n");
  }
  if (dashboardLinkNeeded) {
    body += `\n\n📝 <a href="${DASHBOARD_URL}">Open dashboard to approve</a>`;
  }

  await sendTelegram("jre", body, { severity: "info" });

  return NextResponse.json({
    ok: true,
    weekday,
    dateStr,
    upcomingClass: upcoming?.class_date ?? null,
    tasks: tasks.length,
    draftsCreated: draftsCreated.length,
  });
}
