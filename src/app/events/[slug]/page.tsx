"use client";

import { useState, useEffect, useRef, use } from "react";
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
  Star,
  Ticket,
  Award,
  Sparkles,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import confetti from "canvas-confetti";
import type { Event, EventSponsorship } from "@/types/database";

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  // Event data from DB
  const [event, setEvent] = useState<Event | null>(null);
  const [sponsorships, setSponsorships] = useState<EventSponsorship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form state
  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [selectedSponsorship, setSelectedSponsorship] = useState<string | null>(null);
  const [showSponsorship, setShowSponsorship] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "check">("online");
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const sponsorshipRef = useRef<HTMLDivElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  // Fetch event data from API
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${slug}`);
        const data = await response.json();

        if (data.success) {
          setEvent(data.event);
          setSponsorships(data.sponsorships || []);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Failed to fetch event:", err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [slug]);

  // Scroll to sponsorship section when toggled
  useEffect(() => {
    if (showSponsorship && sponsorshipRef.current) {
      setTimeout(() => {
        sponsorshipRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 200);
    }
  }, [showSponsorship]);

  // Helper: scroll form container to the bottom
  const scrollFormToBottom = (delay = 200) => {
    setTimeout(() => {
      if (formContainerRef.current) {
        formContainerRef.current.scrollTo({
          top: formContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, delay);
  };

  // When a sponsorship is selected, scroll form to bottom to show total + payment
  useEffect(() => {
    if (selectedSponsorship) {
      scrollFormToBottom(200);
    }
  }, [selectedSponsorship]);

  // When payment method changes, scroll form to bottom to show fields + submit
  useEffect(() => {
    scrollFormToBottom(350);
  }, [paymentMethod]);

  // Scroll form to top when error appears so user sees it
  useEffect(() => {
    if (error && formContainerRef.current) {
      formContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, [error]);

  // Confetti on success
  useEffect(() => {
    if (isSubmitted) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#EF8046", "#f59e0b", "#10b981"],
      });
    }
  }, [isSubmitted]);

  // Calculate totals
  const selectedSponsorshipData = selectedSponsorship
    ? sponsorships.find((s) => s.id === selectedSponsorship)
    : null;

  const sponsorshipPrice = selectedSponsorshipData?.price || 0;
  const baseTotal = event
    ? adults * event.price_per_adult + kids * event.kids_price
    : 0;
  const total = sponsorshipPrice > 0 ? sponsorshipPrice : baseTotal;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormState({
      ...formState,
      [e.target.name]: e.target.value,
    });
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 2) {
      value = value.slice(0, 2) + "/" + value.slice(2, 6);
    }
    setFormState({ ...formState, cardExpiry: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        adults,
        kids,
        name: formState.name,
        email: formState.email,
        phone: formState.phone,
        sponsorshipId: selectedSponsorship || null,
        message: formState.message || null,
        paymentMethod,
      };

      // Include card details only for online payment
      if (paymentMethod === "online") {
        payload.cardName = formState.cardName;
        payload.cardNumber = formState.cardNumber;
        payload.cardExpiry = formState.cardExpiry;
        payload.cardCvv = formState.cardCvv;
      }

      const response = await fetch(`/api/events/${slug}/register`, {
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
  };

  // Format helpers
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (start: string | null, end: string | null) => {
    if (!start) return "";
    const parts = [start];
    if (end) parts.push(end);
    return parts.join(" - ");
  };

  // Loading State
  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#FBFBFB]">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-3 border-[#EF8046] border-t-transparent rounded-full"
          />
        </div>
        <Footer />
      </main>
    );
  }

  // Not Found State
  if (notFound || !event) {
    return (
      <main className="min-h-screen bg-[#FBFBFB]">
        <Header />
        <section className="pt-32 pb-20 min-h-[60vh] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-gray-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Event Not Found</h1>
            <p className="text-gray-500 mb-8">
              This event may have ended or the link may be incorrect.
            </p>
            <Link href="/events">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-[#EF8046] text-white px-8 py-3 rounded font-medium hover:bg-[#d96a2f] transition-colors"
              >
                View All Events
              </motion.button>
            </Link>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  const eventDate = formatDate(event.date);
  const eventTime = formatTime(event.start_time, event.end_time);
  const eventImage = event.image_url || "/images/events/Dinner.jpg";

  // Success State
  if (isSubmitted) {
    return (
      <main className="min-h-screen">
        <Header />
        <section className="pt-32 pb-20 min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-[#FBFBFB] to-white relative overflow-hidden">
          <div className="absolute top-20 left-10 w-64 h-64 bg-[#EF8046]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-green-500/10 rounded-full blur-3xl" />

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
              Your registration has been received.
            </p>
            <p className="text-gray-500 mb-8">
              Check your email for a confirmation with all the event details.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 text-left mb-8"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden relative flex-shrink-0">
                  <Image
                    src={eventImage}
                    alt={event.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{event.title}</h3>
                  <p className="text-sm text-[#EF8046]">
                    {adults} adult{adults > 1 ? "s" : ""}
                    {kids > 0 ? ` + ${kids} kid${kids > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-600 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#EF8046]/10 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-[#EF8046]" />
                  </div>
                  <span>{eventDate}</span>
                </div>
                {eventTime && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#EF8046]/10 rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-[#EF8046]" />
                    </div>
                    <span>{eventTime}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#EF8046]/10 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-[#EF8046]" />
                    </div>
                    {event.location_url ? (
                      <a
                        href={event.location_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#EF8046] hover:underline"
                      >
                        {event.location}
                      </a>
                    ) : (
                      <span>{event.location}</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            <Link href="/events">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-[#EF8046] text-white px-8 py-3 rounded font-medium hover:bg-[#d96a2f] transition-colors"
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
    <main className="min-h-screen bg-[#FBFBFB]">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-24 pb-0">
        <div className="relative h-[45vh] min-h-[350px]">
          <Image
            src={eventImage}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />

          {/* Decorative corner accents */}
          <div className="absolute top-4 left-4 w-20 h-20 border-t-4 border-l-4 border-[#EF8046]/50 rounded-tl-3xl" />
          <div className="absolute bottom-4 right-4 w-20 h-20 border-b-4 border-r-4 border-[#EF8046]/50 rounded-br-3xl" />

          <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-10">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </Link>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-[#EF8046] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  Upcoming Event
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
                {event.title}
              </h1>
              <div className="flex flex-wrap gap-4 text-white/90 text-sm">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {eventDate}
                </span>
                {eventTime && (
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {eventTime}
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="pt-12 pb-24 bg-white relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#EF8046]/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-3 gap-10">
            {/* Event Details - Left Column */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {/* Quick Info Bar */}
                <div className="bg-gradient-to-r from-[#2d3748] to-[#1a202c] rounded-2xl p-6 mb-8 text-white">
                  <div className="grid sm:grid-cols-3 gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#EF8046] rounded-xl flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Date</p>
                        <p className="font-semibold">{eventDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#EF8046] rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Time</p>
                        <p className="font-semibold">{eventTime || "See details"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#EF8046] rounded-xl flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Location</p>
                        {event.location_url ? (
                          <a
                            href={event.location_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#EF8046] hover:underline"
                          >
                            View Map
                          </a>
                        ) : (
                          <p className="font-semibold">{event.location || "TBA"}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {event.description && (
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      About This Event
                    </h2>
                    <div className="prose prose-lg max-w-none text-gray-600">
                      {event.description.split("\n\n").map((paragraph, index) => (
                        <p key={index} className="mb-4">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pricing */}
                <div className="bg-[#FBFBFB] rounded-2xl p-6 mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-[#EF8046]" />
                    Pricing
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-600">Adults</span>
                      <span className="font-semibold text-gray-900">
                        ${event.price_per_adult} per person
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Kids</span>
                      <span className="font-semibold text-[#EF8046]">
                        {event.kids_price === 0 ? "Free!" : `$${event.kids_price}`}
                      </span>
                    </div>
                  </div>
                  {sponsorships.length > 0 && (
                    <p className="text-sm text-gray-500 mt-4">
                      Sponsorships available!
                    </p>
                  )}
                </div>

                {/* Sponsorship Tiers Preview */}
                {sponsorships.length > 0 && (
                  <div className="bg-[#FBFBFB] rounded-2xl p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Award className="w-5 h-5 text-[#EF8046]" />
                      Sponsorship Opportunities
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {sponsorships.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between bg-white rounded-xl p-4 border border-gray-100"
                        >
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                            {s.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                            )}
                          </div>
                          <span className="text-[#EF8046] font-bold ml-4">${s.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Registration Form - Right Column */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div ref={formContainerRef} className="bg-white rounded-2xl shadow-xl border border-gray-100 sticky top-28 overflow-x-hidden overflow-y-auto max-h-[calc(100vh-8rem)]">
                  {/* Form Header */}
                  <div className="bg-gradient-to-r from-[#EF8046] to-[#d96a2f] p-6 text-white">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Register Now
                    </h3>
                    <p className="text-white/80 text-sm mt-1">
                      Secure your spot for this event
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Error Message */}
                    {error && (
                      <div ref={errorRef} className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
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
                            <span className="text-gray-400 text-xs ml-1">(${event.price_per_adult}/person)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setAdults(Math.max(1, adults - 1))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-6 text-center font-bold text-gray-900">{adults}</span>
                            <button
                              type="button"
                              onClick={() => setAdults(adults + 1)}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-gray-700 text-sm">Kids</span>
                            <span className="text-gray-400 text-xs ml-1">
                              ({event.kids_price === 0 ? "Free!" : `$${event.kids_price}/child`})
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setKids(Math.max(0, kids - 1))}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-6 text-center font-bold text-gray-900">{kids}</span>
                            <button
                              type="button"
                              onClick={() => setKids(kids + 1)}
                              className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-500 hover:border-[#EF8046] hover:text-[#EF8046] transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sponsorship Toggle */}
                    {sponsorships.length > 0 && (
                      <div className="pt-4 border-t border-gray-100">
                        <motion.button
                          type="button"
                          onClick={() => {
                            setShowSponsorship(!showSponsorship);
                            if (showSponsorship) {
                              setSelectedSponsorship(null);
                            }
                          }}
                          className={`w-full relative overflow-hidden rounded-xl p-4 font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                            showSponsorship
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
                                  const maxPrice = Math.max(...sponsorships.map(sp => sp.price), 1);
                                  return sponsorships.map((s, i) => {
                                    const ratio = s.price / maxPrice;
                                    const isTop = ratio > 0.8;
                                    const isHigh = ratio > 0.5;
                                    const isSelected = selectedSponsorship === s.id;

                                    return (
                                      <motion.button
                                        key={s.id}
                                        type="button"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{
                                          opacity: 1,
                                          x: 0,
                                          scale: isTop && !isSelected ? [1, 1.015, 1] : 1,
                                          boxShadow: isSelected
                                            ? "0 4px 20px rgba(239, 128, 70, 0.25)"
                                            : isTop
                                              ? [
                                                  "0 2px 8px rgba(239, 128, 70, 0.1)",
                                                  "0 4px 24px rgba(239, 128, 70, 0.3)",
                                                  "0 2px 8px rgba(239, 128, 70, 0.1)",
                                                ]
                                              : isHigh
                                                ? [
                                                    "0 1px 4px rgba(239, 128, 70, 0.05)",
                                                    "0 2px 12px rgba(239, 128, 70, 0.15)",
                                                    "0 1px 4px rgba(239, 128, 70, 0.05)",
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
                                        onClick={() => setSelectedSponsorship(isSelected ? null : s.id)}
                                        whileHover={{ y: -3, scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        className={`w-full text-left rounded-xl p-4 border-2 transition-colors duration-200 relative overflow-hidden ${
                                          isSelected
                                            ? "border-[#EF8046] bg-gradient-to-r from-[#EF8046]/10 to-[#EF8046]/5"
                                            : isTop
                                              ? "border-[#EF8046]/40 bg-gradient-to-r from-[#FFF7ED] to-white"
                                              : isHigh
                                                ? "border-[#EF8046]/20 bg-white hover:border-[#EF8046]/40"
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
                                                  <Star className="w-4 h-4 text-[#EF8046] fill-[#EF8046]" />
                                                </motion.div>
                                              ) : (
                                                <Award className={`w-4 h-4 transition-colors duration-200 ${
                                                  isSelected ? "text-[#EF8046]" : isHigh ? "text-[#EF8046]/60" : "text-gray-300"
                                                }`} />
                                              )}
                                              <p className={`font-semibold text-sm ${isTop && !isSelected ? "text-[#EF8046]" : "text-gray-900"}`}>{s.name}</p>
                                              {isTop && !isSelected && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#EF8046] text-white px-2 py-0.5 rounded-full">
                                                  Popular
                                                </span>
                                              )}
                                            </div>
                                            {s.description && (
                                              <p className="text-xs text-gray-500 mt-1 ml-6">{s.description}</p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3 ml-4">
                                            <span className={`text-lg font-bold whitespace-nowrap transition-colors duration-200 ${
                                              isSelected || isTop ? "text-[#EF8046]" : isHigh ? "text-[#EF8046]/80" : "text-gray-700"
                                            }`}>
                                              ${s.price}
                                            </span>
                                            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 ${
                                              isSelected
                                                ? "border-[#EF8046] bg-[#EF8046]"
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

                                {selectedSponsorship && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                  >
                                    <textarea
                                      name="message"
                                      value={formState.message}
                                      onChange={handleChange}
                                      rows={2}
                                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm resize-none"
                                      placeholder="In honor of... (optional)"
                                    />
                                  </motion.div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

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
                          {adults} adult{adults > 1 ? "s" : ""} &times; ${event.price_per_adult}
                          {kids > 0 && ` + ${kids} kid${kids > 1 ? "s" : ""} \u00D7 $${event.kids_price}`}
                        </p>
                      )}
                      {selectedSponsorshipData && (
                        <p className="text-xs text-gray-500 mt-1">{selectedSponsorshipData.name}</p>
                      )}
                    </div>

                    {/* Payment Method */}
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="font-semibold text-gray-900 mb-3">Payment Method</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("online")}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            paymentMethod === "online"
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
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            paymentMethod === "check"
                              ? "border-[#EF8046] bg-[#EF8046]/5 text-[#EF8046]"
                              : "border-gray-200 hover:border-gray-300 text-gray-500"
                          }`}
                        >
                          <span className="text-lg block mb-1">&#9993;</span>
                          <span className="text-sm font-medium">Send a Check</span>
                        </button>
                      </div>

                      <AnimatePresence>
                        {paymentMethod === "online" && (
                          <motion.div
                            ref={paymentRef}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 space-y-3 overflow-hidden"
                          >
                            <input
                              type="text"
                              name="cardName"
                              value={formState.cardName}
                              onChange={handleChange}
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                              placeholder="Cardholder Name"
                            />
                            <input
                              type="text"
                              name="cardNumber"
                              value={formState.cardNumber}
                              onChange={handleChange}
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                              placeholder="Card Number"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="text"
                                name="cardExpiry"
                                value={formState.cardExpiry}
                                onChange={handleExpiryChange}
                                maxLength={7}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                                placeholder="MM/YYYY"
                              />
                              <input
                                type="text"
                                name="cardCvv"
                                value={formState.cardCvv}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                                placeholder="CVV"
                              />
                            </div>
                          </motion.div>
                        )}

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
                          <Ticket className="w-5 h-5" />
                          Complete Registration
                        </>
                      )}
                    </motion.button>

                    <p className="text-xs text-center text-gray-500">
                      By registering, you agree to receive event-related communications.
                    </p>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
