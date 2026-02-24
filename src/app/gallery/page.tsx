import { createServerClient } from "@/lib/supabase/server";
import type { GalleryPhoto } from "@/types/database";
import GalleryClient from "./GalleryClient";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  let photos: GalleryPhoto[] = [];
  let categories: string[] = [];

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("gallery_photos")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: false })
      .order("date_taken", { ascending: false });

    if (!error && data) {
      photos = data as GalleryPhoto[];
      categories = [...new Set(photos.map((p) => p.category))];
    }
  } catch (err) {
    console.error("Failed to fetch gallery photos:", err);
  }

  return <GalleryClient photos={photos} categories={categories} />;
}
