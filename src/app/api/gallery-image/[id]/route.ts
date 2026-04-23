import { NextRequest, NextResponse } from "next/server";

/**
 * Image proxy for Google Drive files.
 *
 * Why this exists: `lh3.googleusercontent.com/d/{id}` works in curl but gets
 * blocked by Chrome/Safari when referenced from a third-party page
 * (Google tightened hotlink protection in 2026). Proxying through our own
 * origin sidesteps the issue — the browser sees a same-origin URL, and
 * Google sees the server's server-to-server request.
 *
 * URL shape: /api/gallery-image/{driveFileId}?sz=w1200
 */

const ID_RE = /^[A-Za-z0-9_-]+$/;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  if (!id || !ID_RE.test(id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }
  const sz = req.nextUrl.searchParams.get("sz") || "w1200";

  const upstream = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=${encodeURIComponent(sz)}`;

  try {
    const res = await fetch(upstream, {
      redirect: "follow",
      // Cache the upstream response for an hour; Drive regenerates thumbnails on demand.
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return new NextResponse(`Upstream ${res.status}`, { status: 502 });
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buf = await res.arrayBuffer();

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Let browsers / CDNs cache for a day; revalidate in the background after.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("gallery-image proxy failed:", err);
    return new NextResponse("Upstream error", { status: 502 });
  }
}
