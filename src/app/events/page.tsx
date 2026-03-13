import { createServerClient } from "@/lib/supabase/server";
import type { Event } from "@/types/database";
import type { Metadata } from "next";
import EventsClient, { type DisplayEvent } from "./EventsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events | JRE - The Jewish Renaissance Experience",
  description:
    "Join JRE for unforgettable community events — great people, great food, and meaningful Torah.",
};

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function to12Hour(time: string): string {
  if (/am|pm/i.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatEventTime(
  startTime: string | null,
  endTime: string | null
): string {
  if (!startTime) return "See event details";
  const start = to12Hour(startTime);
  if (endTime) return `${start} - ${to12Hour(endTime)}`;
  return start;
}

function eventToDisplay(event: Event, isFeatured: boolean, isPast = false): DisplayEvent {
  // Past events show placeholder by default (flyers look out of place in the carousel).
  // To show a real post-event photo: update image_url AND set post_event_photo = true,
  // or use the naming convention of adding "-photo" or "-recap" to the filename.
  const hasPostEventPhoto = isPast
    ? !!event.image_url && /-(photo|recap|gallery)/.test(event.image_url)
    : !!event.image_url;

  return {
    id: event.slug,
    title: event.title,
    date: formatEventDate(event.date),
    time: formatEventTime(event.start_time, event.end_time),
    location: event.location || "See event details",
    price: event.price_per_adult,
    image: hasPostEventPhoto ? (event.image_url || "") : "",
    hasImage: hasPostEventPhoto,
    description: event.description || "",
    featured: isFeatured,
    themeColor: event.theme_color,
  };
}

// Standalone events that have their own dedicated pages (not in Supabase)
const standaloneUpcoming: DisplayEvent[] = [
  {
    id: "purim-2026",
    title: "JRE Purim Extravaganza",
    date: "Monday, March 2, 2026",
    time: "6:00 PM",
    location: "Life, The Place To Be - Ardsley, NY",
    price: 40,
    image: "/images/events/purim-2026-banner.jpg",
    hasImage: true,
    description:
      "Megillah, live music, open bar, festive banquet, and kids activities! $40/adult, $10/child, Family max $110.",
    featured: false,
    themeColor: "black",
  },
];

const standalonePast: DisplayEvent[] = [
  {
    id: "purim-2025",
    title: "JRE's Next-Level Purim Experience",
    date: "March 2025",
    time: "",
    location: "",
    price: 0,
    image: "",
    hasImage: false,
    description: "",
    featured: false,
    themeColor: "black",
  },
  {
    id: "staying-serene-2026",
    title: "Staying Serene in a Stressful World",
    date: "February 2026",
    time: "",
    location: "",
    price: 0,
    image: "/images/events/staying-serene-2026.jpeg",
    hasImage: true,
    description: "",
    featured: false,
    themeColor: "womens",
  },
  {
    id: "brush-blossom-2026",
    title: "Women's Brush and Blossom Event",
    date: "January 2026",
    time: "",
    location: "",
    price: 0,
    image: "/images/events/brush-blossom-2026.jpeg",
    hasImage: true,
    description: "",
    featured: false,
    themeColor: "womens",
  },
  {
    id: "chanukah-2025",
    title: "Chanukah Extravaganza",
    date: "December 2025",
    time: "",
    location: "",
    price: 0,
    image: "/images/events/chanukah-2025.jpeg",
    hasImage: true,
    description: "",
    featured: false,
  },
  {
    id: "high-holidays-2024",
    title: "High Holiday Services 2024",
    date: "September 2024",
    time: "",
    location: "",
    price: 0,
    image: "/images/events/JREBensoussan.jpeg",
    hasImage: true,
    description: "",
    featured: false,
  },
  {
    id: "womens-retreat-2024",
    title: "Women's Retreat",
    date: "August 2024",
    time: "",
    location: "",
    price: 0,
    image: "/images/events/women2.jpg",
    hasImage: true,
    description: "",
    featured: false,
    themeColor: "womens",
  },
  {
    id: "summer-bbq-2024",
    title: "Summer BBQ",
    date: "July 2024",
    time: "",
    location: "",
    price: 0,
    image: "/images/events/Dinner.jpg",
    hasImage: true,
    description: "",
    featured: false,
  },
];

function filterStandaloneByDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allStandalone = [...standaloneUpcoming, ...standalonePast];
  const stillUpcoming: DisplayEvent[] = [];
  const nowPast: DisplayEvent[] = [];
  for (const evt of allStandalone) {
    const parsed = new Date(evt.date + "T00:00:00");
    if (!isNaN(parsed.getTime()) && parsed >= today) {
      stillUpcoming.push(evt);
    } else {
      nowPast.push(evt);
    }
  }
  return { stillUpcoming, nowPast };
}

export default async function EventsPage() {
  const { stillUpcoming: saUpcoming, nowPast: saPast } =
    filterStandaloneByDate();

  let upcomingEvents: DisplayEvent[] = saUpcoming;
  let pastEvents: DisplayEvent[] = saPast;

  try {
    const supabase = createServerClient();

    const { data: eventsData, error } = await supabase
      .from("events")
      .select("*")
      .eq("is_active", true)
      .order("date", { ascending: true });

    if (!error && eventsData) {
      const events = eventsData as Event[];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = events.filter((e) => new Date(e.date + "T00:00:00") >= today);
      const past = events
        .filter((e) => new Date(e.date + "T00:00:00") < today)
        .sort(
          (a, b) =>
            new Date(b.date + "T00:00:00").getTime() - new Date(a.date + "T00:00:00").getTime()
        );

      const dbUpcoming = upcoming.map((e) => eventToDisplay(e, false, false));
      const dbPast = past.map((e) => eventToDisplay(e, false, true));

      // Merge: DB events first, then standalone (skip duplicates by id)
      const dbUpcomingIds = new Set(dbUpcoming.map((e) => e.id));
      upcomingEvents = [
        ...dbUpcoming,
        ...saUpcoming.filter((e) => !dbUpcomingIds.has(e.id)),
      ];

      const dbPastIds = new Set(dbPast.map((e) => e.id));
      pastEvents = [
        ...dbPast,
        ...saPast.filter((e) => !dbPastIds.has(e.id)),
      ];
    }
  } catch (err) {
    console.error("Failed to fetch events:", err);
    // Falls back to standalone events already set above
  }

  // Mark featured if exactly 1 upcoming event
  if (upcomingEvents.length === 1) {
    upcomingEvents[0] = { ...upcomingEvents[0], featured: true };
  }

  return (
    <EventsClient upcomingEvents={upcomingEvents} pastEvents={pastEvents} />
  );
}
