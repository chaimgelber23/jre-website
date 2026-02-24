import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Photo Gallery | JRE - The Jewish Renaissance Experience",
  description:
    "Browse photos from JRE events, classes, and community gatherings in Westchester County, NY.",
  keywords: [
    "JRE photos",
    "Jewish events photos Westchester",
    "Jewish community gallery",
  ],
  openGraph: {
    title: "Photo Gallery | The JRE",
    description:
      "Highlights from JRE events, classes, and community life in Westchester County.",
    url: "https://thejre.org/gallery",
  },
  alternates: { canonical: "https://thejre.org/gallery" },
};

export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
