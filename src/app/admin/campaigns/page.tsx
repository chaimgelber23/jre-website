"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, DollarSign, Users, Target, ExternalLink } from "lucide-react";
import StatsCard from "@/components/admin/StatsCard";
import { formatUsd } from "@/lib/campaign";
import type { Campaign } from "@/types/campaign";

interface ProgressRow {
  campaign_id: string;
  raised_cents: number;
  matched_cents: number;
  donor_count: number;
  goal_cents: number;
}

interface ApiResponse {
  success: boolean;
  campaigns: Campaign[];
  progress: ProgressRow[];
}

export default function AdminCampaignsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/campaigns");
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setError(null);
    if (!newSlug || !newTitle) return;
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 2);
    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: newSlug,
        title: newTitle,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        status: "draft",
        goal_cents: 10_000_000,
      }),
    });
    const json = await res.json();
    if (!json.success) {
      setError(json.error || "Failed to create");
      return;
    }
    setCreating(false);
    setNewSlug("");
    setNewTitle("");
    load();
  };

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-10">
        <div className="text-gray-500">Loading campaigns...</div>
      </div>
    );
  }

  const campaigns = data?.campaigns ?? [];
  const progressByCampaign = new Map((data?.progress ?? []).map((p) => [p.campaign_id, p]));

  const totalRaised = (data?.progress ?? []).reduce((s, p) => s + (p.raised_cents ?? 0) + (p.matched_cents ?? 0), 0);
  const totalDonors = (data?.progress ?? []).reduce((s, p) => s + (p.donor_count ?? 0), 0);
  const activeCount = campaigns.filter((c) => c.status === "live").length;

  return (
    <div className="container mx-auto px-3 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Fundraising campaign pages — replaces the Charidy setup fee.</p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-2 bg-[#EF8046] hover:bg-[#d96a2f] text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> New campaign
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatsCard icon={DollarSign} title="Total raised (all campaigns)" value={formatUsd(totalRaised)} />
        <StatsCard icon={Users} title="Total donors" value={totalDonors.toLocaleString()} />
        <StatsCard icon={Target} title="Live campaigns" value={String(activeCount)} />
      </div>

      {creating && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm"
        >
          <h3 className="font-semibold text-gray-900 mb-3">Create campaign</h3>
          {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="URL slug (e.g. jre-june-2026)"
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-sm outline-none focus:border-[#EF8046]"
            />
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Campaign title"
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] text-sm outline-none focus:border-[#EF8046]"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={create}
              disabled={!newSlug || !newTitle}
              className="bg-[#EF8046] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              Create draft
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-xl text-sm text-gray-600">
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {campaigns.length === 0 && (
            <div className="p-12 text-center text-gray-500 text-sm">
              No campaigns yet. Create one above to get started.
            </div>
          )}
          {campaigns.map((c) => {
            const p = progressByCampaign.get(c.id);
            const total = (p?.raised_cents ?? 0) + (p?.matched_cents ?? 0);
            const pct = c.goal_cents > 0 ? Math.min(100, (total / c.goal_cents) * 100) : 0;
            return (
              <div key={c.id} className="p-5 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{c.title}</span>
                    <StatusPill status={c.status} />
                  </div>
                  <div className="text-xs text-gray-500">
                    /{c.slug} · {new Date(c.start_at).toLocaleDateString()} → {new Date(c.end_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="w-full sm:w-60">
                  <div className="flex items-baseline justify-between text-xs text-gray-500 mb-1">
                    <span>{formatUsd(total)} raised</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#EF8046] to-[#d96a2f] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">goal {formatUsd(c.goal_cents)} · {p?.donor_count ?? 0} donors</div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Link
                    href={`/campaign/${c.slug}`}
                    target="_blank"
                    className="text-sm text-gray-500 hover:text-[#EF8046] inline-flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </Link>
                  <Link
                    href={`/admin/campaigns/${c.id}`}
                    className="inline-flex items-center gap-1 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-3 py-2 rounded-xl"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Campaign["status"] }) {
  const map: Record<Campaign["status"], { bg: string; text: string }> = {
    draft: { bg: "bg-gray-100", text: "text-gray-700" },
    scheduled: { bg: "bg-amber-100", text: "text-amber-700" },
    live: { bg: "bg-emerald-100", text: "text-emerald-700" },
    ended: { bg: "bg-gray-100", text: "text-gray-500" },
    archived: { bg: "bg-gray-100", text: "text-gray-400" },
  };
  const s = map[status];
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
}
