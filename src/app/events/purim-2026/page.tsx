"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ArrowLeft,
  Plus,
  Check,
  CreditCard,
  PartyPopper,
  Music,
  Wine,
  Baby,
  Sparkles,
  Award,
  Star,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import CollectJsPayment, { useCollectJs } from "@/components/payment/CollectJsPayment";
// Square kept for backup - uncomment to switch processors
// import SquarePayment, { useSquarePayment } from "@/components/payment/SquarePayment";
import { SlideInLeft, SlideInRight } from "@/components/ui/motion";

// Purim Event Data
const purimEvent = {
  title: "JRE's Next-Level Purim Experience",
  subtitle: "Megillah, Music, Open Bar, Festive Banquet, Kids Activities & More",
  date: "Monday, March 2, 2026",
  time: "6:00 PM",
  location: "Life, The Place To Be - 2 Lawrence Street, Ardsley, NY, 10502",
  locationUrl: "https://maps.app.goo.gl/ibLU2DfYiH1ngTVd6",
  pricePerAdult: 40,
  kidsPrice: 10,
  familyMax: 100,
  image: "/images/events/purim-2026-banner.jpg",
  description: `Join us for an unforgettable Purim celebration featuring Megillah reading, live music, an open bar, a festive banquet, and activities for kids of all ages!

Experience the joy of Purim with your community as we celebrate together with delicious food, inspiring words, and joyful singing.

$40 per adult, $10 per child. Family max $100!`,
  sponsorships: [
    { name: "For The Love Purim with The JRE Sponsorship", price: 1800 },
    { name: "Rabbi Yossi \"The Whole Megilla\" Sponsorship", price: 1200 },
    { name: "The JRE Rebbetzins Queen Esther Sponsorship", price: 960 },
    { name: "Rabbi Avi's Purim Pastrami Sponsorship", price: 720 },
    { name: "Noisy Grogger Kids Play Sponsorship", price: 630 },
    { name: "Haman's Open Bar Tab Sponsorship", price: 540 },
    { name: "Spread The Simcha (Joy)", price: 360 },
    { name: "Designated Driver", price: 180 },
    { name: "Cover", price: 40 },
    { name: "\"Because I'm Happy\" Sponsorship - Any Amount", price: 0 },
  ],
};

export default function PurimEventPage() {
  const [numAdults, setNumAdults] = useState(1);
  const [numKids, setNumKids] = useState(0);
  const [selectedSponsorship, setSelectedSponsorship] = useState<string | null>(null);
  const [showSponsorship, setShowSponsorship] = useState(false);
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "check" | null>(null);
  // Payment processor: "banquest" (primary) or "square" (backup)
  const paymentProcessor = "banquest" as const;

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    cardName: "",
    message: "",
    honoreeEmail: "",
  });

  const [paymentToken, setPaymentToken] = useState<string | null>(null);
  const [cardValid, setCardValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Banquest tokenization hook
  const { requestToken } = useCollectJs();

  // Refs for auto-scroll
  const sponsorshipRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const registrationRef = useRef<HTMLDivElement>(null);

  // Scroll to registration form
  const scrollToRegistration = () => {
    registrationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Scroll to top on page load (disable browser scroll restoration)
  useEffect(() => {
    window.scrollTo(0, 0);
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // Elegant confetti celebration when registration is successful
  useEffect(() => {
    if (isSubmitted) {
      // Scroll to top so user can see the thank you message
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Brand colors: orange and complementary golds
      const colors = ["#EF8046", "#F5A623", "#D4A574", "#FFD700", "#FFA500"];

      // Fire confetti burst from center
      const fireConfetti = () => {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: colors,
          ticks: 200,
          gravity: 1.2,
          scalar: 0.9,
          drift: 0,
        });
      };

      // Initial burst
      fireConfetti();

      // Second subtle burst after a short delay
      setTimeout(() => {
        confetti({
          particleCount: 40,
          spread: 100,
          origin: { y: 0.5 },
          colors: colors,
          ticks: 150,
          gravity: 1,
          scalar: 0.7,
        });
      }, 200);
    }
  }, [isSubmitted]);

  // Calculate totals
  const getSponsorshipPrice = () => {
    if (!selectedSponsorship) return 0;
    const sponsorship = purimEvent.sponsorships.find((s) => s.name === selectedSponsorship);
    if (sponsorship?.price === 0) return customAmount;
    return sponsorship?.price || 0;
  };

  const sponsorshipPrice = getSponsorshipPrice();
  const calculatedTotal = numAdults * purimEvent.pricePerAdult + numKids * purimEvent.kidsPrice;
  const baseTotal = Math.min(calculatedTotal, purimEvent.familyMax);
  const total = sponsorshipPrice > 0 ? sponsorshipPrice : baseTotal;

  // Auto-scroll when expanding sections
  useEffect(() => {
    if (showSponsorship && sponsorshipRef.current) {
      setTimeout(() => {
        sponsorshipRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 150);
    }
  }, [showSponsorship]);

  // When a sponsorship is selected, scroll to show honor fields + total + payment + submit
  useEffect(() => {
    if (selectedSponsorship) {
      setTimeout(() => {
        if (totalRef.current) {
          totalRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
        }
      }, 400);
    }
  }, [selectedSponsorship]);

  // When payment method changes, scroll to show card fields + submit button
  useEffect(() => {
    if (paymentMethod && submitRef.current) {
      setTimeout(() => {
        submitRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 250);
    }
  }, [paymentMethod]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormState({
      ...formState,
      [e.target.name]: e.target.value,
    });
  };

  // Handle token received from Collect.js
  const handleTokenReceived = useCallback((token: string) => {
    setPaymentToken(token);
  }, []);

  // Handle payment errors from Collect.js
  const handlePaymentError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setIsSubmitting(false);
  }, []);

  // Handle card validation changes
  const handleValidationChange = useCallback((isValid: boolean) => {
    setCardValid(isValid);
  }, []);

  // Submit form with token
  const doSubmit = useCallback(async (token: string | null) => {
    try {
      const payload: Record<string, unknown> = {
        name: formState.name,
        email: formState.email,
        phone: formState.phone,
        totalAdults: numAdults,
        totalKids: numKids,
        sponsorship: selectedSponsorship,
        sponsorshipAmount: sponsorshipPrice,
        paymentMethod,
        paymentProcessor: paymentMethod === "online" ? paymentProcessor : undefined,
        amount: total,
        cardName: paymentMethod === "online" ? formState.cardName : undefined,
        message: formState.message,
        honoreeEmail: formState.honoreeEmail || null,
      };

      // Include payment token for online payment
      if (paymentMethod === "online" && token) {
        payload.paymentToken = token;
      }

      const response = await fetch("/api/events/purim-2026/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to register");
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error("Registration error:", err);
      setError(err instanceof Error ? err.message : "Failed to complete registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [formState, numAdults, numKids, selectedSponsorship, sponsorshipPrice, paymentMethod, paymentProcessor, total]);

  // When payment token is received, submit the form
  useEffect(() => {
    if (paymentToken && isSubmitting) {
      doSubmit(paymentToken);
      setPaymentToken(null); // Reset for next submission
    }
  }, [paymentToken, isSubmitting, doSubmit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // For online payments, tokenize first then submit
    if (paymentMethod === "online") {
      const tokenStarted = requestToken();
      if (!tokenStarted) {
        setError("Payment system not ready. Please try again.");
        setIsSubmitting(false);
      }
      // Token callback will trigger doSubmit via useEffect
    } else {
      // For check payments, submit directly
      doSubmit(null);
    }
  };

  if (isSubmitted) {
    return (
      <main className="min-h-screen">
        <Header />
        <section className="pt-32 pb-20 min-h-[80vh] flex items-center justify-center bg-[#FBFBFB]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md mx-auto px-6"
          >
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Thank You!</h1>
            <p className="text-xl text-gray-600 mb-2">
              Your registration has been submitted.
            </p>
            <p className="text-gray-500 mb-8">
              We&apos;re thrilled you&apos;ll be joining us for Purim! You will receive a confirmation email shortly.
            </p>
            <div className="bg-white rounded-xl p-6 shadow-md text-left mb-8">
              <h3 className="font-bold text-gray-900 mb-3">{purimEvent.title}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#EF8046]" />
                  <span>{purimEvent.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#EF8046]" />
                  <span>{purimEvent.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#EF8046]" />
                  <span>{purimEvent.location}</span>
                </div>
              </div>
            </div>
            <Link href="/events">
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="bg-[#EF8046] text-white px-8 py-3 rounded-lg font-medium"
              >
                Back to Events
              </motion.button>
            </Link>
          </motion.div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-24 pb-0">
        {/* Event flyer/banner image - shows full image */}
        <div
          className="relative h-[80vh] min-h-[500px] bg-black cursor-pointer group"
          onClick={scrollToRegistration}
        >
          <Image
            src={purimEvent.image}
            alt={purimEvent.title}
            fill
            className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            priority
          />
          {/* Scroll hint */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
            <span className="text-white/80 text-sm font-medium">Click to Register</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          </div>
          {/* Back button overlay */}
          <div className="absolute top-4 left-0 right-0 container mx-auto px-6 z-10">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-gray-800 hover:text-[#EF8046] transition-colors bg-white/90 hover:bg-white backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border border-white/20"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </Link>
          </div>
        </div>

        {/* Event title below image */}
        <div className="bg-black py-6">
          <div className="container mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[#EF8046] font-medium tracking-wider uppercase text-sm mb-1">
                We&apos;re thrilled you&apos;ll be joining us!
              </p>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
                {purimEvent.title}
              </h1>
              <p className="text-lg text-white/80 max-w-2xl">
                {purimEvent.subtitle}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Event Details */}
            <div className="lg:col-span-2">
              <SlideInLeft>
                {/* Event Info Cards */}
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  <div className="bg-[#FBFBFB] rounded-xl p-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-[#EF8046]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-6 h-6 text-[#EF8046]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="font-bold text-gray-900">{purimEvent.date}</p>
                    </div>
                  </div>
                  <div className="bg-[#FBFBFB] rounded-xl p-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-[#EF8046]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-6 h-6 text-[#EF8046]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Time</p>
                      <p className="font-bold text-gray-900">{purimEvent.time}</p>
                    </div>
                  </div>
                  <div className="bg-[#FBFBFB] rounded-xl p-6 flex items-start gap-4 sm:col-span-2">
                    <div className="w-12 h-12 bg-[#EF8046]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-6 h-6 text-[#EF8046]" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <a
                        href={purimEvent.locationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#EF8046] hover:underline"
                      >
                        {purimEvent.location}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Event Features */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                  {[
                    { icon: PartyPopper, label: "Megillah Reading" },
                    { icon: Music, label: "Live Music" },
                    { icon: Wine, label: "Open Bar" },
                    { icon: Baby, label: "Kids Activities" },
                  ].map((feature, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-br from-[#EF8046]/10 to-[#EF8046]/5 rounded-xl p-4 text-center"
                    >
                      <feature.icon className="w-8 h-8 text-[#EF8046] mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">{feature.label}</p>
                    </div>
                  ))}
                </div>

                {/* Pricing Info */}
                <div className="bg-[#FBFBFB] rounded-xl p-6 mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Pricing</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Adults</span>
                      <span className="font-medium">${purimEvent.pricePerAdult} per person</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Kids</span>
                      <span className="font-medium">${purimEvent.kidsPrice} per child</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-gray-900 font-semibold">Family Maximum</span>
                      <span className="font-bold text-[#EF8046]">${purimEvent.familyMax}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    Sponsorships available!
                  </p>
                </div>

                {/* Description */}
                <div className="prose prose-lg max-w-none">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Event</h2>
                  {purimEvent.description.split("\n\n").map((paragraph, index) => (
                    <p key={index} className="text-gray-600">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </SlideInLeft>
            </div>

            {/* Registration Form */}
            <div ref={registrationRef} className="lg:col-span-1 scroll-mt-28">
              <SlideInRight>
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 sticky top-28">
                  <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-[#EF8046] to-[#d96a2f] rounded-t-2xl">
                    <h3 className="text-xl font-bold text-white">Register Now</h3>
                    <p className="text-white/80 text-sm mt-1">
                      Secure your spot for Purim!
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Error Message */}
                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                      </div>
                    )}

                    {/* Your Details */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#EF8046]" />
                        Your Details
                      </h4>
                      <div className="space-y-3">
                        <input
                          type="text"
                          name="name"
                          value={formState.name}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                          placeholder="Full Name *"
                        />
                        <input
                          type="email"
                          name="email"
                          value={formState.email}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                          placeholder="Email Address *"
                        />
                        <input
                          type="tel"
                          name="phone"
                          value={formState.phone}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                          placeholder="Phone (optional)"
                        />
                      </div>
                    </div>

                    {/* Attendees */}
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="font-semibold text-gray-900 mb-4">Attendees</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-gray-700 text-sm">Adults</span>
                            <span className="text-gray-400 text-xs ml-1">(${purimEvent.pricePerAdult}/person)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setNumAdults(Math.max(1, numAdults - 1))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors text-lg"
                            >
                              &minus;
                            </button>
                            <span className="w-6 text-center font-bold text-gray-900">{numAdults}</span>
                            <button
                              type="button"
                              onClick={() => setNumAdults(numAdults + 1)}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors text-lg"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-gray-700 text-sm">Children</span>
                            <span className="text-gray-400 text-xs ml-1">(${purimEvent.kidsPrice}/child)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setNumKids(Math.max(0, numKids - 1))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors text-lg"
                            >
                              &minus;
                            </button>
                            <span className="w-6 text-center font-bold text-gray-900">{numKids}</span>
                            <button
                              type="button"
                              onClick={() => setNumKids(numKids + 1)}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors text-lg"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {calculatedTotal > purimEvent.familyMax && (
                          <p className="text-sm text-[#EF8046] font-medium">
                            Family max ${purimEvent.familyMax} applied!
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Sponsorship Toggle */}
                    <div className="pt-4 border-t border-gray-100">
                      <motion.button
                        type="button"
                        onClick={() => {
                          setShowSponsorship(!showSponsorship);
                          if (showSponsorship) {
                            setSelectedSponsorship(null);
                            setCustomAmount(0);
                          }
                        }}
                        className={`w-full relative overflow-hidden rounded-xl p-4 font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 ${showSponsorship
                            ? "bg-gray-50 text-gray-500 border border-gray-200"
                            : "bg-gradient-to-r from-[#EF8046] to-[#f59e0b] text-white shadow-lg shadow-[#EF8046]/25"
                          }`}
                        whileHover={{ scale: showSponsorship ? 1 : 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {!showSponsorship && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                            animate={{ x: ["-100%", "200%"] }}
                            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
                          />
                        )}
                        <span className="relative flex items-center gap-2">
                          {showSponsorship ? (
                            <>
                              <Plus className="w-4 h-4 rotate-45" />
                              Remove Sponsorship
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Become a Sponsor
                              <Award className="w-4 h-4" />
                            </>
                          )}
                        </span>
                      </motion.button>

                      <AnimatePresence>
                        {showSponsorship && (
                          <motion.div
                            ref={sponsorshipRef}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-3 pt-4">
                              <p className="text-xs text-gray-400 text-center font-medium tracking-wide uppercase">Select a sponsorship level</p>
                              {(() => {
                                const maxPrice = Math.max(...purimEvent.sponsorships.map(sp => sp.price), 1);
                                return purimEvent.sponsorships.map((s, i) => {
                                  const ratio = s.price / maxPrice;
                                  const isTop = ratio > 0.8;
                                  const isHigh = ratio > 0.5;
                                  const glowSpread = Math.round(ratio * 18);
                                  const glowAlpha = (ratio * 0.35).toFixed(2);
                                  const isSelected = selectedSponsorship === s.name;

                                  return (
                                    <motion.button
                                      key={s.name}
                                      type="button"
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={isSelected ? { opacity: 1, y: 0 } : {
                                        opacity: 1,
                                        y: 0,
                                        boxShadow: isHigh ? [
                                          `0 0 0px rgba(239, 128, 70, 0)`,
                                          `0 0 ${glowSpread}px rgba(239, 128, 70, ${glowAlpha})`,
                                          `0 0 0px rgba(239, 128, 70, 0)`,
                                        ] : "0 0 0px rgba(239, 128, 70, 0)",
                                      }}
                                      transition={isSelected ? { delay: 0 } : isHigh ? {
                                        opacity: { delay: i * 0.06, duration: 0.3 },
                                        y: { delay: i * 0.06, duration: 0.3 },
                                        boxShadow: { duration: 2.5, repeat: Infinity, repeatDelay: isTop ? 0.5 : 1.5, ease: "easeInOut" },
                                      } : { delay: i * 0.06 }}
                                      onClick={() => setSelectedSponsorship(isSelected ? null : s.name)}
                                      className={`w-full text-left rounded-xl p-4 border-2 transition-all duration-300 relative overflow-hidden group ${isSelected
                                          ? "border-[#EF8046] bg-[#EF8046]/5"
                                          : isTop
                                            ? "border-[#EF8046]/30 bg-gradient-to-r from-[#EF8046]/[0.03] to-white hover:border-[#EF8046]/60"
                                            : "border-gray-100 bg-white hover:border-[#EF8046]/40 hover:shadow-sm"
                                        }`}
                                    >
                                      {/* Shimmer for top-tier sponsorships */}
                                      {isHigh && !isSelected && (
                                        <motion.div
                                          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#EF8046]/[0.07] to-transparent"
                                          animate={{ x: ["-100%", "200%"] }}
                                          transition={{ duration: 3, repeat: Infinity, repeatDelay: isTop ? 2 : 4, ease: "easeInOut" }}
                                        />
                                      )}
                                      <div className="relative flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            {isTop ? (
                                              <motion.div
                                                animate={{ rotate: [0, 10, -10, 0] }}
                                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                              >
                                                <Star className="w-4 h-4 flex-shrink-0 text-[#EF8046] fill-[#EF8046]" />
                                              </motion.div>
                                            ) : (
                                              <Award className={`w-4 h-4 flex-shrink-0 transition-colors duration-300 ${isSelected ? "text-[#EF8046]" : isHigh ? "text-[#EF8046]/50" : "text-gray-300 group-hover:text-[#EF8046]/60"
                                                }`} />
                                            )}
                                            <p className={`font-semibold text-sm ${isTop && !isSelected ? "text-[#EF8046]" : "text-gray-900"}`}>{s.name}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 ml-4">
                                          <span className={`text-lg font-bold transition-colors duration-300 whitespace-nowrap ${isSelected ? "text-[#EF8046]" : isTop ? "text-[#EF8046]" : "text-gray-700"
                                            }`}>
                                            {s.price > 0 ? `$${s.price}` : "Any $"}
                                          </span>
                                          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-300 ${isSelected
                                              ? "border-[#EF8046] bg-[#EF8046]"
                                              : "border-gray-300 group-hover:border-[#EF8046]/40"
                                            }`}>
                                            {isSelected && (
                                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
                                                <Check className="w-3 h-3 text-white" />
                                              </motion.div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.button>
                                  );
                                });
                              })()}

                              {selectedSponsorship === "\"Because I'm Happy\" Sponsorship - Any Amount" && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                >
                                  <label className="text-xs text-gray-500 mb-1 block">Enter your amount:</label>
                                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-[#EF8046] focus-within:ring-2 focus-within:ring-[#EF8046]/20">
                                    <span className="px-3 py-2 bg-gray-50 text-gray-500 border-r">$</span>
                                    <input
                                      type="number"
                                      value={customAmount || ""}
                                      onChange={(e) => setCustomAmount(Number(e.target.value))}
                                      className="w-full px-3 py-2 outline-none text-sm"
                                      placeholder="0"
                                      min="1"
                                    />
                                  </div>
                                </motion.div>
                              )}

                              {selectedSponsorship && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="space-y-3"
                                >
                                  <textarea
                                    name="message"
                                    value={formState.message}
                                    onChange={handleChange}
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm resize-none"
                                    placeholder="In honor of... (optional)"
                                  />
                                  <input
                                    type="email"
                                    name="honoreeEmail"
                                    value={formState.honoreeEmail}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                                    placeholder="Honoree's email (optional - we'll notify them)"
                                  />
                                </motion.div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Total */}
                    <div ref={totalRef} className="bg-gradient-to-r from-[#EF8046]/10 to-[#EF8046]/5 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Total</span>
                        <motion.span
                          key={total}
                          initial={{ scale: 1.2, color: "#EF8046" }}
                          animate={{ scale: 1, color: "#EF8046" }}
                          className="text-3xl font-bold"
                        >
                          ${total}
                        </motion.span>
                      </div>
                      {!selectedSponsorship && (
                        <p className="text-xs text-gray-500 mt-1">
                          {numAdults} adult{numAdults > 1 ? "s" : ""} &times; ${purimEvent.pricePerAdult}
                          {numKids > 0 && ` + ${numKids} kid${numKids > 1 ? "s" : ""} \u00D7 $${purimEvent.kidsPrice}`}
                        </p>
                      )}
                      {selectedSponsorship && (
                        <p className="text-xs text-gray-500 mt-1">{selectedSponsorship}</p>
                      )}
                    </div>

                    {/* Payment Method */}
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="font-semibold text-gray-900 mb-3">Payment Method</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("online")}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${paymentMethod === "online"
                              ? "border-[#EF8046] bg-[#EF8046]/5 text-[#EF8046]"
                              : "border-gray-200 hover:border-gray-300 text-gray-500"
                            }`}
                        >
                          <CreditCard className="w-5 h-5 mx-auto mb-1" />
                          <span className="text-sm font-medium">Credit Card</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("check")}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${paymentMethod === "check"
                              ? "border-[#EF8046] bg-[#EF8046]/5 text-[#EF8046]"
                              : "border-gray-200 hover:border-gray-300 text-gray-500"
                            }`}
                        >
                          <span className="text-lg block mb-1">&#9993;</span>
                          <span className="text-sm font-medium">Send a Check</span>
                        </button>
                      </div>

                      {/* Card form (hidden until Credit Card selected) */}
                      <div className={paymentMethod === "online" ? "mt-4 space-y-3" : "hidden"}>
                        <input
                          type="text"
                          name="cardName"
                          value={formState.cardName}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                          placeholder="Name on Card"
                        />

                        {/* Banquest Tokenized Payment (PCI Compliant) */}
                        <CollectJsPayment
                          onTokenReceived={handleTokenReceived}
                          onError={handlePaymentError}
                          onValidationChange={handleValidationChange}
                          disabled={isSubmitting}
                        />
                      </div>

                      <AnimatePresence>
                        {paymentMethod === "check" && (
                          <motion.div
                            ref={paymentRef}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 overflow-hidden"
                          >
                            <div className="bg-[#FBFBFB] rounded-lg p-4 text-sm text-gray-600 space-y-2">
                              <p className="font-medium text-gray-900">Check Instructions:</p>
                              <p>Make check payable to: <strong>The JRE</strong></p>
                              <p>Please bring your check to the event or mail to:</p>
                              <p className="font-medium text-gray-900">1495 Weaver Street, Scarsdale, NY 10583</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Submit */}
                    <motion.button
                      ref={submitRef}
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full bg-[#EF8046] text-white py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#d96a2f] transition-colors disabled:opacity-70 shadow-lg"
                    >
                      {isSubmitting ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          />
                          Processing...
                        </>
                      ) : (
                        <>
                          <PartyPopper className="w-5 h-5" />
                          Confirm Registration
                        </>
                      )}
                    </motion.button>
                  </form>
                </div>
              </SlideInRight>
            </div>
          </div>
        </div>
      </section>

      <Footer bgColor="bg-black" />
    </main>
  );
}
