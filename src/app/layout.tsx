import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { JsonLd } from "@/components/seo/JsonLd";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://thejre.org"),
  title: {
    default: "The JRE | Jewish Education & Community in Westchester County, NY",
    template: "%s | The JRE",
  },
  description:
    "The Jewish Renaissance Experience (JRE) provides engaging Jewish education, Torah classes, and community events in Westchester County, NY. Serving Scarsdale, White Plains, Harrison, New Rochelle and surrounding areas since 2009.",
  keywords: [
    "Jewish education Westchester",
    "Jewish community Westchester",
    "Jewish events Westchester",
    "Torah classes Westchester",
    "Jewish classes Scarsdale",
    "Jewish outreach Westchester",
    "synagogue Westchester",
    "shul Westchester",
    "temple Westchester",
    "Jewish White Plains",
    "Jewish Harrison NY",
    "Jewish New Rochelle",
    "Jewish Scarsdale",
    "kiruv Westchester",
    "adult Jewish education",
    "Shabbat dinner Westchester",
    "Jewish Renaissance Experience",
    "JRE",
  ],
  authors: [{ name: "The JRE - Jewish Renaissance Experience" }],
  creator: "The JRE",
  publisher: "The JRE",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "The JRE | Jewish Education & Community in Westchester County",
    description:
      "Empower. Engage. Inspire. The JRE enables Jews of all backgrounds to access the deep and meaningful wisdom of Judaism. Classes, events, and community in Westchester County, NY.",
    url: "https://thejre.org",
    siteName: "The JRE - Jewish Renaissance Experience",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/images/logo.png",
        alt: "The JRE - Jewish Renaissance Experience - Westchester County, NY",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The JRE | Jewish Education & Community in Westchester",
    description:
      "Empower. Engage. Inspire. Jewish education, events, and community in Westchester County, NY.",
    images: ["/images/logo.png"],
  },
  alternates: {
    canonical: "https://thejre.org",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": ["Organization", "EducationalOrganization"],
  name: "The JRE - Jewish Renaissance Experience",
  alternateName: "JRE",
  url: "https://thejre.org",
  logo: "https://thejre.org/images/logo.png",
  image: "https://thejre.org/images/logo.png",
  description:
    "The JRE enables Jews of all backgrounds to access the deep and meaningful wisdom of Judaism in a way that is relevant to their daily lives.",
  foundingDate: "2009",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1495 Weaver Street",
    addressLocality: "Scarsdale",
    addressRegion: "NY",
    postalCode: "10583",
    addressCountry: "US",
  },
  telephone: "+1-914-713-4355",
  email: "office@thejre.org",
  areaServed: [
    { "@type": "AdministrativeArea", name: "Westchester County, NY" },
    { "@type": "City", name: "Scarsdale, NY" },
    { "@type": "City", name: "White Plains, NY" },
    { "@type": "City", name: "Harrison, NY" },
    { "@type": "City", name: "New Rochelle, NY" },
    { "@type": "City", name: "Yonkers, NY" },
    { "@type": "City", name: "Mamaroneck, NY" },
    { "@type": "City", name: "Larchmont, NY" },
    { "@type": "City", name: "Rye, NY" },
    { "@type": "City", name: "Bronxville, NY" },
    { "@type": "City", name: "Eastchester, NY" },
    { "@type": "City", name: "Pelham, NY" },
    { "@type": "City", name: "Tarrytown, NY" },
    { "@type": "City", name: "Ardsley, NY" },
    { "@type": "City", name: "Dobbs Ferry, NY" },
    { "@type": "City", name: "Port Chester, NY" },
  ],
  sameAs: [],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans antialiased">
        <JsonLd data={organizationJsonLd} />
        {children}
      </body>
    </html>
  );
}
