# JRE Outreach MCP Server — Setup Guide

This lets you talk to Claude directly to manage all outreach contacts.
No web admin needed for day-to-day use.

---

## What You Can Ask Claude

```
"Who haven't I been in touch with in the last 2 weeks?"
"Log that I had coffee with David Cohen today. It went really well —
 he's very interested in the learning program."
"Show me my full pipeline"
"Add a new contact: Josh Weiss, met him at shul kiddush last Shabbos"
"Who are our most engaged contacts?"
"What's been working well this month?"
"Show me everyone in the deepening stage"
"Move David Cohen to the learning stage"
```

---

## Step 1 — Get Your Credentials

You need three values from the JRE website admin:

1. **SUPABASE_URL** — from Supabase project settings → API → Project URL
2. **SUPABASE_SERVICE_KEY** — from Supabase project settings → API → service_role key
   (NOT the anon key — the service_role key)
3. **Your email** — the email you use as a JRE team member (e.g. chaim@thejre.org)

---

## Step 2 — Install Claude Desktop

Download from: https://claude.ai/download

---

## Step 3 — Configure Claude Desktop

Open Claude Desktop → Settings → Developer → Edit Config

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jre-outreach": {
      "command": "npx",
      "args": [
        "ts-node",
        "--esm",
        "C:\\Users\\chaim\\JRE Website\\jre-website\\mcp\\outreach-server.ts"
      ],
      "env": {
        "SUPABASE_URL": "https://yhckumlsxrvfvtwrluge.supabase.co",
        "SUPABASE_SERVICE_KEY": "YOUR_SERVICE_ROLE_KEY_HERE",
        "TEAM_MEMBER_EMAIL": "YOUR_EMAIL@thejre.org"
      }
    }
  }
}
```

**Each team member uses their own email in TEAM_MEMBER_EMAIL.**
This tells Claude who you are so it shows you the right contacts.

---

## Step 4 — Restart Claude Desktop

After saving the config, restart Claude Desktop.
You should see "jre-outreach" listed in the tools panel.

---

## Step 5 — Add Yourself as a Team Member

Before using the CRM, run the SQL migration in Supabase
(supabase/migrations/crm_tables.sql), then add all 6 team members:

```sql
INSERT INTO outreach_team_members (name, email, gender, role) VALUES
  ('Chaim Gelber',   'cgelber@thejre.org',    'male',   'admin'),
  ('Team Member 2',  'name2@thejre.org',       'male',   'member'),
  ('Team Member 3',  'name3@thejre.org',       'male',   'member'),
  ('Team Member 4',  'name4@thejre.org',       'female', 'admin'),
  ('Team Member 5',  'name5@thejre.org',       'female', 'member'),
  ('Team Member 6',  'name6@thejre.org',       'female', 'member');
```

---

## Step 6 — Import Your Data (Do This First!)

Go to https://thejre.org/admin/outreach/import and run all 3 imports:
1. Website Registrations
2. Google Sheets Scan
3. Banquest CSV Upload

After importing, your CRM is pre-populated with years of history.
Then start using Claude to talk to it.

---

## Team Member Config Files

Each person gets their own version of the config above,
with their own email in TEAM_MEMBER_EMAIL.

**Men's team** will see men's contacts by default.
**Women's team** will see women's contacts by default.
Leadership can see all contacts by not filtering.

---

## Tips for Logging

Claude understands natural language, so just talk normally:

- "Had Shabbos with the Cohen family last Friday — David and Rivka,
   two kids, very warm, they asked about the learning program.
   Want to invite them to Purim."

Claude will:
1. Find or create David and Rivka Cohen
2. Log a Shabbos interaction with your notes
3. Ask if you want to set a follow-up reminder

Voice notes work too — use Claude's voice mode on your phone.

---

## Troubleshooting

**"TEAM_MEMBER_EMAIL not set"** — Check your claude_desktop_config.json

**"Contact not found"** — Try searching first: "search for David Cohen"

**"Supabase error"** — Make sure you're using the service_role key, not the anon key
