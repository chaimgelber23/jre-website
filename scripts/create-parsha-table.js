#!/usr/bin/env node

/**
 * Creates the parsha_content table in Supabase
 * Run once: node scripts/create-parsha-table.js
 */

const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `
CREATE TABLE IF NOT EXISTS public.parsha_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  parsha TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'practice',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parsha_content_parsha ON public.parsha_content (parsha);
CREATE INDEX IF NOT EXISTS idx_parsha_content_slug ON public.parsha_content (slug);
CREATE INDEX IF NOT EXISTS idx_parsha_content_status ON public.parsha_content (status);
`;

async function main() {
  console.log("Creating parsha_content table...");

  // Try the Supabase SQL endpoint
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    console.log("Table created successfully!");
    return;
  }

  // If RPC approach doesn't work, try direct insert to test if table exists
  console.log("RPC endpoint not available, checking if table already exists...");

  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/parsha_content?select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  if (checkRes.ok) {
    console.log("Table already exists! Ready to import.");
    return;
  }

  console.log("\n========================================");
  console.log("MANUAL STEP REQUIRED");
  console.log("========================================");
  console.log("\nPlease run this SQL in your Supabase Dashboard:");
  console.log("  1. Go to: https://supabase.com/dashboard");
  console.log("  2. Open your project");
  console.log("  3. Go to SQL Editor");
  console.log("  4. Paste and run the SQL from:");
  console.log("     supabase/migrations/create_parsha_content.sql");
  console.log("\nThen re-run: node scripts/import-parsha.js mishpatim");
}

main().catch(console.error);
