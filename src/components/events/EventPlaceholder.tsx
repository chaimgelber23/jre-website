"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface EventPlaceholderProps {
  title: string;
  date?: string;
  /** "card" = small card thumbnail, "featured" = featured spotlight, "hero" = full event detail hero */
  variant?: "card" | "featured" | "hero";
  className?: string;
}

/**
 * Professional text-based placeholder for events without a photo.
 * Designed to look like an elegant event poster/invitation using typography,
 * geometric accents, and brand colors.
 */
export default function EventPlaceholder({
  title,
  date,
  variant = "card",
  className = "",
}: EventPlaceholderProps) {
  // Split title for elegant two-line display if it's long
  const words = title.split(" ");
  const midpoint = Math.ceil(words.length / 2);
  const line1 = words.slice(0, midpoint).join(" ");
  const line2 = words.slice(midpoint).join(" ");
  const isShortTitle = words.length <= 3;

  const titleSizes = {
    card: "text-lg md:text-xl",
    featured: "text-2xl md:text-3xl",
    hero: "text-3xl md:text-5xl",
  };

  const subtitleSizes = {
    card: "text-[10px]",
    featured: "text-xs",
    hero: "text-sm",
  };

  const dateSizes = {
    card: "text-xs",
    featured: "text-sm",
    hero: "text-base md:text-lg",
  };

  const accentLineWidth = {
    card: "w-12",
    featured: "w-16",
    hero: "w-20",
  };

  const cornerSize = {
    card: "w-8 h-8 border-2",
    featured: "w-12 h-12 border-2",
    hero: "w-16 h-16 border-[3px]",
  };

  const padding = {
    card: "p-5",
    featured: "p-8",
    hero: "p-10 md:p-16",
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: "linear-gradient(135deg, #1a202c 0%, #2d3748 40%, #1a202c 100%)",
      }}
    >
      {/* Dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
          backgroundSize: variant === "card" ? "16px 16px" : "24px 24px",
        }}
      />

      {/* Subtle center radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, rgba(239, 128, 70, 0.08) 0%, transparent 70%)",
        }}
      />

      {/* Decorative diagonal lines */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 30px,
            rgba(255,255,255,0.5) 30px,
            rgba(255,255,255,0.5) 31px
          )`,
        }}
      />

      {/* Corner accents */}
      <div className={`absolute top-3 left-3 ${cornerSize[variant]} border-t border-l border-[#EF8046]/40 rounded-tl-lg`} />
      <div className={`absolute top-3 right-3 ${cornerSize[variant]} border-t border-r border-[#EF8046]/40 rounded-tr-lg`} />
      <div className={`absolute bottom-3 left-3 ${cornerSize[variant]} border-b border-l border-[#EF8046]/40 rounded-bl-lg`} />
      <div className={`absolute bottom-3 right-3 ${cornerSize[variant]} border-b border-r border-[#EF8046]/40 rounded-br-lg`} />

      {/* Content */}
      <div className={`relative z-10 h-full flex flex-col items-center justify-center text-center ${padding[variant]}`}>
        {/* "THE JRE PRESENTS" header */}
        <div className="flex items-center gap-2 mb-3">
          {variant !== "card" && (
            <div className="w-6 h-px bg-gradient-to-r from-transparent to-[#EF8046]/50" />
          )}
          <span className={`${subtitleSizes[variant]} font-semibold tracking-[0.25em] uppercase text-[#EF8046]/70`}>
            The JRE Presents
          </span>
          {variant !== "card" && (
            <div className="w-6 h-px bg-gradient-to-l from-transparent to-[#EF8046]/50" />
          )}
        </div>

        {/* Decorative sparkle */}
        {variant !== "card" && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="mb-3"
          >
            <Sparkles className="w-5 h-5 text-[#EF8046]/40" />
          </motion.div>
        )}

        {/* Event Title */}
        <div className={`${titleSizes[variant]} font-bold text-white leading-tight max-w-[90%]`}>
          {isShortTitle ? (
            <span>{title}</span>
          ) : (
            <>
              <span className="block">{line1}</span>
              <span className="block text-[#EF8046]">{line2}</span>
            </>
          )}
        </div>

        {/* Accent line */}
        <div className={`${accentLineWidth[variant]} h-0.5 bg-gradient-to-r from-transparent via-[#EF8046] to-transparent my-3`} />

        {/* Date */}
        {date && (
          <p className={`${dateSizes[variant]} text-gray-400 font-medium tracking-wide`}>
            {date}
          </p>
        )}
      </div>
    </div>
  );
}
