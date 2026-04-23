import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCampaignTeamSnapshot } from "@/lib/campaign";
import TeamClient from "./TeamClient";

export const revalidate = 0;

interface Params {
  params: Promise<{ slug: string; teamSlug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, teamSlug } = await params;
  const snap = await getCampaignTeamSnapshot(slug, teamSlug);
  if (!snap) return { title: "Team Not Found", robots: { index: false, follow: false } };
  const { campaign, team } = snap;
  const title = `${team.name} — ${campaign.title}`;
  const description = team.story || campaign.tagline || `Support ${team.name} for ${campaign.title}.`;
  const image = team.avatar_url || campaign.og_image_url || campaign.hero_image_url || undefined;
  return {
    title,
    description,
    // Unlisted: the team page exists at a direct URL but is not advertised; keep search engines out.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function TeamPage({ params }: Params) {
  const { slug, teamSlug } = await params;
  const snap = await getCampaignTeamSnapshot(slug, teamSlug);
  if (!snap) notFound();
  return <TeamClient snapshot={snap} />;
}
