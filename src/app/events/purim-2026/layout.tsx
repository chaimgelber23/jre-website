import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "JRE's Next-Level Purim 2026 Celebration - Ardsley, NY",
  description:
    "Join The JRE for an unforgettable Purim celebration on March 3, 2026 at Life, The Place To Be in Ardsley, NY. Megillah reading, live music, open bar, festive banquet, and kids activities.",
  keywords: [
    "Purim 2026 Westchester",
    "Purim celebration Ardsley",
    "Jewish Purim event NY",
    "Purim party Westchester",
    "Megillah reading Westchester",
    "Purim Scarsdale",
    "Purim White Plains",
  ],
  openGraph: {
    title: "JRE's Next-Level Purim 2026 - March 3, Ardsley NY",
    description:
      "Megillah reading, live music, open bar, festive banquet, and kids activities. The ultimate Purim experience in Westchester County.",
    url: "https://thejre.org/events/purim-2026",
    images: [
      {
        url: "/images/events/purim-2026-banner.jpg",
        width: 1200,
        height: 630,
        alt: "JRE Purim 2026 Celebration",
      },
    ],
  },
  alternates: { canonical: "https://thejre.org/events/purim-2026" },
};

const purimEventJsonLd = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "JRE's Next-Level Purim 2026 Experience",
  startDate: "2026-03-03T18:00:00-05:00",
  endDate: "2026-03-03T22:00:00-05:00",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: {
    "@type": "Place",
    name: "Life, The Place To Be",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Ardsley",
      addressRegion: "NY",
      addressCountry: "US",
    },
  },
  organizer: {
    "@type": "Organization",
    name: "The JRE - Jewish Renaissance Experience",
    url: "https://thejre.org",
  },
  image: "https://thejre.org/images/events/purim-2026-banner.jpg",
  description:
    "An unforgettable Purim celebration with Megillah reading, live music, open bar, festive banquet, and kids activities.",
  offers: {
    "@type": "Offer",
    price: "40",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: "https://thejre.org/events/purim-2026",
  },
};

export default function PurimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={purimEventJsonLd} />
      {children}
    </>
  );
}
