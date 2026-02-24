import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Gallery Auto-Sync Cron
 *
 * Scans a parent Google Drive folder for subfolders (each = a gallery category).
 * For each subfolder, lists image files and inserts new ones into Supabase
 * gallery_photos table using Google's CDN URL.
 *
 * Setup:
 *   1. Enable Google Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com
 *   2. Create a parent Google Drive folder
 *   3. Share it with: jresignuptosheets@jresignuptosheets.iam.gserviceaccount.com (Viewer)
 *   4. Set GALLERY_DRIVE_FOLDER_ID env var to the parent folder ID
 *   5. Create subfolders inside it (e.g., "Purim 2025", "Chanukah 2025")
 *   6. Upload photos to those subfolders
 *   7. Photos appear on /gallery automatically after next cron run
 */

const CRON_SECRET = process.env.CRON_SECRET;
const PARENT_FOLDER_ID = process.env.GALLERY_DRIVE_FOLDER_ID;

const IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

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

/** Google CDN URL for publicly shared Drive files */
function driveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

/** List subfolders in a parent folder */
async function listSubfolders(
  drive: ReturnType<typeof google.drive>,
  parentId: string
) {
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

/** List image files in a folder */
async function listImages(
  drive: ReturnType<typeof google.drive>,
  folderId: string
) {
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

export async function GET(request: NextRequest) {
  // Auth
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

    // 1. Get existing drive_file_ids to skip duplicates
    const { data: existing } = await supabase
      .from("gallery_photos")
      .select("drive_file_id");

    const existingIds = new Set(
      (existing || []).map((r: { drive_file_id: string | null }) => r.drive_file_id).filter(Boolean)
    );

    // 2. List subfolders (each = a category)
    const folders = await listSubfolders(drive, PARENT_FOLDER_ID);

    // 3. Also check for images directly in the parent folder (category = "Community")
    const topLevelImages = await listImages(drive, PARENT_FOLDER_ID);
    if (topLevelImages.length > 0) {
      folders.unshift({ id: PARENT_FOLDER_ID, name: "Community" });
    }

    let totalInserted = 0;
    let totalSkipped = 0;
    const categoryStats: Record<string, { added: number; skipped: number }> = {};

    for (const folder of folders) {
      const images =
        folder.id === PARENT_FOLDER_ID
          ? topLevelImages
          : await listImages(drive, folder.id);

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
          category: folder.name,
          drive_file_id: img.id,
          date_taken: img.createdTime ? img.createdTime.split("T")[0] : null,
          sort_order: i,
          is_active: true,
        });

        existingIds.add(img.id); // prevent duplicates within this run
        added++;
      }

      // Batch insert
      if (newRows.length > 0) {
        const { error } = await supabase
          .from("gallery_photos")
          .insert(newRows as never);

        if (error) {
          console.error(
            `Gallery sync error for "${folder.name}":`,
            error.message
          );
          // Continue with other folders
        }
      }

      totalInserted += added;
      totalSkipped += skipped;
      categoryStats[folder.name] = { added, skipped };
    }

    return NextResponse.json({
      success: true,
      folders: folders.length,
      totalInserted,
      totalSkipped,
      categories: categoryStats,
    });
  } catch (error) {
    console.error("Gallery sync cron error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
