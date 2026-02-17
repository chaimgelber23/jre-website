import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Torah Classes in Westchester County - Free Jewish Learning",
  description:
    "Weekly Torah classes for men, women, and families in Westchester County. Sunday through Friday classes in Scarsdale, White Plains, Harrison, and via Zoom. All levels welcome, all classes free.",
  keywords: [
    "Torah classes Westchester",
    "Jewish classes Scarsdale",
    "parsha class Westchester",
    "adult Jewish education Westchester",
    "Jewish learning White Plains",
    "women Torah class Westchester",
    "Talmud study Westchester",
    "free Jewish classes NY",
  ],
  openGraph: {
    title: "Torah Classes in Westchester County",
    description:
      "Torah learning for everyone, every day of the week. Free classes in Scarsdale, White Plains, Harrison, and via Zoom.",
    url: "https://thejre.org/classes",
  },
  alternates: { canonical: "https://thejre.org/classes" },
};

export default function ClassesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
