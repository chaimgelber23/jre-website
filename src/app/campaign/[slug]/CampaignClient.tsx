"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  motion,
  AnimatePresence,
  useInView,
  useReducedMotion,
  animate,
  type Variants,
} from "framer-motion";
import confetti from "canvas-confetti";
import {
  Search, Share2, Mail,
  MessageCircle, Copy, Check,
} from "lucide-react";
import Footer from "@/components/layout/Footer";
import { formatUsd, getActiveMatcher, getTimeRemaining } from "@/lib/campaign";
import type { CampaignSnapshot, CampaignTeamWithProgress, CampaignMatcher, Campaign, CampaignTier } from "@/types/campaign";
import DonateModal from "./DonateModal";
import DonorCard from "./DonorCard";
import type { RecentPhoto } from "./page";

interface Props {
  snapshot: CampaignSnapshot;
  recentPhotos?: RecentPhoto[];
  orgName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

type Tab = "donors" | "matchers" | "about" | "teams" | "communities";
type Sort = "newest" | "oldest" | "highest";

const DEFAULT_ACCENT = "#DA98B1";

// ============ MOTION UTILITIES ============

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Scroll-triggered reveal. Honors prefers-reduced-motion. */
function Reveal({
  children, delay = 0, y = 22, className, as: As = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section";
}) {
  const reduced = useReducedMotion();
  const MotionTag = As === "section" ? motion.section : motion.div;
  return (
    <MotionTag
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay }}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

/** Animated integer that counts up from 0 → target when it enters the viewport. */
function CountUp({
  value, format = (n) => Math.round(n).toLocaleString(), className, durationMs = 1400,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  durationMs?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState<number>(reduced ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) { setDisplay(value); return; }
    const controls = animate(0, value, {
      duration: durationMs / 1000,
      ease: EASE_OUT_EXPO,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, durationMs, reduced]);

  return <span ref={ref} className={className} aria-live="polite">{format(display)}</span>;
}

/** Standard stagger parent for card grids. */
const STAGGER_PARENT: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const STAGGER_CHILD: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT_EXPO } },
};

/** Fire confetti sourced from the theme color. */
function fireConfetti(accent: string, intensity: "small" | "big" = "big") {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const colors = [accent, "#ffffff", shiftColor(accent, 30), shiftColor(accent, -30)];
  const count = intensity === "big" ? 120 : 60;
  confetti({ particleCount: count, spread: 80, origin: { y: 0.6 }, colors, scalar: 0.9 });
  if (intensity === "big") {
    setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors }), 200);
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors }), 300);
  }
}

function shiftColor(hex: string, percent: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + Math.round(255 * percent / 100)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * percent / 100)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Parse a hex color like "#DA98B1" → "218, 152, 177". Used for box-shadow glow alphas. */
function hexToRgb(hex: string): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return "0, 0, 0";
  const num = parseInt(m[1], 16);
  return `${num >> 16}, ${(num >> 8) & 0xff}, ${num & 0xff}`;
}

const HERO_PARENT: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const HERO_CHILD: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
};

export default function CampaignClient({
  snapshot: initial,
  recentPhotos = [],
  orgName = "Jewish Renaissance Experience",
  contactEmail = "office@thejre.org",
  contactPhone = "(914) 359-2200",
}: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [preselectedTier, setPreselectedTier] = useState<string | null>(null);
  const [preselectedTeam, setPreselectedTeam] = useState<string | null>(null);
  const [preselectedAmount, setPreselectedAmount] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("donors");
  const [sortBy, setSortBy] = useState<Sort>("newest");
  const [search, setSearch] = useState("");
  const [showAllDonors, setShowAllDonors] = useState(false);
  const [copied, setCopied] = useState(false);

  // live inline amount input (drives the big $ display and the modal preload)
  const [inlineAmount, setInlineAmount] = useState<string>("");

  const { campaign, tiers, matchers, teams, progress, recent_donations } = snapshot;
  const accent = campaign.theme_color || DEFAULT_ACCENT;

  // Preview override: `?banner=/path/to.jpg` lets us see what a new banner will look
  // like without touching the DB. Strips on navigation; never applied server-side.
  const [previewBanner, setPreviewBanner] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("banner");
    if (p) setPreviewBanner(p);
  }, []);
  const heroImageUrl = previewBanner || campaign.hero_image_url;
  const activeMatcher = getActiveMatcher(matchers);
  const multiplier = activeMatcher ? Number(activeMatcher.multiplier) : 1;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaign/${campaign.slug}/progress`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.snapshot) setSnapshot(data.snapshot);
    } catch { /* best-effort */ }
  }, [campaign.slug]);

  // Poll the progress snapshot, but pause while the tab is hidden so a sea of
  // backgrounded tabs during the campaign rush doesn't stack DB load. The
  // server-side cache already collapses repeated polls to one Supabase fan-out
  // per ~10s, so the foreground 30s cadence still feels live.
  useEffect(() => {
    if (typeof document === "undefined") return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id !== null) return;
      id = setInterval(refresh, 30_000);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        refresh();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const totalRaisedCents = progress.raised_cents + progress.matched_cents;
  const pctRaw = progress.goal_cents > 0 ? (totalRaisedCents / progress.goal_cents) * 100 : 0;

  // Milestone confetti: track crossings live, skip the initial mount so the
  // page doesn't explode with confetti just for loading at 40%.
  const milestonesSeenRef = useRef<Set<number> | null>(null);
  useEffect(() => {
    const thresholds = [25, 50, 75, 100];
    if (milestonesSeenRef.current === null) {
      milestonesSeenRef.current = new Set(thresholds.filter((t) => pctRaw >= t));
      return;
    }
    for (const t of thresholds) {
      if (pctRaw >= t && !milestonesSeenRef.current.has(t)) {
        milestonesSeenRef.current.add(t);
        fireConfetti(accent, t === 100 ? "big" : "small");
      }
    }
  }, [pctRaw, accent]);

  const inlineDollars = parseInt(inlineAmount, 10);
  const inlineCents = Number.isFinite(inlineDollars) && inlineDollars > 0 ? inlineDollars * 100 : 0;
  const inlineMatchedCents = Math.round(inlineCents * Math.max(0, multiplier - 1));
  const inlineTotalCents = inlineCents + inlineMatchedCents;

  const openDonate = (opts?: { tierId?: string; teamId?: string; amount?: number }) => {
    setPreselectedTier(opts?.tierId ?? null);
    setPreselectedTeam(opts?.teamId ?? null);
    setPreselectedAmount(opts?.amount ?? null);
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
      const at = new Date(a.created_at).getTime();
      const bt = new Date(b.created_at).getTime();
      if (sortBy === "highest") {
        if (b.amount_cents !== a.amount_cents) return b.amount_cents - a.amount_cents;
        return bt - at;
      }
      if (sortBy === "oldest") return at - bt;
      return bt - at; // newest (default)
    });
  const visibleDonations = showAllDonors ? filteredDonations : filteredDonations.slice(0, 24);

  const counts: Record<Tab, number | null> = {
    donors: progress.donor_count,
    matchers: matchers.length,
    about: null,
    teams: teams.length,
    communities: 0,
  };

  return (
    <main className="min-h-screen bg-white">
      {heroImageUrl && (
        <section className="w-full bg-black">
          <img
            src={heroImageUrl}
            alt={campaign.title}
            className="block w-full max-h-[70vh] object-contain mx-auto"
          />
        </section>
      )}
      {/* ============ TITLE BAND ============ */}
      <section className="text-white relative overflow-hidden" style={{ background: accent }}>
        <motion.div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.22 }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35) 0, rgba(255,255,255,0) 40%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.25) 0, rgba(0,0,0,0) 40%)",
          }}
        />
        <motion.div
          className="relative container mx-auto px-6 pt-28 pb-14 md:pt-40 md:pb-20 text-center"
          variants={HERO_PARENT}
          initial="hidden"
          animate="show"
        >
          <motion.div
            variants={HERO_CHILD}
            className="text-[11px] md:text-xs uppercase tracking-[0.3em] text-white/80 mb-3"
          >
            {orgName}
          </motion.div>
          <motion.h1
            variants={HERO_CHILD}
            className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl mx-auto text-white"
          >
            {campaign.title}
          </motion.h1>
          {campaign.tagline && (
            <motion.div variants={HERO_CHILD} className="mt-7 max-w-2xl mx-auto space-y-3">
              <TaglineLines tagline={campaign.tagline} />
            </motion.div>
          )}
          <motion.div
            variants={HERO_CHILD}
            className="mt-5 text-[11px] uppercase tracking-[0.2em] text-white/60 tabular-nums"
          >
            {formatDateRange(campaign.start_at, campaign.end_at)}
          </motion.div>
          <motion.button
            variants={HERO_CHILD}
            type="button"
            onClick={() => setTab("about")}
            whileHover={{ scale: 1.04, backgroundColor: "rgba(255,255,255,0.22)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="mt-6 inline-flex items-center px-5 py-2 rounded-md bg-white/15 border border-white/40 text-xs font-medium uppercase tracking-wide"
          >
            About Campaign
          </motion.button>
        </motion.div>
      </section>

      {/* ============ HORIZONTAL SPONSOR TIER STRIP (Charidy-style) ============ */}
      {tiers.length > 0 && (
        <TierStrip tiers={tiers} accent={accent} onPickTier={(t) => openDonate({ tierId: t.id, amount: Math.round(t.amount_cents / 100) })} />
      )}

      {/* ============ HERO PROGRESS BLOCK — 2-col: $ raised | clock ============ */}
      <section className="pt-10 md:pt-14 pb-8 bg-white">
        <div className="container mx-auto px-6">
          {activeMatcher && (
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.18em] text-white" style={{ background: accent }}>
                <span className="tabular-nums">x{multiplier}</span>
                <span>{activeMatcher.name ? `${activeMatcher.name} Match` : "Campaign Match"}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-10 md:gap-6 max-w-5xl mx-auto">
            {/* LEFT — pencil squiggle + big raised amount */}
            <div className="text-center md:border-r md:border-gray-100 md:pr-6 md:py-4">
              <PencilSquiggle accent={accent} />
              <div className="mt-1 text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 tabular-nums leading-none">
                <CountUp
                  value={totalRaisedCents / 100}
                  durationMs={1600}
                  format={(n) => formatUsd(Math.round(n) * 100)}
                />
              </div>
              <div className="mt-3 text-[12px] uppercase tracking-[0.15em] text-gray-500">
                <CountUp
                  value={pctRaw}
                  durationMs={1400}
                  format={(n) => `${n.toFixed(0)}%`}
                  className="font-bold text-gray-900 tabular-nums"
                />
                <span className="mx-1.5 text-gray-400">of</span>
                <span className="font-semibold text-gray-700 tabular-nums normal-case">{formatUsd(progress.goal_cents)}</span>
                <span className="ml-1.5 text-gray-400">goal</span>
              </div>
              <ProgressBar pctRaw={pctRaw} accent={accent} />
            </div>

            {/* RIGHT — clock ring + countdown digits */}
            <div className="flex flex-col items-center md:pl-6 md:py-4">
              <ClockRing startAt={campaign.start_at} endAt={campaign.end_at} accent={accent} />
              <div className="mt-4">
                <CountdownStrip startAt={campaign.start_at} endAt={campaign.end_at} accent={accent} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ INLINE DONATION ROW: SHARE | $ INPUT | DONATE ============ */}
      <section className="pb-12 md:pb-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center text-[11px] uppercase tracking-[0.22em] text-gray-500 mb-6">
            Start Your Donation
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-stretch gap-3 md:gap-4">
            <motion.button
              type="button"
              onClick={copyLink}
              whileHover={{ scale: 1.03, borderColor: "#9ca3af" }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
              className="hidden md:inline-flex items-center justify-center gap-2 px-5 py-3 border-2 border-gray-200 rounded-md text-xs font-semibold uppercase tracking-[0.1em] text-gray-700"
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? "Copied" : "Share"}
            </motion.button>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl md:text-3xl font-bold text-gray-400">$</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={inlineAmount}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                  setInlineAmount(digits);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inlineDollars > 0) {
                    openDonate({ amount: inlineDollars });
                  }
                }}
                placeholder="0"
                aria-label="Donation amount in dollars"
                className="w-full h-full pl-12 pr-4 py-3 text-2xl md:text-3xl font-bold text-gray-900 tabular-nums border border-gray-200 rounded-md focus:outline-none bg-white text-center"
              />
            </div>

            <motion.button
              type="button"
              onClick={() => openDonate(inlineDollars > 0 ? { amount: inlineDollars } : undefined)}
              whileHover={{
                y: -2,
                scale: 1.03,
                boxShadow: `0 18px 40px -12px rgba(${hexToRgb(accent)}, 0.55)`,
              }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="px-10 py-4 text-white font-bold rounded-md text-sm uppercase tracking-[0.1em] shadow-lg whitespace-nowrap"
              style={{ background: accent }}
            >
              Donate
            </motion.button>
          </div>

          <p className="text-center text-xs text-gray-500 mt-4 tabular-nums">
            {orgName} gets:{" "}
            <span className="font-semibold">(x{multiplier})</span>
            <span className="mx-1.5">=</span>
            <span className="font-bold text-gray-900">{formatUsd(inlineTotalCents)}</span>
          </p>
        </div>
      </section>

      {/* ============ CONTACT STRIP ============ */}
      <Reveal as="section" className="border-t border-b border-gray-100 py-6 bg-white">
        <div className="container mx-auto px-6 text-center text-sm text-gray-500 space-y-1.5">
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
      </Reveal>

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
                      <CountUp
                        value={count}
                        durationMs={1200}
                        className="text-xl font-bold tabular-nums leading-none"
                      />
                      <span className="text-[11px] uppercase tracking-[0.15em] mt-1.5 opacity-70">{t.label}</span>
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
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
          >
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
                    <span className="text-gray-400 uppercase tracking-wide text-xs">Sort By:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as Sort)}
                      className="px-3 py-2 border border-gray-200 rounded-md bg-white focus:outline-none focus:border-gray-400 text-sm"
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="highest">Highest</option>
                    </select>
                  </div>
                </div>

                {visibleDonations.length === 0 ? (
                  <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
                    <p className="text-gray-700 font-medium">Be the first to donate</p>
                    <p className="text-gray-500 text-sm mt-1">Your gift kicks off this campaign.</p>
                  </div>
                ) : (
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 auto-rows-fr"
                    variants={STAGGER_PARENT}
                    initial="hidden"
                    animate="show"
                  >
                    {visibleDonations.map((d) => (
                      <motion.div key={d.id} variants={STAGGER_CHILD} whileHover={{ y: -2 }} transition={{ duration: 0.2 }} className="h-full">
                        <DonorCard d={d} accent={accent} />
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {filteredDonations.length > 24 && (
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
            {tab === "teams" && <TeamsPanel teams={teams} campaignSlug={campaign.slug} accent={accent} onDonate={(teamId) => openDonate({ teamId })} />}
            {tab === "communities" && (
              <div className="text-center py-12 text-gray-400 text-sm">No communities yet.</div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>


      {/* ============ EVENT PHOTO CAROUSEL (below donor wall) ============ */}
      {recentPhotos.length > 0 && (
        <section className="bg-white py-14 md:py-20 border-t border-gray-100">
          <div className="container mx-auto px-6">
            <Reveal className="text-center mb-8">
              <div className="text-[11px] uppercase tracking-[0.22em] text-gray-400 mb-2">From Our Community</div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">This is what you&apos;re powering</h2>
            </Reveal>
            <Reveal delay={0.08}>
              <PhotoCarousel photos={recentPhotos} accent={accent} />
            </Reveal>
          </div>
        </section>
      )}

      {/* ============ VIDEO STORY (below donor wall) ============ */}
      {campaign.video_url && (
        <section className="bg-gray-50 border-t border-gray-100 py-14 md:py-20">
          <div className="container mx-auto px-6">
            <Reveal className="text-center mb-8">
              <div className="text-[11px] uppercase tracking-[0.22em] text-gray-400 mb-2">Watch</div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Why JRE is On Fire</h2>
              <p className="text-sm text-gray-500 mt-2 max-w-lg mx-auto">Hear it straight from our community — classes, events, and experiences that are changing lives across Westchester.</p>
            </Reveal>
            <Reveal delay={0.08}>
              <InlineVideo url={campaign.video_url} accent={accent} campaignTitle={campaign.title} />
            </Reveal>
          </div>
        </section>
      )}

      {/* ============ BOTTOM SHARE BAND ============ */}
      <Reveal as="section" className="border-t border-gray-100 bg-white py-10">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-700 mb-4">
            <Share2 className="w-4 h-4" /> Share this campaign
          </div>
          <motion.div
            className="flex items-center justify-center gap-2 flex-wrap"
            variants={STAGGER_PARENT}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
          >
            <motion.div variants={STAGGER_CHILD}>
              <ShareBtn href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} label="WhatsApp" Icon={MessageCircle} accent={accent} />
            </motion.div>
            <motion.div variants={STAGGER_CHILD}>
              <ShareBtn href={`mailto:?subject=${encodeURIComponent(campaign.title)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`} label="Email" Icon={Mail} accent={accent} />
            </motion.div>
            <motion.button
              variants={STAGGER_CHILD}
              type="button"
              onClick={copyLink}
              whileHover={{ y: -2, scale: 1.04, borderColor: "#9ca3af" }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-md text-sm font-medium"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy link"}
            </motion.button>
          </motion.div>
          <p className="text-xs text-gray-400 mt-6 max-w-xl mx-auto">
            {campaign.tax_deductible_note || "JRE is a 501(c)(3) nonprofit. All donations are tax-deductible to the fullest extent permitted by law."}
            {campaign.tax_id ? ` ${campaign.tax_id}.` : ""}
          </p>
        </div>
      </Reveal>

      <Footer />

      <StickyMobileBar accent={accent} pct={pctRaw} total={totalRaisedCents} goal={progress.goal_cents} onDonate={() => openDonate(inlineDollars > 0 ? { amount: inlineDollars } : undefined)} />

      <DonateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        snapshot={snapshot}
        preselectedTierId={preselectedTier}
        preselectedTeamId={preselectedTeam}
        preselectedAmountDollars={preselectedAmount}
        onDonated={refresh}
      />

    </main>
  );
}

// ============ SUBCOMPONENTS ============

/**
 * 3-up sliding photo strip. On desktop it shows three photos side-by-side
 * inside a clipped viewport; the arrows (and the 5 s auto-advance) shift the
 * whole row by exactly one card width, so photos glide past one at a time.
 * Mobile falls back to 1 photo visible.
 *
 * Photos loop infinitely via modular index + % total, so there's no awkward
 * "end of rail" state.
 */
function PhotoCarousel({ photos, accent }: { photos: RecentPhoto[]; accent: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = photos.length;

  useEffect(() => {
    if (paused || total < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % total), 5000);
    return () => clearInterval(id);
  }, [paused, total]);

  if (total === 0) return null;
  const prev = () => setI((v) => (v - 1 + total) % total);
  const next = () => setI((v) => (v + 1) % total);

  // Render photos looped 3× so no matter where we scroll, there's always
  // content to the right of the visible window (prevents empty-space flash).
  const loop = [...photos, ...photos, ...photos];

  return (
    <div
      className="relative max-w-5xl mx-auto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-xl">
        <motion.div
          className="flex"
          animate={{ x: `-${(i + total) * (100 / loop.length)}%` }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          style={{ width: `${(loop.length * 100) / 3}%` }}
        >
          {loop.map((p, idx) => (
            <div
              key={`${p.id}-${idx}`}
              className="flex-shrink-0 px-2"
              style={{ width: `${100 / loop.length}%` }}
            >
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 shadow-md group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url}
                  alt={p.title || p.category || "JRE event"}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {p.category && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3">
                    <div className="text-white text-xs font-semibold leading-tight drop-shadow">{p.category}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-0 md:-left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white shadow-lg hover:scale-110 transition flex items-center justify-center z-10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 text-gray-800"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-0 md:-right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white shadow-lg hover:scale-110 transition flex items-center justify-center z-10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5 text-gray-800"><polyline points="9 18 15 12 9 6" /></svg>
          </button>

          <div className="mt-5 flex items-center justify-center gap-1.5">
            {photos.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`Go to photo ${idx + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: idx === i ? 22 : 6,
                  background: idx === i ? accent : "#d1d5db",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Campaign video with a text-based poster — no blurry YouTube auto-thumbnail.
 * Uses the same design language as the `/events` placeholder (corner brackets,
 * dot-pattern texture, diagonal hatch, "The JRE Presents" eyebrow) themed to
 * the campaign's accent color. Click swaps the poster for the autoplaying embed.
 */
function InlineVideo({ url, accent, campaignTitle }: { url: string; accent: string; campaignTitle: string }) {
  const [playing, setPlaying] = useState(false);
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  const ytId = yt?.[1] ?? null;
  const embedSrc = ytId
    ? `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
    : vm
    ? `https://player.vimeo.com/video/${vm[1]}?autoplay=1`
    : null;
  const accentRgb = hexToRgb(accent);

  return (
    <div className="relative max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden shadow-2xl bg-black">
      {playing && embedSrc ? (
        <iframe
          src={embedSrc}
          title="Campaign video"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      ) : playing ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={url} controls autoPlay className="absolute inset-0 w-full h-full bg-black" />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play campaign video"
          className="group absolute inset-0 w-full h-full overflow-hidden"
          style={{
            background: `linear-gradient(160deg, #ffffff 0%, #fafafa 45%, rgba(${accentRgb}, 0.06) 100%)`,
          }}
        >
          {/* Very subtle accent glow top-right */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 85% 12%, rgba(${accentRgb}, 0.18) 0%, transparent 45%)`,
            }}
          />
          {/* Delicate top accent rule */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-24 rounded-b-full"
            style={{ background: accent }}
          />

          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-8">
            <div className="text-[10px] md:text-[11px] font-semibold tracking-[0.3em] uppercase mb-5" style={{ color: accent }}>
              Watch
            </div>
            <h3 className="text-2xl md:text-4xl font-semibold text-gray-900 leading-tight max-w-xl tracking-tight">
              {campaignTitle}
            </h3>
            <p className="mt-3 text-sm md:text-base text-gray-500 max-w-md">
              Press play for the story.
            </p>
          </div>

          {/* Centered play button — orange pill with soft ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
              style={{
                background: accent,
                boxShadow: `0 12px 36px rgba(${accentRgb}, 0.35), 0 0 0 10px rgba(${accentRgb}, 0.08)`,
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 md:w-11 md:h-11 text-white ml-1"><path d="M8 5v14l11-7L8 5z" /></svg>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

/**
 * Horizontal Sponsor Tier Strip — premium Charidy-style row of tier cards.
 * Mobile-first: snap-x scroll with edge peek + fade hints so the user
 * perceives the row as scrollable, not clipped. Desktop: centered row.
 * Featured tier gets a raised, accent-tinted card with a flame pulse.
 */
function TierStrip({
  tiers, accent, onPickTier,
}: {
  tiers: CampaignTier[];
  accent: string;
  onPickTier: (t: CampaignTier) => void;
}) {
  const reduced = useReducedMotion();
  const accentRgb = useMemo(() => hexToRgb(accent), [accent]);
  return (
    <section className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
      <div className="container mx-auto px-4 pt-12 pb-8 md:pt-16 md:pb-10">
        <div className="text-center mb-5 md:mb-6">
          <div className="text-[10px] md:text-[11px] uppercase tracking-[0.22em] text-gray-500 font-semibold">
            Pick a level
          </div>
        </div>

        {/* Edge fades hint that the row scrolls on mobile */}
        <div className="relative">
          <div
            aria-hidden
            className="md:hidden pointer-events-none absolute inset-y-0 left-0 w-6 z-10 bg-gradient-to-r from-gray-50 to-transparent"
          />
          <div
            aria-hidden
            className="md:hidden pointer-events-none absolute inset-y-0 right-0 w-6 z-10 bg-gradient-to-l from-gray-50 to-transparent"
          />

          <motion.div
            className="flex items-stretch gap-3 md:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory md:snap-none md:justify-center px-3 md:px-0 py-2 md:py-3"
            variants={STAGGER_PARENT}
            initial={reduced ? undefined : "hidden"}
            whileInView={reduced ? undefined : "show"}
            viewport={{ once: true, margin: "-60px" }}
          >
            {tiers.map((t) => {
              const featured = t.is_featured;
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  onClick={() => onPickTier(t)}
                  variants={STAGGER_CHILD}
                  whileHover={reduced ? undefined : {
                    y: -4,
                    scale: featured ? 1.06 : 1.04,
                    boxShadow: featured
                      ? `0 20px 40px -14px rgba(${accentRgb}, 0.55)`
                      : `0 14px 30px -12px rgba(${accentRgb}, 0.4)`,
                  }}
                  whileTap={reduced ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
                  className={[
                    "group relative flex-shrink-0 snap-center rounded-2xl text-center",
                    "min-w-[128px] sm:min-w-[140px] md:min-w-[156px] lg:min-w-[168px]",
                    "px-4 md:px-5",
                    featured ? "py-5 md:py-6" : "py-4 md:py-5",
                    "active:scale-[0.98] transition-[transform,box-shadow]",
                    featured
                      ? "border-2 text-white shadow-lg"
                      : "bg-white border border-gray-200 text-gray-900 hover:border-gray-300",
                  ].join(" ")}
                  style={featured ? {
                    background: `linear-gradient(160deg, ${accent} 0%, rgba(${accentRgb}, 0.92) 100%)`,
                    borderColor: accent,
                    boxShadow: `0 14px 30px -12px rgba(${accentRgb}, 0.55)`,
                  } : undefined}
                  aria-label={`Pick ${formatUsd(t.amount_cents)}${t.label ? ` — ${t.label}` : ""}`}
                >
                  {featured && (
                    <motion.span
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[10px] md:text-[11px] font-extrabold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-white text-gray-900 shadow-md ring-1 ring-black/5 whitespace-nowrap"
                      animate={reduced ? undefined : { scale: [1, 1.05, 1] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <span>Popular</span>
                    </motion.span>
                  )}

                  <div
                    className={[
                      "font-extrabold tabular-nums leading-none",
                      featured ? "text-2xl md:text-3xl" : "text-xl md:text-2xl",
                    ].join(" ")}
                  >
                    {formatUsd(t.amount_cents)}
                  </div>

                  {t.label && (
                    <div
                      className={[
                        "uppercase tracking-[0.12em] font-bold leading-tight mt-2",
                        "text-[11px] md:text-[12px]",
                        featured ? "text-white/90" : "text-gray-500",
                      ].join(" ")}
                    >
                      {t.label}
                    </div>
                  )}

                  {t.hebrew_value && (
                    <div
                      dir="rtl"
                      className={[
                        "mt-2 pt-2 border-t text-sm font-semibold tabular-nums",
                        featured ? "border-white/25 text-white" : "border-gray-100",
                      ].join(" ")}
                      style={featured ? undefined : { color: accent }}
                    >
                      {t.hebrew_value}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

type ClockState = "pre" | "live" | "ended";

/**
 * Circular clock ring scaled to the full campaign window. Full ring = total
 * duration (start_at → end_at), so a 2-day campaign is a 2-day clock and a
 * 36-hour campaign is a 36-hour clock. Auto-switches between three states:
 *   - "pre"   → campaign hasn't started. Label: STARTS IN. Ring is empty.
 *   - "live"  → currently running. Label: TIME REMAINING. Arc fills + running
 *               dot tracks the elapsed fraction; re-renders every second.
 *   - "ended" → past end_at. Label: CAMPAIGN ENDED. Ring is full.
 */
/**
 * "Jun 7 – 8, 2026" style formatter that collapses same-month ranges and
 * only shows the year when it'd be ambiguous (campaign spans a year boundary
 * or isn't the current year).
 */
function formatDateRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const sameYear = s.getFullYear() === e.getFullYear();
  const monthShort = (d: Date) => d.toLocaleString("en-US", { month: "short" });
  const y = s.getFullYear();
  if (sameDay) return `${monthShort(s)} ${s.getDate()}, ${y}`;
  if (sameMonth) return `${monthShort(s)} ${s.getDate()}–${e.getDate()}, ${y}`;
  if (sameYear) return `${monthShort(s)} ${s.getDate()} – ${monthShort(e)} ${e.getDate()}, ${y}`;
  return `${monthShort(s)} ${s.getDate()}, ${y} – ${monthShort(e)} ${e.getDate()}, ${e.getFullYear()}`;
}

/**
 * Render the tagline as three visual lines: opening sentence, the middle
 * staccato "Torah. Events. Teachers. Brisket." burst, and a loud closing "All
 * On Fire." If the tagline doesn't match that shape, fall back to a single line.
 */
function TaglineLines({ tagline }: { tagline: string }) {
  const m = tagline.match(/^(.+?\.)\s+(.+?\.)\s+(All\s+On\s+Fire\.?)$/i);
  if (!m) {
    return <p className="text-sm md:text-lg text-white/80 leading-relaxed">{tagline}</p>;
  }
  return (
    <>
      <p className="text-base md:text-xl text-white/90 leading-snug">{m[1]}</p>
      <p className="text-sm md:text-base text-white/75 tracking-wide italic">{m[2]}</p>
      <p className="pt-2 text-2xl md:text-4xl font-extrabold text-white tracking-tight">{m[3]}</p>
    </>
  );
}

function ClockRing({ startAt, endAt, accent }: { startAt: string; endAt: string; accent: string }) {
  const [elapsedPct, setElapsedPct] = useState(0);
  const [state, setState] = useState<ClockState>("pre");

  useEffect(() => {
    const tick = () => {
      const s = new Date(startAt).getTime();
      const e = new Date(endAt).getTime();
      const now = Date.now();
      if (now >= e) { setElapsedPct(100); setState("ended"); return; }
      if (now < s) { setElapsedPct(0); setState("pre"); return; }
      const total = Math.max(1, e - s);
      const used = Math.max(0, now - s);
      setElapsedPct(Math.min(100, (used / total) * 100));
      setState("live");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startAt, endAt]);

  const size = 200;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (c * elapsedPct) / 100;

  // dot position along the arc — starts at 12 o'clock, rotates clockwise.
  const angle = (elapsedPct / 100) * 2 * Math.PI - Math.PI / 2;
  const cx = size / 2 + r * Math.cos(angle);
  const cy = size / 2 + r * Math.sin(angle);

  const label =
    state === "ended" ? (<>Campaign<br />ended</>) :
    state === "pre"   ? (<>Starts<br />in</>) :
                        (<>Time<br />Remaining</>);

  const reduced = useReducedMotion();
  return (
    <motion.div
      className="relative"
      style={{ width: size, height: size }}
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay: 0.2 }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduced ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: EASE_OUT_EXPO, delay: 0.3 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {state === "live" && (
          <motion.circle
            initial={reduced ? false : { opacity: 0 }}
            animate={{ cx, cy, opacity: 1 }}
            transition={{
              cx: { duration: 1, ease: "linear" },
              cy: { duration: 1, ease: "linear" },
              opacity: { duration: 0.4, delay: 1.4 },
            }}
            r={stroke / 2 + 2}
            fill={accent}
            stroke="white"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* decorative push-pin at 12 o'clock */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ top: -10 }}
        aria-hidden="true"
      >
        <div className="w-3 h-3 rounded-full" style={{ background: "#374151" }} />
        <div className="w-px h-2.5" style={{ background: "#374151" }} />
      </div>

      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-gray-800 leading-tight">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Hand-drawn style pencil squiggle — the Charidy signature flourish that sits
 * above the big raised-dollar amount. Subtle, accent-colored, slightly rotated
 * for a sketched feel.
 */
function PencilSquiggle({ accent }: { accent: string }) {
  const reduced = useReducedMotion();
  return (
    <svg
      width="120"
      height="22"
      viewBox="0 0 120 22"
      aria-hidden="true"
      className="mx-auto"
      style={{ color: accent }}
    >
      <motion.path
        d="M3 14 C 18 3, 34 3, 48 12 S 78 22, 92 10 S 114 4, 117 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: EASE_OUT_EXPO, delay: 0.3 }}
      />
      <motion.path
        d="M113 5 L119 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 1.4 }}
      />
    </svg>
  );
}

/**
 * Progress bar with animated fill, subtle shimmer sweep, and a brief scale pulse
 * when the bar crosses 25/50/75/100% milestones during the session.
 */
function ProgressBar({ pctRaw, accent }: { pctRaw: number; accent: string }) {
  const reduced = useReducedMotion();

  const thresholds = [25, 50, 75, 100];
  const [initialCrossed] = useState(() => thresholds.filter((t) => pctRaw >= t).length);
  const crossedNow = thresholds.filter((t) => pctRaw >= t).length;
  const pulseKey = Math.max(0, crossedNow - initialCrossed);

  const pct = Math.min(100, pctRaw);
  return (
    <motion.div
      key={pulseKey}
      className="max-w-xs mx-auto mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden relative"
      animate={pulseKey > 0 && !reduced ? { scaleY: [1, 1.6, 1] } : undefined}
      transition={{ duration: 0.45, ease: "easeOut" }}
      style={{ originY: 0.5 }}
    >
      <motion.div
        initial={reduced ? { width: `${pct}%` } : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.4, ease: EASE_OUT_EXPO }}
        className="h-full rounded-full relative"
        style={{ background: accent }}
      >
        {!reduced && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-y-0 w-1/3 pointer-events-none"
            initial={{ x: "-100%" }}
            animate={{ x: "300%" }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

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
        <div className="text-xl font-bold text-gray-900">Thank you!</div>
        <div className="text-xs text-gray-500 mt-1">Campaign ended</div>
      </div>
    );
  }

  // Pick the unit scale automatically so it "feels right" for the remaining
  // window: multi-day → D/H/M, sub-day → H/M/S, last hour → M/S.
  const totalHours = t.days * 24 + t.hours;
  const totalMinutes = totalHours * 60 + t.minutes;
  const segments = t.days > 0
    ? [
        { value: t.days, label: "Days" },
        { value: t.hours, label: "Hours" },
        { value: t.minutes, label: "Minutes" },
      ]
    : totalHours > 0
    ? [
        { value: totalHours, label: "Hours" },
        { value: t.minutes, label: "Minutes" },
        { value: t.seconds, label: "Seconds" },
      ]
    : [
        { value: totalMinutes, label: "Minutes" },
        { value: t.seconds, label: "Seconds" },
      ];

  return (
    <div className="flex items-stretch gap-0">
      {segments.map((s, i) => (
        <div key={s.label} className="flex items-stretch">
          <div className="px-4 md:px-5 text-center min-w-[64px]">
            <div className="text-xl md:text-2xl font-bold tabular-nums text-gray-900 leading-none">
              {String(s.value).padStart(2, "0")}
            </div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 mt-1.5">{s.label}</div>
          </div>
          {i < segments.length - 1 && (
            <div className="w-px self-stretch" style={{ background: accent, opacity: 0.4 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function MatchersPanel({ matchers, accent }: { matchers: CampaignMatcher[]; accent: string }) {
  const accentRgb = useMemo(() => hexToRgb(accent), [accent]);
  if (matchers.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">No matchers announced yet.</div>;
  }
  return (
    <div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center px-4 py-1 rounded-full text-white text-sm font-bold tracking-wide" style={{ background: accent }}>
          x{Math.max(...matchers.map((m) => Number(m.multiplier)))} CAMPAIGN MATCHERS
        </div>
      </div>
      <motion.div
        className="grid sm:grid-cols-2 gap-4"
        variants={STAGGER_PARENT}
        initial="hidden"
        animate="show"
      >
        {matchers.map((m) => (
          <motion.div
            key={m.id}
            variants={STAGGER_CHILD}
            whileHover={{
              y: -3,
              boxShadow: `0 18px 40px -16px rgba(${accentRgb}, 0.35)`,
              borderColor: accent,
            }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            className="bg-white border border-gray-100 rounded-lg p-5 flex items-start gap-4"
          >
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
                <div className="text-xs text-gray-400 mt-1">Match cap: {formatUsd(m.cap_cents)}</div>
              )}
              {m.story && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{m.story}</p>}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Editorial About panel — magazine-feel layout.
 *
 * Sections (top → bottom):
 *   1. Opening pull-quote — tagline rendered with serif display flourishes
 *   2. Eyebrow + "Empower. Engage. Inspire." split-word banner
 *   3. Three pillar cards with lucide icons (Empower / Engage / Inspire)
 *   4. Narrative article with drop-cap on first paragraph
 *   5. "Since YEAR" stat ribbon (extracted from story text)
 *   6. Matcher Tiers as 4-card grid with medal-inspired gradient badges
 *   7. FAQ accordion with polished hover/open states
 */
function AboutPanel({ campaign, accent }: { campaign: Campaign; accent: string }) {
  const blocks = parseStoryMd(campaign.story_md ?? "");
  const accentRgb = hexToRgb(accent);

  // Partition blocks by section. Matcher Tiers heading triggers a new section
  // that we render as a grid, not the default paragraph/bullet rendering.
  // Also drop any heading that echoes the pillar words — the card grid
  // already conveys "Empower / Engage / Inspire", so repeating it in the
  // narrative heading is visual noise.
  const PILLAR_ECHO = /empower|engage|inspire/i;
  const narrativeBlocks: StoryBlock[] = [];
  const tierBullets: string[] = [];
  let inTiers = false;
  for (const b of blocks) {
    if ((b.kind === "h1" || b.kind === "h2") && /matcher\s*tiers?/i.test(b.text)) {
      inTiers = true;
      continue;
    }
    if (inTiers && b.kind === "bullets") {
      tierBullets.push(...b.items);
      continue;
    }
    if (!inTiers) {
      if ((b.kind === "h1" || b.kind === "h2") && PILLAR_ECHO.test(b.text)) continue;
      narrativeBlocks.push(b);
    }
  }

  // Year mention for the stat ribbon — look for the first "Since YYYY" in
  // any paragraph. Renders a big "N years" callout.
  const sinceMatch = narrativeBlocks
    .map((b) => (b.kind === "p" ? b.text : ""))
    .join(" ")
    .match(/since\s+(19|20)\d{2}/i);
  const sinceYear = sinceMatch ? parseInt(sinceMatch[0].replace(/\D/g, ""), 10) : null;
  const yearsActive = sinceYear ? new Date().getFullYear() - sinceYear : null;

  const PILLARS = [
    { label: "Empower", blurb: "Deep, sophisticated Torah wisdom — made relevant for modern life." },
    { label: "Engage",  blurb: "Classes, events, and community gatherings that bring people together." },
    { label: "Inspire", blurb: "Meaningful Jewish experiences that spark curiosity and connection." },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* ---------- 1. OPENING PULL-QUOTE ---------- */}
      {campaign.tagline && (
        <figure
          className="relative mb-14 px-6 md:px-10 py-10 md:py-12 text-center overflow-hidden rounded-3xl border border-gray-100"
          style={{ background: `linear-gradient(160deg, #ffffff 0%, rgba(${accentRgb}, 0.06) 100%)` }}
        >
          <div
            aria-hidden="true"
            className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-[0.12] blur-2xl"
            style={{ background: accent }}
          />
          <span
            aria-hidden="true"
            className="absolute top-4 left-6 text-7xl leading-none font-serif select-none"
            style={{ color: `rgba(${accentRgb}, 0.35)` }}
          >
            &ldquo;
          </span>
          <blockquote className="relative text-xl md:text-2xl font-medium text-gray-800 leading-snug max-w-2xl mx-auto">
            <TaglineEditorial tagline={campaign.tagline} accent={accent} />
          </blockquote>
        </figure>
      )}

      {/* ---------- 2. PILLAR CARDS (mission stated through the cards themselves) ---------- */}
      <div className="text-center mb-8">
        <div className="text-[11px] md:text-xs font-semibold tracking-[0.3em] uppercase mb-2" style={{ color: accent }}>
          Our Mission
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight max-w-xl mx-auto">
          Three commitments. One community.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.label}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: EASE_OUT_EXPO }}
            className="relative rounded-2xl border border-gray-100 bg-white p-7 pt-8 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
          >
            {/* Watermark number in the corner — darker so it reads as design */}
            <div
              aria-hidden="true"
              className="absolute -top-1 right-3 text-7xl md:text-8xl font-extrabold leading-none select-none tabular-nums"
              style={{ color: `rgba(${accentRgb}, 0.28)` }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>

            <div className="relative">
              <div className="text-xl md:text-2xl font-bold text-gray-900 mb-2 tracking-tight">{p.label}</div>
              <div className="h-0.5 w-8 rounded-full mb-3" style={{ background: accent }} />
              <p className="text-sm text-gray-600 leading-relaxed">{p.blurb}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ---------- 4. NARRATIVE ARTICLE ---------- */}
      {narrativeBlocks.length > 0 && (
        <article className="space-y-5 text-gray-700 leading-relaxed">
          {narrativeBlocks.map((b, i) => {
            if (b.kind === "h1" || b.kind === "h2") {
              return (
                <div key={i} className="pt-6">
                  <div className="h-1 w-8 rounded-full mb-3" style={{ background: accent }} />
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                    {b.text}
                  </h2>
                </div>
              );
            }
            if (b.kind === "h3") {
              return <h3 key={i} className="text-lg font-bold text-gray-900 pt-2">{b.text}</h3>;
            }
            if (b.kind === "bullets") {
              return (
                <ul key={i} className="space-y-2.5 pl-0">
                  {b.items.map((item, j) => (
                    <li key={j} className="flex gap-3 items-start">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accent }} />
                      <span>{renderInline(item)}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            // paragraph — drop-cap the first, normal body after
            const isFirstPara = narrativeBlocks.findIndex((x) => x.kind === "p") === i;
            return (
              <p
                key={i}
                className={
                  isFirstPara
                    ? "text-lg first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-[0.9]"
                    : "text-base"
                }
                style={isFirstPara ? ({ ["--dc" as string]: accent } as React.CSSProperties) : undefined}
              >
                {renderInline(b.text)}
              </p>
            );
          })}
        </article>
      )}

      {/* ---------- 5. "SINCE YEAR" STAT RIBBON ---------- */}
      {yearsActive && yearsActive > 0 && (
        <div
          className="mt-12 rounded-2xl px-6 md:px-10 py-8 md:py-10 text-center border"
          style={{
            background: `linear-gradient(135deg, rgba(${accentRgb}, 0.08), rgba(${accentRgb}, 0.02))`,
            borderColor: `rgba(${accentRgb}, 0.18)`,
          }}
        >
          <div className="inline-flex items-baseline gap-2 justify-center">
            <span
              className="text-5xl md:text-7xl font-extrabold tabular-nums leading-none tracking-tight"
              style={{ color: accent }}
            >
              {yearsActive}
            </span>
            <span className="text-xs md:text-sm uppercase tracking-[0.2em] font-semibold text-gray-500">Years</span>
          </div>
          <div className="mt-4 text-sm md:text-base font-bold text-gray-900 leading-tight">
            Building community in Westchester since {sinceYear}.
          </div>
          <div className="mt-1 text-xs md:text-sm text-gray-600 leading-relaxed">
            Thousands of classes, events, and experiences — and counting.
          </div>
        </div>
      )}

      {/* ---------- 6. MATCHER TIERS ---------- */}
      {tierBullets.length > 0 && (
        <div className="mt-14">
          <div className="text-center mb-6">
            <div className="text-[11px] md:text-xs font-semibold tracking-[0.3em] uppercase mb-2" style={{ color: accent }}>
              Campaign Matchers
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
              Join a tier. Unlock the match.
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tierBullets.map((raw, i) => {
              const m = raw.match(/\$?([\d,]+)(?:\s*·|\s+—|\s+-|:)?\s*(.+)?/);
              const amt = m?.[1] ? `$${m[1].replace(/[^\d,]/g, "")}` : raw;
              const label = m?.[2]?.replace(/\*\*/g, "").trim() || "";
              const medal = MEDAL_FOR(label);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: i * 0.06, ease: EASE_OUT_EXPO }}
                  className="relative rounded-xl p-5 text-center border overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-default"
                  style={{
                    background: medal.bg,
                    borderColor: medal.border,
                  }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-30 blur-xl"
                    style={{ background: medal.glow }}
                  />
                  <div className="relative">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: medal.labelColor }}>
                      {label}
                    </div>
                    <div className="text-2xl md:text-3xl font-extrabold tabular-nums" style={{ color: medal.amountColor }}>
                      {amt}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- 7. FAQ ---------- */}
      {campaign.faq && campaign.faq.length > 0 && (
        <div className="mt-16 pt-10 border-t border-gray-100">
          <div className="text-center mb-6">
            <div className="text-[11px] md:text-xs font-semibold tracking-[0.3em] uppercase mb-2" style={{ color: accent }}>
              FAQ
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Questions?</h3>
          </div>
          <div className="space-y-2">
            {campaign.faq.map((entry, i) => (
              <details key={i} className="border border-gray-200 rounded-xl overflow-hidden bg-white group hover:border-gray-300 open:border-gray-300 open:shadow-sm transition-all cursor-pointer">
                <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-gray-900 hover:bg-gray-50 flex items-center justify-between gap-4 transition-colors">
                  <span className="flex-1">{entry.q}</span>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-lg leading-none transition-transform duration-200 group-open:rotate-45 flex-shrink-0"
                    style={{ background: accent }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed whitespace-pre-line border-t border-gray-100 pt-4">
                  {entry.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Split the tagline into three visual lines matching the hero treatment. */
function TaglineEditorial({ tagline, accent }: { tagline: string; accent: string }) {
  const m = tagline.match(/^(.+?\.)\s+(.+?\.)\s+(All\s+On\s+Fire\.?)$/i);
  if (!m) return <span>{tagline}</span>;
  return (
    <>
      <span className="block">{m[1]}</span>
      <span className="block text-base md:text-lg text-gray-500 italic tracking-wide mt-2">{m[2]}</span>
      <span className="block mt-3 font-serif text-3xl md:text-4xl font-bold tracking-tight" style={{ color: accent }}>
        {m[3]}
      </span>
    </>
  );
}

/**
 * Visual styling for each matcher tier — subtle medal-inspired gradient
 * backgrounds (not gaudy metallic). Works on top of the accent-agnostic palette.
 */
function MEDAL_FOR(label: string) {
  const l = label.toLowerCase();
  if (l.includes("platinum")) {
    return {
      bg: "linear-gradient(135deg, #f8fafc, #e2e8f0)",
      border: "#cbd5e1",
      glow: "#94a3b8",
      labelColor: "#475569",
      amountColor: "#0f172a",
    };
  }
  if (l.includes("gold")) {
    return {
      bg: "linear-gradient(135deg, #fffbeb, #fde68a)",
      border: "#f59e0b55",
      glow: "#f59e0b",
      labelColor: "#92400e",
      amountColor: "#78350f",
    };
  }
  if (l.includes("silver")) {
    return {
      bg: "linear-gradient(135deg, #f8fafc, #e5e7eb)",
      border: "#9ca3af55",
      glow: "#9ca3af",
      labelColor: "#4b5563",
      amountColor: "#111827",
    };
  }
  if (l.includes("bronze")) {
    return {
      bg: "linear-gradient(135deg, #fef3c7, #fcd9a8)",
      border: "#d9770655",
      glow: "#d97706",
      labelColor: "#9a3412",
      amountColor: "#7c2d12",
    };
  }
  return {
    bg: "linear-gradient(135deg, #ffffff, #f9fafb)",
    border: "#e5e7eb",
    glow: "#9ca3af",
    labelColor: "#4b5563",
    amountColor: "#111827",
  };
}

type StoryBlock =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "bullets"; items: string[] };

/**
 * Lightweight Markdown parser: enough to render our campaign story_md nicely
 * without pulling in a full markdown library. Handles headings, paragraphs,
 * bullet lists, and horizontal rules.
 */
function parseStoryMd(md: string): StoryBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: StoryBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushPara = () => {
    if (paragraph.length) {
      out.push({ kind: "p", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      out.push({ kind: "bullets", items: [...bullets] });
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushBullets();
      continue;
    }
    if (/^---+$/.test(line)) {
      // Dashes/separators in the story are treated as paragraph breaks — don't
      // render a visible line (design request: no dashes in the About tab).
      flushPara(); flushBullets();
      continue;
    }
    if (line.startsWith("### ")) {
      flushPara(); flushBullets();
      out.push({ kind: "h3", text: line.slice(4).trim() });
      continue;
    }
    if (line.startsWith("## ")) {
      flushPara(); flushBullets();
      out.push({ kind: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("# ")) {
      flushPara(); flushBullets();
      out.push({ kind: "h1", text: line.slice(2).trim() });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      bullets.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    flushBullets();
    paragraph.push(line);
  }
  flushPara();
  flushBullets();
  return out;
}

/**
 * Render inline **bold** markers within a line. Keeps everything else plain.
 */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

function TeamsPanel({
  teams, campaignSlug, accent, onDonate,
}: {
  teams: CampaignTeamWithProgress[];
  campaignSlug: string;
  accent: string;
  onDonate: (teamId: string) => void;
}) {
  if (teams.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">No teams yet.</div>;
  }
  const sorted = [...teams].sort((a, b) => b.raised_cents - a.raised_cents);
  return (
    <motion.div
      className="space-y-3"
      variants={STAGGER_PARENT}
      initial="hidden"
      animate="show"
    >
      {sorted.map((t, i) => {
        const pct = t.goal_cents && t.goal_cents > 0 ? Math.min(100, (t.raised_cents / t.goal_cents) * 100) : 0;
        const isLeader = i === 0;
        const teamHref = `/campaign/${campaignSlug}/team/${t.slug}`;
        return (
          <motion.div
            key={t.id}
            variants={STAGGER_CHILD}
            whileHover={{ y: -2, boxShadow: "0 12px 24px -12px rgba(0,0,0,0.15)" }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="bg-white border border-gray-100 rounded-lg p-5 relative overflow-hidden"
          >
            {isLeader && (
              <div
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: accent }}
                aria-hidden="true"
              />
            )}
            <a href={teamHref} className="flex items-center gap-4 mb-3 group">
              <div className={`text-lg font-bold tabular-nums w-6 text-center ${isLeader ? "" : "text-gray-300"}`}
                style={isLeader ? { color: accent } : undefined}>
                {i + 1}
              </div>
              {t.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.avatar_url} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm" style={{ background: accent }}>
                  {t.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm group-hover:underline">{t.name}</div>
                {t.leader_name && <div className="text-xs text-gray-400">Led by {t.leader_name}</div>}
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900 tabular-nums text-sm">{formatUsd(t.raised_cents)}</div>
                {t.goal_cents ? (
                  <div className="text-xs text-gray-400 tabular-nums">of {formatUsd(t.goal_cents)}</div>
                ) : null}
              </div>
            </a>
            {t.goal_cents ? (
              <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${pct}%` }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 1.2, ease: EASE_OUT_EXPO }}
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: accent }}
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{t.donor_count} {t.donor_count === 1 ? "donor" : "donors"}</span>
              <div className="flex items-center gap-4">
                <a
                  href={teamHref}
                  className="font-semibold uppercase tracking-wide hover:underline text-gray-500"
                >
                  View page
                </a>
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
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function ShareBtn({
  href, label, Icon, accent,
}: {
  href: string; label: string; Icon: React.ElementType; accent: string;
}) {
  const accentRgb = useMemo(() => hexToRgb(accent), [accent]);
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      whileHover={{
        y: -2,
        scale: 1.04,
        borderColor: accent,
        color: accent,
        boxShadow: `0 10px 22px -10px rgba(${accentRgb}, 0.4)`,
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
      className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-md text-sm font-medium"
    >
      <Icon className="w-4 h-4" />
      {label}
    </motion.a>
  );
}

function StickyMobileBar({
  accent, pct, total, goal, onDonate,
}: {
  accent: string; pct: number; total: number; goal: number; onDonate: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.4 }}
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden"
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between text-xs mb-1.5 tabular-nums">
          <span className="text-gray-500">{formatUsd(total)} of {formatUsd(goal)}</span>
          <span className="font-bold" style={{ color: accent }}>{pct.toFixed(0)}%</span>
        </div>
        <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <motion.div
            initial={reduced ? { width: `${Math.min(100, pct)}%` } : { width: 0 }}
            animate={{ width: `${Math.min(100, pct)}%` }}
            transition={{ duration: 1.2, ease: EASE_OUT_EXPO, delay: 0.6 }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: accent }}
          />
        </div>
        <motion.button
          type="button"
          onClick={onDonate}
          whileTap={{ scale: 0.97 }}
          className="w-full py-3 text-white font-bold rounded-md text-sm uppercase tracking-[0.1em] shadow-lg"
          style={{ background: accent }}
        >
          Donate Now
        </motion.button>
      </div>
    </motion.div>
  );
}
