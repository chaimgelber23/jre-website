/**
 * GET /api/admin/secretary/audit
 *
 * Task-discovery audit — reads Gitty's real inbox, sent folder, and drive
 * to map her actual weekly workflow and surface automation opportunities.
 *
 * Returns a structured report with:
 *  - inbox summary (recent threads, frequent contacts, unread count)
 *  - sent summary (top recipients, email patterns by day-of-week)
 *  - drive files (recent + most-accessed sheets/docs)
 *  - automation gap analysis (tasks detected that aren't yet automated)
 */

import { NextResponse } from "next/server";
import { getGmailClient } from "@/lib/secretary/gmail-client";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

type EmailSummary = {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  labels?: string[];
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
};

function headerVal(headers: Array<{ name?: string | null; value?: string | null }>, name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function getRecentMessages(gmail: ReturnType<typeof google.gmail>, query: string, max = 20): Promise<EmailSummary[]> {
  const list = await gmail.users.messages.list({ userId: "me", q: query, maxResults: max });
  const ids = list.data.messages?.map((m) => m.id).filter((x): x is string => !!x) ?? [];

  const out: EmailSummary[] = [];
  for (const id of ids.slice(0, max)) {
    try {
      const msg = await gmail.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["Subject", "From", "To", "Date"] });
      const headers = msg.data.payload?.headers ?? [];
      out.push({
        id,
        subject: headerVal(headers, "Subject"),
        from: headerVal(headers, "From"),
        to: headerVal(headers, "To"),
        date: headerVal(headers, "Date"),
        snippet: msg.data.snippet ?? "",
        labels: msg.data.labelIds ?? [],
      });
    } catch {}
  }
  return out;
}

function countByContact(emails: EmailSummary[], field: "from" | "to"): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of emails) {
    const addr = e[field].replace(/.*</, "").replace(/>.*/, "").trim().toLowerCase();
    if (addr) counts[addr] = (counts[addr] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 15));
}

function countByDayOfWeek(emails: EmailSummary[]): Record<string, number> {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts: Record<string, number> = {};
  for (const e of emails) {
    try {
      const d = new Date(e.date);
      const day = days[d.getDay()];
      counts[day] = (counts[day] || 0) + 1;
    } catch {}
  }
  return counts;
}

export async function GET() {
  try {
    const client = await getGmailClient();
    if (!client) {
      return NextResponse.json({ error: "Gmail not connected. Complete OAuth first." }, { status: 401 });
    }
    const { gmail } = client;

    // --- Inbox: last 30 days ---
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
    const [inboxMsgs, sentMsgs, unreadMsgs] = await Promise.all([
      getRecentMessages(gmail, `in:inbox after:${thirtyDaysAgo}`, 30),
      getRecentMessages(gmail, `in:sent after:${thirtyDaysAgo}`, 30),
      getRecentMessages(gmail, `in:inbox is:unread`, 10),
    ]);

    // Profile counts
    const profile = await gmail.users.getProfile({ userId: "me" });

    // --- Drive: recent files ---
    const oauth2 = (gmail as unknown as { _options: { auth: Parameters<typeof google.drive>[0]["auth"] } })._options.auth;
    const drive = google.drive({ version: "v3", auth: oauth2 as Parameters<typeof google.drive>[0]["auth"] });

    let recentFiles: DriveFile[] = [];
    try {
      const filesRes = await drive.files.list({
        pageSize: 20,
        fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
        orderBy: "modifiedTime desc",
        q: "trashed=false",
      });
      recentFiles = (filesRes.data.files ?? []).map((f) => ({
        id: f.id ?? "",
        name: f.name ?? "",
        mimeType: f.mimeType ?? "",
        modifiedTime: f.modifiedTime ?? "",
        webViewLink: f.webViewLink ?? undefined,
      }));
    } catch (driveErr) {
      console.warn("[audit] Drive read failed:", driveErr);
    }

    // --- Sheets: find the JRE class roster sheet ---
    const sheets = recentFiles.filter((f) =>
      f.mimeType === "application/vnd.google-apps.spreadsheet"
    );

    // --- Docs ---
    const docs = recentFiles.filter((f) =>
      f.mimeType === "application/vnd.google-apps.document"
    );

    // --- Existing automation coverage (from DB) ---
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: automationFlags } = await supabase.from("jre_automation_flags").select("*");
    const { data: recentDrafts } = await supabase
      .from("jre_email_drafts")
      .select("draft_type, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    // --- Gap analysis ---
    const knownAutomated = [
      "email_speaker",
      "email_cc_1",
      "email_cc_2",
      "email_payment",
      "email_reminder",
      "email_elisheva_ask",
    ];
    const automationGaps: string[] = [];

    // Check for patterns in sent emails that look like recurring tasks
    const sentSubjects = sentMsgs.map((e) => e.subject.toLowerCase());
    if (sentSubjects.some((s) => s.includes("zoom") || s.includes("link"))) {
      automationGaps.push("Zoom link distribution detected in sent emails — not yet automated");
    }
    if (sentSubjects.some((s) => s.includes("donation") || s.includes("pledge") || s.includes("thank"))) {
      automationGaps.push("Thank-you / donation acknowledgment emails detected");
    }
    if (sentSubjects.some((s) => s.includes("newsletter") || s.includes("bulletin"))) {
      automationGaps.push("Newsletter / bulletin emails detected");
    }
    if (sentSubjects.some((s) => s.includes("reminder") && !s.includes("payment"))) {
      automationGaps.push("Non-payment reminders detected — may be automatable");
    }
    if (sheets.length > 0 && !knownAutomated.includes("sheet_sync")) {
      automationGaps.push(`${sheets.length} Google Sheet(s) found — verify all are synced to JRE DB`);
    }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      accountEmail: profile.data.emailAddress,
      mailbox: {
        messagesTotal: profile.data.messagesTotal,
        threadsTotal: profile.data.threadsTotal,
        unreadCount: unreadMsgs.length,
        unreadMessages: unreadMsgs,
      },
      inbox: {
        last30Days: inboxMsgs.length,
        topSenders: countByContact(inboxMsgs, "from"),
        byDayOfWeek: countByDayOfWeek(inboxMsgs),
        recentMessages: inboxMsgs.slice(0, 10),
      },
      sent: {
        last30Days: sentMsgs.length,
        topRecipients: countByContact(sentMsgs, "to"),
        byDayOfWeek: countByDayOfWeek(sentMsgs),
        recentMessages: sentMsgs.slice(0, 10),
      },
      drive: {
        recentFiles: recentFiles.slice(0, 10),
        sheets,
        docs,
      },
      automation: {
        currentlyCovered: knownAutomated,
        flags: automationFlags ?? [],
        recentDrafts: recentDrafts ?? [],
        gaps: automationGaps,
      },
    });
  } catch (err) {
    console.error("[secretary/audit]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
