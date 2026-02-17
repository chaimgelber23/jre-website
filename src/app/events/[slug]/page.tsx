import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { JsonLd } from "@/components/seo/JsonLd";
import type { Event } from "@/types/database";
import EventDetailClient from "./EventDetailClient";

type Props = {
  params: Promise<{ slug: string }>;
};

async function getEvent(slug: string): Promise<Event | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    return {
      title: "Event Not Found",
      description: "This event could not be found.",
    };
  }

  const eventDate = new Date(event.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const description = event.description
    ? `${event.title} on ${eventDate}${event.location ? ` at ${event.location}` : ""}. ${event.description.slice(0, 120)}...`
    : `Join The JRE for ${event.title} on ${eventDate}${event.location ? ` at ${event.location}` : ""} in Westchester County, NY.`;

  return {
    title: `${event.title} - Jewish Event in Westchester`,
    description,
    keywords: [
      event.title,
      "Jewish event Westchester",
      "JRE event",
      `Jewish ${event.location || "Westchester"}`,
      "Jewish community event",
    ],
    openGraph: {
      title: event.title,
      description: `${eventDate}${event.location ? ` | ${event.location}` : ""} - Join us for this JRE community event.`,
      url: `https://thejre.org/events/${slug}`,
      type: "article",
      images: event.image_url
        ? [{ url: event.image_url, width: 1200, height: 630, alt: event.title }]
        : undefined,
    },
    alternates: { canonical: `https://thejre.org/events/${slug}` },
  };
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params;
  const event = await getEvent(slug);

  const eventJsonLd = event
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        startDate: `${event.date}T${event.start_time || "19:00"}`,
        ...(event.end_time && { endDate: `${event.date}T${event.end_time}` }),
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: event.location
          ? {
              "@type": "Place",
              name: event.location,
              address: { "@type": "PostalAddress", addressRegion: "NY", addressCountry: "US" },
            }
          : undefined,
        organizer: {
          "@type": "Organization",
          name: "The JRE - Jewish Renaissance Experience",
          url: "https://thejre.org",
        },
        offers: {
          "@type": "Offer",
          price: String(event.price_per_adult),
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
          url: `https://thejre.org/events/${slug}`,
        },
        image: event.image_url
          ? `https://thejre.org${event.image_url}`
          : undefined,
        description: event.description || undefined,
      }
    : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://thejre.org" },
      { "@type": "ListItem", position: 2, name: "Events", item: "https://thejre.org/events" },
      ...(event
        ? [{ "@type": "ListItem", position: 3, name: event.title, item: `https://thejre.org/events/${slug}` }]
        : []),
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      {eventJsonLd && <JsonLd data={eventJsonLd} />}
      <EventDetailClient params={params} />
    </>
  );
}
