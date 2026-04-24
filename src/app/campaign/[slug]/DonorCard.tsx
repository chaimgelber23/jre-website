import { Heart, Users } from "lucide-react";
import { formatUsd } from "@/lib/campaign";
import type { PublicDonation } from "@/types/campaign";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) {
    const m = Math.floor(s / 60);
    return `${m}m ago`;
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    return `${h}h ago`;
  }
  const d = Math.floor(s / 86400);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

interface Props {
  d: PublicDonation;
  accent: string;
  /** Hides the team pill when every donor on the page is on the same team. */
  hideTeam?: boolean;
  campaignSlug?: string;
}

export default function DonorCard({ d, accent, hideTeam = false, campaignSlug }: Props) {
  const name = d.display_name || "Anonymous";
  const teamHref = d.team_slug && campaignSlug ? `/campaign/${campaignSlug}/team/${d.team_slug}` : null;
  const accentRgb = hexToRgb(accent);
  const isHighValue = d.amount_cents >= 50000; // $500+

  return (
    <div
      className="group relative bg-white border border-gray-100 rounded-2xl p-5 flex items-start gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-transparent"
      style={{ ["--accent" as string]: accent }}
    >
      {/* Left accent rail on hover — subtle premium cue */}
      <div
        aria-hidden
        className="absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: accent }}
      />

      {/* Avatar — gradient circle with subtle ring */}
      <div className="flex-shrink-0 relative">
        <div
          className="w-12 h-12 rounded-full text-white flex items-center justify-center font-bold text-sm ring-4 ring-white shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, rgba(${accentRgb}, 0.78) 100%)`,
          }}
        >
          {initials(name)}
        </div>
        {isHighValue && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm"
            aria-label="Featured supporter"
          >
            <span className="block w-2 h-2 rounded-full" style={{ background: accent }} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Top row: name + amount */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 text-[15px] leading-tight truncate">{name}</div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-gray-400 mt-1 tabular-nums">
              {timeAgo(d.created_at)}
            </div>
          </div>
          <div
            className="flex-shrink-0 font-extrabold tabular-nums text-lg leading-none tracking-tight"
            style={{ color: accent }}
          >
            {formatUsd(d.amount_cents)}
          </div>
        </div>

        {/* Message — quote-style with left accent bar */}
        {d.message && (
          <div
            dir="auto"
            className="mt-3 pl-3 border-l-2 text-sm leading-relaxed text-gray-700 italic line-clamp-3"
            style={{ borderColor: `rgba(${accentRgb}, 0.45)` }}
          >
            &ldquo;{d.message}&rdquo;
          </div>
        )}

        {/* Dedication — heart icon + soft accent text */}
        {d.dedication_name && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-700">
            <Heart className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
            <span className="text-gray-500">
              {d.dedication_type === "memory" ? "In memory of" : "In honor of"}
            </span>
            <span className="font-semibold text-gray-800 truncate">{d.dedication_name}</span>
          </div>
        )}

        {/* Team — pill badge */}
        {!hideTeam && d.team_name && (
          <div className="mt-3">
            {teamHref ? (
              <a
                href={teamHref}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
                style={{
                  background: `rgba(${accentRgb}, 0.08)`,
                  color: accent,
                }}
              >
                <Users className="w-3 h-3" />
                {d.team_name}
              </a>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{
                  background: `rgba(${accentRgb}, 0.08)`,
                  color: accent,
                }}
              >
                <Users className="w-3 h-3" />
                {d.team_name}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
