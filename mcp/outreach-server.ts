#!/usr/bin/env node
/**
 * JRE Outreach MCP Server
 *
 * Gives Claude full access to the outreach CRM.
 * Team members configure Claude Desktop to use this server.
 * Each person sets their TEAM_MEMBER_EMAIL env var so Claude
 * knows who it's talking to and shows the right contacts.
 *
 * TOOLS EXPOSED:
 *   search_contacts     — find a contact by name, stage, or filter
 *   get_contact         — full profile + interaction history for one person
 *   create_contact      — add someone new to the CRM
 *   update_contact      — update a contact's info or stage
 *   log_interaction     — record a coffee, Shabbos, call, event, etc.
 *   get_my_pipeline     — contacts assigned to me, grouped by stage
 *   get_overdue         — people with no contact in N days (default 21)
 *   get_analytics       — team-wide pipeline stats and what's working
 *   list_team_members   — see all 6 team members
 *   assign_contact      — assign/reassign a contact to a team member
 *   get_recent_activity — last N interactions across the whole team
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// Config from environment (set in Claude Desktop config)
// ============================================================
const SUPABASE_URL         = process.env.SUPABASE_URL         || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const TEAM_MEMBER_EMAIL    = (process.env.TEAM_MEMBER_EMAIL   || "").toLowerCase().trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  process.stderr.write("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const STAGE_LABELS: Record<string, string> = {
  new_contact:     "New Contact",
  in_touch:        "In Touch",
  event_connected: "Event Connected",
  deepening:       "Deepening",
  learning:        "Learning",
  inner_circle:    "Inner Circle",
  multiplying:     "Multiplying",
};

const INTERACTION_LABELS: Record<string, string> = {
  met: "Met", call: "Call", text: "Text", coffee: "Coffee",
  shabbos: "Shabbos", event: "Event", learning: "Learning",
  email: "Email", donation: "Donation", other: "Other",
};

// ============================================================
// Helper: get current team member by TEAM_MEMBER_EMAIL
// ============================================================
async function getMe() {
  if (!TEAM_MEMBER_EMAIL) return null;
  const { data } = await supabase
    .from("outreach_team_members")
    .select("*")
    .eq("email", TEAM_MEMBER_EMAIL)
    .single();
  return data;
}

// ============================================================
// Helper: format a contact into readable text for Claude
// ============================================================
function formatContact(c: any, withInteractions = false): string {
  const lines = [
    `**${c.first_name} ${c.last_name}**`,
    `Stage: ${STAGE_LABELS[c.stage] || c.stage}`,
  ];
  if (c.email)      lines.push(`Email: ${c.email}`);
  if (c.phone)      lines.push(`Phone: ${c.phone}`);
  if (c.gender && c.gender !== "unknown") lines.push(`Gender: ${c.gender}`);
  if (c.how_met)    lines.push(`How met: ${c.how_met}`);
  if (c.background) lines.push(`Background: ${c.background}`);
  if (c.spouse_name) lines.push(`Spouse: ${c.spouse_name}`);
  if (c.assigned_member?.name) lines.push(`Assigned to: ${c.assigned_member.name}`);
  if (c.engagement_score) lines.push(`Engagement score: ${c.engagement_score}/100`);
  if (c.next_followup_date) lines.push(`Next follow-up: ${c.next_followup_date}`);

  if (withInteractions && c.interactions?.length) {
    lines.push("\n**Interaction History:**");
    const sorted = [...c.interactions].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    for (const i of sorted.slice(0, 15)) {
      const type = INTERACTION_LABELS[i.type] || i.type;
      const date = new Date(i.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      let line = `  • ${type} — ${date}`;
      if (i.location) line += ` @ ${i.location}`;
      if (i.notes)    line += `: "${i.notes}"`;
      if (i.donation_amount) line += ` ($${i.donation_amount})`;
      lines.push(line);
    }
  } else if (withInteractions) {
    lines.push("\nNo interactions logged yet.");
  }

  return lines.join("\n");
}

// ============================================================
// MCP Server
// ============================================================
const server = new Server(
  { name: "jre-outreach", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ---- LIST TOOLS ----
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_contacts",
      description: "Search for contacts by name, email, stage, or other filters. Returns a list of matching people.",
      inputSchema: {
        type: "object",
        properties: {
          search:      { type: "string",  description: "Name or email to search" },
          stage:       { type: "string",  description: "Filter by stage: new_contact, in_touch, event_connected, deepening, learning, inner_circle, multiplying" },
          gender:      { type: "string",  description: "Filter by gender: male, female" },
          assigned_to_me: { type: "boolean", description: "If true, only show contacts assigned to the current user" },
          overdue_days: { type: "number", description: "Only show contacts with no interaction in this many days" },
          limit:       { type: "number",  description: "Max results to return (default 20)" },
        },
      },
    },
    {
      name: "get_contact",
      description: "Get the full profile and complete interaction history for one person.",
      inputSchema: {
        type: "object",
        properties: {
          id:   { type: "string", description: "Contact UUID" },
          name: { type: "string", description: "Person's name (if you don't have the ID)" },
        },
      },
    },
    {
      name: "create_contact",
      description: "Add a new person to the outreach CRM.",
      inputSchema: {
        type: "object",
        required: ["first_name"],
        properties: {
          first_name:  { type: "string" },
          last_name:   { type: "string" },
          email:       { type: "string" },
          phone:       { type: "string" },
          gender:      { type: "string", description: "male or female" },
          how_met:     { type: "string", description: "Where/how you met them (e.g. shul kiddush, work, neighbor)" },
          background:  { type: "string", description: "Any relevant background info" },
          spouse_name: { type: "string" },
          stage:       { type: "string", description: "Default: new_contact" },
        },
      },
    },
    {
      name: "update_contact",
      description: "Update a contact's info, stage, background, or next follow-up date.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id:                  { type: "string" },
          first_name:          { type: "string" },
          last_name:           { type: "string" },
          email:               { type: "string" },
          phone:               { type: "string" },
          stage:               { type: "string" },
          background:          { type: "string" },
          how_met:             { type: "string" },
          spouse_name:         { type: "string" },
          next_followup_date:  { type: "string", description: "YYYY-MM-DD" },
        },
      },
    },
    {
      name: "log_interaction",
      description: "Log an interaction with a contact — a coffee, Shabbos, call, event, etc. This is the main tool for recording outreach activity.",
      inputSchema: {
        type: "object",
        required: ["contact_name", "type"],
        properties: {
          contact_name:  { type: "string",  description: "Full name or first name of the person" },
          contact_id:    { type: "string",  description: "Contact UUID if known" },
          type:          { type: "string",  description: "met | call | text | coffee | shabbos | event | learning | email | other" },
          date:          { type: "string",  description: "YYYY-MM-DD or 'today' (default: today)" },
          notes:         { type: "string",  description: "What happened, key observations, feelings, anything relevant" },
          location:      { type: "string",  description: "Where it happened" },
          new_stage:     { type: "string",  description: "If this interaction moved them to a new stage, specify it" },
          next_followup: { type: "string",  description: "YYYY-MM-DD for the next follow-up reminder" },
        },
      },
    },
    {
      name: "get_my_pipeline",
      description: "Show all contacts assigned to me, grouped by stage. The best way to see your full picture.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "get_overdue",
      description: "Show contacts who haven't had any interaction in N days. Default is 21 days. Use this to find who needs a follow-up.",
      inputSchema: {
        type: "object",
        properties: {
          days:          { type: "number",  description: "Days threshold (default 21)" },
          assigned_to_me: { type: "boolean", description: "Only show my contacts" },
        },
      },
    },
    {
      name: "get_analytics",
      description: "Get team-wide pipeline stats, interaction counts, what's working, and the nobody-left-behind list.",
      inputSchema: {
        type: "object",
        properties: {
          period_days: { type: "number", description: "Days to look back for interaction stats (default 30)" },
        },
      },
    },
    {
      name: "list_team_members",
      description: "List all 6 JRE team members with their contact counts and recent activity.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "assign_contact",
      description: "Assign or reassign a contact to a team member.",
      inputSchema: {
        type: "object",
        required: ["contact_id", "team_member_email"],
        properties: {
          contact_id:         { type: "string" },
          team_member_email:  { type: "string" },
        },
      },
    },
    {
      name: "get_recent_activity",
      description: "Show the most recent interactions logged across the whole team.",
      inputSchema: {
        type: "object",
        properties: {
          limit:         { type: "number",  description: "Number of interactions to show (default 20)" },
          my_team_only:  { type: "boolean", description: "Only show interactions by team members of my gender group" },
        },
      },
    },
  ],
}));

// ---- CALL TOOLS ----
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args || {}) as Record<string, any>;

  try {
    switch (name) {

      // -------------------------------------------------------
      case "search_contacts": {
        const limit = a.limit || 20;
        let query = supabase
          .from("outreach_contacts")
          .select(`*, assigned_member:outreach_team_members!outreach_contacts_assigned_to_fkey(id, name)`)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(limit);

        if (a.search) {
          query = query.or(`first_name.ilike.%${a.search}%,last_name.ilike.%${a.search}%,email.ilike.%${a.search}%`);
        }
        if (a.stage)  query = query.eq("stage", a.stage);
        if (a.gender) query = query.eq("gender", a.gender);

        if (a.assigned_to_me && TEAM_MEMBER_EMAIL) {
          const me = await getMe();
          if (me) query = query.eq("assigned_to", me.id);
        }

        if (a.overdue_days) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - (a.overdue_days || 21));
          query = query.lt("updated_at", cutoff.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data?.length) return text("No contacts found matching your search.");

        const lines = data.map((c: any) => {
          const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
          const daysStr = days === 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`;
          return `• **${c.first_name} ${c.last_name}** — ${STAGE_LABELS[c.stage] || c.stage} — last contact: ${daysStr}${c.assigned_member ? ` (${c.assigned_member.name})` : ""} [ID: ${c.id}]`;
        });

        return text(`Found ${data.length} contact(s):\n\n${lines.join("\n")}`);
      }

      // -------------------------------------------------------
      case "get_contact": {
        let contactData: any = null;

        if (a.id) {
          const { data } = await supabase
            .from("outreach_contacts")
            .select(`*, assigned_member:outreach_team_members!outreach_contacts_assigned_to_fkey(id, name), interactions:outreach_interactions(*)`)
            .eq("id", a.id)
            .single();
          contactData = data;
        } else if (a.name) {
          const parts = a.name.trim().split(/\s+/);
          const first = parts[0];
          const last  = parts.length > 1 ? parts[parts.length - 1] : "";
          let q = supabase
            .from("outreach_contacts")
            .select(`*, assigned_member:outreach_team_members!outreach_contacts_assigned_to_fkey(id, name), interactions:outreach_interactions(*)`)
            .eq("is_active", true)
            .ilike("first_name", `%${first}%`)
            .limit(3);
          if (last) q = q.ilike("last_name", `%${last}%`);
          const { data } = await q;
          if (data?.length === 1) contactData = data[0];
          else if (data && data.length > 1) {
            const names = data.map((c: any) => `${c.first_name} ${c.last_name} [${c.id}]`).join("\n");
            return text(`Found multiple matches for "${a.name}". Use get_contact with the specific ID:\n${names}`);
          }
        }

        if (!contactData) return text("Contact not found.");
        return text(formatContact(contactData, true));
      }

      // -------------------------------------------------------
      case "create_contact": {
        const me = await getMe();
        const { data, error } = await supabase
          .from("outreach_contacts")
          .insert({
            first_name:      a.first_name,
            last_name:       a.last_name       || "",
            email:           a.email           || null,
            phone:           a.phone           || null,
            gender:          a.gender          || "unknown",
            stage:           a.stage           || "new_contact",
            how_met:         a.how_met         || null,
            background:      a.background      || null,
            spouse_name:     a.spouse_name     || null,
            assigned_to:     me?.id            || null,
            source:          "manual",
            engagement_score: 0,
          })
          .select()
          .single();

        if (error) throw error;
        return text(`Created contact: **${data.first_name} ${data.last_name}** [ID: ${data.id}]\nStage: ${STAGE_LABELS[data.stage] || data.stage}${me ? `\nAssigned to: ${me.name}` : ""}`);
      }

      // -------------------------------------------------------
      case "update_contact": {
        const fields: Record<string, any> = {};
        const allowed = ["first_name","last_name","email","phone","stage","background","how_met","spouse_name","next_followup_date"];
        for (const k of allowed) {
          if (k in a) fields[k] = a[k];
        }
        if (a.stage) fields.stage_updated_at = new Date().toISOString();

        const { data, error } = await supabase
          .from("outreach_contacts")
          .update(fields)
          .eq("id", a.id)
          .select()
          .single();

        if (error) throw error;
        return text(`Updated **${data.first_name} ${data.last_name}**.\nStage: ${STAGE_LABELS[data.stage] || data.stage}`);
      }

      // -------------------------------------------------------
      case "log_interaction": {
        const me = await getMe();

        // Resolve contact ID from name if not provided
        let contactId = a.contact_id;
        let contactName = a.contact_name;

        if (!contactId && contactName) {
          const parts = contactName.trim().split(/\s+/);
          const first = parts[0];
          const last  = parts.length > 1 ? parts[parts.length - 1] : "";
          let q = supabase
            .from("outreach_contacts")
            .select("id, first_name, last_name, stage")
            .eq("is_active", true)
            .ilike("first_name", `%${first}%`)
            .limit(5);
          if (last && last !== first) q = q.ilike("last_name", `%${last}%`);
          const { data: matches } = await q;

          if (!matches?.length) {
            // Auto-create if not found
            const nameParts = contactName.trim().split(/\s+/);
            const { data: newContact } = await supabase
              .from("outreach_contacts")
              .insert({
                first_name:      nameParts[0],
                last_name:       nameParts.slice(1).join(" ") || "",
                gender:          me?.gender || "unknown",
                stage:           "new_contact",
                assigned_to:     me?.id || null,
                source:          "manual",
                engagement_score: 0,
              })
              .select("id, first_name, last_name")
              .single();
            if (!newContact) return text(`Could not find or create contact "${contactName}".`);
            contactId   = newContact.id;
            contactName = `${newContact.first_name} ${newContact.last_name}`;
          } else if (matches.length === 1) {
            contactId   = matches[0].id;
            contactName = `${matches[0].first_name} ${matches[0].last_name}`;
          } else {
            const opts = matches.map((c: any) => `  • ${c.first_name} ${c.last_name} [ID: ${c.id}]`).join("\n");
            return text(`Multiple matches for "${contactName}". Please call log_interaction again with the contact_id:\n${opts}`);
          }
        }

        if (!contactId) return text("Could not find contact. Please provide contact_id or a clearer name.");

        // Fetch current stage for the before/after
        const { data: currentContact } = await supabase
          .from("outreach_contacts")
          .select("stage")
          .eq("id", contactId)
          .single();

        const stageBefore = currentContact?.stage || null;
        const stageAfter  = a.new_stage || stageBefore;

        const interactionDate = (!a.date || a.date === "today")
          ? new Date().toISOString().split("T")[0]
          : a.date;

        const { data: interaction, error } = await supabase
          .from("outreach_interactions")
          .insert({
            contact_id:          contactId,
            team_member_id:      me?.id || null,
            type:                a.type,
            date:                interactionDate,
            notes:               a.notes    || null,
            location:            a.location || null,
            stage_before:        stageBefore,
            stage_after:         stageAfter,
            parsed_by_ai:        false,
            confirmation_status: "confirmed",
          })
          .select()
          .single();

        if (error) throw error;

        // Update stage and follow-up date on contact
        const contactUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
        if (a.new_stage && a.new_stage !== stageBefore) {
          contactUpdate.stage           = a.new_stage;
          contactUpdate.stage_updated_at = new Date().toISOString();
        }
        if (a.next_followup) contactUpdate.next_followup_date = a.next_followup;
        await supabase.from("outreach_contacts").update(contactUpdate).eq("id", contactId);

        const type = INTERACTION_LABELS[a.type] || a.type;
        let response = `Logged: **${type}** with **${contactName}** on ${interactionDate}`;
        if (a.notes)      response += `\n"${a.notes}"`;
        if (a.new_stage && a.new_stage !== stageBefore) {
          response += `\nStage: ${STAGE_LABELS[stageBefore] || stageBefore} → ${STAGE_LABELS[a.new_stage] || a.new_stage}`;
        }
        if (a.next_followup) response += `\nReminder set for: ${a.next_followup}`;
        return text(response);
      }

      // -------------------------------------------------------
      case "get_my_pipeline": {
        const me = await getMe();
        if (!me) return text("TEAM_MEMBER_EMAIL is not configured. Set it in your Claude Desktop environment.");

        const { data: contacts } = await supabase
          .from("outreach_contacts")
          .select("*, interactions:outreach_interactions(id, date)")
          .eq("assigned_to", me.id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false });

        if (!contacts?.length) return text(`You don't have any contacts assigned yet.`);

        const byStage: Record<string, any[]> = {};
        for (const c of contacts) {
          const s = c.stage || "new_contact";
          if (!byStage[s]) byStage[s] = [];
          byStage[s].push(c);
        }

        const stageOrder = ["new_contact","in_touch","event_connected","deepening","learning","inner_circle","multiplying"];
        const lines: string[] = [`**Your Pipeline — ${me.name}** (${contacts.length} contacts total)\n`];

        for (const stage of stageOrder) {
          const group = byStage[stage];
          if (!group?.length) continue;
          lines.push(`**${STAGE_LABELS[stage]} (${group.length})**`);
          for (const c of group) {
            const days = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
            const overdue = days >= 21 ? " ⚠️" : "";
            const interactionCount = c.interactions?.length || 0;
            lines.push(`  • ${c.first_name} ${c.last_name} — ${days === 0 ? "today" : `${days}d ago`}${overdue} (${interactionCount} interactions) [ID: ${c.id}]`);
          }
          lines.push("");
        }

        return text(lines.join("\n"));
      }

      // -------------------------------------------------------
      case "get_overdue": {
        const days    = a.days || 21;
        const cutoff  = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        let query = supabase
          .from("outreach_contacts")
          .select(`*, assigned_member:outreach_team_members!outreach_contacts_assigned_to_fkey(id, name)`)
          .eq("is_active", true)
          .lt("updated_at", cutoff.toISOString())
          .order("updated_at", { ascending: true })
          .limit(30);

        if (a.assigned_to_me && TEAM_MEMBER_EMAIL) {
          const me = await getMe();
          if (me) query = query.eq("assigned_to", me.id);
        }

        const { data } = await query;
        if (!data?.length) return text(`Everyone is up to date! No contacts without interaction in the past ${days} days.`);

        const lines = data.map((c: any) => {
          const daysGone = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
          return `• **${c.first_name} ${c.last_name}** — ${daysGone} days since last contact | ${STAGE_LABELS[c.stage] || c.stage}${c.assigned_member ? ` | ${c.assigned_member.name}` : ""} [ID: ${c.id}]`;
        });

        return text(`**${data.length} contacts without interaction in ${days}+ days:**\n\n${lines.join("\n")}`);
      }

      // -------------------------------------------------------
      case "get_analytics": {
        const periodDays = a.period_days || 30;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - periodDays);
        const cutoffStr = cutoff.toISOString().split("T")[0];

        const [
          { data: contacts },
          { data: interactions },
          { data: teamMembers },
        ] = await Promise.all([
          supabase.from("outreach_contacts").select("id, stage, gender, assigned_to, updated_at, created_at").eq("is_active", true),
          supabase.from("outreach_interactions").select("id, type, date, team_member_id, stage_before, stage_after").gte("date", cutoffStr),
          supabase.from("outreach_team_members").select("id, name, gender").eq("is_active", true),
        ]);

        const total = contacts?.length || 0;
        const newCount = contacts?.filter((c: any) => new Date(c.created_at) >= cutoff).length || 0;
        const stageMoves = interactions?.filter((i: any) => i.stage_before !== i.stage_after && i.stage_after).length || 0;
        const maleCount   = contacts?.filter((c: any) => c.gender === "male").length || 0;
        const femaleCount = contacts?.filter((c: any) => c.gender === "female").length || 0;

        const overdueCount = contacts?.filter(
          (c: any) => new Date(c.updated_at) < cutoff
        ).length || 0;

        const stageCounts: Record<string, number> = {};
        for (const c of contacts || []) {
          stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
        }

        const typeAdvances: Record<string, number> = {};
        const typeTotals: Record<string, number> = {};
        for (const i of interactions || []) {
          typeTotals[i.type] = (typeTotals[i.type] || 0) + 1;
          if (i.stage_before !== i.stage_after && i.stage_after) {
            typeAdvances[i.type] = (typeAdvances[i.type] || 0) + 1;
          }
        }

        const teamLines = (teamMembers || []).map((m: any) => {
          const myInteractions = interactions?.filter((i: any) => i.team_member_id === m.id).length || 0;
          const myContacts = contacts?.filter((c: any) => c.assigned_to === m.id).length || 0;
          return `  • ${m.name}: ${myContacts} contacts, ${myInteractions} interactions this period`;
        });

        const stageLines = ["new_contact","in_touch","event_connected","deepening","learning","inner_circle","multiplying"]
          .filter((s) => (stageCounts[s] || 0) > 0)
          .map((s) => `  • ${STAGE_LABELS[s]}: ${stageCounts[s]}`);

        const topTypes = Object.entries(typeAdvances)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([type, advances]) => `  • ${type}: ${advances} stage advances (${typeTotals[type] || 0} total interactions)`);

        const lines = [
          `**JRE Outreach Analytics — Last ${periodDays} Days**\n`,
          `Total contacts: ${total} (${maleCount} men, ${femaleCount} women)`,
          `New contacts this period: ${newCount}`,
          `Total interactions: ${interactions?.length || 0}`,
          `Stage advances: ${stageMoves}`,
          `Overdue (30+ days no contact): ${overdueCount}`,
          `\n**Pipeline:**`,
          ...stageLines,
          `\n**What's Working (interactions that led to stage advances):**`,
          ...(topTypes.length ? topTypes : ["  Not enough data yet"]),
          `\n**Team Activity:**`,
          ...teamLines,
        ];

        return text(lines.join("\n"));
      }

      // -------------------------------------------------------
      case "list_team_members": {
        const { data: members } = await supabase
          .from("outreach_team_members")
          .select("*, contacts:outreach_contacts(id)")
          .eq("is_active", true);

        if (!members?.length) return text("No team members found.");

        const lines = members.map((m: any) => {
          const count = Array.isArray(m.contacts) ? m.contacts.length : 0;
          return `• **${m.name}** (${m.gender}) — ${m.email} — ${count} contacts`;
        });

        return text(`**JRE Team Members:**\n\n${lines.join("\n")}`);
      }

      // -------------------------------------------------------
      case "assign_contact": {
        const { data: member } = await supabase
          .from("outreach_team_members")
          .select("id, name")
          .eq("email", a.team_member_email.toLowerCase())
          .single();

        if (!member) return text(`Team member not found: ${a.team_member_email}`);

        await supabase
          .from("outreach_contacts")
          .update({ assigned_to: member.id })
          .eq("id", a.contact_id);

        return text(`Contact assigned to **${member.name}**.`);
      }

      // -------------------------------------------------------
      case "get_recent_activity": {
        const limit = a.limit || 20;
        const { data } = await supabase
          .from("outreach_interactions")
          .select(`
            *,
            contact:outreach_contacts(id, first_name, last_name),
            team_member:outreach_team_members(id, name, gender)
          `)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (!data?.length) return text("No recent activity.");

        const lines = data.map((i: any) => {
          const type = INTERACTION_LABELS[i.type] || i.type;
          const name = i.contact ? `${i.contact.first_name} ${i.contact.last_name}` : "Unknown";
          const by   = i.team_member?.name || "Unknown";
          const date = new Date(i.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return `• ${type} with **${name}** by ${by} — ${date}${i.notes ? `: "${i.notes.slice(0, 60)}${i.notes.length > 60 ? "…" : ""}"` : ""}`;
        });

        return text(`**Recent Activity:**\n\n${lines.join("\n")}`);
      }

      default:
        return text(`Unknown tool: ${name}`);
    }
  } catch (e: any) {
    return text(`Error: ${e?.message || String(e)}`);
  }
});

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

// ============================================================
// Start server
// ============================================================
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("JRE Outreach MCP Server running\n");
}

main().catch((e) => {
  process.stderr.write(`Fatal error: ${e}\n`);
  process.exit(1);
});
