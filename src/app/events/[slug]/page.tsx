"use client";

import { useState, use } from "react";
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
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { FadeUp, SlideInLeft, SlideInRight } from "@/components/ui/motion";

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
    sponsorships: [
      { name: "Light Up The Night", price: 1800 },
      { name: "A Whole Latke Love", price: 1800 },
      { name: "Spin To Win", price: 720 },
      { name: "Fill The Dough(Nut)", price: 500 },
      { name: "It's All About The Neis (Miracles)", price: 360 },
    ],
  },
};

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  // Get event data - in production, this would fetch from your data source
  const event = eventData["chanukah-2025"]; // Using sample data for now

  const [step, setStep] = useState(1);
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
              Your registration has been received.
            </p>
            <p className="text-gray-500 mb-8">
              You will receive a confirmation email shortly with all the event
              details.
            </p>
            <div className="bg-white rounded-xl p-6 shadow-md text-left mb-8">
              <h3 className="font-bold text-gray-900 mb-3">{event.title}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#EF8046]" />
                  <span>{event.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#EF8046]" />
                  <span>{event.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#EF8046]" />
                  <span>{event.location}</span>
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
        <div className="relative h-[40vh] min-h-[300px]">
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-8">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </Link>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold text-white"
            >
              {event.title}
            </motion.h1>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Event Details */}
            <div className="lg:col-span-2">
              <SlideInLeft>
                {/* Event Info */}
                <div className="bg-[#FBFBFB] rounded-xl p-6 mb-8">
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#EF8046]/10 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[#EF8046]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Date</p>
                        <p className="font-medium text-gray-900">{event.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#EF8046]/10 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-[#EF8046]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Time</p>
                        <p className="font-medium text-gray-900">{event.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#EF8046]/10 rounded-lg flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-[#EF8046]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <a
                          href={event.locationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#EF8046] hover:underline"
                        >
                          View Map
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="prose prose-lg max-w-none mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    About This Event
                  </h2>
                  {event.description.split("\n\n").map((paragraph, index) => (
                    <p key={index} className="text-gray-600">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Pricing */}
                <div className="bg-[#FBFBFB] rounded-xl p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Pricing
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Adults</span>
                      <span className="font-medium">
                        ${event.pricePerAdult} per person
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Kids</span>
                      <span className="font-medium text-[#EF8046]">
                        {event.kidsPrice === 0 ? "Free!" : `$${event.kidsPrice}`}
                      </span>
                    </div>
                  </div>
                </div>
              </SlideInLeft>
            </div>

            {/* Registration Form */}
            <div className="lg:col-span-1">
              <SlideInRight>
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 sticky top-28">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">
                      Register Now
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">
                      Secure your spot for this event
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Attendees */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Number of Attendees
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">
                            Adults (${event.pricePerAdult} each)
                          </label>
                          <div className="flex items-center border border-gray-200 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setAdults(Math.max(1, adults - 1))}
                              className="p-2 hover:bg-gray-50"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="flex-1 text-center font-medium">
                              {adults}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAdults(adults + 1)}
                              className="p-2 hover:bg-gray-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">
                            Kids (Free!)
                          </label>
                          <div className="flex items-center border border-gray-200 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setKids(Math.max(0, kids - 1))}
                              className="p-2 hover:bg-gray-50"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="flex-1 text-center font-medium">
                              {kids}
                            </span>
                            <button
                              type="button"
                              onClick={() => setKids(kids + 1)}
                              className="p-2 hover:bg-gray-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formState.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formState.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                        placeholder="your@email.com"
                      />
                    </div>

                    {/* Sponsorship */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sponsorship (Optional)
                      </label>
                      <select
                        value={selectedSponsorship || ""}
                        onChange={(e) =>
                          setSelectedSponsorship(e.target.value || null)
                        }
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
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
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                          placeholder="Card number"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="text"
                            name="cardExpiry"
                            value={formState.cardExpiry}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                            placeholder="MM/YYYY"
                          />
                          <input
                            type="text"
                            name="cardCvv"
                            value={formState.cardCvv}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                            placeholder="CVV"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="bg-[#FBFBFB] rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total</span>
                        <span className="text-2xl font-bold text-[#EF8046]">
                          ${total}
                        </span>
                      </div>
                      {sponsorshipPrice > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Sponsorship includes {adults} adult ticket
                          {adults > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    {/* Submit */}
                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full bg-[#EF8046] text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-[#d96a2f] transition-colors disabled:opacity-70"
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
                          <Users className="w-5 h-5" />
                          Register Now
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

      <Footer />
    </main>
  );
}
