import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jewish Events in Westchester County",
  description:
    "Upcoming Jewish events in Westchester County, NY. Join The JRE for Shabbat dinners, holiday celebrations, community gatherings, and more in Scarsdale, White Plains, Harrison, and surrounding areas.",
  keywords: [
    "Jewish events Westchester",
    "Jewish events Scarsdale",
    "Shabbat dinner Westchester",
    "Jewish holiday events NY",
    "Jewish community events White Plains",
    "Jewish gatherings Harrison",
    "Purim Westchester",
    "Jewish things to do Westchester",
  ],
  openGraph: {
    title: "Upcoming Jewish Events in Westchester County",
    description:
      "Great people, great food, and meaningful Torah. Join The JRE for community events across Westchester County.",
    url: "https://thejre.org/events",
  },
  alternates: { canonical: "https://thejre.org/events" },
};

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
