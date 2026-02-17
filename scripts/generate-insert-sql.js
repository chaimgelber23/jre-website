const fs = require("fs");
const path = require("path");

const content = fs.readFileSync(
  path.resolve(
    __dirname, "..", "..", "..", "C Gelber JRE",
    "content", "parsha", "mishpatim",
    "practice-higher-levels-of-mitzvah.md"
  ),
  "utf-8"
);

// Escape single quotes for SQL
const escaped = content.replace(/'/g, "''");

const rawTitle = (content.match(/^#\s+(.+)/m) || [])[1] || "The Higher Levels of a Mitzvah";
const title = "Mishpatim - " + rawTitle.replace(/^Practice Sheet:\s*/i, "").trim();
const titleEscaped = title.replace(/'/g, "''");

const summaryMatch = content.match(/^>\s*(.+)/m);
const summary = summaryMatch
  ? summaryMatch[1].trim().replace(/'/g, "''")
  : "1-Hour Class on the Higher Levels of a Mitzvah";

const sql = `INSERT INTO public.parsha_content (slug, parsha, title, summary, content, status)
VALUES (
  'mishpatim-higher-levels-of-mitzvah',
  'mishpatim',
  '${titleEscaped}',
  '${summary}',
  '${escaped}',
  'practice'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';`;

const outPath = path.join(__dirname, "insert-mishpatim.sql");
fs.writeFileSync(outPath, sql, "utf-8");
console.log("SQL file created:", outPath);
console.log("Length:", sql.length, "chars");
