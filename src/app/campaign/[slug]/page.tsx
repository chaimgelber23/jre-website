import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCampaignSnapshot } from "@/lib/campaign";
import CampaignClient from "./CampaignClient";

export const revalidate = 0;

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const snapshot = await getCampaignSnapshot(slug);
  if (!snapshot) {
    return { title: "Campaign Not Found" };
  }
  const { campaign } = snapshot;
  const description = campaign.tagline || "Support JRE — tax-deductible donation.";
  const ogImage = campaign.og_image_url || campaign.hero_image_url || undefined;
  return {
    title: `${campaign.title} — JRE`,
    description,
    openGraph: {
      title: campaign.title,
      description,
      images: ogImage ? [ogImage] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: campaign.title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function CampaignPage({ params }: Params) {
  const { slug } = await params;
  const snapshot = await getCampaignSnapshot(slug);
  if (!snapshot) notFound();
  return <CampaignClient snapshot={snapshot} />;
}
