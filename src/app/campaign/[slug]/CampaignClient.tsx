"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search, Share2, Heart, Facebook, Twitter, Mail,
  MessageCircle, Copy, Check,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { formatUsd, getActiveMatcher, getTimeRemaining } from "@/lib/campaign";
import type { CampaignSnapshot, PublicDonation, CampaignTeamWithProgress, CampaignMatcher, Campaign } from "@/types/campaign";
import DonateModal from "./DonateModal";
import HeroCarousel from "./HeroCarousel";
import VideoModal from "./VideoModal";

interface Props {
  snapshot: CampaignSnapshot;
  orgName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

type Tab = "donors" | "matchers" | "about" | "teams" | "communities";
type Sort = "default" | "latest" | "oldest" | "highest";

const DEFAULT_ACCENT = "#DA98B1";

export default function CampaignClient({
  snapshot: initial,
  orgName = "Jewish Renaissance Experience",
  contactEmail = "office@thejre.org",
  contactPhone = "(914) 359-2200",
}: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [preselectedTier, setPreselectedTier] = useState<string | null>(null);
  const [preselectedTeam, setPreselectedTeam] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("donors");
  const [sortBy, setSortBy] = useState<Sort>("default");
  const [search, setSearch] = useState("");
  const [showAllDonors, setShowAllDonors] = useState(false);
  const [copied, setCopied] = useState(false);

  const { campaign, tiers, matchers, teams, progress, recent_donations } = snapshot;
  const accent = campaign.theme_color || DEFAULT_ACCENT;
  const activeMatcher = getActiveMatcher(matchers);
  const multiplier = activeMatcher ? Number(activeMatcher.multiplier) : 1;

  const heroImages = useMemo(() => {
    const list = (campaign.hero_image_urls ?? []).filter(Boolean);
    if (list.length > 0) return list;
    return campaign.hero_image_url ? [campaign.hero_image_url] : [];
  }, [campaign.hero_image_urls, campaign.hero_image_url]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaign/${campaign.slug}/progress`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.snapshot) setSnapshot(data.snapshot);
    } catch { /* best-effort */ }
  }, [campaign.slug]);

  useEffect(() => {
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  const total = progress.raised_cents + progress.matched_cents;
  const pctRaw = progress.goal_cents > 0 ? (total / progress.goal_cents) * 100 : 0;

  const openDonate = () => {
    setPreselectedTier(null);
    setPreselectedTeam(null);
    setModalOpen(true);
  };
  const openWithTier = (tierId: string) => {
    setPreselectedTier(tierId);
    setPreselectedTeam(null);
    setModalOpen(true);
  };
  const openWithTeam = (teamId: string) => {
    setPreselectedTeam(teamId);
    setPreselectedTier(null);
    setModalOpen(true);
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = campaign.share_text || `Support ${campaign.title}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const filteredDonations = recent_donations
    .filter((d) => !search || d.display_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "highest") return b.amount_cents - a.amount_cents;
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      if (sortBy === "oldest") return at - bt;
      if (sortBy === "latest") return bt - at;
      // "default" — featured/highest gifts first, then recency
      if (b.amount_cents !== a.amount_cents) return b.amount_cents - a.amount_cents;
      return bt - at;
    });
  const visibleDonations = showAllDonors ? filteredDonations : filteredDonations.slice(0, 10);

  const counts: Record<Tab, number | null> = {
    donors: progress.donor_count,
    matchers: matchers.length,
    about: null,
    teams: teams.length,
    communities: 0,
  };

  return (
    <main className="min-h-screen bg-white">
      <Header />

      {/* ============ FULL-WIDTH HERO CAROUSEL / VIDEO ============ */}
      <section className="relative w-full bg-gray-100">
        {heroImages.length > 0 ? (
          <HeroCarousel
            images={heroImages}
            alt={campaign.title}
            videoUrl={campaign.video_url}
            onPlayVideo={() => setVideoOpen(true)}
          />
        ) : (
          <div className="relative w-full aspect-[21/9] md:aspect-[21/8] overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 text-gray-300">
              <Heart className="w-24 h-24" />
            </div>
          </div>
        )}
      </section>

      {/* ============ NARROW TITLE BAND ============ */}
      <section className="text-center text-white" style={{ background: accent }}>
        <div className="container mx-auto px-6 py-6">
          <div className="text-[11px] uppercase tracking-[0.22em] opacity-90 mb-1">{orgName}</div>
          <h1 className="text-2xl md:text-3xl font-bold mb-3">{campaign.title}</h1>
          <button
            type="button"
            onClick={() => setTab("about")}
            className="inline-flex items-center px-5 py-1.5 rounded-md bg-white/15 hover:bg-white/25 border border-white/40 text-xs font-medium uppercase tracking-wide transition"
          >
            About Campaign
          </button>
        </div>
      </section>

      {/* ============ 3-COL STATS ROW: PROGRESS | ACTION | COUNTDOWN ============ */}
      <section className="border-b border-gray-100">
        <div className="grid md:grid-cols-3 items-stretch divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* LEFT — progress with arc */}
          <div className="px-6 py-8 md:py-10 flex flex-col items-center justify-center">
            <ArcProgress percent={pctRaw} accent={accent} />
            <div className="text-center mt-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                <span className="font-bold text-gray-900 tabular-nums">{pctRaw.toFixed(0)}%</span> of {formatUsd(progress.goal_cents)} goal
              </div>
              <div className="text-xs text-gray-400 mt-1 tabular-nums">{formatUsd(total)} raised</div>
            </div>
          </div>

          {/* MIDDLE — pink action band */}
          <div className="px-6 py-8 md:py-10 flex items-center justify-center" style={{ background: accent }}>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={openDonate}
                className="w-full px-6 py-3 bg-white font-bold rounded-md text-sm tracking-[0.1em] uppercase shadow-sm hover:bg-gray-50 transition"
                style={{ color: accent }}
              >
                Donate Now
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-800 text-white font-medium rounded-md text-sm uppercase tracking-[0.1em] transition inline-flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copied ? "Copied" : "Share"}
              </button>
            </div>
          </div>

          {/* RIGHT — countdown */}
          <div className="px-6 py-8 md:py-10 flex flex-col items-center justify-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500 mb-3">Time Remaining</div>
            <CountdownStrip startAt={campaign.start_at} endAt={campaign.end_at} accent={accent} />
          </div>
        </div>
      </section>

      {/* ============ SPONSOR TIER CARDS ============ */}
      {tiers.length > 0 && (
        <section className="py-10 md:py-12 bg-gray-50 border-b border-gray-100">
          <div className="container mx-auto px-6">
            <div className="text-center mb-6">
              <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500 mb-1">Sponsorship Levels</div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">Choose how you&apos;ll give</h2>
              {multiplier > 1 && (
                <p className="text-sm text-gray-600 mt-2">
                  Every gift is <span className="font-semibold" style={{ color: accent }}>multiplied {multiplier}×</span> thanks to our matcher.
                </p>
              )}
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${tiers.length >= 3 ? "lg:grid-cols-3" : ""} ${tiers.length >= 4 ? "xl:grid-cols-4" : ""} gap-4 max-w-6xl mx-auto`}>
              {tiers.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openWithTier(t.id)}
                  className={`relative text-left bg-white border rounded-xl p-5 transition-all hover:shadow-lg ${
                    t.is_featured ? "border-2" : "border border-gray-200"
                  }`}
                  style={t.is_featured ? { borderColor: accent } : undefined}
                >
                  {t.is_featured && (
                    <span
                      className="absolute -top-2 left-5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
                      style={{ background: accent }}
                    >
                      Popular
                    </span>
                  )}
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-2xl md:text-3xl font-bold text-gray-900 tabular-nums">{formatUsd(t.amount_cents)}</div>
                    {t.hebrew_value && (
                      <div dir="rtl" className="text-sm font-semibold" style={{ color: accent }}>
                        {t.hebrew_value}
                      </div>
                    )}
                  </div>
                  {t.label && <div className="text-sm font-semibold text-gray-800 mb-1">{t.label}</div>}
                  {t.description && <div className="text-xs text-gray-600 leading-relaxed">{t.description}</div>}
                  {multiplier > 1 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
                      Becomes <span className="font-semibold tabular-nums" style={{ color: accent }}>{formatUsd(t.amount_cents * multiplier)}</span> with match
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============ 3-COL DONATION WIDGET: SHARE | $AMOUNT | DONATE ============ */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-6">
          <div className="text-center text-[11px] uppercase tracking-[0.22em] text-gray-500 mb-6">
            Start Your Donation
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-6 md:gap-10 max-w-4xl mx-auto">
            {/* Share pill (left) */}
            <button
              type="button"
              onClick={copyLink}
              className="hidden md:inline-flex items-center gap-2 px-5 py-3 border border-gray-200 rounded-md text-xs font-semibold uppercase tracking-[0.1em] text-gray-700 hover:border-gray-400 transition"
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? "Copied" : "Share"}
            </button>

            {/* Center — amount */}
            <div className="text-center">
              <div className="text-6xl md:text-7xl font-bold text-gray-900 tabular-nums leading-none">$0</div>
              <div className="text-xs text-gray-600 mt-3">
                {orgName} gets:{" "}
                <span className="font-semibold">(x{Number(activeMatcher?.multiplier ?? 1)})</span>{" "}
                = <span className="font-semibold text-gray-900">$0</span>
              </div>
            </div>

            {/* Donate button (right) */}
            <button
              type="button"
              onClick={openDonate}
              className="px-10 py-4 text-white font-bold rounded-md text-sm uppercase tracking-[0.1em] shadow-lg hover:shadow-xl transition"
              style={{ background: accent }}
            >
              Donate Now
            </button>
          </div>
        </div>
      </section>

      {/* ============ CONTACT STRIP ============ */}
      <section className="border-t border-b border-gray-100 py-6 bg-white">
        <div className="container mx-auto px-6 text-center text-sm text-gray-600 space-y-1.5">
          <div>
            Campaign Contact Email:{" "}
            <a href={`mailto:${contactEmail}`} className="underline font-medium" style={{ color: accent }}>
              {contactEmail}
            </a>
          </div>
          <div>
            Campaign Contact Phone:{" "}
            <a href={`tel:${contactPhone.replace(/\D/g, "")}`} className="underline font-medium" style={{ color: accent }}>
              {contactPhone}
            </a>
          </div>
        </div>
      </section>

      {/* ============ TABS STRIP — NUMBER STACKED ABOVE LABEL ============ */}
      <section className="bg-gray-50 border-b border-gray-200">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap justify-center items-end gap-x-12 gap-y-2">
            {([
              { id: "donors", label: "Donors" },
              { id: "matchers", label: "Matchers" },
              { id: "about", label: "About" },
              { id: "teams", label: "Teams" },
              { id: "communities", label: "Communities" },
            ] as { id: Tab; label: string }[]).map((t) => {
              const active = tab === t.id;
              const count = counts[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="py-4 border-b-2 transition-colors flex flex-col items-center"
                  style={{
                    borderColor: active ? accent : "transparent",
                    color: active ? accent : "#6b7280",
                  }}
                >
                  {count !== null ? (
                    <>
                      <span className="text-xl font-bold tabular-nums leading-none">{count.toLocaleString()}</span>
                      <span className="text-[11px] uppercase tracking-[0.15em] mt-1.5">{t.label}</span>
                    </>
                  ) : (
                    <span className="text-[11px] uppercase tracking-[0.15em] py-1.5">{t.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ TAB BODY ============ */}
      <section className="container mx-auto px-6 py-10 max-w-5xl">
        {tab === "donors" && (
          <>
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

            {visibleDonations.length === 0 ? (
              <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
                <Heart className="w-8 h-8 mx-auto mb-3" style={{ color: accent }} />
                <p className="text-gray-700 font-medium">Be the first to donate</p>
                <p className="text-gray-500 text-sm mt-1">Your gift kicks off this campaign.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {visibleDonations.map((d) => (
                  <DonorCard key={d.id} d={d} accent={accent} />
                ))}
              </div>
            )}

            {filteredDonations.length > 10 && (
              <div className="text-center mt-8">
                <button
                  type="button"
                  onClick={() => setShowAllDonors((v) => !v)}
                  className="text-sm font-semibold uppercase tracking-[0.18em] underline"
                  style={{ color: accent }}
                >
                  {showAllDonors ? "Show Less" : "See More"}
                </button>
              </div>
            )}
          </>
        )}

        {tab === "matchers" && <MatchersPanel matchers={matchers} accent={accent} />}
        {tab === "about" && <AboutPanel campaign={campaign} accent={accent} />}
        {tab === "teams" && <TeamsPanel teams={teams} accent={accent} onDonate={openWithTeam} />}
        {tab === "communities" && (
          <div className="text-center py-12 text-gray-500 text-sm">No communities yet.</div>
        )}
      </section>

      {/* ============ BOTTOM SHARE BAND ============ */}
      <section className="border-t border-gray-100 bg-white py-10">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 mb-4">
            <Share2 className="w-4 h-4" /> Share this campaign
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <ShareBtn href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} label="Facebook" Icon={Facebook} accent={accent} />
            <ShareBtn href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} label="X" Icon={Twitter} accent={accent} />
            <ShareBtn href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} label="WhatsApp" Icon={MessageCircle} accent={accent} />
            <ShareBtn href={`mailto:?subject=${encodeURIComponent(campaign.title)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`} label="Email" Icon={Mail} accent={accent} />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-md text-sm font-medium hover:border-gray-400 transition"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-6 max-w-xl mx-auto">
            {campaign.tax_deductible_note || "JRE is a 501(c)(3) nonprofit. All donations are tax-deductible to the fullest extent permitted by law."}
            {campaign.tax_id ? ` ${campaign.tax_id}.` : ""}
          </p>
        </div>
      </section>

      <Footer />

      <StickyMobileBar accent={accent} pct={pctRaw} total={total} goal={progress.goal_cents} onDonate={openDonate} />

      <DonateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        snapshot={snapshot}
        preselectedTierId={preselectedTier}
        preselectedTeamId={preselectedTeam}
        onDonated={refresh}
      />

      <VideoModal open={videoOpen} url={campaign.video_url} onClose={() => setVideoOpen(false)} />
    </main>
  );
}

// ============ SUBCOMPONENTS ============

/** Charidy-style horizontal countdown: HH | MM | SS with thin vertical dividers, label under each. */
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

  // If days > 0, show D/H/M, otherwise H/M/S — Charidy shows up to 3 segments.
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

/** Charidy-style circular arc progress (thick semi-circle). */
function ArcProgress({ percent, accent }: { percent: number; accent: string }) {
  const size = 140;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = Math.PI * radius; // semicircle circumference
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circ - (circ * clamped) / 100;

  return (
    <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`} className="overflow-visible">
      {/* track */}
      <path
        d={`M ${stroke / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${size / 2}`}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {/* fill */}
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

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "less than a minute ago";
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m} ${m === 1 ? "minute" : "minutes"} ago`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  }
  const d = Math.floor(s / 86400);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function DonorCard({ d, accent }: { d: PublicDonation; accent: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg p-4 flex items-start gap-3 hover:shadow-md transition-shadow">
      <div
        className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-xs flex-shrink-0"
        style={{ background: accent }}
      >
        {initials(d.display_name || "Anonymous")}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-semibold text-gray-900 text-sm truncate">{d.display_name || "Anonymous"}</div>
          <div className="font-bold text-gray-900 tabular-nums text-sm flex-shrink-0">{formatUsd(d.amount_cents)}</div>
        </div>
        {d.message && (
          <div dir="auto" className="text-xs text-gray-600 italic mt-1 line-clamp-2">
            {d.message}
          </div>
        )}
        {d.dedication_name && (
          <div className="text-xs text-gray-600 mt-1">
            {d.dedication_type === "memory" ? "In memory of " : "In honor of "}
            <span className="font-medium">{d.dedication_name}</span>
          </div>
        )}
        <div className="text-xs text-gray-400 mt-1">{timeAgo(d.created_at)}</div>
        {d.team_name && (
          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
            <div>
              with{" "}
              {d.team_slug ? (
                <a href={`#team-${d.team_slug}`} className="underline" style={{ color: accent }}>
                  {d.team_name}
                </a>
              ) : (
                <span className="underline" style={{ color: accent }}>{d.team_name}</span>
              )}
            </div>
            <div className="text-gray-500">
              <span className="font-medium text-gray-700">Donated to:</span>{" "}
              {d.team_slug ? (
                <a href={`#team-${d.team_slug}`} className="underline" style={{ color: accent }}>
                  {d.team_name}
                </a>
              ) : (
                <span className="underline" style={{ color: accent }}>{d.team_name}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchersPanel({ matchers, accent }: { matchers: CampaignMatcher[]; accent: string }) {
  if (matchers.length === 0) {
    return <div className="text-center py-12 text-gray-500 text-sm">No matchers announced yet.</div>;
  }
  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center px-4 py-1 rounded-full text-white text-sm font-bold tracking-wide" style={{ background: accent }}>
          x{Math.max(...matchers.map((m) => Number(m.multiplier)))} CAMPAIGN MATCHERS
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {matchers.map((m) => (
          <div key={m.id} className="bg-white border border-gray-100 rounded-lg p-5 flex items-start gap-4">
            {m.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.logo_url} alt={m.name} className="w-14 h-14 rounded-lg object-contain bg-gray-50" />
            ) : (
              <div className="w-14 h-14 rounded-lg text-white flex items-center justify-center font-bold flex-shrink-0" style={{ background: accent }}>
                {m.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-bold text-gray-900">{m.name}</div>
                <div className="text-sm font-bold tabular-nums" style={{ color: accent }}>
                  {Number(m.multiplier).toFixed(Number(m.multiplier) % 1 === 0 ? 0 : 2)}X
                </div>
              </div>
              {m.cap_cents != null && (
                <div className="text-xs text-gray-500 mt-1">Match cap: {formatUsd(m.cap_cents)}</div>
              )}
              {m.story && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{m.story}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AboutPanel({ campaign, accent }: { campaign: Campaign; accent: string }) {
  return (
    <div className="max-w-3xl mx-auto">
      {campaign.tagline && (
        <p className="text-lg text-gray-700 mb-6 italic text-center">{campaign.tagline}</p>
      )}
      {campaign.story_md ? (
        <div className="prose prose-lg max-w-none text-gray-700 whitespace-pre-line leading-relaxed">
          {campaign.story_md}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">Story coming soon.</p>
      )}

      {campaign.faq && campaign.faq.length > 0 && (
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">Questions?</h3>
          <div className="space-y-2">
            {campaign.faq.map((entry, i) => (
              <details key={i} className="border border-gray-200 rounded-lg overflow-hidden bg-white group">
                <summary className="cursor-pointer px-5 py-4 font-semibold text-gray-900 hover:bg-gray-50 flex items-center justify-between">
                  <span>{entry.q}</span>
                  <span className="text-xl transition-transform group-open:rotate-45" style={{ color: accent }}>+</span>
                </summary>
                <div className="px-5 pb-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{entry.a}</div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamsPanel({
  teams, accent, onDonate,
}: {
  teams: CampaignTeamWithProgress[];
  accent: string;
  onDonate: (teamId: string) => void;
}) {
  if (teams.length === 0) {
    return <div className="text-center py-12 text-gray-500 text-sm">No teams yet.</div>;
  }
  const sorted = [...teams].sort((a, b) => b.raised_cents - a.raised_cents);
  return (
    <div className="space-y-3">
      {sorted.map((t, i) => {
        const pct = t.goal_cents && t.goal_cents > 0 ? Math.min(100, (t.raised_cents / t.goal_cents) * 100) : 0;
        return (
          <div key={t.id} className="bg-white border border-gray-100 rounded-lg p-5">
            <div className="flex items-center gap-4 mb-3">
              <div className="text-lg font-bold text-gray-300 tabular-nums w-6 text-center">{i + 1}</div>
              {t.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatar_url} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm" style={{ background: accent }}>
                  {t.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                {t.leader_name && <div className="text-xs text-gray-500">Led by {t.leader_name}</div>}
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900 tabular-nums text-sm">{formatUsd(t.raised_cents)}</div>
                {t.goal_cents ? (
                  <div className="text-xs text-gray-500 tabular-nums">of {formatUsd(t.goal_cents)}</div>
                ) : null}
              </div>
            </div>
            {t.goal_cents ? (
              <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: accent }} />
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{t.donor_count} {t.donor_count === 1 ? "donor" : "donors"}</span>
              <button
                type="button"
                onClick={() => onDonate(t.id)}
                className="font-semibold uppercase tracking-wide hover:underline"
                style={{ color: accent }}
              >
                Give to this team →
              </button>
            </div>
          </div>
        );
      })}
    </div>
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

function StickyMobileBar({
  accent, pct, total, goal, onDonate,
}: {
  accent: string; pct: number; total: number; goal: number; onDonate: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between text-xs mb-1.5 tabular-nums">
          <span className="text-gray-500">{formatUsd(total)} of {formatUsd(goal)}</span>
          <span className="font-bold" style={{ color: accent }}>{pct.toFixed(0)}%</span>
        </div>
        <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: accent }} />
        </div>
        <button
          type="button"
          onClick={onDonate}
          className="w-full py-3 text-white font-bold rounded-md text-sm uppercase tracking-[0.1em] shadow-lg"
          style={{ background: accent }}
        >
          Donate Now
        </button>
      </div>
    </div>
  );
}
