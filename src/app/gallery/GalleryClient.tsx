"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ChevronLeft, ChevronRight, X, ArrowRight } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { FadeUp } from "@/components/ui/motion";
import type { GalleryPhoto } from "@/types/database";

const PHOTOS_PER_PAGE = 20;

/** Check if a URL is a remote Google CDN URL vs local path */
function isRemoteUrl(url: string) {
  return url.startsWith("http");
}

interface GalleryClientProps {
  photos: GalleryPhoto[];
  categories: string[];
}

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

function Lightbox({
  photos,
  currentIndex,
  onClose,
  onNext,
  onPrev,
}: {
  photos: GalleryPhoto[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const touchStartX = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, onNext, onPrev]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? onNext() : onPrev();
    }
  };

  const photo = photos[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-5 text-white/60 text-sm font-medium">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Previous */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Next */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Image */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.2 }}
        className="relative max-w-[90vw] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={photo.image_url}
          alt={photo.title}
          width={1200}
          height={800}
          className="max-h-[85vh] w-auto object-contain rounded-lg"
          unoptimized={isRemoteUrl(photo.image_url)}
          priority
        />
        {/* Caption overlay */}
        {(photo.title || photo.caption) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-5 rounded-b-lg">
            <p className="text-white font-semibold text-sm">{photo.title}</p>
            {photo.caption && (
              <p className="text-white/70 text-xs mt-1">{photo.caption}</p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Gallery
// ---------------------------------------------------------------------------

export default function GalleryClient({ photos, categories }: GalleryClientProps) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(PHOTOS_PER_PAGE);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Reset visible count when category changes
  useEffect(() => {
    setVisibleCount(PHOTOS_PER_PAGE);
  }, [activeCategory]);

  const filteredPhotos =
    activeCategory === "All"
      ? photos
      : photos.filter((p) => p.category === activeCategory);

  const visiblePhotos = filteredPhotos.slice(0, visibleCount);
  const hasMore = visibleCount < filteredPhotos.length;

  // Lightbox navigation within the FILTERED set
  const openLightbox = (filteredIndex: number) => setLightboxIndex(filteredIndex);
  const closeLightbox = () => setLightboxIndex(null);

  const nextPhoto = useCallback(() => {
    setLightboxIndex((prev) =>
      prev !== null ? (prev + 1) % filteredPhotos.length : null
    );
  }, [filteredPhotos.length]);

  const prevPhoto = useCallback(() => {
    setLightboxIndex((prev) =>
      prev !== null
        ? (prev - 1 + filteredPhotos.length) % filteredPhotos.length
        : null
    );
  }, [filteredPhotos.length]);

  return (
    <main className="min-h-screen">
      <Header />

      {/* ------------------------------------------------------------------ */}
      {/* Hero */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d3748] to-[#1a202c]" />

        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-3 mb-4"
          >
            <div className="w-8 h-px bg-[#EF8046]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#EF8046]">Memories &amp; Moments</span>
            <div className="w-8 h-px bg-[#EF8046]" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-5xl md:text-6xl font-bold mb-6 text-white"
          >
            Photo Gallery
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl max-w-2xl mx-auto text-gray-300"
          >
            A look at our community in action
          </motion.p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Filter Bar */}
      {/* ------------------------------------------------------------------ */}
      {categories.length > 0 && (
        <section className="py-6 bg-white sticky top-[72px] z-30 border-b border-gray-100 shadow-sm">
          <div className="container mx-auto px-6">
            <div className="flex flex-nowrap md:flex-wrap md:justify-center gap-2.5 overflow-x-auto scrollbar-hide pb-1">
              {["All", ...categories].map((cat) => (
                <motion.button
                  key={cat}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    activeCategory === cat
                      ? "bg-[#EF8046] text-white shadow-md"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </motion.button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Photo Grid */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-16 bg-[#FBFBFB] min-h-[60vh]">
        <div className="container mx-auto px-6">
          {filteredPhotos.length === 0 ? (
            /* Empty state */
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-[#EF8046]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Camera className="w-10 h-10 text-[#EF8046]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Photos Coming Soon
              </h3>
              <p className="text-gray-500">
                Check back after our next event!
              </p>
            </div>
          ) : (
            <>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5"
                >
                  {visiblePhotos.map((photo, index) => (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: Math.min(index * 0.04, 0.8),
                        duration: 0.4,
                      }}
                      className="break-inside-avoid"
                    >
                      <div
                        onClick={() => openLightbox(index)}
                        className="relative group cursor-pointer rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300"
                      >
                        <Image
                          src={photo.image_url}
                          alt={photo.title}
                          width={600}
                          height={400}
                          unoptimized={isRemoteUrl(photo.image_url)}
                          className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-end">
                          <div className="p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 w-full">
                            <p className="text-white font-semibold text-sm">
                              {photo.title}
                            </p>
                            {photo.caption && (
                              <p className="text-white/80 text-xs mt-1">
                                {photo.caption}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Load More */}
              {hasMore && (
                <div className="text-center mt-12">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() =>
                      setVisibleCount((prev) => prev + PHOTOS_PER_PAGE)
                    }
                    className="bg-white text-gray-700 px-8 py-3 rounded-full font-medium shadow-md hover:shadow-lg border border-gray-200 transition-all"
                  >
                    Load More Photos
                  </motion.button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* CTA */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20 bg-[#EF8046]">
        <div className="container mx-auto px-6 text-center">
          <FadeUp>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Want to Be in the Next Photo?
            </h2>
            <p className="text-white/90 text-lg max-w-2xl mx-auto mb-10">
              Join us at our next event and become part of the JRE community.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/events">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white text-[#EF8046] px-8 py-4 rounded-xl font-medium text-lg shadow-lg hover:shadow-xl transition-shadow flex items-center gap-2 mx-auto sm:mx-0"
                >
                  View Events
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
              <Link href="/contact">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-xl font-medium text-lg hover:bg-white hover:text-[#EF8046] transition-all mx-auto sm:mx-0"
                >
                  Contact Us
                </motion.button>
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>

      <Footer />

      {/* ------------------------------------------------------------------ */}
      {/* Lightbox */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            photos={filteredPhotos}
            currentIndex={lightboxIndex}
            onClose={closeLightbox}
            onNext={nextPhoto}
            onPrev={prevPhoto}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
