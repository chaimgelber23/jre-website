import { formatUsd } from "@/lib/campaign";
import type { PublicDonation } from "@/types/campaign";

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

interface Props {
  d: PublicDonation;
  accent: string;
  /** When true, hides the "Donated to: <team>" row — used on team pages where every donor is on that team. */
  hideTeam?: boolean;
  campaignSlug?: string;
}

export default function DonorCard({ d, accent, hideTeam = false, campaignSlug }: Props) {
  const teamHref = d.team_slug && campaignSlug
    ? `/campaign/${campaignSlug}/team/${d.team_slug}`
    : null;

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
        {!hideTeam && d.team_name && (
          <div className="text-xs text-gray-500 mt-1 space-y-0.5">
            <div>
              with{" "}
              {teamHref ? (
                <a href={teamHref} className="underline" style={{ color: accent }}>{d.team_name}</a>
              ) : (
                <span className="underline" style={{ color: accent }}>{d.team_name}</span>
              )}
            </div>
            <div className="text-gray-500">
              <span className="font-medium text-gray-700">Donated to:</span>{" "}
              {teamHref ? (
                <a href={teamHref} className="underline" style={{ color: accent }}>{d.team_name}</a>
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
