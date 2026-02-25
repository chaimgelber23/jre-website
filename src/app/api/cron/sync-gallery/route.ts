import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Gallery Auto-Sync
 *
 * Scans a Google Drive folder tree and syncs all images to Supabase.
 * Handles nested structures like:
 *   JRE Pictures/
 *     random-photo.jpg          → category: "Community"
 *     Pictures 2025/
 *       Purim/
 *         photo1.jpg            → category: "Purim 2025"
 *       Chanukah/
 *         photo2.jpg            → category: "Chanukah 2025"
 *     Pictures 2026/
 *       Serene Event/
 *         photo3.jpg            → category: "Serene Event 2026"
 *     Scotch Night/
 *       photo4.jpg              → category: "Scotch Night"
 *
 * Setup:
 *   1. Enable Google Drive API in Google Cloud Console
 *   2. Share the parent folder with: jresignuptosheets@jresignuptosheets.iam.gserviceaccount.com
 *   3. Set GALLERY_DRIVE_FOLDER_ID env var to the parent folder ID
 */

const CRON_SECRET = process.env.CRON_SECRET;
const PARENT_FOLDER_ID = process.env.GALLERY_DRIVE_FOLDER_ID;

const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Year-like folder names (e.g., "Pictures 2025", "2025", "Photos 2026")
const YEAR_PATTERN = /(?:^|\D)(20\d{2})(?:\D|$)/;

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}

function driveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

type DriveClient = ReturnType<typeof google.drive>;

async function listSubfolders(drive: DriveClient, parentId: string) {
  const folders: { id: string; name: string }[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 100,
      pageToken,
    });
    if (res.data.files) {
      for (const f of res.data.files) {
        if (f.id && f.name) folders.push({ id: f.id, name: f.name });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return folders;
}

async function listImages(drive: DriveClient, folderId: string) {
  const images: { id: string; name: string; createdTime: string | null }[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, createdTime)",
      pageSize: 200,
      pageToken,
    });
    if (res.data.files) {
      for (const f of res.data.files) {
        if (f.id && f.mimeType && IMAGE_MIMES.includes(f.mimeType)) {
          images.push({
            id: f.id,
            name: f.name || "Photo",
            createdTime: f.createdTime || null,
          });
        }
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return images;
}

/** Check if a folder name looks like a year grouping (e.g., "Pictures 2025", "2025 Photos") */
function extractYear(folderName: string): string | null {
  const match = folderName.match(YEAR_PATTERN);
  return match ? match[1] : null;
}

/**
 * Walk the folder tree and collect all leaf folders with their category names.
 * - If a folder contains images directly, it's a leaf (category = folder name)
 * - If a folder looks like a year (e.g., "Pictures 2025"), its subfolders get " 2025" appended
 * - Recurses up to 3 levels deep
 */
async function discoverCategories(
  drive: DriveClient,
  parentId: string,
  depth = 0,
  yearSuffix = ""
): Promise<{ folderId: string; category: string }[]> {
  if (depth > 3) return []; // safety limit

  const subfolders = await listSubfolders(drive, parentId);
  const results: { folderId: string; category: string }[] = [];

  for (const folder of subfolders) {
    const year = extractYear(folder.name);

    if (year) {
      // This is a year folder — recurse into it, passing the year as suffix
      const nested = await discoverCategories(drive, folder.id, depth + 1, ` ${year}`);
      if (nested.length > 0) {
        results.push(...nested);
      } else {
        // Year folder has no subfolders, treat its images as a category
        results.push({ folderId: folder.id, category: folder.name });
      }
    } else {
      // Regular event folder — use its name + any year suffix from parent
      const category = folder.name + yearSuffix;
      results.push({ folderId: folder.id, category });
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!PARENT_FOLDER_ID) {
    return NextResponse.json(
      { error: "GALLERY_DRIVE_FOLDER_ID not configured" },
      { status: 500 }
    );
  }

  try {
    const drive = getDriveClient();
    const supabase = createServerClient();

    // 1. Get existing drive_file_ids
    const { data: existing } = await supabase
      .from("gallery_photos")
      .select("drive_file_id");

    const existingIds = new Set(
      (existing || [])
        .map((r: { drive_file_id: string | null }) => r.drive_file_id)
        .filter(Boolean)
    );

    // 2. Discover all categories by walking the folder tree
    const categories = await discoverCategories(drive, PARENT_FOLDER_ID);

    // Skip random photos in the root folder — only sync photos inside event folders

    let totalInserted = 0;
    let totalSkipped = 0;
    const categoryStats: Record<string, { added: number; skipped: number }> = {};

    for (const cat of categories) {
      const images = await listImages(drive, cat.folderId);

      let added = 0;
      let skipped = 0;
      const newRows: {
        title: string;
        image_url: string;
        category: string;
        drive_file_id: string;
        date_taken: string | null;
        sort_order: number;
        is_active: boolean;
      }[] = [];

      for (let i = 0; i < images.length; i++) {
        const img = images[i];

        if (existingIds.has(img.id)) {
          skipped++;
          continue;
        }

        const title = img.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");

        newRows.push({
          title,
          image_url: driveImageUrl(img.id),
          category: cat.category,
          drive_file_id: img.id,
          date_taken: img.createdTime ? img.createdTime.split("T")[0] : null,
          sort_order: i,
          is_active: true,
        });

        existingIds.add(img.id);
        added++;
      }

      if (newRows.length > 0) {
        const { error } = await supabase
          .from("gallery_photos")
          .insert(newRows as never);

        if (error) {
          console.error(`Gallery sync error for "${cat.category}":`, error.message);
        }
      }

      totalInserted += added;
      totalSkipped += skipped;
      if (added > 0 || skipped > 0) {
        categoryStats[cat.category] = { added, skipped };
      }
    }

    return NextResponse.json({
      success: true,
      folders: categories.length,
      totalInserted,
      totalSkipped,
      categories: categoryStats,
    });
  } catch (error) {
    console.error("Gallery sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
