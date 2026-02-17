import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "Contact The JRE - Jewish Education Center in Scarsdale, NY",
  description:
    "Contact The Jewish Renaissance Experience at 1495 Weaver Street, Scarsdale, NY 10583. Call 914-713-4355 or email office@thejre.org. Serving the Westchester Jewish community since 2009.",
  keywords: [
    "JRE contact",
    "Jewish education Scarsdale",
    "Jewish center Westchester",
    "Jewish organization Scarsdale NY",
    "1495 Weaver Street Scarsdale",
  ],
  openGraph: {
    title: "Contact The JRE - Scarsdale, NY",
    description:
      "Get in touch with The JRE. 1495 Weaver Street, Scarsdale, NY 10583. Phone: 914-713-4355.",
    url: "https://thejre.org/contact",
  },
  alternates: { canonical: "https://thejre.org/contact" },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "EducationalOrganization"],
  name: "The JRE - Jewish Renaissance Experience",
  image: "https://thejre.org/images/logo.png",
  url: "https://thejre.org",
  telephone: "+1-914-713-4355",
  email: "office@thejre.org",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1495 Weaver Street",
    addressLocality: "Scarsdale",
    addressRegion: "NY",
    postalCode: "10583",
    addressCountry: "US",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 41.0051,
    longitude: -73.7846,
  },
  areaServed: {
    "@type": "AdministrativeArea",
    name: "Westchester County, NY",
  },
  priceRange: "Free - Varies by event",
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd data={localBusinessJsonLd} />
      {children}
    </>
  );
}
