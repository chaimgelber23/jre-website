"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plane, MapPin, Calendar, CheckCircle2 } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const PRIMARY = "#B5838D";
const PRIMARY_HOVER = "#9B6B75";
const DARK_BG = "#9B6B75";
const DARKER_BG = "#7D5560";

const OPTIONS = [
  { value: "Excited to join", label: "That sounds amazing! Looking forward to joining." },
  { value: "Potentially interested", label: "I would potentially be interested in joining." },
  { value: "Cannot attend", label: "Unfortunately, I cannot attend." },
  { value: "Other", label: "Other" },
];

export default function IsraelTripInterestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !status) {
      setError("Please fill in your name, email, and select an option.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/interest/israel-trip-2026", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, status, comments }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen">
      <Header />

      <section
        className="relative pt-32 pb-16 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${DARK_BG} 0%, ${DARKER_BG} 100%)`,
        }}
      >
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-3 mb-6"
          >
            <div className="w-8 h-px bg-white/60" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Women&apos;s Trip · Interest Form
            </span>
            <div className="w-8 h-px bg-white/60" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-6xl font-bold text-white mb-6"
          >
            Israel Trip · November 2026
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6 text-white/90"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Week of November 1, 2026
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Israel
            </span>
            <span className="flex items-center gap-2">
              <Plane className="w-5 h-5" />
              Women only
            </span>
          </motion.div>
        </div>
      </section>

      <section className="py-16 bg-[#FBFBFB]">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-xl p-8 md:p-10"
            >
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle2
                    className="w-16 h-16 mx-auto mb-4"
                    style={{ color: PRIMARY }}
                  />
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    Thank you!
                  </h2>
                  <p className="text-gray-600">
                    Your response has been recorded. We&apos;ll be in touch as plans firm up.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-gray-700 leading-relaxed mb-8">
                    We&apos;re currently planning a women&apos;s Israel trip for the week of November 1st, 2026.
                    This trip requires a minimum number of attendees to move forward.
                    Please share your interest below so we can move ahead with crafting the most incredible and uplifting trip.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Name <span style={{ color: PRIMARY }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 transition-all"
                        style={{ "--tw-ring-color": PRIMARY } as React.CSSProperties}
                        onFocus={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email <span style={{ color: PRIMARY }}>*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 transition-all"
                        onFocus={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                      />
                    </div>

                    <div>
                      <p className="block text-sm font-semibold text-gray-700 mb-3">
                        Please select the option that best describes your status:{" "}
                        <span style={{ color: PRIMARY }}>*</span>
                      </p>
                      <div className="space-y-2">
                        {OPTIONS.map((opt) => {
                          const checked = status === opt.value;
                          return (
                            <label
                              key={opt.value}
                              className="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all"
                              style={{
                                borderColor: checked ? PRIMARY : "#e5e7eb",
                                backgroundColor: checked ? `${PRIMARY}10` : "#fff",
                              }}
                            >
                              <input
                                type="radio"
                                name="status"
                                value={opt.value}
                                checked={checked}
                                onChange={() => setStatus(opt.value)}
                                className="mt-1"
                                style={{ accentColor: PRIMARY }}
                              />
                              <span className="text-gray-800">{opt.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Additional details or comments {status === "Other" && <span style={{ color: PRIMARY }}>*</span>}
                      </label>
                      <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        rows={3}
                        placeholder={
                          status === "Other"
                            ? "Please tell us more..."
                            : "Anything you'd like us to know (optional)"
                        }
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none transition-all resize-none"
                        onFocus={(e) => (e.currentTarget.style.borderColor = PRIMARY)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                      />
                    </div>

                    {error && (
                      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <motion.button
                      type="submit"
                      disabled={submitting}
                      whileHover={{ scale: submitting ? 1 : 1.02, y: submitting ? 0 : -2 }}
                      whileTap={{ scale: submitting ? 1 : 0.98 }}
                      className="w-full text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{
                        background: submitting ? PRIMARY_HOVER : PRIMARY,
                        boxShadow: `0 10px 25px -5px ${PRIMARY}50`,
                      }}
                      onMouseEnter={(e) => {
                        if (!submitting) e.currentTarget.style.background = PRIMARY_HOVER;
                      }}
                      onMouseLeave={(e) => {
                        if (!submitting) e.currentTarget.style.background = PRIMARY;
                      }}
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </motion.button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
