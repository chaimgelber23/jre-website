"use client";

import { motion } from "framer-motion";
import { getEventTheme } from "@/lib/event-theme";

interface EventPlaceholderProps {
  title: string;
  date?: string;
  /** "card" = small card thumbnail, "featured" = featured spotlight, "hero" = full event detail hero */
  variant?: "card" | "featured" | "hero";
  /** Event theme_color value (e.g. "womens") - colors the placeholder accents */
  themeColor?: string | null;
  /** When true, only renders the decorative background (no text). Use for hero where overlay text is separate. */
  backgroundOnly?: boolean;
  className?: string;
}

type DateParts = { month: string; day: string; year: string } | null;

// Accepts ISO "2026-06-03" (parsed as local — no off-by-one),
// formatted strings like "Wednesday, June 3, 2026", or anything Date can parse.
function parseDateParts(input?: string): DateParts {
  if (!input) return null;
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return {
      month: dt.toLocaleString("en-US", { month: "short" }).toUpperCase(),
      day: String(parseInt(d, 10)).padStart(2, "0"),
      year: y,
    };
  }
  const dt = new Date(input);
  if (!isNaN(dt.getTime())) {
    return {
      month: dt.toLocaleString("en-US", { month: "short" }).toUpperCase(),
      day: String(dt.getDate()).padStart(2, "0"),
      year: String(dt.getFullYear()),
    };
  }
  return null;
}

/**
 * Editorial-style placeholder for events without a photo.
 * Restrained typography (system serif title, tracked-caps eyebrow + date),
 * warm theme-colored ambient glow, no decorative brackets or diagonal lines.
 */
export default function EventPlaceholder({
  title,
  date,
  variant = "card",
  themeColor,
  backgroundOnly = false,
  className = "",
}: EventPlaceholderProps) {
  const theme = getEventTheme(themeColor);
  const isLightTheme = theme.darkBg === "#ffffff" || theme.darkBg.toLowerCase() === "#fff";
  const textColor = isLightTheme ? "text-gray-900" : "text-white";
  const mutedColor = isLightTheme ? "text-gray-500" : "text-white/60";
  const ruleColor = isLightTheme ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.22)";

  const dateParts = parseDateParts(date);

  const sizes = {
    card: {
      eyebrow: "text-[9px]",
      eyebrowTrack: "tracking-[0.3em]",
      title: "text-base md:text-lg",
      meta: "text-[10px]",
      metaTrack: "tracking-[0.25em]",
      padding: "px-4 py-6",
      maxTitle: "max-w-[94%]",
      eyebrowGap: "mb-4",
      metaGap: "mt-4",
      eyebrowRule: "w-3",
      metaRule: "w-6",
    },
    featured: {
      eyebrow: "text-[10px]",
      eyebrowTrack: "tracking-[0.3em]",
      title: "text-2xl md:text-3xl",
      meta: "text-[11px] md:text-xs",
      metaTrack: "tracking-[0.25em]",
      padding: "px-5 py-7 md:px-6 md:py-8",
      maxTitle: "max-w-[88%]",
      eyebrowGap: "mb-5 md:mb-6",
      metaGap: "mt-5 md:mt-6",
      eyebrowRule: "w-4 md:w-6",
      metaRule: "w-7 md:w-10",
    },
    hero: {
      eyebrow: "text-[10px] md:text-xs lg:text-sm",
      eyebrowTrack: "tracking-[0.3em] md:tracking-[0.4em] lg:tracking-[0.45em]",
      title: "text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl",
      meta: "text-xs md:text-sm lg:text-base",
      metaTrack: "tracking-[0.2em] md:tracking-[0.28em] lg:tracking-[0.3em]",
      // Balanced padding for vertically-centered content. The hero now lives
      // in a flex-1 container above a natural-flow info bar, so the placeholder
      // doesn't need heavy bottom padding to clear an absolute-positioned
      // overlay anymore — the info bar takes whatever height it needs and the
      // placeholder fills the remaining space cleanly.
      padding: "px-5 py-12 sm:px-8 sm:py-14 md:px-16 md:py-16",
      maxTitle: "max-w-[92%] sm:max-w-3xl md:max-w-4xl",
      eyebrowGap: "mb-6 sm:mb-8 md:mb-10",
      metaGap: "mt-6 sm:mt-8 md:mt-10",
      eyebrowRule: "w-5 sm:w-8 md:w-12 lg:w-14",
      metaRule: "w-7 sm:w-12 md:w-16 lg:w-20",
    },
  };
  const s = sizes[variant];

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(180deg, ${theme.darkerBg} 0%, ${theme.darkBg} 55%, ${theme.darkBg} 100%)`,
      }}
    >
      {/* Single soft warm glow at top — gives the title a subtle stage */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 50% at 50% 30%, rgba(${theme.primaryRgb}, 0.09) 0%, transparent 65%)`,
        }}
      />

      {!backgroundOnly && (
        <div className={`relative z-10 h-full flex flex-col items-center justify-center text-center ${s.padding}`}>
          {/* Eyebrow: tracked caps with hairline rules */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`flex items-center gap-3 ${variant === "card" ? "" : s.eyebrowGap}`}
          >
            <span className={`block h-px ${s.eyebrowRule}`} style={{ backgroundColor: ruleColor }} />
            <span
              className={`${s.eyebrow} ${s.eyebrowTrack} font-medium uppercase whitespace-nowrap`}
              style={{ color: `rgba(${theme.primaryRgb}, 0.9)` }}
            >
              The JRE
            </span>
            <span className={`block h-px ${s.eyebrowRule}`} style={{ backgroundColor: ruleColor }} />
          </motion.div>

          {/* Hero + featured: full editorial — title + stacked date row.
              Card variant is eyebrow-only — the parent card body already shows
              title/description/date/time/location, and any added text in the
              image area either duplicated content or felt heavy. */}
          {variant !== "card" && (
            <>
              {/* Title: light-weight system serif, single voice (no color-split halves) */}
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className={`${s.title} ${s.maxTitle} ${textColor} font-serif font-normal leading-[1.05] tracking-tight break-words [text-wrap:balance]`}
              >
                {title}
              </motion.h1>

              {/* Date: editorial stacked caps with hairline rules */}
              {dateParts && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  className={`flex items-center gap-3 md:gap-4 ${s.metaGap}`}
                >
                  <span className={`block h-px ${s.metaRule}`} style={{ backgroundColor: ruleColor }} />
                  <span className={`${s.meta} ${s.metaTrack} ${mutedColor} font-medium uppercase whitespace-nowrap`}>
                    {dateParts.month} {dateParts.day}
                    <span className="mx-1.5 md:mx-2 opacity-50">·</span>
                    {dateParts.year}
                  </span>
                  <span className={`block h-px ${s.metaRule}`} style={{ backgroundColor: ruleColor }} />
                </motion.div>
              )}

              {/* Fallback for non-parseable date strings */}
              {!dateParts && date && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className={`${s.meta} ${s.metaTrack} ${mutedColor} font-medium uppercase ${s.metaGap}`}
                >
                  {date}
                </motion.p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
