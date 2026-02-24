/**
 * Pull Gallery Photos from Google Drive
 *
 * Downloads photos from shared Google Drive folders and optionally
 * seeds the Supabase gallery_photos table.
 *
 * Usage:
 *   node scripts/pull-gallery-photos.mjs
 *
 * Prerequisites:
 *   1. Google Drive API enabled in Google Cloud Console
 *   2. Each folder shared with: jresignuptosheets@jresignuptosheets.iam.gserviceaccount.com
 *   3. .env.local has GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY
 *   4. Supabase gallery_photos table created (see SQL below)
 *
 * What it does:
 *   - Lists all image files in each Drive folder
 *   - Downloads them to /public/images/gallery/
 *   - Inserts rows into Supabase gallery_photos table
 */

import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

// Load env
config({ path: path.join(PROJECT_ROOT, ".env.local") });

// ─── Google Drive folders to pull from ───────────────────────────────────────
// Add your folder IDs here. Get the ID from the URL:
// https://drive.google.com/drive/folders/FOLDER_ID_HERE
const FOLDERS = [
  {
    folderId: "1Lr7csmc_AUg2TYMv1BiDQHi3A2PE4oZq",
    category: "Pictures 2025",
  },
  {
    folderId: "1fNpy6TtFDfYbcjbzJFdkLDWpRTVrGqh1",
    category: "Staying Serene 2026",
  },
  {
    folderId: "1TeF6yzQ77S4raHi6-SpQjqttbki-nMEC",
    category: "Pictures 2026",
  },
  {
    folderId: "1-4qI_FncbsErgHqTNaLzWRyVORHnO5WM",
    category: "JRE Community",
  },
];

// ─── Auth ────────────────────────────────────────────────────────────────────

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

// ─── Supabase ────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GALLERY_DIR = path.join(PROJECT_ROOT, "public", "images", "gallery");
const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
];

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function listFilesInFolder(folderId) {
  const files = [];
  let pageToken = undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, createdTime, imageMediaMetadata)",
      pageSize: 100,
      pageToken,
    });

    if (res.data.files) {
      files.push(...res.data.files);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files.filter((f) => IMAGE_MIMES.some((m) => f.mimeType?.startsWith(m.split("/")[0])));
}

async function downloadFile(fileId, destPath) {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  await writeFile(destPath, Buffer.from(res.data));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🖼️  JRE Gallery Photo Puller\n");

  // Ensure gallery directory exists
  if (!existsSync(GALLERY_DIR)) {
    await mkdir(GALLERY_DIR, { recursive: true });
    console.log(`📁 Created ${GALLERY_DIR}\n`);
  }

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const dbRows = [];

  for (const folder of FOLDERS) {
    const categorySlug = slugify(folder.category);
    console.log(`\n📂 Folder: ${folder.category} (${folder.folderId})`);

    let files;
    try {
      files = await listFilesInFolder(folder.folderId);
    } catch (err) {
      console.error(`   ❌ Failed to list files: ${err.message}`);
      if (err.message?.includes("has not been used") || err.message?.includes("not enabled")) {
        console.error(
          "\n   ⚠️  Google Drive API is not enabled. Go to:\n" +
            "   https://console.cloud.google.com/apis/library/drive.googleapis.com\n" +
            "   and enable it for the 'jresignuptosheets' project.\n"
        );
      }
      if (err.message?.includes("not found") || err.code === 404) {
        console.error(
          `\n   ⚠️  Folder not found. Make sure you shared it with:\n` +
            `   ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}\n`
        );
      }
      totalErrors++;
      continue;
    }

    console.log(`   Found ${files.length} images`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.name || ".jpg") || ".jpg";
      const filename = `${categorySlug}-${String(i + 1).padStart(2, "0")}${ext.toLowerCase()}`;
      const destPath = path.join(GALLERY_DIR, filename);
      const imageUrl = `/images/gallery/${filename}`;

      if (existsSync(destPath)) {
        console.log(`   ⏭️  ${filename} (already exists)`);
        totalSkipped++;
      } else {
        try {
          process.stdout.write(`   ⬇️  ${filename}...`);
          await downloadFile(file.id, destPath);
          console.log(" ✅");
          totalDownloaded++;
        } catch (err) {
          console.log(` ❌ ${err.message}`);
          totalErrors++;
          continue;
        }
      }

      // Prepare DB row
      dbRows.push({
        title: file.name?.replace(/\.[^.]+$/, "") || `Photo ${i + 1}`,
        image_url: imageUrl,
        category: folder.category,
        date_taken: file.createdTime
          ? file.createdTime.split("T")[0]
          : null,
        sort_order: i,
        is_active: true,
      });
    }
  }

  console.log(
    `\n📊 Summary: ${totalDownloaded} downloaded, ${totalSkipped} skipped, ${totalErrors} errors`
  );

  // ─── Seed Supabase ──────────────────────────────────────────────────────────

  if (supabase && dbRows.length > 0) {
    console.log(`\n💾 Seeding ${dbRows.length} rows into gallery_photos...`);

    // Check which image_urls already exist
    const { data: existing } = await supabase
      .from("gallery_photos")
      .select("image_url");

    const existingUrls = new Set((existing || []).map((r) => r.image_url));
    const newRows = dbRows.filter((r) => !existingUrls.has(r.image_url));

    if (newRows.length === 0) {
      console.log("   All photos already in database. Nothing to insert.");
    } else {
      const { error } = await supabase.from("gallery_photos").insert(newRows);
      if (error) {
        console.error(`   ❌ Supabase insert error: ${error.message}`);
        if (error.message?.includes("relation") && error.message?.includes("does not exist")) {
          console.error(
            "\n   ⚠️  The gallery_photos table doesn't exist yet. Run this SQL in Supabase:\n\n" +
              "   CREATE TABLE gallery_photos (\n" +
              "     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n" +
              "     title VARCHAR(255) NOT NULL,\n" +
              "     caption TEXT,\n" +
              "     image_url VARCHAR(500) NOT NULL,\n" +
              "     category VARCHAR(100) NOT NULL DEFAULT 'Community',\n" +
              "     event_slug VARCHAR(255),\n" +
              "     date_taken DATE,\n" +
              "     sort_order INTEGER DEFAULT 0,\n" +
              "     is_active BOOLEAN DEFAULT true,\n" +
              "     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n" +
              "   );\n"
          );
        }
      } else {
        console.log(`   ✅ Inserted ${newRows.length} new photos`);
      }
    }
  } else if (!supabase) {
    console.log("\n⚠️  No Supabase credentials found. Photos downloaded but not seeded to DB.");
    console.log("   You can add them manually via the Supabase dashboard.");
  }

  console.log("\n✨ Done!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
