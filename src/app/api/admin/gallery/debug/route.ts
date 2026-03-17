import { NextResponse } from "next/server";
import { google } from "googleapis";

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

export async function GET() {
  const folderId = process.env.GALLERY_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json({ error: "GALLERY_DRIVE_FOLDER_ID not set" });
  }

  try {
    const drive = getDriveClient();

    // 1. Get the folder itself
    const folderMeta = await drive.files.get({
      fileId: folderId,
      fields: "id, name, mimeType",
      supportsAllDrives: true,
    });

    // 2. List ALL direct children (no filter)
    const children = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
      pageSize: 50,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return NextResponse.json({
      folder: folderMeta.data,
      children: children.data.files || [],
      childCount: children.data.files?.length || 0,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
