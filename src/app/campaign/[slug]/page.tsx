import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCampaignSnapshot } from "@/lib/campaign";
import { createServerClient } from "@/lib/supabase/server";
import CampaignClient from "./CampaignClient";

export const revalidate = 0;

export interface RecentPhoto {
  id: string;
  image_url: string;
  category: string | null;
  title: string | null;
}

/**
 * Pull a small, varied set of recent event photos from gallery_photos.
 * We group by category and take a few from each of the most-recent events so
 * the strip isn't dominated by a single session.
 */
/**
 * Serve Drive images through our own origin to bypass Chrome/Safari hotlink
 * blocking of `lh3.googleusercontent.com`. See /api/gallery-image/[id].
 */
function driveThumbnail(fileId: string, size = 1200): string {
  return `/api/gallery-image/${fileId}?sz=w${size}`;
}

/** Extract the file id from an lh3 URL (fallback when drive_file_id is null). */
function extractDriveId(url: string): string | null {
  const m = url.match(/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

async function getRecentEventPhotos(limit = 12): Promise<RecentPhoto[]> {
  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data } = await db
    .from("gallery_photos")
    .select("id,image_url,drive_file_id,category,title,date_taken,sort_order")
    .eq("is_active", true)
    .order("date_taken", { ascending: false, nullsFirst: false })
    .order("sort_order", { ascending: true })
    .limit(60);

  type Row = {
    id: string;
    image_url: string;
    drive_file_id: string | null;
    category: string | null;
    title: string | null;
    date_taken: string | null;
    sort_order: number;
  };
  const rows = (data ?? []) as Row[];

  const toRecent = (r: Row): RecentPhoto => {
    const id = r.drive_file_id || extractDriveId(r.image_url);
    return {
      id: r.id,
      image_url: id ? driveThumbnail(id) : r.image_url,
      category: r.category,
      title: r.title,
    };
  };

  // Round-robin across categories so multiple events are represented
  const byCat = new Map<string, RecentPhoto[]>();
  for (const r of rows) {
    const key = r.category || "Uncategorized";
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(toRecent(r));
  }
  const picked: RecentPhoto[] = [];
  let cursor = 0;
  const cats = Array.from(byCat.values());
  while (picked.length < limit && cats.some((arr) => arr.length > cursor)) {
    for (const arr of cats) {
      if (picked.length >= limit) break;
      if (arr[cursor]) picked.push(arr[cursor]);
    }
    cursor += 1;
  }
  return picked.slice(0, limit);
}

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const snapshot = await getCampaignSnapshot(slug);
  if (!snapshot) {
    return { title: "Campaign Not Found" };
  }
  const { campaign } = snapshot;
  const description = campaign.tagline || "Support JRE — tax-deductible donation.";
  const ogImage = campaign.og_image_url || campaign.hero_image_url || undefined;
  return {
    title: `${campaign.title} — JRE`,
    description,
    openGraph: {
      title: campaign.title,
      description,
      images: ogImage ? [ogImage] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: campaign.title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function CampaignPage({ params }: Params) {
  const { slug } = await params;
  const [snapshot, recentPhotos] = await Promise.all([
    getCampaignSnapshot(slug),
    getRecentEventPhotos(12),
  ]);
  if (!snapshot) notFound();
  return (
    <CampaignClient
      snapshot={snapshot}
      recentPhotos={recentPhotos}
    />
  );
}
