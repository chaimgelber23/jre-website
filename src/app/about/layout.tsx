import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About The JRE - Jewish Education in Westchester Since 2009",
  description:
    "Learn about The Jewish Renaissance Experience (JRE), serving the Westchester Jewish community since 2009. Our mission: empower Jews of all backgrounds with meaningful Torah wisdom in Scarsdale, White Plains, Harrison, and beyond.",
  keywords: [
    "about JRE",
    "Jewish organization Westchester",
    "Jewish community Scarsdale",
    "Jewish outreach Westchester",
    "Jewish education organization NY",
    "kiruv Westchester",
  ],
  openGraph: {
    title: "About The JRE - Jewish Education in Westchester Since 2009",
    description:
      "The JRE enables Jews of all backgrounds to access Judaism's deep wisdom. Serving Westchester County from our Scarsdale home since 2009.",
    url: "https://thejre.org/about",
  },
  alternates: { canonical: "https://thejre.org/about" },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
