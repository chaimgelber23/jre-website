"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { formatUsd } from "@/lib/campaign";
import type { PublicDonation } from "@/types/campaign";

interface Props {
  donations: PublicDonation[];
  totalCount: number;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function DonorWall({ donations, totalCount }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? donations : donations.slice(0, 10);

  if (donations.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
        <p className="text-gray-700 font-medium">Be the first to donate</p>
        <p className="text-gray-500 text-sm mt-1">Your donation will kick off this campaign.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Recent supporters</h3>
        <span className="text-sm text-gray-500">{totalCount.toLocaleString()} total</span>
      </div>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {visible.map((d) => (
            <motion.li
              key={d.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#EF8046] to-[#d96a2f] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                {(d.display_name || "A").slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{d.display_name}</span>
                  <span className="text-xs text-gray-400">{timeAgo(d.created_at)}</span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-lg font-bold text-[#EF8046] tabular-nums">
                    {formatUsd(d.amount_cents)}
                  </span>
                  {d.team_name && (
                    <span className="text-xs text-gray-500">• {d.team_name}</span>
                  )}
                </div>
                {d.dedication_name && (
                  <div className="text-xs text-gray-600 mt-1 italic">
                    {d.dedication_type === "memory" ? "In memory of " : "In honor of "}
                    <span className="font-medium not-italic">{d.dedication_name}</span>
                  </div>
                )}
                {d.message && (
                  <div className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 flex gap-2">
                    <MessageCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span>{d.message}</span>
                  </div>
                )}
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {donations.length > 10 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-4 w-full py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors"
        >
          {expanded ? "Show less" : `Show all ${donations.length}`}
        </button>
      )}
    </div>
  );
}
