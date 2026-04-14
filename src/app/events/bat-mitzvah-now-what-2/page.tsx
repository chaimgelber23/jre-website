"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, MapPin, Calendar, Clock, ArrowLeft, Heart } from "lucide-react";
import confetti from "canvas-confetti";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const THEME = {
  primary: "#B5838D",
  hover: "#9B6B75",
  darkBg: "#9B6B75",
  darkerBg: "#7D5560",
  rgb: "181, 131, 141",
};

const CONFETTI_COLORS = ["#B5838D", "#D4A5A5", "#E8C4C4", "#9B6B75", "#F2D7D5", "#ffffff"];

function fireConfetti() {
  const end = Date.now() + 2200;
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: CONFETTI_COLORS,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: CONFETTI_COLORS,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

export default function Event2Page() {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/events/bat-mitzvah-now-what-2/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          adults: 1,
          kids: 0,
          paymentMethod: "online",
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        fireConfetti();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      {/* Hero — flyer image */}
      <section
        className="relative w-full overflow-hidden"
        style={{ backgroundColor: THEME.darkBg, minHeight: "85vh" }}
      >
        {/* Back button */}
        <Link
          href="/events"
          className="absolute top-6 left-6 z-20 flex items-center gap-1.5 text-white/80 bg-black/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm hover:bg-black/30 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All Events
        </Link>

        {/* Blurred background */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/images/events/bat-mitzvah-now-what-2.png"
            alt=""
            fill
            className="object-cover blur-xl scale-110 opacity-40"
            priority
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Centered flyer card */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-4 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
          >
            <Image
              src="/images/events/bat-mitzvah-now-what-2.png"
              alt="I Had My Bat Mitzvah, Now What?"
              width={500}
              height={700}
              className="w-full h-auto object-contain"
              priority
            />
          </motion.div>

          {/* Bouncing scroll arrow */}
          <motion.button
            onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            className="mt-8 flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors cursor-pointer"
            aria-label="Scroll to RSVP form"
          >
            <span className="text-xs font-medium tracking-widest uppercase">RSVP Below</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.button>
        </div>

        {/* Bottom gradient */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, ${THEME.darkBg})` }}
        />
      </section>

      {/* Event info bar */}
      <div
        className="w-full py-4 px-4"
        style={{ backgroundColor: THEME.darkBg }}
      >
        <div className="max-w-xl mx-auto flex flex-wrap items-center justify-center gap-5 text-white text-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            <span>Sunday, April 19, 2026</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-3.5 h-3.5 text-white" />
            </div>
            <span>10:00 AM</span>
          </div>
          <a
            href="https://maps.google.com/?q=3+Bryant+Ave+White+Plains+NY"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="underline underline-offset-2 decoration-white/40">3 Bryant Ave, White Plains</span>
          </a>
        </div>
      </div>

      {/* RSVP / Success section */}
      <section
        className="min-h-screen py-16 px-4"
        style={{ backgroundColor: "#FBFBFB" }}
        ref={formRef}
      >
        <div className="max-w-md mx-auto">

          {/* Sponsor badge */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-center gap-2 mb-8"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-white shadow-sm"
              style={{ backgroundColor: THEME.primary }}
            >
              <Heart className="w-3.5 h-3.5 fill-white" />
              Generously sponsored by the Abramson Family
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {success ? (
              /* ── Success state ── */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-gray-100/80 overflow-hidden text-center"
              >
                {/* Header */}
                <div
                  className="px-8 pt-10 pb-6"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.hover})`,
                  }}
                >
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">You&apos;re Registered!</h2>
                  <p className="text-white/80 mt-1 text-sm">We can&apos;t wait to see you there</p>
                </div>

                {/* Details */}
                <div className="p-8 space-y-4">
                  <p className="text-gray-700">
                    <span className="font-semibold">{form.name}</span>, your spot is confirmed for{" "}
                    <span className="font-semibold">I Had My Bat Mitzvah, Now What?</span>
                  </p>
                  <p className="text-gray-500 text-sm">
                    A confirmation has been sent to <span className="font-medium text-gray-700">{form.email}</span>.
                  </p>

                  <div
                    className="mt-6 p-4 rounded-2xl text-sm space-y-2 text-left"
                    style={{ backgroundColor: `rgba(${THEME.rgb}, 0.08)` }}
                  >
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: THEME.primary }} />
                      <span>Sunday, April 19, 2026 at 10:00 AM</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: THEME.primary }} />
                      <span>3 Bryant Ave, White Plains, NY</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-4 italic">
                    This event is free — generously sponsored by the Abramson Family.
                  </p>
                </div>
              </motion.div>
            ) : (
              /* ── RSVP Form ── */
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-gray-100/80 overflow-hidden"
              >
                {/* Form header */}
                <div
                  className="relative px-8 py-7 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.hover})`,
                  }}
                >
                  {/* Shimmer sweep */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        background:
                          "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.6) 50%, transparent 60%)",
                        animation: "shimmer 6s ease-in-out infinite",
                      }}
                    />
                  </div>
                  <p className="text-white/70 text-xs font-semibold tracking-widest uppercase mb-1">
                    JRE Girls Edition
                  </p>
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    Reserve Your Spot
                  </h2>

                </div>

                {/* Form body */}
                <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
                  {/* Teen's Name */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Teen&apos;s Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="First and last name"
                      required
                      className="w-full px-5 py-3.5 rounded-xl border border-gray-200/80 bg-[#FAFAFA] text-sm outline-none transition-all duration-200 placeholder:text-gray-400"
                      onFocus={(e) => {
                        e.target.style.borderColor = THEME.primary;
                        e.target.style.boxShadow = `0 0 0 4px rgba(${THEME.rgb}, 0.10)`;
                        e.target.style.backgroundColor = "#ffffff";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(209, 213, 219, 0.8)";
                        e.target.style.boxShadow = "none";
                        e.target.style.backgroundColor = "#FAFAFA";
                      }}
                    />
                  </div>

                  {/* Parent's Email */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Parent&apos;s Email <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="parent@example.com"
                      required
                      className="w-full px-5 py-3.5 rounded-xl border border-gray-200/80 bg-[#FAFAFA] text-sm outline-none transition-all duration-200 placeholder:text-gray-400"
                      onFocus={(e) => {
                        e.target.style.borderColor = THEME.primary;
                        e.target.style.boxShadow = `0 0 0 4px rgba(${THEME.rgb}, 0.10)`;
                        e.target.style.backgroundColor = "#ffffff";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(209, 213, 219, 0.8)";
                        e.target.style.boxShadow = "none";
                        e.target.style.backgroundColor = "#FAFAFA";
                      }}
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Phone Number <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="(914) 555-0000"
                      required
                      className="w-full px-5 py-3.5 rounded-xl border border-gray-200/80 bg-[#FAFAFA] text-sm outline-none transition-all duration-200 placeholder:text-gray-400"
                      onFocus={(e) => {
                        e.target.style.borderColor = THEME.primary;
                        e.target.style.boxShadow = `0 0 0 4px rgba(${THEME.rgb}, 0.10)`;
                        e.target.style.backgroundColor = "#ffffff";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "rgba(209, 213, 219, 0.8)";
                        e.target.style.boxShadow = "none";
                        e.target.style.backgroundColor = "#FAFAFA";
                      }}
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3"
                    >
                      {error}
                    </motion.p>
                  )}

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative w-full py-5 rounded-2xl font-bold text-lg text-white overflow-hidden transition-all duration-300 disabled:opacity-70"
                    style={{
                      background: `linear-gradient(135deg, ${THEME.primary}, ${THEME.hover})`,
                      boxShadow: loading
                        ? "none"
                        : `0 4px 20px rgba(${THEME.rgb}, 0.35)`,
                    }}
                  >
                    {/* Shimmer sweep */}
                    <span className="absolute inset-0 overflow-hidden pointer-events-none">
                      <span
                        className="absolute inset-0 opacity-30"
                        style={{
                          background:
                            "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.7) 50%, transparent 60%)",
                          animation: "shimmer 3s ease-in-out infinite",
                        }}
                      />
                    </span>
                    <span className="relative">
                      {loading ? "Submitting..." : "RSVP Now"}
                    </span>
                  </button>


                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <Footer />

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}
