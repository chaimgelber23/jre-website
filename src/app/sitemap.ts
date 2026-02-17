import type { MetadataRoute } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { createSpeechServerClient } from "@/lib/supabase/speech";
import type { Event } from "@/types/database";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://thejre.org";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/classes`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/parsha`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/donate`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/events/purim-2026`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // Dynamic event pages from Supabase
  let eventPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServerClient();
    const { data: events } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true);

    const typedEvents = (events || []) as Event[];
    eventPages = typedEvents.map((event) => ({
      url: `${baseUrl}/events/${event.slug}`,
      lastModified: new Date(event.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // Silently continue if events fetch fails
  }

  // Dynamic parsha pages from speech Supabase
  let parshaPages: MetadataRoute.Sitemap = [];
  try {
    const speechSupabase = createSpeechServerClient();
    const { data: parshaContent } = await speechSupabase
      .from("parsha_content")
      .select("*");

    const items = (parshaContent || []) as Array<{ slug: string; updated_at: string }>;
    parshaPages = items.map((p) => ({
      url: `${baseUrl}/parsha/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    // Silently continue if parsha fetch fails
  }

  return [...staticPages, ...eventPages, ...parshaPages];
}
