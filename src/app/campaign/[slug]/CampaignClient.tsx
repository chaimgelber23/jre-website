"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Share2, Copy, Check, Users, Trophy, Facebook, Twitter, Mail,
  MessageCircle, Sparkles,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { FadeUp } from "@/components/ui/motion";
import { formatUsd, getActiveMatcher } from "@/lib/campaign";
import type { CampaignSnapshot } from "@/types/campaign";
import Progress from "./Progress";
import Countdown from "./Countdown";
import DonorWall from "./DonorWall";
import DonateModal from "./DonateModal";

interface Props {
  snapshot: CampaignSnapshot;
}

export default function CampaignClient({ snapshot: initial }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [preselectedTier, setPreselectedTier] = useState<string | null>(null);
  const [preselectedTeam, setPreselectedTeam] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { campaign, tiers, teams, matchers, updates, progress, recent_donations } = snapshot;
  const activeMatcher = getActiveMatcher(matchers);

  // Live polling — refresh progress every 20s (no SSE needed for MVP).
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaign/${campaign.slug}/progress`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.snapshot) setSnapshot(data.snapshot);
    } catch {
      // silent — polling is best-effort
    }
  }, [campaign.slug]);

  useEffect(() => {
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  const openWithTier = (tierId: string | null) => {
    setPreselectedTier(tierId);
    setModalOpen(true);
  };
  const openWithTeam = (teamId: string | null) => {
    setPreselectedTeam(teamId);
    setModalOpen(true);
  };
  const openDefault = () => {
    setPreselectedTier(null);
    setPreselectedTeam(null);
    setModalOpen(true);
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = campaign.share_text || `Support ${campaign.title} — every dollar counts.`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <main className="min-h-screen bg-[#FBFBFB]">
      <Header />

      {/* Matcher Banner */}
      {activeMatcher && (
        <div className="bg-gradient-to-r from-[#EF8046] to-[#d96a2f] text-white text-center py-2.5 px-4 text-sm font-semibold tracking-wide relative overflow-hidden">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span>
              <span className="font-bold">{Number(activeMatcher.multiplier).toFixed(activeMatcher.multiplier % 1 === 0 ? 0 : 2)}X MATCH ACTIVE</span>
              {" — "}Every dollar becomes {formatUsd(Math.round(100 * Number(activeMatcher.multiplier)))} · {activeMatcher.name}
            </span>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative pt-12 pb-10 md:pt-16 md:pb-14 bg-gradient-to-b from-[#1a202c] via-[#1a202c] to-[#2d3748] text-white overflow-hidden">
        {campaign.hero_image_url && (
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center"
            style={{ backgroundImage: `url('${campaign.hero_image_url}')` }}
            aria-hidden
          />
        )}
        <div className="relative container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-3 mb-4"
            >
              <div className="w-8 h-px bg-[#EF8046]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#EF8046]">
                JRE Campaign
              </span>
              <div className="w-8 h-px bg-[#EF8046]" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-bold mb-4 leading-[1.05]"
            >
              {campaign.title}
            </motion.h1>

            {campaign.tagline && (
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto"
              >
                {campaign.tagline}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-10 mb-8"
            >
              <Countdown startAt={campaign.start_at} endAt={campaign.end_at} tone="light" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 md:p-6 mb-6"
            >
              <Progress
                raisedCents={progress.raised_cents}
                matchedCents={progress.matched_cents}
                goalCents={progress.goal_cents}
                donorCount={progress.donor_count}
                tone="light"
              />
            </motion.div>

            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openDefault}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] px-8 py-4 rounded-full font-bold text-lg shadow-2xl hover:shadow-[0_12px_40px_rgba(239,128,70,0.5)] transition-all"
            >
              <Heart className="w-5 h-5" />
              Donate Now
            </motion.button>
          </div>
        </div>
      </section>

      {/* Video embed */}
      {campaign.video_url && (
        <section className="py-12 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto aspect-video rounded-2xl overflow-hidden shadow-xl">
              <iframe
                src={campaign.video_url}
                title={campaign.title}
                className="w-full h-full"
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </section>
      )}

      {/* Story */}
      {campaign.story_md && (
        <section className="py-14 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <FadeUp>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 text-center">Our mission</h2>
                <div className="prose prose-lg max-w-none text-gray-700 whitespace-pre-line leading-relaxed">
                  {campaign.story_md}
                </div>
              </FadeUp>
            </div>
          </div>
        </section>
      )}

      {/* Tiers */}
      {tiers.length > 0 && (
        <section className="py-14 bg-[#FBFBFB]">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <FadeUp>
                <div className="text-center mb-10">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Ways to give</h2>
                  <p className="text-gray-600">Every gift — at every level — makes a difference.</p>
                </div>
              </FadeUp>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {tiers.map((t) => (
                  <motion.button
                    key={t.id}
                    whileHover={{ y: -4 }}
                    onClick={() => openWithTier(t.id)}
                    className={`relative text-left bg-white rounded-2xl p-6 border-2 transition-all shadow-sm hover:shadow-xl ${
                      t.is_featured ? "border-[#EF8046]" : "border-transparent hover:border-[#EF8046]"
                    }`}
                  >
                    {t.is_featured && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
                        Most Popular
                      </div>
                    )}
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="text-3xl font-bold text-[#EF8046] tabular-nums">
                        {formatUsd(t.amount_cents)}
                      </div>
                      {t.hebrew_value && (
                        <div className="text-2xl font-semibold text-gray-400" style={{ fontFamily: "serif" }}>
                          {t.hebrew_value}
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-gray-900 mb-2">{t.label}</div>
                    {t.description && <p className="text-sm text-gray-600 leading-relaxed">{t.description}</p>}
                    <div className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#EF8046]">
                      Give {formatUsd(t.amount_cents)} →
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Matchers */}
      {matchers.length > 0 && (
        <section className="py-14 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto">
              <FadeUp>
                <div className="text-center mb-8">
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Our matchers</h2>
                  <p className="text-gray-600">Lead donors multiplying every gift you make.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {matchers.map((m) => (
                    <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-start gap-4">
                      {m.logo_url ? (
                        <img src={m.logo_url} alt={m.name} className="w-14 h-14 rounded-xl object-contain bg-gray-50" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#EF8046] to-[#d96a2f] text-white flex items-center justify-center font-bold text-lg flex-shrink-0">
                          {m.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <div className="font-bold text-gray-900">{m.name}</div>
                          <div className="text-sm font-bold text-[#EF8046] tabular-nums">
                            {Number(m.multiplier).toFixed(Number(m.multiplier) % 1 === 0 ? 0 : 2)}X
                          </div>
                        </div>
                        {m.cap_cents != null && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            Match cap: {formatUsd(m.cap_cents)}
                          </div>
                        )}
                        {m.story && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{m.story}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </FadeUp>
            </div>
          </div>
        </section>
      )}

      {/* Teams */}
      {teams.length > 0 && (
        <section className="py-14 bg-[#FBFBFB]">
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto">
              <FadeUp>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 text-[#EF8046] text-sm font-semibold uppercase tracking-wide mb-2">
                    <Trophy className="w-4 h-4" /> Team leaderboard
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Teams raising together</h2>
                </div>
              </FadeUp>
              <div className="space-y-3">
                {teams
                  .slice()
                  .sort((a, b) => b.raised_cents - a.raised_cents)
                  .map((t, i) => {
                    const pct = t.goal_cents && t.goal_cents > 0 ? Math.min(100, (t.raised_cents / t.goal_cents) * 100) : 0;
                    return (
                      <motion.div
                        key={t.id}
                        whileHover={{ x: 2 }}
                        className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"
                      >
                        <div className="flex items-center gap-4 mb-3">
                          <div className="text-xl font-bold text-gray-400 tabular-nums w-6 text-center flex-shrink-0">
                            {i + 1}
                          </div>
                          {t.avatar_url ? (
                            <img src={t.avatar_url} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EF8046] to-[#d96a2f] text-white flex items-center justify-center font-bold">
                              {t.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900">{t.name}</div>
                            {t.leader_name && <div className="text-xs text-gray-500">Led by {t.leader_name}</div>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-[#EF8046] tabular-nums">{formatUsd(t.raised_cents)}</div>
                            {t.goal_cents && <div className="text-xs text-gray-500 tabular-nums">of {formatUsd(t.goal_cents)}</div>}
                          </div>
                        </div>
                        {t.goal_cents && (
                          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] rounded-full"
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 inline-flex items-center gap-1">
                            <Users className="w-3 h-3" /> {t.donor_count} {t.donor_count === 1 ? "donor" : "donors"}
                          </span>
                          <button
                            type="button"
                            onClick={() => openWithTeam(t.id)}
                            className="text-[#EF8046] font-semibold hover:underline"
                          >
                            Give to this team →
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Donor Wall */}
      <section className="py-14 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            <FadeUp>
              <DonorWall donations={recent_donations} totalCount={progress.donor_count} />
            </FadeUp>
          </div>
        </div>
      </section>

      {/* Updates */}
      {updates.length > 0 && (
        <section className="py-14 bg-[#FBFBFB]">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 text-center">Campaign updates</h2>
              <div className="space-y-4">
                {updates.map((u) => (
                  <div key={u.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <h3 className="font-bold text-gray-900">{u.title}</h3>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(u.posted_at).toLocaleDateString()}
                      </span>
                    </div>
                    {u.body_md && (
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{u.body_md}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {campaign.faq && campaign.faq.length > 0 && (
        <section className="py-14 bg-white">
          <div className="container mx-auto px-6">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">Questions?</h2>
              <div className="space-y-3">
                {campaign.faq.map((entry, i) => (
                  <FaqItem key={i} q={entry.q} a={entry.a} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Share */}
      <section className="py-10 bg-[#FBFBFB]">
        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
            <Share2 className="w-4 h-4" /> Spread the word
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <ShareBtn href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} label="Facebook" Icon={Facebook} />
            <ShareBtn href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} label="X" Icon={Twitter} />
            <ShareBtn href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} label="WhatsApp" Icon={MessageCircle} />
            <ShareBtn href={`mailto:?subject=${encodeURIComponent(campaign.title)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`} label="Email" Icon={Mail} />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-[#EF8046] hover:text-[#EF8046] px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>
      </section>

      {/* Tax disclosure */}
      <section className="py-8 bg-[#FBFBFB] border-t border-gray-100">
        <div className="container mx-auto px-6 text-center">
          <p className="text-xs text-gray-500 max-w-2xl mx-auto">
            {campaign.tax_deductible_note || "JRE is a 501(c)(3) nonprofit. All donations are tax-deductible to the fullest extent permitted by law."}
            {campaign.tax_id && <> {campaign.tax_id}.</>}
          </p>
        </div>
      </section>

      <Footer />

      {/* Sticky mobile donate bar */}
      <StickyDonateBar snapshot={snapshot} onDonate={openDefault} />

      <DonateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        snapshot={snapshot}
        preselectedTierId={preselectedTier}
        preselectedTeamId={preselectedTeam}
        onDonated={refresh}
      />
    </main>
  );
}

// ---------- helpers inside this file ----------

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900">{q}</span>
        <span className={`text-[#EF8046] transform transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShareBtn({ href, label, Icon }: { href: string; label: string; Icon: React.ElementType }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-[#EF8046] hover:text-[#EF8046] px-4 py-2 rounded-xl text-sm font-medium transition-colors"
    >
      <Icon className="w-4 h-4" />
      {label}
    </a>
  );
}

function StickyDonateBar({
  snapshot, onDonate,
}: { snapshot: CampaignSnapshot; onDonate: () => void }) {
  const { progress } = snapshot;
  const pct = progress.goal_cents > 0
    ? Math.min(100, ((progress.raised_cents + progress.matched_cents) / progress.goal_cents) * 100)
    : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs text-gray-500">
            {formatUsd(progress.raised_cents + progress.matched_cents)} of {formatUsd(progress.goal_cents)}
          </div>
          <div className="text-xs font-semibold text-[#EF8046] tabular-nums">{pct.toFixed(1)}%</div>
        </div>
        <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1 }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] rounded-full"
          />
        </div>
        <button
          type="button"
          onClick={onDonate}
          className="w-full py-3 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          <Heart className="w-4 h-4" /> Donate
        </button>
      </div>
    </div>
  );
}

