"use client";

import { useState, useEffect } from "react";
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
  Trash2,
  UserPlus,
  ChevronUp,
  PartyPopper,
  Music,
  Wine,
  Baby,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { SlideInLeft, SlideInRight } from "@/components/ui/motion";

// Purim Event Data
const purimEvent = {
  title: "JRE's Next-Level Purim Experience",
  subtitle: "Megillah, Music, Open Bar, Festive Banquet, Kids Activities & More",
  date: "Sunday, March 2, 2025",
  time: "6:00 PM",
  location: "Life, The Place To Be - 2 Lawrence Street, Ardsley, NY, 10502",
  locationUrl: "https://maps.app.goo.gl/ibLU2DfYiH1ngTVd6",
  pricePerAdult: 40,
  kidsPrice: 10,
  familyMax: 100,
  image: "/images/events/Purim25.jpg",
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

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "adult" | "child";
}

export default function PurimEventPage() {
  const [showFamilyDetails, setShowFamilyDetails] = useState(false);
  const [selectedSponsorship, setSelectedSponsorship] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "check">("online");

  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    // Spouse details
    spouseName: "",
    spouseEmail: "",
    spousePhone: "",
    // Payment
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    // Message
    message: "",
  });

  const [additionalAdults, setAdditionalAdults] = useState<FamilyMember[]>([]);
  const [children, setChildren] = useState<FamilyMember[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const baseAdults = 1 + (showFamilyDetails && formState.spouseName ? 1 : 0);
  const totalAdults = baseAdults + additionalAdults.length;
  const totalKids = children.length;

  const getSponsorshipPrice = () => {
    if (!selectedSponsorship) return 0;
    const sponsorship = purimEvent.sponsorships.find((s) => s.name === selectedSponsorship);
    if (sponsorship?.price === 0) return customAmount; // Custom amount sponsorship
    return sponsorship?.price || 0;
  };

  const sponsorshipPrice = getSponsorshipPrice();

  // Calculate base total with family max cap
  const calculatedTotal = totalAdults * purimEvent.pricePerAdult + totalKids * purimEvent.kidsPrice;
  const baseTotal = Math.min(calculatedTotal, purimEvent.familyMax);

  const total = sponsorshipPrice > 0 ? sponsorshipPrice : baseTotal;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormState({
      ...formState,
      [e.target.name]: e.target.value,
    });
  };

  // Auto-format expiry date: add "/" after entering 2 digits for month
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d]/g, ""); // Remove non-digits

    // Limit to 6 digits (MMYYYY)
    if (value.length > 6) {
      value = value.slice(0, 6);
    }

    // Auto-insert "/" after month (MM)
    if (value.length >= 2) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }

    setFormState({
      ...formState,
      cardExpiry: value,
    });
  };

  const addFamilyMember = (type: "adult" | "child") => {
    const newMember: FamilyMember = {
      id: `${type}_${Date.now()}`,
      name: "",
      email: "",
      phone: "",
      type,
    };

    if (type === "adult") {
      setAdditionalAdults([...additionalAdults, newMember]);
    } else {
      setChildren([...children, newMember]);
    }
  };

  const removeFamilyMember = (id: string, type: "adult" | "child") => {
    if (type === "adult") {
      setAdditionalAdults(additionalAdults.filter((m) => m.id !== id));
    } else {
      setChildren(children.filter((m) => m.id !== id));
    }
  };

  const updateFamilyMember = (
    id: string,
    field: keyof FamilyMember,
    value: string,
    type: "adult" | "child"
  ) => {
    const updateList = (list: FamilyMember[]) =>
      list.map((m) => (m.id === id ? { ...m, [field]: value } : m));

    if (type === "adult") {
      setAdditionalAdults(updateList(additionalAdults));
    } else {
      setChildren(updateList(children));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/events/purim-2025/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Primary registrant
          name: formState.name,
          email: formState.email,
          phone: formState.phone,
          // Spouse
          spouseName: formState.spouseName,
          spouseEmail: formState.spouseEmail,
          spousePhone: formState.spousePhone,
          // Family members
          additionalAdults,
          children,
          // Counts
          totalAdults,
          totalKids,
          // Sponsorship
          sponsorship: selectedSponsorship,
          sponsorshipAmount: sponsorshipPrice,
          // Payment
          paymentMethod,
          amount: total,
          cardName: paymentMethod === "online" ? formState.cardName : undefined,
          cardNumber: paymentMethod === "online" ? formState.cardNumber : undefined,
          cardExpiry: paymentMethod === "online" ? formState.cardExpiry : undefined,
          cardCvv: paymentMethod === "online" ? formState.cardCvv : undefined,
          // Message
          message: formState.message,
        }),
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
        <div className="relative h-[50vh] min-h-[400px]">
          <Image
            src={purimEvent.image}
            alt={purimEvent.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
          <div className="absolute bottom-0 left-0 right-0 container mx-auto px-6 pb-8">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Events
            </Link>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-[#EF8046] font-medium tracking-wider uppercase mb-2">
                We&apos;re thrilled you&apos;ll be joining us!
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
                {purimEvent.title}
              </h1>
              <p className="text-xl text-white/90 max-w-2xl">
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
            <div className="lg:col-span-1">
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

                    {/* Primary Registrant */}
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
                          required
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                          placeholder="Phone Number *"
                        />
                      </div>
                    </div>

                    {/* Add Family Details Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowFamilyDetails(!showFamilyDetails)}
                      className="w-full py-2 text-[#EF8046] font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#EF8046]/5 rounded-lg transition-colors"
                    >
                      {showFamilyDetails ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Hide Family Details
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Add Family Details
                        </>
                      )}
                    </button>

                    {/* Family Details Section */}
                    <AnimatePresence>
                      {showFamilyDetails && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-5 overflow-hidden"
                        >
                          {/* Spouse Details */}
                          <div className="pt-4 border-t border-gray-100">
                            <h4 className="font-semibold text-gray-900 mb-3">Spouse Details</h4>
                            <div className="space-y-3">
                              <input
                                type="text"
                                name="spouseName"
                                value={formState.spouseName}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                                placeholder="Spouse Full Name"
                              />
                              <input
                                type="email"
                                name="spouseEmail"
                                value={formState.spouseEmail}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                                placeholder="Spouse Email"
                              />
                              <input
                                type="tel"
                                name="spousePhone"
                                value={formState.spousePhone}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                                placeholder="Spouse Phone"
                              />
                            </div>
                          </div>

                          {/* Additional Adults */}
                          <div className="pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="font-semibold text-gray-900">Additional Adults</h4>
                              <button
                                type="button"
                                onClick={() => addFamilyMember("adult")}
                                className="text-[#EF8046] text-sm font-medium flex items-center gap-1 hover:underline"
                              >
                                <Plus className="w-4 h-4" /> Add Adult
                              </button>
                            </div>
                            {additionalAdults.map((adult) => (
                              <div key={adult.id} className="bg-gray-50 rounded-lg p-3 mb-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs text-gray-500">Adult Guest</span>
                                  <button
                                    type="button"
                                    onClick={() => removeFamilyMember(adult.id, "adult")}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={adult.name}
                                  onChange={(e) => updateFamilyMember(adult.id, "name", e.target.value, "adult")}
                                  className="w-full px-3 py-2 rounded border border-gray-200 text-sm mb-2"
                                  placeholder="Full Name"
                                />
                              </div>
                            ))}
                          </div>

                          {/* Children */}
                          <div className="pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-center mb-3">
                              <h4 className="font-semibold text-gray-900">
                                Children <span className="text-gray-500 text-sm">(${purimEvent.kidsPrice} each)</span>
                              </h4>
                              <button
                                type="button"
                                onClick={() => addFamilyMember("child")}
                                className="text-[#EF8046] text-sm font-medium flex items-center gap-1 hover:underline"
                              >
                                <Plus className="w-4 h-4" /> Add Child
                              </button>
                            </div>
                            {children.map((child) => (
                              <div key={child.id} className="bg-[#EF8046]/5 rounded-lg p-3 mb-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs text-[#EF8046]">Child (${purimEvent.kidsPrice})</span>
                                  <button
                                    type="button"
                                    onClick={() => removeFamilyMember(child.id, "child")}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={child.name}
                                  onChange={(e) => updateFamilyMember(child.id, "name", e.target.value, "child")}
                                  className="w-full px-3 py-2 rounded border border-gray-200 text-sm"
                                  placeholder="Child's Name"
                                />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Sponsorship */}
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="font-semibold text-gray-900 mb-3">Sponsorship (Optional)</h4>
                      <select
                        value={selectedSponsorship || ""}
                        onChange={(e) => setSelectedSponsorship(e.target.value || null)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm"
                      >
                        <option value="">No sponsorship</option>
                        {purimEvent.sponsorships.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name} {s.price > 0 ? `- $${s.price}` : ""}
                          </option>
                        ))}
                      </select>

                      {/* Custom Amount for "Because I'm Happy" */}
                      {selectedSponsorship === "\"Because I'm Happy\" Sponsorship - Any Amount" && (
                        <div className="mt-3">
                          <label className="text-xs text-gray-500 mb-1 block">Enter your amount:</label>
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
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
                        </div>
                      )}
                    </div>

                    {/* Donation Amount (if no sponsorship) */}
                    {!selectedSponsorship && (
                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="font-semibold text-gray-900 mb-3">Amount</h4>
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                          <span className="px-3 py-2 bg-[#EF8046] text-white font-medium">$</span>
                          <input
                            type="number"
                            value={total || ""}
                            readOnly
                            className="w-full px-3 py-2 outline-none text-sm bg-gray-50"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          {totalAdults} adult{totalAdults > 1 ? "s" : ""} @ ${purimEvent.pricePerAdult}
                          {totalKids > 0 && ` + ${totalKids} kid${totalKids > 1 ? "s" : ""} @ $${purimEvent.kidsPrice}`}
                          {calculatedTotal > purimEvent.familyMax && (
                            <span className="text-[#EF8046] font-medium"> (Family max ${purimEvent.familyMax} applied!)</span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Payment Method */}
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="font-semibold text-gray-900 mb-3">Payment Method</h4>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === "online"}
                            onChange={() => setPaymentMethod("online")}
                            className="w-4 h-4 text-[#EF8046]"
                          />
                          <span className="text-sm">Online Payment</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === "check"}
                            onChange={() => setPaymentMethod("check")}
                            className="w-4 h-4 text-[#EF8046]"
                          />
                          <span className="text-sm">I&apos;ll send a Check</span>
                        </label>
                      </div>
                    </div>

                    {/* Credit Card Details */}
                    <AnimatePresence>
                      {paymentMethod === "online" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-4 border-t border-gray-100 overflow-hidden"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <CreditCard className="w-5 h-5 text-[#EF8046]" />
                            <h4 className="font-semibold text-gray-900">Credit Card Details</h4>
                          </div>
                          <div className="space-y-3">
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
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Message */}
                    <div className="pt-4 border-t border-gray-100">
                      <h4 className="font-semibold text-gray-900 mb-2">Message (Optional)</h4>
                      <p className="text-xs text-gray-500 mb-3">
                        If you would like your sponsorship in honor of a friend, leave a message below or email us at office@thejre.org
                      </p>
                      <textarea
                        name="message"
                        value={formState.message}
                        onChange={handleChange}
                        rows={3}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-sm resize-none"
                        placeholder="Enter your message..."
                      />
                    </div>

                    {/* Total */}
                    <div className="bg-gradient-to-r from-[#EF8046]/10 to-[#EF8046]/5 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-medium">Total</span>
                        <span className="text-3xl font-bold text-[#EF8046]">${total}</span>
                      </div>
                      {selectedSponsorship && (
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedSponsorship}
                        </p>
                      )}
                    </div>

                    {/* Submit */}
                    <motion.button
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
                          Register for Purim
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
