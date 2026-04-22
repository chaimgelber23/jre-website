"use client";

import { useEffect, useState } from "react";
import { getTimeRemaining } from "@/lib/campaign";

interface Props {
  startAt: string;
  endAt: string;
  tone?: "light" | "dark";
  compact?: boolean;
}

export default function Countdown({ startAt, endAt, tone = "dark", compact = false }: Props) {
  const [t, setT] = useState(() => getTimeRemaining(startAt, endAt));

  useEffect(() => {
    const id = setInterval(() => setT(getTimeRemaining(startAt, endAt)), 1000);
    return () => clearInterval(id);
  }, [startAt, endAt]);

  const label = !t.hasStarted ? "Starts in" : t.isEnded ? "Campaign ended" : "Time left";

  if (t.isEnded) {
    return (
      <div className={`text-center ${tone === "light" ? "text-white" : "text-gray-700"}`}>
        <div className={`text-xs uppercase tracking-[0.18em] ${tone === "light" ? "text-white/70" : "text-gray-500"}`}>
          Campaign ended
        </div>
        <div className="text-2xl font-bold mt-1">Thank you!</div>
      </div>
    );
  }

  const segments: Array<{ value: number; label: string }> = [
    { value: t.days, label: "Days" },
    { value: t.hours, label: "Hours" },
    { value: t.minutes, label: "Min" },
    { value: t.seconds, label: "Sec" },
  ];

  const textMain = tone === "light" ? "text-white" : "text-gray-900";
  const textSub = tone === "light" ? "text-white/70" : "text-gray-500";
  const bg = tone === "light" ? "bg-white/10" : "bg-white";
  const border = tone === "light" ? "border-white/20" : "border-gray-200";

  return (
    <div className="text-center">
      <div className={`text-[10px] sm:text-xs uppercase tracking-[0.18em] ${textSub} mb-2`}>{label}</div>
      <div className={`flex items-center justify-center ${compact ? "gap-1.5" : "gap-2 sm:gap-3"}`}>
        {segments.map((s, i) => (
          <div key={s.label} className="flex items-center">
            <div
              className={`${bg} border ${border} rounded-lg backdrop-blur-sm ${
                compact ? "px-2 py-1.5 min-w-[44px]" : "px-3 sm:px-4 py-2 sm:py-3 min-w-[56px] sm:min-w-[72px]"
              }`}
            >
              <div className={`${textMain} tabular-nums font-bold ${compact ? "text-lg" : "text-2xl sm:text-3xl"}`}>
                {String(s.value).padStart(2, "0")}
              </div>
              <div className={`${textSub} text-[9px] sm:text-[10px] uppercase tracking-[0.15em] mt-0.5`}>{s.label}</div>
            </div>
            {i < segments.length - 1 && !compact && (
              <div className={`${textSub} text-xl sm:text-2xl font-light px-1 sm:px-1.5`}>:</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
