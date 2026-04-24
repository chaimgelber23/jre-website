"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CreditCard, ChevronDown, Gift, MessageSquare, Lock } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { FadeUp } from "@/components/ui/motion";
import TurnstileWidget from "@/components/ui/TurnstileWidget";

const presetAmounts = [18, 36, 72, 180, 360, 720];

const sponsorships = [
  { value: "", label: "Select a sponsorship (optional)" },
  { value: "class-sunday", label: "Sponsor a Sunday Morning Class" },
  { value: "class-women", label: "Sponsor a Sunday Morning Women's Class" },
  { value: "class-chumash", label: "Sponsor a Tuesday Evening Chumash Class" },
  { value: "mishmar", label: "Sponsor a Thursday Night Mishmar" },
  { value: "dinner", label: "Sponsor a Friday Night Dinner" },
  { value: "scotch", label: "Sponsor a Scotch and Steak" },
  { value: "food-thought", label: "Sponsor a Food For Thought Event" },
];

type DonatePaymentMethod = "card" | "donors_fund" | "ojc_fund";

export default function DonatePage() {
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<DonatePaymentMethod>("card");
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    honorName: "",
    honorEmail: "",
    sponsorship: "",
    message: "",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    dfDonor: "",
    dfAuth: "",
    ojcCardNumber: "",
    ojcExpDate: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHonorSection, setShowHonorSection] = useState(false);
  const [showSponsorSection, setShowSponsorSection] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Card field refs for auto-jump
  const cardNameRef = useRef<HTMLInputElement>(null);
  const cardNumberRef = useRef<HTMLInputElement>(null);
  const cardExpiryRef = useRef<HTMLInputElement>(null);
  const cardCvvRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  const handleAmountClick = (value: number) => {
    setAmount(value);
    setCustomAmount("");
  };

  const pickPaymentMethod = (m: DonatePaymentMethod) => {
    setPaymentMethod(m);
    if (m !== "card") setIsRecurring(false);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomAmount(value);
    setAmount(value ? parseInt(value) : "");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormState({
      ...formState,
      [e.target.name]: e.target.value,
    });
  };

  // Card formatting helpers (same as event pages)
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (value: string, prevValue: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 2 && value.length > prevValue.length) {
      return digits.slice(0, 2) + "/" + digits.slice(2);
    }
    if (digits.length >= 3) {
      return digits.slice(0, 2) + "/" + digits.slice(2);
    }
    return digits;
  };

  const handleCardKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLInputElement | HTMLButtonElement | null> | null
  ) => {
    if (e.key === "Enter" && nextRef?.current) {
      e.preventDefault();
      nextRef.current.focus();
    }
  };

  // Submit form — routes card / Donor's Fund / OJC Fund through /api/donate
  const doSubmit = useCallback(async () => {
    try {
      if (paymentMethod === "card") {
        const cardNum = formState.cardNumber.replace(/\s/g, "");
        if (!cardNum || cardNum.length < 13) {
          setError("Please enter a valid card number.");
          setIsSubmitting(false);
          return;
        }
        if (!formState.cardExpiry || !formState.cardExpiry.includes("/")) {
          setError("Please enter the card expiry date (MM/YY).");
          setIsSubmitting(false);
          return;
        }
        const [mm, yy] = formState.cardExpiry.split("/");
        if (!mm || !yy || parseInt(mm) < 1 || parseInt(mm) > 12) {
          setError("Invalid expiry month. Please use MM/YY format.");
          setIsSubmitting(false);
          return;
        }
        if (!formState.cardCvv || formState.cardCvv.length < 3) {
          setError("Please enter the CVV.");
          setIsSubmitting(false);
          return;
        }
      } else if (paymentMethod === "donors_fund") {
        if (!formState.dfDonor.trim()) {
          setError("Please enter your Giving Card number or Donor's Fund email.");
          setIsSubmitting(false);
          return;
        }
        if (!formState.dfAuth.trim()) {
          setError("Please enter your CVV (for card) or PIN (for email login).");
          setIsSubmitting(false);
          return;
        }
      } else if (paymentMethod === "ojc_fund") {
        const cardDigits = formState.ojcCardNumber.replace(/\s/g, "");
        if (!/^\d{13,19}$/.test(cardDigits)) {
          setError("Please enter a valid OJC Charity Card number.");
          setIsSubmitting(false);
          return;
        }
        if (!/^\d{4}$/.test(formState.ojcExpDate.trim())) {
          setError("OJC expiration must be MMYY (e.g. 1226).");
          setIsSubmitting(false);
          return;
        }
      }

      if (captchaRequired && !captchaToken) {
        setError("Please wait for verification to finish, then try again.");
        setIsSubmitting(false);
        return;
      }

      const payload = {
        amount,
        isRecurring: paymentMethod === "card" ? isRecurring : false,
        paymentMethod,
        name: formState.name,
        email: formState.email,
        phone: formState.phone,
        honorName: formState.honorName,
        honorEmail: formState.honorEmail,
        sponsorship: formState.sponsorship,
        message: formState.message,
        cardName: formState.cardName,
        cardNumber: paymentMethod === "card" ? formState.cardNumber.replace(/\s/g, "") : "",
        cardExpiry: formState.cardExpiry,
        cardCvv: formState.cardCvv,
        donorsFund: paymentMethod === "donors_fund" ? {
          donor: formState.dfDonor.trim(),
          authorization: formState.dfAuth.trim(),
        } : null,
        ojc: paymentMethod === "ojc_fund" ? {
          cardNumber: formState.ojcCardNumber.replace(/\s/g, ""),
          expDate: formState.ojcExpDate.trim(),
        } : null,
        turnstileToken: captchaToken,
      };

      const response = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to process donation");
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error("Donation error:", err);
      setError(err instanceof Error ? err.message : "Failed to process donation. Please try again.");
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);
    } finally {
      setIsSubmitting(false);
    }
  }, [amount, isRecurring, paymentMethod, formState, captchaRequired, captchaToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    doSubmit();
  };

  if (isSubmitted) {
    return (
      <main className="min-h-screen">
        <Header />
        <section className="pt-32 pb-20 min-h-[80vh] flex items-center justify-center bg-[#FBFBFB]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Thank You!
            </h1>
            <p className="text-xl text-gray-600 mb-2">
              Your donation of ${amount} has been processed successfully.
            </p>
            <p className="text-gray-500">
              You will receive a confirmation email shortly.
            </p>
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
      <section className="relative pt-32 pb-20 bg-gradient-to-b from-[#2d3748] to-[#1a202c]">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-3 mb-4"
          >
            <div className="w-8 h-px bg-[#EF8046]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#EF8046]">
              Partner With Us
            </span>
            <div className="w-8 h-px bg-[#EF8046]" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-6xl font-bold mb-6"
            style={{ color: '#ffffff' }}
          >
            Make a Donation
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl max-w-2xl mx-auto"
            style={{ color: '#e2e8f0' }}
          >
            Your generosity helps us continue to provide meaningful Jewish
            experiences for the Westchester community.
          </motion.p>
        </div>
      </section>

      {/* Donation Form - Compact Single-Card Design */}
      <section className="py-12 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit}>
              <FadeUp>
                <div className="bg-[#FBFBFB] rounded-2xl p-6 md:p-8 shadow-sm">
                  {/* Amount Selection */}
                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      Select Amount
                    </h3>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {presetAmounts.map((preset) => (
                        <motion.button
                          key={preset}
                          type="button"
                          onClick={() => handleAmountClick(preset)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`py-3 rounded-lg font-bold transition-all ${
                            amount === preset
                              ? "bg-[#EF8046] text-white shadow-md"
                              : "bg-white border border-gray-200 text-gray-700 hover:border-[#EF8046]"
                          }`}
                        >
                          ${preset}
                        </motion.button>
                      ))}
                    </div>

                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        $
                      </span>
                      <input
                        type="number"
                        value={customAmount}
                        onChange={handleCustomAmountChange}
                        placeholder="Other amount"
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none transition-all"
                      />
                    </div>

                    {paymentMethod === "card" && (
                      <label className="flex items-center gap-2 mt-4 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={isRecurring}
                          onChange={(e) => setIsRecurring(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#EF8046] focus:ring-[#EF8046]"
                        />
                        <span className="text-gray-600">Make this monthly</span>
                      </label>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-6" />

                  {/* Your Information */}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                      Your Information
                    </h3>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
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
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none text-sm transition-all"
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
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none text-sm transition-all"
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Optional Sections - Collapsible */}
                  <div className="space-y-3 mb-6">
                    {/* In Honor Of - Collapsible */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowHonorSection(!showHonorSection)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4 text-[#EF8046]" />
                          <span className="text-sm font-medium text-gray-700">Donate in honor of someone</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showHonorSection ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showHonorSection && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="px-4 pb-4 pt-2 bg-gray-50/50 grid md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                name="honorName"
                                value={formState.honorName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none text-sm transition-all"
                                placeholder="Honoree's name"
                              />
                              <input
                                type="email"
                                name="honorEmail"
                                value={formState.honorEmail}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none text-sm transition-all"
                                placeholder="Honoree's email (optional)"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Sponsorship - Collapsible */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowSponsorSection(!showSponsorSection)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-[#EF8046]" />
                          <span className="text-sm font-medium text-gray-700">Add sponsorship or message</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showSponsorSection ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {showSponsorSection && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="px-4 pb-4 pt-2 bg-gray-50/50 space-y-3">
                              <select
                                name="sponsorship"
                                value={formState.sponsorship}
                                onChange={handleChange}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none text-sm transition-all"
                              >
                                {sponsorships.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <textarea
                                name="message"
                                value={formState.message}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-3 py-2 rounded-xl border border-gray-200/80 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none text-sm transition-all resize-none"
                                placeholder="Add a personal message (optional)"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200 my-6" />

                  {/* Payment Details */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-xs font-semibold text-gray-400 tracking-[0.15em] uppercase">Payment Details</h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Lock className="w-3 h-3 text-green-500" />
                        <span>Secure</span>
                      </div>
                    </div>

                    {/* Method selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                      {(
                        [
                          { m: "card" as const, label: "Credit Card", subtitle: "US tax-deductible receipt" },
                          { m: "ojc_fund" as const, label: "OJC Fund", subtitle: "Charge Charity Card instantly", logo: "/logos/ojc-fund.png" },
                          { m: "donors_fund" as const, label: "The Donors Fund", subtitle: "Charge Giving Card instantly", logo: "/logos/donors-fund.svg" },
                        ]
                      ).map((opt) => {
                        const active = paymentMethod === opt.m;
                        return (
                          <button
                            key={opt.m}
                            type="button"
                            onClick={() => pickPaymentMethod(opt.m)}
                            aria-pressed={active}
                            className={`relative p-3 pt-7 rounded-xl border transition-all text-center flex flex-col items-center justify-start gap-1.5 min-h-[128px] ${
                              active
                                ? "border-[#EF8046] bg-[#fff5f0] shadow-sm"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <span
                              className={`absolute top-2.5 left-2.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                active ? "border-[#EF8046] bg-[#EF8046]" : "border-gray-300 bg-white"
                              }`}
                            >
                              {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3.5} />}
                            </span>
                            <div className="h-8 flex items-center justify-center">
                              {opt.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={opt.logo} alt={opt.label} className="object-contain h-8 max-w-[110px]" />
                              ) : (
                                <CreditCard className="w-7 h-7 text-gray-700" strokeWidth={1.75} />
                              )}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 leading-tight">{opt.label}</div>
                            <div className="text-[11px] text-gray-500 leading-tight px-1">{opt.subtitle}</div>
                          </button>
                        );
                      })}
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                        {error}
                      </div>
                    )}

                    {paymentMethod === "card" && (
                    <div className="bg-[#FAFAFA] rounded-2xl p-5 space-y-4 border border-gray-100/80 relative overflow-hidden">
                      {/* Subtle shimmer on the card form border */}
                      <motion.div
                        className="absolute inset-0 rounded-2xl border border-[#EF8046]/20 pointer-events-none"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      />
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block font-medium">Name on Card</label>
                        <input
                          ref={cardNameRef}
                          type="text"
                          name="cardName"
                          value={formState.cardName}
                          onChange={handleChange}
                          onKeyDown={(e) => handleCardKeyDown(e, cardNumberRef)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-[15px] bg-white transition-colors"
                          placeholder="Name on Card"
                          autoComplete="cc-name"
                        />
                      </div>
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
                              if (formatted.replace(/\s/g, "").length === 16) {
                                cardExpiryRef.current?.focus();
                              }
                            }}
                            onKeyDown={(e) => handleCardKeyDown(e, cardExpiryRef)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-[15px] bg-white transition-colors tabular-nums tracking-wide pr-12"
                            placeholder="Card Number"
                            maxLength={19}
                            autoComplete="cc-number"
                          />
                          <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                        </div>
                      </div>
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
                              if (formatted.length === 5) {
                                cardCvvRef.current?.focus();
                              }
                            }}
                            onKeyDown={(e) => handleCardKeyDown(e, cardCvvRef)}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-[15px] bg-white transition-colors tabular-nums tracking-wide"
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
                              if (e.key === "Enter") {
                                e.preventDefault();
                                submitRef.current?.focus();
                              }
                            }}
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-[15px] bg-white transition-colors tabular-nums tracking-wide"
                            placeholder="CVV"
                            maxLength={4}
                            autoComplete="cc-csc"
                          />
                        </div>
                      </div>
                    </div>
                    )}

                    {paymentMethod === "donors_fund" && (
                      <div className="bg-[#FAFAFA] rounded-2xl p-5 space-y-4 border border-gray-100/80">
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Charge your <span className="font-semibold">Donors&apos; Fund</span> Giving Card directly. Enter your 16-digit card + CVV, or your account email + PIN.
                        </p>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block font-medium">Giving Card # or Account Email</label>
                          <input
                            type="text"
                            name="dfDonor"
                            value={formState.dfDonor}
                            onChange={handleChange}
                            autoComplete="off"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-[15px] bg-white transition-colors"
                            placeholder="6599 9929 9945 6587 or you@example.com"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block font-medium">CVV (card) or PIN (email)</label>
                          <input
                            type="text"
                            name="dfAuth"
                            value={formState.dfAuth}
                            onChange={handleChange}
                            autoComplete="off"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-[15px] bg-white transition-colors tabular-nums"
                            placeholder="476 or 1234"
                          />
                        </div>
                      </div>
                    )}

                    {paymentMethod === "ojc_fund" && (
                      <div className="bg-[#FAFAFA] rounded-2xl p-5 space-y-4 border border-gray-100/80">
                        <p className="text-xs text-gray-600 leading-relaxed">
                          Enter your OJC Charity Card — we&apos;ll charge it instantly and email your tax-deductible receipt.
                        </p>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block font-medium">OJC Charity Card Number</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            name="ojcCardNumber"
                            value={formState.ojcCardNumber}
                            onChange={handleChange}
                            autoComplete="off"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-[15px] bg-white transition-colors tabular-nums tracking-wide"
                            placeholder="6900 0000 0000 0000"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block font-medium">Expiration (MMYY)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            name="ojcExpDate"
                            value={formState.ojcExpDate}
                            onChange={handleChange}
                            maxLength={4}
                            autoComplete="off"
                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none text-[15px] bg-white transition-colors tabular-nums"
                            placeholder="1226"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {captchaRequired && (
                    <div className="mb-4 flex justify-center">
                      <TurnstileWidget
                        onVerify={setCaptchaToken}
                        onExpire={() => setCaptchaToken(null)}
                        onError={() => setCaptchaToken(null)}
                        resetSignal={captchaReset}
                      />
                    </div>
                  )}

                  {/* Submit Button */}
                  <motion.button
                    ref={submitRef}
                    type="submit"
                    disabled={!amount || isSubmitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-gradient-to-r from-[#EF8046] to-[#d96a2f] text-white py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-2.5 hover:shadow-[0_8px_30px_rgba(239,128,70,0.35)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg relative overflow-hidden"
                  >
                    {/* Shimmer sweep */}
                    {!isSubmitting && (
                      <motion.span
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                        animate={{ x: ["-150%", "250%"] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
                      />
                    )}
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
                        Donate {amount ? `$${amount}` : "Now"}
                        {isRecurring && " Monthly"}
                      </>
                    )}
                  </motion.button>

                  <p className="text-center text-gray-500 text-xs mt-3">
                    Tax-deductible. JRE is a 501(c)(3) nonprofit.
                  </p>
                </div>
              </FadeUp>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
