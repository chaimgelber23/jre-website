"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: string[];
  alt: string;
  autoplayMs?: number;
}

export default function HeroCarousel({ images, alt, autoplayMs = 6000 }: Props) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = images.length;

  const next = useCallback(() => setI((v) => (v + 1) % total), [total]);
  const prev = useCallback(() => setI((v) => (v - 1 + total) % total), [total]);

  useEffect(() => {
    if (paused || total < 2) return;
    const id = setInterval(next, autoplayMs);
    return () => clearInterval(id);
  }, [paused, total, autoplayMs, next]);

  if (total === 0) return null;

  return (
    <div
      className="relative w-full aspect-[21/9] md:aspect-[21/8] overflow-hidden bg-gray-100"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={images[i]}
          src={images[i]}
          alt={`${alt} — slide ${i + 1}`}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      </AnimatePresence>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous image"
            className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-gray-800 flex items-center justify-center shadow-md transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next image"
            className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-gray-800 flex items-center justify-center shadow-md transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setI(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: idx === i ? 28 : 8,
                  background: idx === i ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
