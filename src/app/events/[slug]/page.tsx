"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
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
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import confetti from "canvas-confetti";

// This would come from your Google Sheet or database
const eventData = {
  "chanukah-2025": {
    title: "Light It Up - Chanukah Celebration",
    date: "December 16, 2025",
    time: "6:00 PM - 8:00 PM",
    location: "JRE - 1495 Weaver Street, 2nd floor, Scarsdale",
    locationUrl: "https://maps.app.goo.gl/P3KenjmqEyS7QrH4A",
    pricePerAdult: 36,
    kidsPrice: 0,
    image: "/images/events/Dinner.jpg",
    description: `Join us for an evening of light, latkes, and celebration as we kindle the Chanukah flames together!

Experience the warmth of community as we celebrate the Festival of Lights with delicious food, inspiring words, and joyful singing.

This event is perfect for the whole family. Kids activities included!`,
    highlights: [
      "Delicious traditional latkes & sufganiyot",
      "Live candle lighting ceremony",
      "Inspiring words of Torah",
      "Family-friendly activities for all ages",
    ],
    sponsorships: [
      { name: "Light Up The Night", price: 1800 },
      { name: "A Whole Latke Love", price: 1800 },
      { name: "Spin To Win", price: 720 },
      { name: "Fill The Dough(Nut)", price: 500 },
      { name: "It's All About The Neis (Miracles)", price: 360 },
    ],
  },
};

// Decorative shape component
function DecorativeShape({
  className,
  delay = 0,
}: {
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay }}
    />
  );
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  // Get event data - in production, this would fetch from your data source
  const event = eventData["chanukah-2025"]; // Using sample data for now

  const [adults, setAdults] = useState(1);
  const [kids, setKids] = useState(0);
  const [selectedSponsorship, setSelectedSponsorship] = useState<string | null>(null);
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

  // Scroll to top and trigger confetti when registration is successful
  useEffect(() => {
    if (isSubmitted) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Celebration confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#EF8046", "#f59e0b", "#10b981"],
      });
    }
  }, [isSubmitted]);

  const sponsorshipPrice = selectedSponsorship
    ? event.sponsorships.find((s) => s.name === selectedSponsorship)?.price || 0
    : 0;

  const baseTotal = adults * event.pricePerAdult + kids * event.kidsPrice;
  const total = sponsorshipPrice > 0 ? sponsorshipPrice : baseTotal;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormState({
      ...formState,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/events/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adults,
          kids,
          name: formState.name,
          email: formState.email,
          phone: formState.phone,
          sponsorshipId: selectedSponsorship,
          message: formState.message,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to register");
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error("Registration error:", error);
      alert("Failed to complete registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success State
  if (isSubmitted) {
    return (
      <main className="min-h-screen">
        <Header />
        <section className="pt-32 pb-20 min-h-[80vh] flex items-center justify-center bg-gradient-to-b from-[#FBFBFB] to-white relative overflow-hidden">
          {/* Decorative elements */}
          <DecorativeShape
            className="absolute top-20 left-10 w-64 h-64 bg-[#EF8046]/10 rounded-full blur-3xl"
            delay={0}
          />
          <DecorativeShape
            className="absolute bottom-20 right-10 w-80 h-80 bg-green-500/10 rounded-full blur-3xl"
            delay={0.2}
          />

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
                    src={event.image}
                    alt={event.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{event.title}</h3>
                  <p className="text-sm text-[#EF8046]">
                    {adults} adult{adults > 1 ? "s" : ""}{kids > 0 ? ` + ${kids} kid${kids > 1 ? "s" : ""}` : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-600 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#EF8046]/10 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-[#EF8046]" />
                  </div>
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#EF8046]/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-[#EF8046]" />
                  </div>
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#EF8046]/10 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-[#EF8046]" />
                  </div>
                  <a
                    href={event.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#EF8046] hover:underline"
                  >
                    {event.location}
                  </a>
                </div>
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

      {/* Hero Section - Enhanced */}
      <section className="relative pt-24 pb-0">
        <div className="relative h-[45vh] min-h-[350px]">
          <Image
            src={event.image}
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
                  {event.date}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {event.time}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 bg-white relative">
        {/* Subtle decorative background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#EF8046]/5 rounded-full blur-3xl" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-3 gap-10">
            {/* Event Details */}
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
                        <p className="font-semibold">{event.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#EF8046] rounded-xl flex items-center justify-center">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Time</p>
                        <p className="font-semibold">{event.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#EF8046] rounded-xl flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Location</p>
                        <a
                          href={event.locationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#EF8046] hover:underline"
                        >
                          View Map
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
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

                {/* Event Highlights */}
                {event.highlights && (
                  <div className="bg-[#FBFBFB] rounded-2xl p-6 mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Star className="w-5 h-5 text-[#EF8046]" />
                      Event Highlights
                    </h3>
                    <ul className="grid sm:grid-cols-2 gap-3">
                      {event.highlights.map((highlight, index) => (
                        <motion.li
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-3 text-gray-700"
                        >
                          <div className="w-6 h-6 bg-[#EF8046]/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5 text-[#EF8046]" />
                          </div>
                          {highlight}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pricing */}
                <div className="bg-[#FBFBFB] rounded-2xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-[#EF8046]" />
                    Pricing
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-600">Adults</span>
                      <span className="font-semibold text-gray-900">
                        ${event.pricePerAdult} per person
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-600">Kids</span>
                      <span className="font-semibold text-[#EF8046]">
                        {event.kidsPrice === 0 ? "Free!" : `$${event.kidsPrice}`}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Registration Form */}
            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 sticky top-28 overflow-hidden">
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
                    {/* Attendees */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Number of Attendees
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#FBFBFB] rounded-xl p-3">
                          <label className="text-xs text-gray-500 mb-2 block">
                            Adults <span className="text-[#EF8046]">(${event.pricePerAdult})</span>
                          </label>
                          <div className="flex items-center bg-white border border-gray-200 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setAdults(Math.max(1, adults - 1))}
                              className="p-2.5 hover:bg-gray-50 transition-colors rounded-l-lg"
                            >
                              <Minus className="w-4 h-4 text-gray-600" />
                            </button>
                            <span className="flex-1 text-center font-semibold text-lg">
                              {adults}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAdults(adults + 1)}
                              className="p-2.5 hover:bg-gray-50 transition-colors rounded-r-lg"
                            >
                              <Plus className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                        <div className="bg-[#FBFBFB] rounded-xl p-3">
                          <label className="text-xs text-gray-500 mb-2 block">
                            Kids <span className="text-[#EF8046]">(Free!)</span>
                          </label>
                          <div className="flex items-center bg-white border border-gray-200 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setKids(Math.max(0, kids - 1))}
                              className="p-2.5 hover:bg-gray-50 transition-colors rounded-l-lg"
                            >
                              <Minus className="w-4 h-4 text-gray-600" />
                            </button>
                            <span className="flex-1 text-center font-semibold text-lg">
                              {kids}
                            </span>
                            <button
                              type="button"
                              onClick={() => setKids(kids + 1)}
                              className="p-2.5 hover:bg-gray-50 transition-colors rounded-r-lg"
                            >
                              <Plus className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formState.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm transition-colors"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formState.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm transition-colors"
                        placeholder="your@email.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formState.phone}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm transition-colors"
                        placeholder="(123) 456-7890"
                      />
                    </div>

                    {/* Sponsorship */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sponsorship <span className="text-gray-400">(Optional)</span>
                      </label>
                      <select
                        value={selectedSponsorship || ""}
                        onChange={(e) =>
                          setSelectedSponsorship(e.target.value || null)
                        }
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm transition-colors bg-white"
                      >
                        <option value="">No sponsorship</option>
                        {event.sponsorships.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name} - ${s.price}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Payment */}
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="w-5 h-5 text-[#EF8046]" />
                        <span className="font-medium text-gray-900">
                          Payment Details
                        </span>
                      </div>

                      <div className="space-y-3">
                        <input
                          type="text"
                          name="cardNumber"
                          value={formState.cardNumber}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm transition-colors"
                          placeholder="Card number"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            name="cardExpiry"
                            value={formState.cardExpiry}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm transition-colors"
                            placeholder="MM/YYYY"
                          />
                          <input
                            type="text"
                            name="cardCvv"
                            value={formState.cardCvv}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm transition-colors"
                            placeholder="CVV"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="bg-gradient-to-r from-[#FBFBFB] to-[#f5f5f5] rounded-xl p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-gray-600 text-sm">Total Amount</span>
                          {sponsorshipPrice > 0 && (
                            <p className="text-xs text-gray-500">
                              Includes {adults} ticket{adults > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        <span className="text-3xl font-bold text-[#EF8046]">
                          ${total}
                        </span>
                      </div>
                    </div>

                    {/* Submit */}
                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full bg-[#EF8046] text-white py-4 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#d96a2f] transition-colors disabled:opacity-70 shadow-lg shadow-[#EF8046]/20"
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
