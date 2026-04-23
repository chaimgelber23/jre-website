"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Share2, Heart, Mail, MessageCircle, Copy, Check, ArrowLeft,
  Flame, Trophy, Users, Sparkles,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  formatUsd,
  getActiveMatcher,
  getTimeRemaining,
  type CampaignTeamSnapshot,
} from "@/lib/campaign";
import DonateModal from "../../DonateModal";
import DonorCard from "../../DonorCard";
import type { CampaignSnapshot, PublicDonation } from "@/types/campaign";

type Sort = "default" | "latest" | "oldest" | "highest";

const DEFAULT_ACCENT = "#DA98B1";
const QUICK_GIVE_CENTS = [3600, 18000, 36000, 100000]; // $36, $180, $360, $1000

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
  const [preselectAmount, setPreselectAmount] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<Sort>("default");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [donations, setDonations] = useState(recent_donations);
  const [progress, setProgress] = useState({
    raised_cents: team.raised_cents,
    donor_count: team.donor_count,
  });

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
        setDonations(snap.recent_donations.filter((d) => d.team_slug === team.slug));
      }
    } catch {
      /* best-effort */
    }
  }, [campaign.slug, team.slug]);

  useEffect(() => {
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  const goalCents = team.goal_cents ?? 0;
  const pctRaw = goalCents > 0 ? (progress.raised_cents / goalCents) * 100 : 0;

  // Display name for CTAs: strip leading "Team " prefix so "Team Oratz" -> "Oratz"
  // (so buttons read "Donate to Oratz's Team" instead of "Donate to Team's Team").
  const teamShortName = team.name.replace(/^Team\s+/i, "") || team.name;

  // Top 5 donors for this team — ranked by amount
  const topDonors = useMemo(() => {
    const sorted = [...donations].sort((a, b) => b.amount_cents - a.amount_cents);
    return sorted.slice(0, 5);
  }, [donations]);

  // Matcher-pool scarcity
  const matcherPoolRemaining = activeMatcher?.cap_cents
    ? Math.max(0, activeMatcher.cap_cents - (activeMatcher.matched_cents ?? 0))
    : null;
  const matcherPoolPct = activeMatcher?.cap_cents
    ? Math.min(100, ((activeMatcher.matched_cents ?? 0) / activeMatcher.cap_cents) * 100)
    : 0;

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `Support ${team.name} — ${campaign.title}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const openDonateWith = (amountCents: number | null) => {
    setPreselectAmount(amountCents);
    setModalOpen(true);
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 text-white">
            <div className="container mx-auto">
              <div className="text-[11px] uppercase tracking-[0.22em] opacity-80 mb-2 inline-flex items-center gap-2">
                <Flame className="w-3.5 h-3.5" /> {orgName}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight">{team.name}</h1>
              {team.leader_name && (
                <div className="text-sm md:text-base opacity-90 mt-1">
                  Led by <span className="font-semibold">{team.leader_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ LIVE ACTIVITY TICKER ============ */}
      {donations.length > 0 && (
        <ActivityTicker donations={donations.slice(0, 12)} accent={accent} />
      )}

      {/* ============ MAIN STATS ROW ============ */}
      <section className="border-b border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 items-stretch divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* LEFT — full radial ring */}
          <div className="px-6 py-8 md:py-10 flex flex-col items-center justify-center">
            <RadialRing percent={pctRaw} accent={accent} raised={progress.raised_cents} goal={goalCents} />
            <div className="text-center mt-4">
              <div className="text-xs text-gray-500 tabular-nums">
                <span className="font-bold text-gray-900">{formatUsd(progress.raised_cents)}</span>
                {goalCents > 0 && (
                  <> of <span className="text-gray-600">{formatUsd(goalCents)}</span> team goal</>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {progress.donor_count} {progress.donor_count === 1 ? "donor" : "donors"}
              </div>
            </div>
          </div>

          {/* MIDDLE — match impact + donate */}
          <div
            className="px-6 py-8 md:py-10 flex flex-col items-center justify-center text-white"
            style={{ background: accent }}
          >
            {multiplier > 1 ? (
              <MatchImpactCard multiplier={multiplier} matcherName={activeMatcher?.name} />
            ) : (
              <div className="text-center mb-3">
                <div className="text-[11px] uppercase tracking-[0.22em] opacity-90">Support</div>
                <div className="text-xl font-bold mt-1">{team.name}</div>
              </div>
            )}

            <button
              type="button"
              onClick={() => openDonateWith(null)}
              className="w-full max-w-xs px-6 py-4 bg-white font-bold rounded-md text-sm tracking-[0.1em] uppercase shadow-lg hover:bg-gray-50 transition"
              style={{ color: accent }}
            >
              Donate to {teamShortName}&apos;s Team
            </button>

            {/* Quick-give chips */}
            <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
              <span className="text-[10px] uppercase tracking-widest opacity-80">Quick give</span>
              {QUICK_GIVE_CENTS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => openDonateWith(cents)}
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-md text-xs font-semibold tabular-nums transition"
                >
                  ${cents / 100}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={copyLink}
              className="w-full max-w-xs mt-3 px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-medium rounded-md text-xs uppercase tracking-[0.1em] transition inline-flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Share this team"}
            </button>
          </div>

          {/* RIGHT — countdown */}
          <div className="px-6 py-8 md:py-10 flex flex-col items-center justify-center">
            <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500 mb-3 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} />
              Campaign Ends In
            </div>
            <CountdownStrip startAt={campaign.start_at} endAt={campaign.end_at} accent={accent} />
          </div>
        </div>
      </section>

      {/* ============ MATCH POOL SCARCITY BAR ============ */}
      {activeMatcher && matcherPoolRemaining !== null && (
        <section className="border-b border-gray-100 bg-amber-50">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <Flame className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-amber-900 mb-1.5 truncate">
                  {multiplier}× match pool:{" "}
                  <span className="tabular-nums font-bold">{formatUsd(matcherPoolRemaining)}</span> of{" "}
                  <span className="tabular-nums">{formatUsd(activeMatcher.cap_cents ?? 0)}</span> remaining
                </div>
                <div className="relative h-1 bg-amber-200 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-amber-500 rounded-full transition-all duration-700"
                    style={{ width: `${matcherPoolPct}%` }}
                  />
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700 flex-shrink-0">
                Unlocked
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============ TOP DONORS + STORY ============ */}
      <section className="py-10 md:py-14 bg-white">
        <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl">
          {/* Top donors (left col on desktop) */}
          <div className="lg:col-span-2">
            <h2 className="text-xs uppercase tracking-[0.22em] text-gray-500 inline-flex items-center gap-2 mb-4">
              <Trophy className="w-3.5 h-3.5" style={{ color: accent }} />
              Top Donors
            </h2>
            {topDonors.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
                <div className="text-sm text-gray-500">Be the first to give</div>
                <button
                  type="button"
                  onClick={() => openDonateWith(null)}
                  className="mt-3 text-sm font-semibold uppercase tracking-wide"
                  style={{ color: accent }}
                >
                  Kick it off →
                </button>
              </div>
            ) : (
              <ol className="space-y-2">
                {topDonors.map((d, i) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2.5 hover:border-gray-200 transition"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={
                        i === 0
                          ? { background: accent, color: "#fff" }
                          : { background: "#f3f4f6", color: "#374151" }
                      }
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{d.display_name}</div>
                      {d.dedication_name && (
                        <div className="text-[11px] text-gray-500 truncate">
                          in {d.dedication_type === "memory" ? "memory" : "honor"} of{" "}
                          <span className="font-medium">{d.dedication_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-bold text-gray-900 tabular-nums">
                      {formatUsd(d.amount_cents)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Team story (right col on desktop) */}
          <div className="lg:col-span-3">
            <h2 className="text-xs uppercase tracking-[0.22em] text-gray-500 inline-flex items-center gap-2 mb-4">
              <Users className="w-3.5 h-3.5" style={{ color: accent }} />
              About {team.name}
            </h2>
            {team.story ? (
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line leading-relaxed">
                {team.story}
              </div>
            ) : (
              <div className="text-sm text-gray-500 leading-relaxed">
                <p>
                  Join {team.name} in supporting the Jewish Renaissance Experience — classes,
                  events, and meaningful Jewish experiences that inspire Westchester&apos;s
                  Jewish community.
                </p>
                <p className="mt-3">
                  Every gift to {team.name} is multiplied by our matching sponsors. Your donation
                  goes directly to powering the programs and experiences that bring people
                  together.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============ TEAM DONOR WALL ============ */}
      <section className="container mx-auto px-6 py-10 max-w-5xl border-t border-gray-100">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{progress.donor_count}</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 mt-1">
            {progress.donor_count === 1 ? "Donor on this team" : "Donors on this team"}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-3 mb-6">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search donors"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-gray-400 bg-white"
            />
          </div>
          <div className="flex items-center gap-2 text-sm md:justify-end">
            <span className="text-gray-500 uppercase tracking-wide text-xs">Sort by:</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <ShareBtn
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
              label="WhatsApp"
              Icon={MessageCircle}
              accent={accent}
            />
            <ShareBtn
              href={`mailto:?subject=${encodeURIComponent(`${team.name} — ${campaign.title}`)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`}
              label="Email"
              Icon={Mail}
              accent={accent}
            />
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
            <span className="text-gray-500 truncate">
              {formatUsd(progress.raised_cents)}
              {goalCents > 0 ? ` of ${formatUsd(goalCents)}` : ""}
            </span>
            <span className="font-bold" style={{ color: accent }}>
              {pctRaw.toFixed(0)}%
            </span>
          </div>
          <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.min(100, pctRaw)}%`, background: accent }}
            />
          </div>
          <button
            type="button"
            onClick={() => openDonateWith(null)}
            className="w-full py-3 text-white font-bold rounded-md text-sm uppercase tracking-[0.1em] shadow-lg"
            style={{ background: accent }}
          >
            Donate to {teamShortName}&apos;s Team
          </button>
        </div>
      </div>

      <DonateModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setPreselectAmount(null);
        }}
        snapshot={pseudoSnapshot}
        preselectedTierId={null}
        preselectedTeamId={team.id}
        preselectedAmountDollars={preselectAmount !== null ? preselectAmount / 100 : null}
        onDonated={refresh}
      />
    </main>
  );
}

// ============ SUBCOMPONENTS ============

function MatchImpactCard({ multiplier, matcherName }: { multiplier: number; matcherName?: string }) {
  return (
    <div className="text-center mb-4">
      <div className="text-[10px] uppercase tracking-[0.22em] opacity-90 inline-flex items-center gap-1.5">
        <Flame className="w-3 h-3" /> {multiplier}× Match Active
      </div>
      <div className="text-2xl md:text-3xl font-bold leading-none mt-2 tabular-nums">
        $100 → <span className="underline decoration-2 underline-offset-4">${multiplier * 100}</span>
      </div>
      {matcherName && (
        <div className="text-[11px] mt-1.5 opacity-90 truncate max-w-[220px] mx-auto">{matcherName}</div>
      )}
    </div>
  );
}

function ActivityTicker({
  donations,
  accent,
}: {
  donations: PublicDonation[];
  accent: string;
}) {
  // Continuous marquee; duplicate the list so CSS animation loops seamlessly.
  const items = [...donations, ...donations];
  return (
    <section className="border-b border-gray-100 bg-gray-50 overflow-hidden">
      <div className="relative py-2.5">
        <motion.div
          className="flex gap-6 whitespace-nowrap will-change-transform"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 40, ease: "linear", repeat: Infinity }}
        >
          {items.map((d, i) => (
            <div key={`${d.id}-${i}`} className="inline-flex items-center gap-2 text-xs text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
              <span className="font-semibold text-gray-900">{d.display_name}</span>
              <span className="font-medium text-gray-700 tabular-nums">
                {formatUsd(d.amount_cents)}
              </span>
              {d.message && (
                <span dir="auto" className="italic text-gray-500 max-w-[180px] truncate">
                  &ldquo;{d.message}&rdquo;
                </span>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function CountdownStrip({
  startAt,
  endAt,
  accent,
}: {
  startAt: string;
  endAt: string;
  accent: string;
}) {
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
  const segments =
    t.days > 0
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
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400 mt-2">
              {s.label}
            </div>
          </div>
          {i < segments.length - 1 && (
            <div className="w-px self-stretch" style={{ background: accent, opacity: 0.5 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function RadialRing({
  percent,
  accent,
  raised,
  goal,
}: {
  percent: number;
  accent: string;
  raised: number;
  goal: number;
}) {
  const size = 180;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circ - (circ * clamped) / 100;

  return (
    <div className="relative">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={clamped.toFixed(0)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="text-4xl font-bold tabular-nums text-gray-900 leading-none"
          >
            {clamped.toFixed(0)}
            <span className="text-2xl text-gray-500">%</span>
          </motion.div>
        </AnimatePresence>
        <div className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mt-1">
          {goal > 0 ? "of team goal" : "raised"}
        </div>
        {raised > 0 && goal > 0 && (
          <div className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
            {formatUsd(raised)} / {formatUsd(goal)}
          </div>
        )}
      </div>
    </div>
  );
}

function ShareBtn({
  href,
  label,
  Icon,
  accent,
}: {
  href: string;
  label: string;
  Icon: React.ElementType;
  accent: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-md text-sm font-medium transition-colors"
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.color = accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "";
        e.currentTarget.style.color = "";
      }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </a>
  );
}
