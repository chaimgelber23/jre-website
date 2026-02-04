import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "The JRE | Jewish Religious Education",
    template: "%s | The JRE",
  },
  description:
    "The JRE enables Jews of all backgrounds to access the deep and meaningful wisdom of Judaism in a way that is relevant to their daily lives.",
  keywords: [
    "Jewish education",
    "Westchester",
    "Scarsdale",
    "Jewish events",
    "Torah classes",
    "Judaism",
    "JRE",
  ],
  authors: [{ name: "The JRE" }],
  openGraph: {
    title: "The JRE | Jewish Religious Education",
    description:
      "The future of ancient wisdom. Empower. Engage. Inspire.",
    url: "https://thejre.org",
    siteName: "The JRE",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
