// @ts-nocheck
/**
 * GET /api/cron/monthly-outreach-report
 *
 * Runs on the 1st of every month (configure in vercel.json).
 * Sends a full team dashboard to all active team members.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { STAGE_LABELS } from "@/types/database";

const CRON_SECRET = process.env.CRON_SECRET;
const FROM_EMAIL  = "JRE Outreach <outreach@thejre.org>";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const resend   = new Resend(process.env.RESEND_API_KEY);

  const now        = new Date();
  const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 30);
  const cutoff30   = monthStart.toISOString().split("T")[0];

  const [
    { data: allContacts },
    { data: monthInteractions },
    { data: teamMembers },
  ] = await Promise.all([
    supabase.from("outreach_contacts").select("id, stage, gender, assigned_to, updated_at, created_at").eq("is_active", true),
    supabase.from("outreach_interactions").select("id, type, date, team_member_id, stage_before, stage_after, contact_id").gte("date", cutoff30),
    supabase.from("outreach_team_members").select("*").eq("is_active", true),
  ]);

  if (!teamMembers?.length) return NextResponse.json({ message: "No team members" });

  const contacts    = allContacts    || [];
  const interactions = monthInteractions || [];

  const newThisMonth = contacts.filter((c) => new Date(c.created_at) >= monthStart).length;
  const stageMoves   = interactions.filter((i) => i.stage_before && i.stage_after && i.stage_before !== i.stage_after).length;
  const overdueList  = contacts.filter((c) => new Date(c.updated_at) < monthStart);
  const maleCount    = contacts.filter((c) => c.gender === "male").length;
  const femaleCount  = contacts.filter((c) => c.gender === "female").length;

  // Stage counts
  const stageCounts: Record<string, number> = {};
  for (const c of contacts) {
    stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
  }

  // What's working (interaction type with most stage advances)
  const typeAdvances: Record<string, number> = {};
  for (const i of interactions) {
    if (i.stage_before !== i.stage_after && i.stage_after) {
      typeAdvances[i.type] = (typeAdvances[i.type] || 0) + 1;
    }
  }
  const topMethod = Object.entries(typeAdvances).sort((a, b) => b[1] - a[1])[0];

  // Team activity
  const teamActivity = (teamMembers || []).map((m: any) => ({
    name:         m.name,
    gender:       m.gender,
    interactions: interactions.filter((i) => i.team_member_id === m.id).length,
    contacts:     contacts.filter((c) => c.assigned_to === m.id).length,
  }));

  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const emailHtml = buildMonthlyEmail({
    monthName,
    totalContacts: contacts.length,
    newThisMonth,
    totalInteractions: interactions.length,
    stageMoves,
    maleCount,
    femaleCount,
    stageCounts,
    overdueList,
    teamActivity,
    topMethod: topMethod ? { type: topMethod[0], count: topMethod[1] } : null,
  });

  const emails = teamMembers.map((m: any) =>
    resend.emails.send({
      from:    FROM_EMAIL,
      to:      m.email,
      subject: `JRE Outreach — ${monthName} Report`,
      html:    emailHtml,
    })
  );

  await Promise.all(emails);

  return NextResponse.json({
    sent: teamMembers.map((m: any) => m.email),
    stats: { newThisMonth, totalInteractions: interactions.length, stageMoves, overdueContacts: overdueList.length },
  });
}

function buildMonthlyEmail(p: {
  monthName: string;
  totalContacts: number;
  newThisMonth: number;
  totalInteractions: number;
  stageMoves: number;
  maleCount: number;
  femaleCount: number;
  stageCounts: Record<string, number>;
  overdueList: any[];
  teamActivity: Array<{ name: string; gender: string; interactions: number; contacts: number }>;
  topMethod: { type: string; count: number } | null;
}): string {
  const { monthName, totalContacts, newThisMonth, totalInteractions, stageMoves,
          maleCount, femaleCount, stageCounts, overdueList, teamActivity, topMethod } = p;

  const STAGE_ORDER = ["new_contact","in_touch","event_connected","deepening","learning","inner_circle","multiplying"];

  const pipelineRows = STAGE_ORDER
    .filter((s) => (stageCounts[s] || 0) > 0)
    .map((s) => `<tr><td style="padding:4px 8px;color:#666;">${STAGE_LABELS[s as keyof typeof STAGE_LABELS]}</td><td style="padding:4px 8px;font-weight:600;text-align:right;">${stageCounts[s] || 0}</td></tr>`)
    .join("");

  const teamRows = teamActivity
    .sort((a, b) => b.interactions - a.interactions)
    .map((m) => `<tr><td style="padding:4px 8px;color:#666;">${m.name}</td><td style="padding:4px 8px;text-align:right;">${m.contacts}</td><td style="padding:4px 8px;text-align:right;">${m.interactions}</td></tr>`)
    .join("");

  const overdueHtml = overdueList.length === 0
    ? `<p style="color:#27ae60;">No one has been forgotten this month.</p>`
    : `<ul style="padding-left:20px;margin:8px 0;">
        ${overdueList.slice(0, 8).map((c) => {
          const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
          return `<li style="margin-bottom:4px;"><strong>${c.first_name || ""} ${c.last_name || ""}</strong> — ${days} days since last contact</li>`;
        }).join("")}
        ${overdueList.length > 8 ? `<li style="color:#999;">...and ${overdueList.length - 8} more</li>` : ""}
      </ul>`;

  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="background:#EF8046;color:white;padding:20px 24px;border-radius:12px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:24px;">JRE Outreach</h1>
    <p style="margin:4px 0 0;opacity:0.85;">${monthName} Monthly Report</p>
  </div>

  <h2 style="color:#EF8046;font-size:16px;">This Month at a Glance</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="padding:12px;background:#f9f9f9;border-radius:8px;text-align:center;margin:4px;">
        <div style="font-size:28px;font-weight:700;color:#EF8046;">${newThisMonth}</div>
        <div style="color:#666;font-size:13px;">New contacts</div>
      </td>
      <td style="padding:4px;" width="8"></td>
      <td style="padding:12px;background:#f9f9f9;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#EF8046;">${totalInteractions}</div>
        <div style="color:#666;font-size:13px;">Interactions</div>
      </td>
      <td style="padding:4px;" width="8"></td>
      <td style="padding:12px;background:#f9f9f9;border-radius:8px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#27ae60;">${stageMoves}</div>
        <div style="color:#666;font-size:13px;">Stage advances</div>
      </td>
    </tr>
  </table>

  <h2 style="color:#EF8046;font-size:16px;">The Team</h2>
  <p>Men: <strong>${maleCount}</strong> contacts · Women: <strong>${femaleCount}</strong> contacts · Total: <strong>${totalContacts}</strong></p>
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr style="border-bottom:1px solid #eee;">
      <th style="text-align:left;padding:6px 8px;color:#999;font-size:12px;font-weight:500;">Name</th>
      <th style="text-align:right;padding:6px 8px;color:#999;font-size:12px;font-weight:500;">Contacts</th>
      <th style="text-align:right;padding:6px 8px;color:#999;font-size:12px;font-weight:500;">Interactions</th>
    </tr></thead>
    <tbody>${teamRows}</tbody>
  </table>

  <h2 style="color:#EF8046;font-size:16px;margin-top:24px;">Pipeline</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tbody>${pipelineRows}</tbody>
  </table>

  ${topMethod ? `
  <h2 style="color:#27ae60;font-size:16px;margin-top:24px;">What's Working</h2>
  <p style="background:#eafaf1;padding:12px 16px;border-radius:8px;border-left:3px solid #27ae60;">
    <strong>${topMethod.type.charAt(0).toUpperCase() + topMethod.type.slice(1)}</strong> led to the most stage advances this month (${topMethod.count} times). Keep doing it.
  </p>` : ""}

  <h2 style="color:#e74c3c;font-size:16px;margin-top:24px;">Nobody Left Behind (${overdueList.length})</h2>
  ${overdueHtml}

  <div style="margin-top:32px;padding:16px;background:#f9f9f9;border-radius:8px;text-align:center;">
    <a href="https://thejre.org/admin/outreach" style="color:#EF8046;font-weight:600;text-decoration:none;">Open Outreach Dashboard →</a>
  </div>

  <p style="margin-top:24px;color:#999;font-size:13px;text-align:center;">
    You are doing holy work. Every interaction matters.<br/>
    Keep going. — The JRE
  </p>
</body>
</html>`;
}
