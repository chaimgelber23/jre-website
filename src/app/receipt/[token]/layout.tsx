import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tax Receipt — The JRE",
  description:
    "Official tax receipt for your donation to The Jewish Renaissance Experience.",
  robots: { index: false, follow: false },
};

export default function ReceiptLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
