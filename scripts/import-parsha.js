#!/usr/bin/env node

/**
 * Import parsha content from markdown files into Supabase
 *
 * Usage:
 *   node scripts/import-parsha.js <parsha-name>
 *
 * Example:
 *   node scripts/import-parsha.js mishpatim
 *
 * Reads practice-*.md files from:
 *   ../C Gelber JRE/content/parsha/<parsha-name>/
 *
 * Tries REST API first. If schema cache is stale, automatically
 * generates a SQL file and tries RPC. Falls back to SQL file output.
 */

const fs = require("fs");
const path = require("path");

// Load .env.local for Supabase credentials
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        process.env[key] = value;
      }
    }
  }
}

// Use Speech Coaching Supabase project for parsha content
const SUPABASE_URL = process.env.NEXT_PUBLIC_SPEECH_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SPEECH_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const parshaName = process.argv[2];
if (!parshaName) {
  console.error("Usage: node scripts/import-parsha.js <parsha-name>");
  console.error("Example: node scripts/import-parsha.js mishpatim");
  process.exit(1);
}

// Content folder path
const contentDir = path.resolve(
  __dirname, "..", "..", "..", "C Gelber JRE", "content", "parsha", parshaName
);

if (!fs.existsSync(contentDir)) {
  console.error(`Content directory not found: ${contentDir}`);
  process.exit(1);
}

// Find all practice-*.md files
const files = fs
  .readdirSync(contentDir)
  .filter((f) => f.startsWith("practice-") && f.endsWith(".md"));

if (files.length === 0) {
  console.error(`No practice-*.md files found in ${contentDir}`);
  process.exit(1);
}

console.log(`Found ${files.length} practice file(s) in ${parshaName}:`);
files.forEach((f) => console.log(`  - ${f}`));

// --- Method 1: REST API (PostgREST) ---
async function upsertViaRest(item) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/parsha_content`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(item),
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.includes("PGRST205")) {
      throw new Error("SCHEMA_CACHE_STALE");
    }
    throw new Error(`Supabase REST error (${res.status}): ${text}`);
  }
  return true;
}

// --- Method 2: RPC function ---
async function upsertViaRpc(item) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/insert_parsha_content`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_slug: item.slug,
      p_parsha: item.parsha,
      p_title: item.title,
      p_summary: item.summary || "",
      p_content: item.content,
      p_status: item.status,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.includes("PGRST202")) {
      throw new Error("RPC_NOT_FOUND");
    }
    throw new Error(`Supabase RPC error (${res.status}): ${text}`);
  }
  return true;
}

// --- Method 3: Generate SQL file ---
function generateSqlFile(items) {
  const statements = items.map((item) => {
    const esc = (s) => (s || "").replace(/'/g, "''");
    return `INSERT INTO public.parsha_content (slug, parsha, title, summary, content, status)
VALUES (
  '${esc(item.slug)}',
  '${esc(item.parsha)}',
  '${esc(item.title)}',
  '${esc(item.summary)}',
  '${esc(item.content)}',
  '${esc(item.status)}'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  status = EXCLUDED.status,
  updated_at = NOW();`;
  });

  return statements.join("\n\n") + "\n\nNOTIFY pgrst, 'reload schema';\n";
}

function extractTitle(content, filename) {
  const match = content.match(/^#\s+(.+)/m);
  if (match) return match[1].trim();
  return filename
    .replace("practice-", "")
    .replace(".md", "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractSummary(content) {
  const coreMatch = content.match(
    /\*\*(?:Core Message|Core Idea)[^*]*\*\*\s*\n+(.+)/i
  );
  if (coreMatch) return coreMatch[1].trim();

  const quoteMatch = content.match(/^>\s*(.+)/m);
  if (quoteMatch) return quoteMatch[1].trim();

  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith(">") &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("|") &&
      !trimmed.startsWith("```") &&
      trimmed.length > 20
    ) {
      return trimmed.length > 200 ? trimmed.slice(0, 197) + "..." : trimmed;
    }
  }
  return null;
}

function formatParsha(p) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

async function main() {
  const parsha = parshaName.toLowerCase();
  const items = [];
  let successCount = 0;
  let method = "rest";

  // Build all items
  for (const file of files) {
    const filePath = path.join(contentDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const fileId = file.replace("practice-", "").replace(".md", "");
    const slug = `${parsha}-${fileId}`;
    const rawTitle = extractTitle(content, file);
    const cleanTitle = rawTitle.replace(/^Practice Sheet:\s*/i, "").trim();
    const title = `${formatParsha(parsha)} - ${cleanTitle}`;
    const summary = extractSummary(content);

    items.push({ slug, parsha, title, summary, content, status: "practice" });
  }

  // Try Method 1: REST API
  console.log("\nTrying REST API...");
  for (const item of items) {
    try {
      await upsertViaRest(item);
      console.log(`  Upserted: ${item.title}`);
      successCount++;
    } catch (err) {
      if (err.message === "SCHEMA_CACHE_STALE") {
        console.log("  Schema cache stale - trying RPC fallback...");
        method = "rpc";
        break;
      }
      console.error(`  FAILED: ${item.title} - ${err.message}`);
    }
  }

  // Try Method 2: RPC function
  if (method === "rpc") {
    successCount = 0;
    for (const item of items) {
      try {
        await upsertViaRpc(item);
        console.log(`  Upserted via RPC: ${item.title}`);
        successCount++;
      } catch (err) {
        if (err.message === "RPC_NOT_FOUND") {
          console.log("  RPC function not found - generating SQL file...");
          method = "sql";
          break;
        }
        console.error(`  FAILED: ${item.title} - ${err.message}`);
      }
    }
  }

  // Method 3: Generate SQL file
  if (method === "sql" || (method !== "rest" && successCount === 0)) {
    const sql = generateSqlFile(items);
    const sqlPath = path.join(__dirname, `insert-${parsha}.sql`);
    fs.writeFileSync(sqlPath, sql, "utf-8");
    console.log(`\n  SQL file generated: ${sqlPath}`);
    console.log(`  Paste this into Supabase SQL Editor and run it.`);
    console.log(`  After running, future imports should work via REST API.`);
    return;
  }

  console.log(
    `\nDone! ${successCount}/${items.length} items imported for ${formatParsha(parsha)}`
  );
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
