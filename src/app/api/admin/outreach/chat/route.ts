// @ts-nocheck
/**
 * POST /api/admin/outreach/chat
 *
 * Admin chat interface — Claude with full CRM context.
 * Pre-fetches all relevant data BEFORE calling Claude so the
 * single API call is fast. Stays well within Vercel free plan limits.
 *
 * Body: { message: string, context?: "full" | "mine", memberEmail?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const STAGE_LABELS: Record<string, string> = {
  new_contact: "New Contact", in_touch: "In Touch",
  event_connected: "Event Connected", deepening: "Deepening",
  learning: "Learning", inner_circle: "Inner Circle", multiplying: "Multiplying",
};

const INTERACTION_LABELS: Record<string, string> = {
  met:"Met", call:"Call", text:"Text", coffee:"Coffee", shabbos:"Shabbos",
  event:"Event", learning:"Learning", email:"Email", donation:"Donation", other:"Other",
};

export async function POST(request: NextRequest) {
  const body        = await request.json();
  const userMessage = (body.message || "").trim();
  const memberEmail = (body.memberEmail || "").toLowerCase().trim();

  if (!userMessage) {
    return NextResponse.json({ error: "No message" }, { status: 400 });
  }

  const supabase  = createServerClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ---- Pre-fetch CRM data (runs in parallel, fast) ----
  const thirtyAgo  = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const fourteenAgo = new Date(); fourteenAgo.setDate(fourteenAgo.getDate() - 14);

  const [
    { data: contacts },
    { data: recentInteractions },
    { data: teamMembers },
    { data: pendingInbox },
  ] = await Promise.all([
    supabase.from("outreach_contacts")
      .select("id, first_name, last_name, stage, gender, assigned_to, updated_at, email, phone, engagement_score, how_met, background")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase.from("outreach_interactions")
      .select("id, contact_id, team_member_id, type, date, notes, stage_before, stage_after")
      .gte("date", fourteenAgo.toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(50),
    supabase.from("outreach_team_members")
      .select("id, name, email, gender")
      .eq("is_active", true),
    supabase.from("outreach_interactions")
      .select("id, contact_id, type, date, notes")
      .eq("confirmation_status", "pending")
      .limit(10),
  ]);

  // Build compact context strings
  const totalContacts   = contacts?.length || 0;
  const maleContacts    = contacts?.filter((c: any) => c.gender === "male").length   || 0;
  const femaleContacts  = contacts?.filter((c: any) => c.gender === "female").length || 0;
  const overdueContacts = contacts?.filter((c: any) => new Date(c.updated_at) < thirtyAgo) || [];

  const stageCounts: Record<string, number> = {};
  for (const c of contacts || []) {
    stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
  }
  const pipelineStr = Object.entries(stageCounts)
    .map(([s, n]) => `${STAGE_LABELS[s] || s}: ${n}`)
    .join(", ");

  // Build contact list (compact)
  const contactList = (contacts || []).map((c: any) => {
    const assignedMember = teamMembers?.find((m: any) => m.id === c.assigned_to);
    const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
    return `${c.first_name} ${c.last_name} | ${STAGE_LABELS[c.stage]||c.stage} | ${days}d ago | ${c.gender} | ${assignedMember?.name || "unassigned"}${c.email ? ` | ${c.email}` : ""}`;
  }).join("\n");

  // Build interactions (compact)
  const interactionList = (recentInteractions || []).map((i: any) => {
    const contact = contacts?.find((c: any) => c.id === i.contact_id);
    const member  = teamMembers?.find((m: any) => m.id === i.team_member_id);
    const name    = contact ? `${contact.first_name} ${contact.last_name}` : "Unknown";
    return `${i.date}: ${INTERACTION_LABELS[i.type]||i.type} with ${name} by ${member?.name||"?"}${i.notes ? ` — "${i.notes.slice(0,80)}"` : ""}`;
  }).join("\n");

  // Team activity
  const teamStr = (teamMembers || []).map((m: any) => {
    const myContacts = contacts?.filter((c: any) => c.assigned_to === m.id).length || 0;
    const myInteractions = recentInteractions?.filter((i: any) => i.team_member_id === m.id).length || 0;
    return `${m.name} (${m.gender}): ${myContacts} contacts, ${myInteractions} interactions/14d`;
  }).join("\n");

  const overdueStr = overdueContacts.slice(0, 10).map((c: any) => {
    const assignedMember = teamMembers?.find((m: any) => m.id === c.assigned_to);
    const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
    return `${c.first_name} ${c.last_name} — ${days}d (${assignedMember?.name || "unassigned"})`;
  }).join("\n");

  const pendingStr = (pendingInbox || []).map((i: any) => {
    const contact = contacts?.find((c: any) => c.id === i.contact_id);
    const name = contact ? `${contact.first_name} ${contact.last_name}` : "Unknown";
    return `${i.type} with ${name} on ${i.date}${i.notes ? ` — "${i.notes.slice(0,60)}"` : ""}`;
  }).join("\n");

  const systemPrompt = `You are an outreach assistant for The JRE (Jewish Renaissance Experience) in Westchester, NY.
You help the admin manage the team's kiruv outreach — tracking relationships with Jewish people, logging interactions, and ensuring nobody is forgotten.
The team has 3 men (who work with men) and 3 women (who work with women).
Be warm, practical, and concise. Use bullet points for lists.

TODAY: ${new Date().toISOString().split("T")[0]}

=== PIPELINE OVERVIEW ===
Total contacts: ${totalContacts} (${maleContacts} men, ${femaleContacts} women)
By stage: ${pipelineStr}
Overdue (30+ days no contact): ${overdueContacts.length}
Pending inbox items: ${pendingInbox?.length || 0}

=== TEAM ===
${teamStr || "No team members"}

=== ALL CONTACTS (${totalContacts}) ===
${contactList || "No contacts yet"}

=== RECENT INTERACTIONS (last 14 days, ${recentInteractions?.length || 0} total) ===
${interactionList || "None"}

=== NOBODY LEFT BEHIND (30+ days no contact) ===
${overdueStr || "Everyone is up to date!"}

${pendingInbox?.length ? `=== PENDING INBOX ITEMS ===\n${pendingStr}` : ""}

You can answer questions about any of this data, suggest next steps, identify patterns, draft messages, and help plan outreach strategy.
If asked to log an interaction or update a contact, explain that they should use the contact detail page or email log@thejre.org.`;

  const response = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 1000,
    system:     systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const answer = (response.content[0] as any).text || "I couldn't generate a response.";

  return NextResponse.json({
    answer,
    stats: {
      totalContacts,
      overdueContacts: overdueContacts.length,
      pendingInbox: pendingInbox?.length || 0,
    },
  });
}
