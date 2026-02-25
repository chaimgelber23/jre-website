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
  Minus,
  Check,
  CreditCard,
  Ticket,
  Sparkles,
  Award,
  Star,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
// KEPT FOR FALLBACK: Banquest Hosted Tokenization (has expiry encoding bug as of Feb 2026)
// import CollectJsPayment, { useCollectJs } from "@/components/payment/CollectJsPayment";
// Square kept for backup - uncomment to switch processors
// import SquarePayment, { useSquarePayment } from "@/components/payment/SquarePayment";
import { Lock } from "lucide-react";

// Purim Event Data
const purimEvent = {
  title: "JRE Purim Extravaganza",
  subtitle: "Megillah, Music, Open Bar, Festive Banquet, Kids Activities & More",
  date: "Monday, March 2, 2026",
  time: "6:00 PM",
  location: "Life, The Place To Be - 2 Lawrence Street, Ardsley, NY, 10502",
  locationUrl: "https://maps.app.goo.gl/ibLU2DfYiH1ngTVd6",
  pricePerAdult: 40,
  kidsPrice: 10,
  familyMax: 110,
  image: "/images/events/purim-2026-banner.jpg",
  description: `Join us for an unforgettable Purim celebration featuring Megillah reading, live music, an open bar, a festive banquet, and activities for kids of all ages!

Experience the joy of Purim with your community as we celebrate together with delicious food, inspiring words, and joyful singing.

$40 per adult, $10 per child. Family max $110!`,
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

// Theme colors (Purim uses black/orange theme)
const theme = {
  primary: "#EF8046",
  primaryHover: "#d96a2f",
  darkBg: "#000000",
  darkerBg: "#000000",
  primaryRgb: "239, 128, 70",
};

const themeVars = {
  "--theme-primary": theme.primary,
  "--theme-hover": theme.primaryHover,
  "--theme-dark": theme.darkBg,
  "--theme-darker": theme.darkerBg,
  "--theme-rgb": theme.primaryRgb,
} as React.CSSProperties;

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
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    message: "",
    honoreeEmail: "",
  });

  // Guest details for additional adults (beyond the registrant)
  const [guestDetails, setGuestDetails] = useState<{ name: string; email: string }[]>([]);

  // Sync guest details array when numAdults changes
  useEffect(() => {
    const additionalGuests = Math.max(0, numAdults - 1);
    setGuestDetails((prev) => {
      if (prev.length === additionalGuests) return prev;
      if (prev.length < additionalGuests) {
        return [...prev, ...Array(additionalGuests - prev.length).fill(null).map(() => ({ name: "", email: "" }))];
      }
      return prev.slice(0, additionalGuests);
    });
  }, [numAdults]);

  const updateGuest = (index: number, field: "name" | "email", value: string) => {
    setGuestDetails((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  };

  // KEPT FOR FALLBACK: Tokenization state
  // const [paymentToken, setPaymentToken] = useState<string | null>(null);
  // const { requestToken } = useCollectJs();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestErrors, setGuestErrors] = useState<boolean[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{ name?: boolean; email?: boolean }>({});

  // Refs for auto-scroll
  const sponsorshipRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const registrationRef = useRef<HTMLDivElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const cardNameRef = useRef<HTMLInputElement>(null);
  const cardNumberRef = useRef<HTMLInputElement>(null);
  const cardExpiryRef = useRef<HTMLInputElement>(null);
  const cardCvvRef = useRef<HTMLInputElement>(null);

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

  // KEPT FOR FALLBACK: Tokenization callbacks
  // const handleTokenReceived = useCallback((token: string) => { setPaymentToken(token); }, []);
  // const handlePaymentError = useCallback((errorMsg: string) => { setError(errorMsg); setIsSubmitting(false); }, []);
  // const handleValidationChange = useCallback((isValid: boolean) => { setCardValid(isValid); }, []);

  // Card number formatting: adds spaces every 4 digits (e.g., "4111 1111 1111 1111")
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  // Expiry formatting: auto-inserts slash (e.g., "03/26")
  const formatExpiry = (value: string, prevValue: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    // Auto-add slash after 2 digits (but not when deleting)
    if (digits.length >= 2 && value.length > prevValue.length) {
      return digits.slice(0, 2) + "/" + digits.slice(2);
    }
    if (digits.length >= 3) {
      return digits.slice(0, 2) + "/" + digits.slice(2);
    }
    return digits;
  };

  // Enter key handler for card fields - jump to next field
  const handleCardKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLInputElement | null> | null
  ) => {
    if (e.key === "Enter" && nextRef?.current) {
      e.preventDefault();
      nextRef.current.focus();
    }
  };

  // Submit form with direct card data
  const doSubmit = useCallback(async () => {
    try {
      const payload: Record<string, unknown> = {
        name: formState.name,
        email: formState.email,
        phone: formState.phone,
        totalAdults: numAdults,
        totalKids: numKids,
        guests: guestDetails.filter((g) => g.name.trim()),
        sponsorship: selectedSponsorship,
        sponsorshipAmount: sponsorshipPrice,
        paymentMethod,
        paymentProcessor: paymentMethod === "online" ? paymentProcessor : undefined,
        amount: total,
        cardName: paymentMethod === "online" ? formState.cardName : undefined,
        message: formState.message,
        honoreeEmail: formState.honoreeEmail || null,
      };

      // Include card data for online payment (direct card input - matches old working site)
      if (paymentMethod === "online") {
        payload.cardNumber = formState.cardNumber.replace(/\s/g, "");
        payload.cardExpiry = formState.cardExpiry;
        payload.cardCvv = formState.cardCvv;
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
  }, [formState, numAdults, numKids, guestDetails, selectedSponsorship, sponsorshipPrice, paymentMethod, paymentProcessor, total]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGuestErrors([]);
    setFieldErrors({});

    // Validate registrant name
    if (!formState.name.trim()) {
      setError("Please enter your full name.");
      setFieldErrors({ name: true });
      document.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
      return;
    }

    // Validate registrant email
    if (!formState.email.trim()) {
      setError("Please enter your email address.");
      setFieldErrors({ email: true });
      document.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
      return;
    }

    // Validate guest names for additional adults
    if (guestDetails.length > 0) {
      const errors = guestDetails.map((g) => !g.name.trim());
      if (errors.some(Boolean)) {
        const missingCount = errors.filter(Boolean).length;
        setGuestErrors(errors);
        setError(
          missingCount === 1
            ? "Please enter the name for your guest."
            : `Please enter the names for all ${missingCount} guests.`
        );
        // Scroll to and focus the first empty guest name field
        const firstErrorIndex = errors.findIndex(Boolean);
        const guestInputs = document.querySelectorAll<HTMLInputElement>('[data-guest-name]');
        if (guestInputs[firstErrorIndex]) {
          guestInputs[firstErrorIndex].scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => guestInputs[firstErrorIndex].focus(), 400);
        }
        return;
      }
    }

    // Require a payment method
    if (!paymentMethod) {
      setError("Please select a payment method.");
      return;
    }

    // Validate card fields for online payment
    if (paymentMethod === "online") {
      const cardNum = formState.cardNumber.replace(/\s/g, "");
      if (cardNum.length < 14) {
        setError("Please enter a valid card number.");
        return;
      }
      if (!formState.cardExpiry || !formState.cardExpiry.includes("/")) {
        setError("Please enter the card expiry date (MM/YY).");
        return;
      }
      const [mm, yy] = formState.cardExpiry.split("/");
      if (!mm || !yy || parseInt(mm) < 1 || parseInt(mm) > 12) {
        setError("Invalid expiry month. Please use MM/YY format.");
        return;
      }
      if (!formState.cardCvv || formState.cardCvv.length < 3) {
        setError("Please enter the CVV code from your card.");
        return;
      }
    }

    setIsSubmitting(true);
    doSubmit();
  };

  // ---------- Success State ----------
  if (isSubmitted) {
    return (
      <main className="min-h-screen">
        <Header />
        <section className="pt-32 pb-20 min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-[#FBFBFB] to-white relative overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-lg mx-auto px-6 relative z-10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Check className="w-12 h-12 text-green-500" />
            </motion.div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">You&apos;re All Set!</h1>
            <p className="text-xl text-gray-600 mb-2">
              Your registration has been submitted.
            </p>
            <p className="text-gray-500 mb-8">
              We&apos;re thrilled you&apos;ll be joining us for Purim! You will receive a confirmation email shortly.
            </p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-left mb-8"
            >
              <h3 className="font-bold text-gray-900 mb-4">{purimEvent.title}</h3>
              <div className="space-y-3 text-sm text-gray-600 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--theme-primary)]/10 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-[var(--theme-primary)]" />
                  </div>
                  <span>{purimEvent.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--theme-primary)]/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[var(--theme-primary)]" />
                  </div>
                  <span>{purimEvent.time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--theme-primary)]/10 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-[var(--theme-primary)]" />
                  </div>
                  <a
                    href={purimEvent.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--theme-primary)] hover:underline"
                  >
                    {purimEvent.location}
                  </a>
                </div>
              </div>
            </motion.div>
            <Link href="/events">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-[var(--theme-primary)] text-white px-8 py-3 rounded font-medium hover:bg-[var(--theme-hover)] transition-colors"
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

  // ---------- Main Page ----------
  return (
    <main className="min-h-screen bg-[#FBFBFB]" style={themeVars}>
      <Header />

      {/* Hero Section */}
      <section
        className="relative pt-24 cursor-pointer group"
        style={{ background: "#000" }}
        onClick={scrollToRegistration}
      >
        <h1 className="sr-only">{purimEvent.title}</h1>

        {/* Image area */}
        <div className="relative h-[85vh] min-h-[600px] bg-black">
          <Image
            src={purimEvent.image}
            alt={purimEvent.title}
            fill
            className="object-contain transition-transform duration-300 group-hover:scale-[1.02]"
            priority
          />

          {/* Back to Events - top left */}
          <div className="absolute top-4 left-0 right-0 container mx-auto px-6 z-10">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg transition-colors text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </Link>
          </div>

          {/* Bottom overlay: info bar + click to register */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            {/* Gradient fade from transparent to dark */}
            <div
              className="h-24"
              style={{
                background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))",
              }}
            />
            <div style={{ background: "rgba(0,0,0,0.85)" }} className="pb-6 pt-1">
              <div className="container mx-auto px-6">
                {/* Info icons row */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-5"
                >
                  <span className="flex items-center gap-2 text-white/90 text-sm">
                    <div className="w-7 h-7 bg-[var(--theme-primary)]/20 rounded-lg flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-[var(--theme-primary)]" />
                    </div>
                    <span className="font-medium">{purimEvent.date}</span>
                  </span>
                  <span className="flex items-center gap-2 text-white/90 text-sm">
                    <div className="w-7 h-7 bg-[var(--theme-primary)]/20 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-[var(--theme-primary)]" />
                    </div>
                    <span className="font-medium">{purimEvent.time}</span>
                  </span>
                  <a
                    href={purimEvent.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-white/90 text-sm hover:text-white transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-7 h-7 bg-[var(--theme-primary)]/20 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-[var(--theme-primary)]" />
                    </div>
                    <span className="font-medium">Life, The Place To Be &mdash; Ardsley, NY</span>
                  </a>
                </motion.div>

                {/* Click to Register */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity"
                >
                  <span className="text-white text-sm font-medium tracking-wide">Click to Register</span>
                  <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <svg className="w-5 h-5 text-[var(--theme-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="pt-12 pb-24 bg-white relative">
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-5 gap-10">
            {/* Event Details - Left Column */}
            <div className="lg:col-span-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Event Details Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-10">
                  <h3 className="text-xs font-semibold text-gray-400 tracking-[0.15em] uppercase mb-5">Event Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-[var(--theme-primary)]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-[var(--theme-primary)]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{purimEvent.date}</p>
                        <p className="text-sm text-gray-500">{purimEvent.time}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-[var(--theme-primary)]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-[var(--theme-primary)]" />
                      </div>
                      <div>
                        <a
                          href={purimEvent.locationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-gray-900 hover:text-[var(--theme-primary)] transition-colors"
                        >
                          Life, The Place To Be
                        </a>
                        <a
                          href={purimEvent.locationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[var(--theme-primary)] hover:underline block mt-0.5"
                        >
                          2 Lawrence Street, Ardsley, NY 10502
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event Highlights */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                  {[
                    { icon: Star, label: "Megillah Reading" },
                    { icon: Sparkles, label: "Live Music" },
                    { icon: Award, label: "Open Bar" },
                    { icon: Users, label: "Kids Activities" },
                  ].map((feature, index) => (
                    <div
                      key={index}
                      className="bg-gradient-to-br from-[var(--theme-primary)]/10 to-[var(--theme-primary)]/5 rounded-xl p-4 text-center"
                    >
                      <feature.icon className="w-6 h-6 text-[var(--theme-primary)] mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">{feature.label}</p>
                    </div>
                  ))}
                </div>

                {/* Description */}
                <div className="mb-10">
                  <h2 className="text-3xl font-bold text-gray-900 mb-5">About This Event</h2>
                  <div className="prose prose-lg max-w-prose text-gray-600 text-lg leading-relaxed">
                    {purimEvent.description.split("\n\n").map((paragraph, index) => (
                      <p key={index} className="mb-5">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Pricing */}
                <div className="bg-[#FBFBFB] rounded-2xl p-8 mb-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-5">Pricing</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-600 text-lg">Adults</span>
                      <span className="font-semibold text-gray-900 text-lg">${purimEvent.pricePerAdult} per person</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200">
                      <span className="text-gray-600 text-lg">Kids</span>
                      <span className="font-semibold text-gray-900 text-lg">${purimEvent.kidsPrice} per child</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-gray-900 font-semibold text-lg">Family Maximum</span>
                      <span className="font-bold text-[var(--theme-primary)] text-lg">${purimEvent.familyMax}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-4">
                    Sponsorships available!
                  </p>
                </div>

                {/* Sponsorship Tiers Preview */}
                <div className="bg-[#FBFBFB] rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-[var(--theme-primary)]" />
                    Sponsorship Opportunities
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {purimEvent.sponsorships.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-100"
                      >
                        <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                        <span className="text-[var(--theme-primary)] font-bold ml-4">
                          {s.price > 0 ? `$${s.price}` : "Any $"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Registration Form - Right Column */}
            <div ref={registrationRef} className="lg:col-span-2 scroll-mt-28">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div ref={formContainerRef} className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-gray-100/80 overflow-hidden sticky top-28">
                  {/* Form Header */}
                  <div className="relative bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-hover)] px-8 py-5 text-white overflow-hidden">
                    {/* Subtle shine sweep */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-200%] animate-[shimmer_6s_ease-in-out_infinite]" />
                    <div className="relative">
                      <p className="text-white/70 text-[10px] font-medium tracking-[0.2em] uppercase mb-1">
                        Reserve Your Spot
                      </p>
                      <h3 className="text-xl font-bold">
                        Register Now
                      </h3>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="p-8 space-y-7">
                    {/* Error Message */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2"
                        ref={(el) => el?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
                      >
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {error}
                      </motion.div>
                    )}

                    {/* Your Details */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 tracking-[0.15em] uppercase mb-4">
                        Your Details
                      </h4>
                      <div className="space-y-3.5">
                        <div>
                          <input
                            type="text"
                            name="name"
                            value={formState.name}
                            onChange={(e) => {
                              handleChange(e);
                              if (fieldErrors.name && e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, name: false }));
                            }}
                            className={`w-full px-5 py-3.5 rounded-xl border outline-none text-sm transition-all duration-200 placeholder:text-gray-400 ${
                              fieldErrors.name
                                ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-4 focus:ring-red-200/50"
                                : "border-gray-200/80 bg-[#FAFAFA] focus:bg-white focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/10"
                            }`}
                            placeholder="Full Name *"
                          />
                          {fieldErrors.name && (
                            <p className="text-xs text-red-500 mt-1">Your name is required</p>
                          )}
                        </div>
                        <div>
                          <input
                            type="email"
                            name="email"
                            value={formState.email}
                            onChange={(e) => {
                              handleChange(e);
                              if (fieldErrors.email && e.target.value.trim()) setFieldErrors((prev) => ({ ...prev, email: false }));
                            }}
                            className={`w-full px-5 py-3.5 rounded-xl border outline-none text-sm transition-all duration-200 placeholder:text-gray-400 ${
                              fieldErrors.email
                                ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-4 focus:ring-red-200/50"
                                : "border-gray-200/80 bg-[#FAFAFA] focus:bg-white focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/10"
                            }`}
                            placeholder="Email Address *"
                          />
                          {fieldErrors.email && (
                            <p className="text-xs text-red-500 mt-1">Your email is required</p>
                          )}
                        </div>
                        <input
                          type="tel"
                          name="phone"
                          value={formState.phone}
                          onChange={handleChange}
                          className="w-full px-5 py-3.5 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:bg-white focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/10 outline-none text-sm transition-all duration-200 placeholder:text-gray-400"
                          placeholder="Phone (optional)"
                        />
                      </div>
                    </div>

                    {/* Attendees */}
                    <div className="pt-6 border-t border-gray-100/80">
                      <h4 className="text-xs font-semibold text-gray-400 tracking-[0.15em] uppercase mb-5">Attendees</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-[#FAFAFA] rounded-xl px-5 py-4">
                          <div>
                            <span className="text-gray-800 text-sm font-medium">Adults</span>
                            <span className="text-gray-400 text-xs ml-1.5">${purimEvent.pricePerAdult} each</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setNumAdults(Math.max(1, numAdults - 1))}
                              className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 transition-all duration-200 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center font-bold text-gray-900 text-lg tabular-nums">{numAdults}</span>
                            <button
                              type="button"
                              onClick={() => setNumAdults(numAdults + 1)}
                              className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 transition-all duration-200 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between bg-[#FAFAFA] rounded-xl px-5 py-4">
                          <div>
                            <span className="text-gray-800 text-sm font-medium">Children</span>
                            <span className="text-gray-400 text-xs ml-1.5">${purimEvent.kidsPrice} each</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => setNumKids(Math.max(0, numKids - 1))}
                              className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 transition-all duration-200 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center font-bold text-gray-900 text-lg tabular-nums">{numKids}</span>
                            <button
                              type="button"
                              onClick={() => setNumKids(numKids + 1)}
                              className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 transition-all duration-200 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {calculatedTotal > purimEvent.familyMax && (
                          <p className="text-sm text-[var(--theme-primary)] font-medium">
                            Family max ${purimEvent.familyMax} applied!
                          </p>
                        )}
                      </div>

                      {/* Guest details for additional adults */}
                      {guestDetails.length > 0 && (
                        <div className="mt-4 space-y-4">
                          <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">Guest Details</p>
                          {guestDetails.map((guest, index) => (
                            <div key={index} className="space-y-2 bg-[#FAFAFA] rounded-xl p-4">
                              <p className="text-xs text-gray-400 font-medium">Guest {index + 1}</p>
                              <div>
                                <input
                                  type="text"
                                  data-guest-name
                                  value={guest.name}
                                  onChange={(e) => {
                                    updateGuest(index, "name", e.target.value);
                                    if (guestErrors[index] && e.target.value.trim()) {
                                      setGuestErrors((prev) => prev.map((err, i) => (i === index ? false : err)));
                                    }
                                  }}
                                  className={`w-full px-5 py-3.5 rounded-xl border outline-none text-sm transition-all duration-200 placeholder:text-gray-400 ${
                                    guestErrors[index]
                                      ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-4 focus:ring-red-200/50"
                                      : "border-gray-200/80 bg-white focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/10"
                                  }`}
                                  placeholder="Guest name *"
                                />
                                {guestErrors[index] && (
                                  <p className="text-xs text-red-500 mt-1">Please enter this guest&apos;s name</p>
                                )}
                              </div>
                              <input
                                type="email"
                                value={guest.email}
                                onChange={(e) => updateGuest(index, "email", e.target.value)}
                                className="w-full px-5 py-3.5 rounded-xl border border-gray-200/80 bg-white focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/10 outline-none text-sm transition-all duration-200 placeholder:text-gray-400"
                                placeholder="Guest email (optional)"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sponsorship Toggle */}
                    <div className="pt-5 border-t border-gray-100/80">
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
                            ? "bg-gray-50 text-gray-500 border border-transparent hover:bg-gray-100"
                            : "border-2 border-[var(--theme-primary)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/5 shadow-sm"
                          }`}
                        whileHover={{ scale: showSponsorship ? 1 : 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="relative flex items-center gap-2">
                          {showSponsorship ? (
                            <>
                              <Plus className="w-4 h-4 rotate-45" />
                              Remove Sponsorship
                            </>
                          ) : (
                            <>
                              <Star className="w-4 h-4" />
                              Become a Sponsor
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
                                  const isSelected = selectedSponsorship === s.name;

                                  return (
                                    <motion.button
                                      key={s.name}
                                      type="button"
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{
                                        opacity: 1,
                                        x: 0,
                                        scale: isTop && !isSelected ? [1, 1.015, 1] : 1,
                                        boxShadow: isSelected
                                          ? `0 4px 20px rgba(${theme.primaryRgb}, 0.25)`
                                          : isTop
                                            ? [
                                              `0 2px 8px rgba(${theme.primaryRgb}, 0.1)`,
                                              `0 4px 24px rgba(${theme.primaryRgb}, 0.3)`,
                                              `0 2px 8px rgba(${theme.primaryRgb}, 0.1)`,
                                            ]
                                            : isHigh
                                              ? [
                                                `0 1px 4px rgba(${theme.primaryRgb}, 0.05)`,
                                                `0 2px 12px rgba(${theme.primaryRgb}, 0.15)`,
                                                `0 1px 4px rgba(${theme.primaryRgb}, 0.05)`,
                                              ]
                                              : "0 1px 3px rgba(0,0,0,0.05)",
                                      }}
                                      transition={{
                                        opacity: { delay: i * 0.08, duration: 0.3 },
                                        x: { delay: i * 0.08, duration: 0.3, type: "spring", stiffness: 200 },
                                        scale: isTop && !isSelected ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 },
                                        boxShadow: (isTop || isHigh) && !isSelected
                                          ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
                                          : { duration: 0.2 },
                                      }}
                                      onClick={() => setSelectedSponsorship(isSelected ? null : s.name)}
                                      whileHover={{ y: -3, scale: 1.02 }}
                                      whileTap={{ scale: 0.97 }}
                                      className={`w-full text-left rounded-xl p-4 border-2 transition-colors duration-200 relative overflow-hidden ${isSelected
                                          ? "border-[var(--theme-primary)] bg-gradient-to-r from-[var(--theme-primary)]/10 to-[var(--theme-primary)]/5"
                                          : isTop
                                            ? "border-[var(--theme-primary)]/40 bg-gradient-to-r from-[#FFF7ED] to-white"
                                            : isHigh
                                              ? "border-[var(--theme-primary)]/20 bg-white hover:border-[var(--theme-primary)]/40"
                                              : "border-gray-200 bg-white hover:border-gray-300"
                                        }`}
                                    >
                                      {/* Shine sweep for top/high tiers */}
                                      {(isTop || isHigh) && !isSelected && (
                                        <motion.div
                                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                                          initial={{ x: "-100%" }}
                                          animate={{ x: ["-100%", "200%"] }}
                                          transition={{
                                            duration: 1.5,
                                            repeat: Infinity,
                                            repeatDelay: isTop ? 3 : 5,
                                            ease: "easeInOut",
                                          }}
                                        />
                                      )}
                                      <div className="relative flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2">
                                            {isTop ? (
                                              <motion.div
                                                animate={{ rotate: [0, 15, -15, 0] }}
                                                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
                                              >
                                                <Star className="w-4 h-4 text-[var(--theme-primary)] fill-[var(--theme-primary)]" />
                                              </motion.div>
                                            ) : (
                                              <Award className={`w-4 h-4 transition-colors duration-200 ${isSelected ? "text-[var(--theme-primary)]" : isHigh ? "text-[var(--theme-primary)]/60" : "text-gray-300"
                                                }`} />
                                            )}
                                            <p className={`font-semibold text-sm ${isTop && !isSelected ? "text-[var(--theme-primary)]" : "text-gray-900"}`}>{s.name}</p>
                                            {isTop && !isSelected && (
                                              <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--theme-primary)] text-white px-2 py-0.5 rounded-full">
                                                Popular
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 ml-4">
                                          <span className={`text-lg font-bold whitespace-nowrap transition-colors duration-200 ${isSelected || isTop ? "text-[var(--theme-primary)]" : isHigh ? "text-[var(--theme-primary)]/80" : "text-gray-700"
                                            }`}>
                                            {s.price > 0 ? `$${s.price}` : "Any $"}
                                          </span>
                                          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 ${isSelected
                                              ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]"
                                              : "border-gray-300"
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
                                  <div className="flex items-center border border-gray-200/80 rounded-xl overflow-hidden focus-within:border-[var(--theme-primary)] focus-within:ring-4 focus-within:ring-[var(--theme-primary)]/10">
                                    <span className="px-4 py-3 bg-[#FAFAFA] text-gray-500 border-r border-gray-200/80">$</span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={customAmount || ""}
                                      onChange={(e) => {
                                        const digits = e.target.value.replace(/\D/g, "");
                                        setCustomAmount(digits ? Number(digits) : 0);
                                      }}
                                      className="w-full px-4 py-3 outline-none text-sm bg-white"
                                      placeholder="Enter amount"
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
                                    className="w-full px-5 py-3.5 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:bg-white focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/10 outline-none text-sm resize-none transition-all duration-200 placeholder:text-gray-400"
                                    placeholder="In honor of... (optional)"
                                  />
                                  <input
                                    type="email"
                                    name="honoreeEmail"
                                    value={formState.honoreeEmail}
                                    onChange={handleChange}
                                    className="w-full px-5 py-3.5 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:bg-white focus:border-[var(--theme-primary)] focus:ring-4 focus:ring-[var(--theme-primary)]/10 outline-none text-sm transition-all duration-200 placeholder:text-gray-400"
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
                    <div ref={totalRef} className="bg-gradient-to-br from-[var(--theme-primary)]/8 via-[var(--theme-primary)]/5 to-transparent rounded-2xl p-6 border border-[var(--theme-primary)]/10">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Total</span>
                        <motion.span
                          key={total}
                          initial={{ scale: 1.2, color: theme.primary }}
                          animate={{ scale: 1, color: theme.primary }}
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
                    <div className="pt-6 border-t border-gray-100/80">
                      <h4 className="text-xs font-semibold text-gray-400 tracking-[0.15em] uppercase mb-5">Payment Method</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod(paymentMethod === "online" ? null : "online")}
                          className={`p-5 rounded-2xl border-2 text-center transition-all duration-200 relative cursor-pointer ${paymentMethod === "online"
                              ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]/5 text-[var(--theme-primary)] shadow-sm"
                              : "border-gray-200 hover:border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                        >
                          <CreditCard className="w-5 h-5 mx-auto mb-1" />
                          <span className="text-sm font-medium">Credit Card</span>
                          {paymentMethod === "online" && (
                            <div className="absolute top-2 right-2 mt-0.5 mr-0.5">
                              <Check className="w-4 h-4 text-[var(--theme-primary)]" />
                            </div>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod(paymentMethod === "check" ? null : "check")}
                          className={`p-5 rounded-2xl border-2 text-center transition-all duration-200 relative cursor-pointer ${paymentMethod === "check"
                              ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]/5 text-[var(--theme-primary)] shadow-sm"
                              : "border-gray-200 hover:border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                        >
                          <span className="text-lg block mb-1">&#9993;</span>
                          <span className="text-sm font-medium">Send a Check</span>
                          {paymentMethod === "check" && (
                            <div className="absolute top-2 right-2 mt-0.5 mr-0.5">
                              <Check className="w-4 h-4 text-[var(--theme-primary)]" />
                            </div>
                          )}
                        </button>
                      </div>

                      {/* Card form - expands/collapses with animation */}
                      <AnimatePresence>
                        {paymentMethod === "online" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 overflow-hidden"
                          >
                            <div className="bg-[#FAFAFA] rounded-2xl p-5 space-y-4 border border-gray-100/80">
                              {/* Name on Card */}
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block font-medium">Name on Card</label>
                                <input
                                  ref={cardNameRef}
                                  type="text"
                                  name="cardName"
                                  value={formState.cardName}
                                  onChange={handleChange}
                                  onKeyDown={(e) => handleCardKeyDown(e, cardNumberRef)}
                                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none text-[15px] bg-white transition-colors"
                                  placeholder="Name on Card"
                                  autoComplete="cc-name"
                                />
                              </div>

                              {/* Card Number */}
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block font-medium">Card Number</label>
                                <div className="relative">
                                  <input
                                    ref={cardNumberRef}
                                    type="text"
                                    inputMode="numeric"
                                    value={formState.cardNumber}
                                    onChange={(e) => {
                                      const formatted = formatCardNumber(e.target.value);
                                      setFormState((prev) => ({ ...prev, cardNumber: formatted }));
                                      // Auto-jump to expiry when 16 digits entered
                                      if (formatted.replace(/\s/g, "").length === 16) {
                                        cardExpiryRef.current?.focus();
                                      }
                                    }}
                                    onKeyDown={(e) => handleCardKeyDown(e, cardExpiryRef)}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none text-[15px] bg-white transition-colors tabular-nums tracking-wide pr-12"
                                    placeholder="Card Number"
                                    maxLength={19}
                                    autoComplete="cc-number"
                                  />
                                  <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                                </div>
                              </div>

                              {/* Expiry + CVV row */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block font-medium">Expiry Date</label>
                                  <input
                                    ref={cardExpiryRef}
                                    type="text"
                                    inputMode="numeric"
                                    value={formState.cardExpiry}
                                    onChange={(e) => {
                                      const formatted = formatExpiry(e.target.value, formState.cardExpiry);
                                      setFormState((prev) => ({ ...prev, cardExpiry: formatted }));
                                      // Auto-jump to CVV when full expiry entered (MM/YY = 5 chars)
                                      if (formatted.length === 5) {
                                        cardCvvRef.current?.focus();
                                      }
                                    }}
                                    onKeyDown={(e) => handleCardKeyDown(e, cardCvvRef)}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none text-[15px] bg-white transition-colors tabular-nums tracking-wide"
                                    placeholder="MM / YY"
                                    maxLength={5}
                                    autoComplete="cc-exp"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500 mb-1 block font-medium">Security Code</label>
                                  <input
                                    ref={cardCvvRef}
                                    type="text"
                                    inputMode="numeric"
                                    value={formState.cardCvv}
                                    onChange={(e) => {
                                      const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                                      setFormState((prev) => ({ ...prev, cardCvv: digits }));
                                    }}
                                    onKeyDown={(e) => {
                                      // Enter on last card field moves focus to submit button
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        submitRef.current?.focus();
                                      }
                                    }}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/20 outline-none text-[15px] bg-white transition-colors tabular-nums tracking-wide"
                                    placeholder="CVV"
                                    maxLength={4}
                                    autoComplete="cc-csc"
                                  />
                                </div>
                              </div>

                              {/* Security Badge */}
                              <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                                <Lock className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                <span>Your payment is encrypted and secure.</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* KEPT FOR FALLBACK: Banquest Hosted Tokenization (has expiry bug)
                      <div className={paymentMethod === "online" ? "mt-4 space-y-3" : "hidden"}>
                        <input type="text" name="cardName" placeholder="Name on Card" ... />
                        <CollectJsPayment
                          onTokenReceived={handleTokenReceived}
                          onError={handlePaymentError}
                          onValidationChange={handleValidationChange}
                          disabled={isSubmitting}
                        />
                      </div>
                      */}

                      <AnimatePresence>
                        {paymentMethod === "check" && (
                          <motion.div
                            ref={paymentRef}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 overflow-hidden"
                          >
                            <div className="bg-[#FAFAFA] rounded-2xl p-5 text-sm text-gray-600 space-y-2 border border-gray-100/80">
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
                      className="w-full bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-hover)] text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2.5 hover:shadow-[0_8px_30px_rgba(var(--theme-rgb),0.35)] transition-all duration-300 disabled:opacity-70 shadow-lg relative overflow-hidden"
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
                          <Ticket className="w-5 h-5" />
                          Complete Registration
                        </>
                      )}
                    </motion.button>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer bgColor="#000000" />
    </main>
  );
}
