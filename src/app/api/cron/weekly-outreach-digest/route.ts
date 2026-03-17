// @ts-nocheck
/**
 * GET /api/cron/weekly-outreach-digest
 *
 * Runs every Monday at 7am (configure in vercel.json).
 * Sends each team member a personalized email:
 *   - Their wins from the past week
 *   - Who needs a follow-up
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { STAGE_LABELS, INTERACTION_LABELS } from "@/types/database";

const CRON_SECRET = process.env.CRON_SECRET;
const FROM_EMAIL  = "JRE Outreach <outreach@thejre.org>";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const resend   = new Resend(process.env.RESEND_API_KEY);

  const { data: teamMembers } = await supabase
    .from("outreach_team_members")
    .select("*")
    .eq("is_active", true);

  if (!teamMembers?.length) {
    return NextResponse.json({ message: "No team members found" });
  }

  const now    = new Date();
  const week   = new Date(now); week.setDate(week.getDate() - 7);
  const month  = new Date(now); month.setDate(month.getDate() - 30);
  const sent: string[] = [];

  for (const member of teamMembers) {
    // Interactions this person logged in the past week
    const { data: recentInteractions } = await supabase
      .from("outreach_interactions")
      .select(`*, contact:outreach_contacts(id, first_name, last_name, stage)`)
      .eq("team_member_id", member.id)
      .gte("date", week.toISOString().split("T")[0])
      .order("date", { ascending: false });

    // Contacts assigned to this person with no interaction in 30+ days
    const { data: assignedContacts } = await supabase
      .from("outreach_contacts")
      .select("id, first_name, last_name, stage, updated_at")
      .eq("assigned_to", member.id)
      .eq("is_active", true)
      .lt("updated_at", month.toISOString())
      .order("updated_at", { ascending: true })
      .limit(5);

    // Wins: stage advancements this week
    const stageWins = (recentInteractions || []).filter(
      (i) => i.stage_before && i.stage_after && i.stage_before !== i.stage_after
    );

    const firstName = member.name.split(" ")[0];
    const weekStr   = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });

    const emailHtml = buildWeeklyEmail({
      firstName,
      weekStr,
      interactions:    recentInteractions || [],
      stageWins,
      overdueContacts: assignedContacts || [],
    });

    await resend.emails.send({
      from:    FROM_EMAIL,
      to:      member.email,
      subject: `Your week in outreach — ${weekStr}`,
      html:    emailHtml,
    });

    sent.push(member.email);
  }

  return NextResponse.json({ sent });
}

function buildWeeklyEmail(params: {
  firstName: string;
  weekStr: string;
  interactions: any[];
  stageWins: any[];
  overdueContacts: any[];
}): string {
  const { firstName, weekStr, interactions, stageWins, overdueContacts } = params;

  const winsHtml = interactions.length === 0
    ? `<p style="color:#666;">No interactions logged this week — this week is a great time to connect with someone!</p>`
    : `<ul style="margin:8px 0;padding-left:20px;">
        ${interactions.slice(0, 8).map((i: any) => {
          const name = i.contact ? `${i.contact.first_name} ${i.contact.last_name}` : "Unknown";
          const type = INTERACTION_LABELS[i.type as keyof typeof INTERACTION_LABELS] || i.type;
          return `<li style="margin-bottom:6px;">${type} with <strong>${name}</strong>${i.notes ? ` — "${i.notes.slice(0, 60)}${i.notes.length > 60 ? "…" : ""}"` : ""}</li>`;
        }).join("")}
      </ul>`;

  const stageWinsHtml = stageWins.length === 0 ? "" : `
    <h3 style="color:#27ae60;margin-top:20px;">Stage Advancements</h3>
    <ul style="margin:8px 0;padding-left:20px;">
      ${stageWins.map((i: any) => {
        const name = i.contact ? `${i.contact.first_name} ${i.contact.last_name}` : "Unknown";
        return `<li><strong>${name}</strong>: ${STAGE_LABELS[i.stage_before] || i.stage_before} → ${STAGE_LABELS[i.stage_after] || i.stage_after}</li>`;
      }).join("")}
    </ul>`;

  const overdueHtml = overdueContacts.length === 0
    ? `<p style="color:#27ae60;">Everyone has been in touch recently.</p>`
    : `<ul style="margin:8px 0;padding-left:20px;">
        ${overdueContacts.map((c: any) => {
          const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
          return `<li style="margin-bottom:6px;"><strong>${c.first_name} ${c.last_name}</strong> — last contact ${days} days ago (${STAGE_LABELS[c.stage as keyof typeof STAGE_LABELS] || c.stage})</li>`;
        }).join("")}
      </ul>`;

  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="border-left:4px solid #EF8046;padding-left:16px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:22px;color:#1a1a1a;">Your week in outreach</h1>
    <p style="margin:4px 0 0;color:#666;">${weekStr}</p>
  </div>

  <p>Hey ${firstName},</p>

  <h2 style="color:#EF8046;font-size:16px;border-bottom:1px solid #f0e8e0;padding-bottom:8px;">This Week (${interactions.length} interactions)</h2>
  ${winsHtml}
  ${stageWinsHtml}

  <h2 style="color:#e74c3c;font-size:16px;border-bottom:1px solid #f0e8e0;padding-bottom:8px;margin-top:24px;">Who'd love to hear from you</h2>
  ${overdueHtml}

  <div style="margin-top:32px;padding:16px;background:#f9f9f9;border-radius:8px;text-align:center;">
    <a href="https://thejre.org/admin/outreach" style="color:#EF8046;font-weight:600;text-decoration:none;">Open Outreach Dashboard →</a>
  </div>

  <p style="margin-top:24px;color:#999;font-size:13px;">
    You're doing holy work. Keep going.<br/>
    — The JRE System
  </p>
</body>
</html>`;
}
