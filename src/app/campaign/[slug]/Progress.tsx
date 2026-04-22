"use client";

import { motion } from "framer-motion";
import { formatUsd } from "@/lib/campaign";

interface Props {
  raisedCents: number;
  matchedCents: number;
  goalCents: number;
  donorCount: number;
  tone?: "light" | "dark";
  showNumbers?: boolean;
}

export default function Progress({
  raisedCents,
  matchedCents,
  goalCents,
  donorCount,
  tone = "dark",
  showNumbers = true,
}: Props) {
  const total = raisedCents + matchedCents;
  const percent = goalCents > 0 ? Math.min(100, (total / goalCents) * 100) : 0;
  const matchedPercent = goalCents > 0 ? Math.min(100, (matchedCents / goalCents) * 100) : 0;
  const raisedPercent = Math.max(0, percent - matchedPercent);

  const textMain = tone === "light" ? "text-white" : "text-gray-900";
  const textSub = tone === "light" ? "text-white/70" : "text-gray-500";
  const trackBg = tone === "light" ? "bg-white/15" : "bg-gray-100";

  return (
    <div className="w-full">
      {showNumbers && (
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className={`${textMain} text-3xl sm:text-5xl font-bold tabular-nums leading-none`}>
              {formatUsd(total)}
            </div>
            <div className={`${textSub} text-xs sm:text-sm mt-1`}>
              raised of {formatUsd(goalCents)} goal
            </div>
          </div>
          <div className="text-right">
            <div className={`${textMain} text-2xl sm:text-3xl font-bold tabular-nums leading-none`}>
              {percent.toFixed(1)}%
            </div>
            <div className={`${textSub} text-xs sm:text-sm mt-1`}>
              {donorCount.toLocaleString()} {donorCount === 1 ? "donor" : "donors"}
            </div>
          </div>
        </div>
      )}

      <div className={`relative w-full h-4 sm:h-5 ${trackBg} rounded-full overflow-hidden`}>
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${raisedPercent}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        {matchedCents > 0 && (
          <motion.div
            className="absolute inset-y-0 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
            style={{ left: `${raisedPercent}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${matchedPercent}%` }}
            transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
          />
        )}
        {percent > 0 && (
          <motion.div
            className="absolute inset-y-0 w-[2px] bg-white/80"
            initial={{ left: 0 }}
            animate={{ left: `${Math.min(99, percent)}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        )}
      </div>

      {matchedCents > 0 && (
        <div className={`${textSub} text-xs mt-2 flex flex-wrap gap-3`}>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EF8046]" />
            Direct giving {formatUsd(raisedCents)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Matched {formatUsd(matchedCents)}
          </span>
        </div>
      )}
    </div>
  );
}
