"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  url: string | null;
  onClose: () => void;
}

function toEmbed(url: string): { src: string; kind: "iframe" | "video" } {
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`, kind: "iframe" };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { src: `https://player.vimeo.com/video/${vm[1]}?autoplay=1`, kind: "iframe" };
  return { src: u, kind: "video" };
}

export default function VideoModal({ open, url, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!url) return null;
  const embed = toEmbed(url);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 md:p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close video"
              className="absolute -top-2 -right-2 md:top-3 md:right-3 z-10 w-10 h-10 rounded-full bg-white text-gray-900 flex items-center justify-center shadow-lg hover:scale-105 transition"
            >
              <X className="w-5 h-5" />
            </button>
            {embed.kind === "iframe" ? (
              <iframe
                src={embed.src}
                title="Campaign video"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="w-full h-full border-0"
              />
            ) : (
              <video src={embed.src} controls autoPlay className="w-full h-full bg-black" />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
