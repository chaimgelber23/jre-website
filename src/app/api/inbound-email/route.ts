// @ts-nocheck
/**
 * POST /api/inbound-email
 *
 * Called by Google Apps Script watching log@thejre.org.
 * ONE Claude call handles everything: classifies the email, then either
 * parses a log entry OR answers a question. Stays under Vercel's 10s limit.
 *
 * Uses claude-sonnet-4-6 for best quality.
 *
 * Apps Script sends: { from, subject, body, messageId }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const INBOUND_SECRET = process.env.INBOUND_EMAIL_SECRET || "";
const LOG_EMAIL      = "log@thejre.org";

const STAGE_LABELS: Record<string, string> = {
  new_contact:"New Contact", in_touch:"In Touch", event_connected:"Event Connected",
  deepening:"Deepening", learning:"Learning", inner_circle:"Inner Circle", multiplying:"Multiplying",
};

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-inbound-secret");
  if (INBOUND_SECRET && secret !== INBOUND_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { from, subject, body: emailBody } = body;
  if (!from || !emailBody) {
    return NextResponse.json({ error: "Missing from or body" }, { status: 400 });
  }

  const supabase  = createServerClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resend    = new Resend(process.env.RESEND_API_KEY);

  const senderEmail = extractEmail(from);

  // 1. Identify sender
  const { data: teamMember } = await supabase
    .from("outreach_team_members")
    .select("*")
    .eq("email", senderEmail)
    .single();

  if (!teamMember) {
    await sendReply(resend, senderEmail, `Re: ${subject}`,
      `Your email address (${senderEmail}) is not registered as a JRE team member. Please ask the admin to add you at thejre.org/admin/outreach.`);
    return NextResponse.json({ error: "Unknown sender" }, { status: 403 });
  }

  const firstName = teamMember.name.split(" ")[0];
  const cleanText = (subject ? `Subject: ${subject}\n\n${emailBody}` : emailBody).slice(0, 2000).trim();

  // 2. Pre-fetch this person's contacts (needed for both log matching AND question answering)
  const [{ data: myContacts }, { data: recentInteractions }] = await Promise.all([
    supabase.from("outreach_contacts")
      .select("id, first_name, last_name, stage, updated_at, email, phone, engagement_score, background, how_met")
      .eq("assigned_to", teamMember.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase.from("outreach_interactions")
      .select("contact_id, type, date, notes")
      .eq("team_member_id", teamMember.id)
      .gte("date", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0])
      .order("date", { ascending: false })
      .limit(30),
  ]);

  const contactList = (myContacts || []).map((c: any) => {
    const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
    return `${c.first_name} ${c.last_name} | ${STAGE_LABELS[c.stage]||c.stage} | last contact: ${days}d ago${c.email ? ` | ${c.email}` : ""}`;
  }).join("\n");

  const interactionList = (recentInteractions || []).map((i: any) => {
    const c = myContacts?.find((x: any) => x.id === i.contact_id);
    const name = c ? `${c.first_name} ${c.last_name}` : "Unknown";
    return `${i.date}: ${i.type} with ${name}${i.notes ? ` — "${i.notes.slice(0,80)}"` : ""}`;
  }).join("\n");

  // 3. ONE Claude call — classify + respond
  const claudeRes = await anthropic.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 600,
    system: `You are an assistant for ${firstName}, a Jewish outreach worker at The JRE in Westchester, NY.

You receive emails forwarded from log@thejre.org. Your job:

A) If the email is LOGGING an interaction (a coffee meeting, Shabbos, call, event, etc.):
   Return JSON:
   {
     "intent": "log",
     "contacts": [{"firstName": "", "lastName": ""}],
     "type": "met|call|text|coffee|shabbos|event|learning|other",
     "date": "YYYY-MM-DD or today",
     "location": null,
     "notes": "key observations, warm and meaningful, max 200 chars",
     "nextStep": null
   }

B) If the email is ASKING A QUESTION about contacts, the pipeline, follow-ups, or outreach strategy:
   Return JSON:
   {
     "intent": "question",
     "answer": "Your warm, helpful answer here. Be specific using the data below. Use bullet points if listing people. Max 400 words."
   }

${firstName}'s contacts (${myContacts?.length || 0} people):
${contactList || "No contacts yet"}

Recent interactions (last 30 days):
${interactionList || "None logged"}

Today: ${new Date().toISOString().split("T")[0]}

Return ONLY valid JSON. No explanation outside the JSON.`,
    messages: [{ role: "user", content: cleanText }],
  });

  let parsed: any = null;
  try {
    const raw   = (claudeRes.content[0] as any).text || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {}

  if (!parsed) {
    await sendReply(resend, senderEmail, `Re: ${subject}`,
      `Hi ${firstName},\n\nI received your email but had trouble understanding it. Try again with:\n• A log: "Had coffee with David Cohen today, it went really well"\n• A question: "Who haven't I been in touch with lately?"`);
    return NextResponse.json({ error: "Parse failed" });
  }

  // 4. Handle log
  if (parsed.intent === "log") {
    const summaryLines: string[] = [];

    for (const c of (parsed.contacts || []).slice(0, 3)) {
      const cfn = c.firstName || "";
      const cln = c.lastName  || "";
      if (!cfn) continue;

      let contactId:    string | null = null;
      let contactLabel: string        = `${cfn} ${cln}`.trim();

      // Try to match against known contacts first
      const knownMatch = myContacts?.find((x: any) =>
        x.first_name.toLowerCase() === cfn.toLowerCase() ||
        `${x.first_name} ${x.last_name}`.toLowerCase().includes(cfn.toLowerCase())
      );

      if (knownMatch) {
        contactId    = knownMatch.id;
        contactLabel = `${knownMatch.first_name} ${knownMatch.last_name}`;
      } else {
        // Search broader
        const { data: found } = await supabase
          .from("outreach_contacts")
          .select("id, first_name, last_name")
          .ilike("first_name", `%${cfn}%`)
          .eq("is_active", true)
          .limit(3);

        if (found?.length === 1) {
          contactId    = found[0].id;
          contactLabel = `${found[0].first_name} ${found[0].last_name}`;
        } else {
          // Create new contact
          const { data: created } = await supabase
            .from("outreach_contacts")
            .insert({ first_name: cfn, last_name: cln, gender: teamMember.gender, stage: "new_contact", assigned_to: teamMember.id, source: "email_in", engagement_score: 0 })
            .select("id").single();
          if (created) contactId = created.id;
        }
      }

      if (!contactId) continue;

      const interactionDate = (!parsed.date || parsed.date === "today")
        ? new Date().toISOString().split("T")[0] : parsed.date;

      await supabase.from("outreach_interactions").insert({
        contact_id:          contactId,
        team_member_id:      teamMember.id,
        type:                parsed.type || "other",
        date:                interactionDate,
        notes:               parsed.notes    || null,
        location:            parsed.location || null,
        parsed_by_ai:        true,
        raw_input:           cleanText.slice(0, 500),
        confirmation_status: "pending",
      });

      await supabase.from("outreach_contacts")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", contactId);

      const typeLabel: Record<string, string> = {
        met:"Met", call:"Call", text:"Text", coffee:"Coffee", shabbos:"Shabbos",
        event:"Event", learning:"Learning", other:"Interaction",
      };
      summaryLines.push(
        `${typeLabel[parsed.type] || "Interaction"} with ${contactLabel} (${interactionDate})` +
        (parsed.notes    ? `\n  "${parsed.notes}"`       : "") +
        (parsed.nextStep ? `\n  Next: ${parsed.nextStep}` : "")
      );
    }

    const replyText = summaryLines.length
      ? `Hi ${firstName},\n\nLogged:\n\n${summaryLines.join("\n\n")}\n\nReply CONFIRM to save it, or reply with any corrections.\nView: thejre.org/admin/outreach/inbox`
      : `Hi ${firstName},\n\nI couldn't identify who this was about. Please mention the person's name clearly.`;

    await sendReply(resend, senderEmail, `Re: ${subject || "Log entry"}`, replyText);
    return NextResponse.json({ success: true, intent: "log" });
  }

  // 5. Handle question
  if (parsed.intent === "question" && parsed.answer) {
    await sendReply(
      resend,
      senderEmail,
      `Re: ${subject || "Your question"}`,
      `Hi ${firstName},\n\n${parsed.answer}\n\n—\nReply to ask another question or log an interaction.\nDashboard: thejre.org/admin/outreach`
    );
    return NextResponse.json({ success: true, intent: "question" });
  }

  await sendReply(resend, senderEmail, `Re: ${subject}`,
    `Hi ${firstName},\n\nI received your message but couldn't process it. Please try again.`);
  return NextResponse.json({ success: true, intent: "unknown" });
}

function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

async function sendReply(resend: Resend, to: string, subject: string, text: string) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({ from: `JRE Log <${LOG_EMAIL}>`, to, subject, text }).catch(() => null);
}
