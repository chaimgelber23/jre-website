"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search, Share2, Heart, Mail, MessageCircle, Copy, Check, ArrowLeft,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { formatUsd, getActiveMatcher, getTimeRemaining, type CampaignTeamSnapshot } from "@/lib/campaign";
import DonateModal from "../../DonateModal";
import DonorCard from "../../DonorCard";
import type { CampaignSnapshot } from "@/types/campaign";

type Sort = "default" | "latest" | "oldest" | "highest";

const DEFAULT_ACCENT = "#DA98B1";

interface Props {
  snapshot: CampaignTeamSnapshot;
  orgName?: string;
}

export default function TeamClient({
  snapshot,
  orgName = "Jewish Renaissance Experience",
}: Props) {
  const { campaign, team, matchers, tiers, causes, recent_donations } = snapshot;
  const accent = campaign.theme_color || DEFAULT_ACCENT;
  const activeMatcher = getActiveMatcher(matchers);
  const multiplier = activeMatcher ? Number(activeMatcher.multiplier) : 1;

  const [modalOpen, setModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<Sort>("default");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [donations, setDonations] = useState(recent_donations);
  const [progress, setProgress] = useState({ raised_cents: team.raised_cents, donor_count: team.donor_count });

  // Construct a CampaignSnapshot-shaped object for DonateModal (teams array = just this team, pre-selected).
  const pseudoSnapshot: CampaignSnapshot = useMemo(
    () => ({
      campaign,
      causes,
      tiers,
      matchers,
      teams: [team],
      updates: [],
      progress: {
        goal_cents: campaign.goal_cents,
        raised_cents: 0,
        matched_cents: 0,
        donor_count: 0,
        unique_donors: 0,
        percent_to_goal: 0,
      },
      recent_donations: donations,
    }),
    [campaign, causes, tiers, matchers, team, donations]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaign/${campaign.slug}/progress`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.snapshot) {
        const snap = data.snapshot as CampaignSnapshot;
        const teamEntry = snap.teams.find((t) => t.slug === team.slug);
        if (teamEntry) {
          setProgress({ raised_cents: teamEntry.raised_cents, donor_count: teamEntry.donor_count });
        }
        // Filter wall to this team.
        setDonations(snap.recent_donations.filter((d) => d.team_slug === team.slug));
      }
    } catch { /* best-effort */ }
  }, [campaign.slug, team.slug]);

  useEffect(() => {
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  const goalCents = team.goal_cents ?? 0;
  const pctRaw = goalCents > 0 ? (progress.raised_cents / goalCents) * 100 : 0;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `Support ${team.name} — ${campaign.title}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const filtered = donations
    .filter((d) => !search || d.display_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "highest") return b.amount_cents - a.amount_cents;
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      if (sortBy === "oldest") return at - bt;
      if (sortBy === "latest") return bt - at;
      if (b.amount_cents !== a.amount_cents) return b.amount_cents - a.amount_cents;
      return bt - at;
    });
  const visible = showAll ? filtered : filtered.slice(0, 10);

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* ============ BREADCRUMB ============ */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="container mx-auto px-6 py-3">
          <a
            href={`/campaign/${campaign.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to {campaign.title}
          </a>
        </div>
      </div>

      {/* ============ TEAM HERO ============ */}
      <section className="relative w-full bg-gray-100">
        <div className="relative w-full aspect-[21/9] md:aspect-[21/8] overflow-hidden">
          {team.avatar_url || campaign.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.avatar_url || campaign.hero_image_url || ""}
              alt={team.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 text-gray-300">
              <Heart className="w-24 h-24" />
            </div>
          )}
        </div>
      </section>

      {/* ============ NARROW TITLE BAND ============ */}
      <section className="text-center text-white" style={{ background: accent }}>
        <div className="container mx-auto px-6 py-6">
          <div className="text-[11px] uppercase tracking-[0.22em] opacity-90 mb-1">
            Team Page · {orgName}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1">{team.name}</h1>
          {team.leader_name && (
            <div className="text-sm opacity-90">Led by {team.leader_name}</div>
          )}
        </div>
      </section>

      {/* ============ 3-COL STATS ROW ============ */}
      <section className="border-b border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 items-stretch divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* LEFT — team progress */}
          <div className="px-6 py-8 md:py-10 flex flex-col items-center justify-center">
            <ArcProgress percent={pctRaw} accent={accent} />
            <div className="text-center mt-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                <span className="font-bold text-gray-900 tabular-nums">{pctRaw.toFixed(0)}%</span>{" "}
                {goalCents > 0 ? `of ${formatUsd(goalCents)} team goal` : "raised by team"}
              </div>
              <div className="text-xs text-gray-400 mt-1 tabular-nums">
                {formatUsd(progress.raised_cents)} raised · {progress.donor_count} {progress.donor_count === 1 ? "donor" : "donors"}
              </div>
            </div>
          </div>

          {/* MIDDLE — donate band */}
          <div className="px-6 py-8 md:py-10 flex items-center justify-center" style={{ background: accent }}>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="w-full px-6 py-3 bg-white font-bold rounded-md text-sm tracking-[0.1em] uppercase shadow-sm hover:bg-gray-50 transition"
                style={{ color: accent }}
              >
                Give to {team.name.split(" ")[0]}&apos;s Team
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-800 text-white font-medium rounded-md text-sm uppercase tracking-[0.1em] transition inline-flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copied ? "Copied" : "Share"}
              </button>
              {multiplier > 1 && (
                <div className="text-[11px] text-white/90 text-center">
                  Every gift <span className="font-bold">{multiplier}×</span> matched
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — campaign countdown */}
          <div className="px-6 py-8 md:py-10 flex flex-col items-center justify-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500 mb-3">Campaign Ends In</div>
            <CountdownStrip startAt={campaign.start_at} endAt={campaign.end_at} accent={accent} />
          </div>
        </div>
      </section>

      {/* ============ TEAM STORY ============ */}
      {team.story && (
        <section className="py-10 md:py-14 bg-white">
          <div className="container mx-auto px-6 max-w-3xl">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 text-center mb-4">About this team</h2>
            <div className="prose prose-lg max-w-none text-gray-700 whitespace-pre-line leading-relaxed">
              {team.story}
            </div>
          </div>
        </section>
      )}

      {/* ============ TEAM DONOR WALL ============ */}
      <section className="container mx-auto px-6 py-10 max-w-5xl">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{progress.donor_count}</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 mt-1">
            {progress.donor_count === 1 ? "Donor on this team" : "Donors on this team"}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-gray-400 bg-white"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 uppercase tracking-wide text-xs">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as Sort)}
              className="px-3 py-2 border border-gray-200 rounded-md bg-white focus:outline-none focus:border-gray-400 text-sm"
            >
              <option value="default">Default</option>
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest</option>
            </select>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
            <Heart className="w-8 h-8 mx-auto mb-3" style={{ color: accent }} />
            <p className="text-gray-700 font-medium">Be the first to give to {team.name}</p>
            <p className="text-gray-500 text-sm mt-1">Kick off this team&apos;s fundraising.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {visible.map((d) => (
              <DonorCard key={d.id} d={d} accent={accent} hideTeam />
            ))}
          </div>
        )}

        {filtered.length > 10 && (
          <div className="text-center mt-8">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm font-semibold uppercase tracking-[0.18em] underline"
              style={{ color: accent }}
            >
              {showAll ? "Show Less" : "See More"}
            </button>
          </div>
        )}
      </section>

      {/* ============ SHARE BAND ============ */}
      <section className="border-t border-gray-100 bg-white py-10">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 mb-4">
            <Share2 className="w-4 h-4" /> Share {team.name}&apos;s team page
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <ShareBtn href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} label="WhatsApp" Icon={MessageCircle} accent={accent} />
            <ShareBtn href={`mailto:?subject=${encodeURIComponent(`${team.name} — ${campaign.title}`)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`} label="Email" Icon={Mail} accent={accent} />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-md text-sm font-medium hover:border-gray-400 transition"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </section>

      <Footer />

      {/* Sticky mobile bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between text-xs mb-1.5 tabular-nums">
            <span className="text-gray-500 truncate">{formatUsd(progress.raised_cents)}{goalCents > 0 ? ` of ${formatUsd(goalCents)}` : ""}</span>
            <span className="font-bold" style={{ color: accent }}>{pctRaw.toFixed(0)}%</span>
          </div>
          <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, pctRaw)}%`, background: accent }} />
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full py-3 text-white font-bold rounded-md text-sm uppercase tracking-[0.1em] shadow-lg"
            style={{ background: accent }}
          >
            Donate to {team.name.split(" ")[0]}&apos;s Team
          </button>
        </div>
      </div>

      <DonateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        snapshot={pseudoSnapshot}
        preselectedTierId={null}
        preselectedTeamId={team.id}
        onDonated={refresh}
      />
    </main>
  );
}

// ============ SUBCOMPONENTS (duplicated from CampaignClient — kept local to avoid cross-file churn) ============

function CountdownStrip({ startAt, endAt, accent }: { startAt: string; endAt: string; accent: string }) {
  const [t, setT] = useState(() => getTimeRemaining(startAt, endAt));
  useEffect(() => {
    const id = setInterval(() => setT(getTimeRemaining(startAt, endAt)), 1000);
    return () => clearInterval(id);
  }, [startAt, endAt]);

  if (t.isEnded) {
    return (
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-900">Thank you!</div>
        <div className="text-xs text-gray-500 mt-1">Campaign ended</div>
      </div>
    );
  }

  const totalHours = t.days * 24 + t.hours;
  const segments = t.days > 0
    ? [
        { value: t.days, label: "Days" },
        { value: t.hours, label: "Hours" },
        { value: t.minutes, label: "Minutes" },
      ]
    : [
        { value: totalHours, label: "Hours" },
        { value: t.minutes, label: "Minutes" },
        { value: t.seconds, label: "Seconds" },
      ];

  return (
    <div className="flex items-stretch gap-0">
      {segments.map((s, i) => (
        <div key={s.label} className="flex items-stretch">
          <div className="px-4 md:px-5 text-center min-w-[68px]">
            <div className="text-3xl md:text-4xl font-bold tabular-nums text-gray-900 leading-none">
              {String(s.value).padStart(2, "0")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 mt-2">{s.label}</div>
          </div>
          {i < segments.length - 1 && (
            <div className="w-px self-stretch" style={{ background: accent, opacity: 0.5 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function ArcProgress({ percent, accent }: { percent: number; accent: string }) {
  const size = 140;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circ - (circ * clamped) / 100;

  return (
    <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`} className="overflow-visible">
      <path
        d={`M ${stroke / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <motion.path
        d={`M ${stroke / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`}
        fill="none"
        stroke={accent}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
    </svg>
  );
}

function ShareBtn({
  href, label, Icon, accent,
}: {
  href: string; label: string; Icon: React.ElementType; accent: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-md text-sm font-medium transition-colors"
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.color = ""; }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </a>
  );
}
