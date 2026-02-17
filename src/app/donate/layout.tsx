import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Donate to The JRE - Support Jewish Education in Westchester",
  description:
    "Support The JRE's mission to provide Jewish education and community events in Westchester County. Tax-deductible donations to a 501(c)(3) nonprofit serving Scarsdale, White Plains, Harrison, and beyond.",
  keywords: [
    "donate Jewish education",
    "Jewish charity Westchester",
    "support JRE",
    "tax deductible Jewish donation",
    "Jewish nonprofit Westchester",
  ],
  openGraph: {
    title: "Donate to The JRE - Support Jewish Education in Westchester",
    description:
      "Your generosity helps provide meaningful Jewish experiences for the Westchester community. Tax-deductible. JRE is a 501(c)(3) nonprofit.",
    url: "https://thejre.org/donate",
  },
  alternates: { canonical: "https://thejre.org/donate" },
};

export default function DonateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
