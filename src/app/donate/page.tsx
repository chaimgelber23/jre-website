"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Heart, Check, CreditCard } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import SquarePayment, { useSquarePayment } from "@/components/payment/SquarePayment";
import { FadeUp } from "@/components/ui/motion";

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

export default function DonatePage() {
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    honorName: "",
    honorEmail: "",
    sponsorship: "",
    message: "",
    cardName: "",
  });
  const [paymentToken, setPaymentToken] = useState<string | null>(null);
  const [cardValid, setCardValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Square hook for triggering tokenization
  const { requestToken } = useSquarePayment();

  const handleAmountClick = (value: number) => {
    setAmount(value);
    setCustomAmount("");
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
  const doSubmit = useCallback(async (token: string) => {
    try {
      const response = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          isRecurring,
          name: formState.name,
          email: formState.email,
          phone: formState.phone,
          honorName: formState.honorName,
          honorEmail: formState.honorEmail,
          sponsorship: formState.sponsorship,
          message: formState.message,
          cardName: formState.cardName,
          paymentToken: token,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to process donation");
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error("Donation error:", err);
      setError(err instanceof Error ? err.message : "Failed to process donation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [amount, isRecurring, formState]);

  // When token is received, submit the form
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

    // Tokenize the card first
    const tokenStarted = requestToken();
    if (!tokenStarted) {
      setError("Payment system not ready. Please try again.");
      setIsSubmitting(false);
    }
    // Token callback will trigger doSubmit
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-[#EF8046]/20 text-[#EF8046] px-4 py-2 rounded-full mb-4"
          >
            <Heart className="w-4 h-4" />
            <span className="font-medium">Partner With Us</span>
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

      {/* Donation Form */}
      <section className="section bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit}>
              {/* Amount Selection */}
              <FadeUp>
                <div className="bg-[#FBFBFB] rounded-2xl p-8 mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    Donation Amount
                  </h3>

                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {presetAmounts.map((preset) => (
                      <motion.button
                        key={preset}
                        type="button"
                        onClick={() => handleAmountClick(preset)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`py-4 rounded-lg font-bold text-lg transition-all ${
                          amount === preset
                            ? "bg-[#EF8046] text-white shadow-lg"
                            : "bg-white border-2 border-gray-200 text-gray-700 hover:border-[#EF8046]"
                        }`}
                      >
                        ${preset}
                      </motion.button>
                    ))}
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg font-medium">
                      $
                    </span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      placeholder="Custom amount"
                      className="w-full pl-8 pr-4 py-4 text-lg rounded-lg border-2 border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none transition-all"
                    />
                  </div>

                  <label className="flex items-center gap-3 mt-6 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-[#EF8046] focus:ring-[#EF8046]"
                    />
                    <span className="text-gray-700">
                      Make this a monthly recurring donation
                    </span>
                  </label>
                </div>
              </FadeUp>

              {/* Donor Information */}
              <FadeUp delay={0.1}>
                <div className="bg-[#FBFBFB] rounded-2xl p-8 mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">
                    Donor Information
                  </h3>

                  <div className="grid md:grid-cols-2 gap-5">
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
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none transition-all"
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
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none transition-all"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                </div>
              </FadeUp>

              {/* In Honor Of */}
              <FadeUp delay={0.15}>
                <div className="bg-[#FBFBFB] rounded-2xl p-8 mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    In Honor Of
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Honoree will receive email notification of donation
                  </p>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Honoree Name
                      </label>
                      <input
                        type="text"
                        name="honorName"
                        value={formState.honorName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none transition-all"
                        placeholder="Honoree's name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Honoree Email
                      </label>
                      <input
                        type="email"
                        name="honorEmail"
                        value={formState.honorEmail}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none transition-all"
                        placeholder="honoree@email.com"
                      />
                    </div>
                  </div>
                </div>
              </FadeUp>

              {/* Sponsorship */}
              <FadeUp delay={0.2}>
                <div className="bg-[#FBFBFB] rounded-2xl p-8 mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Sponsorship
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Dedicate your donation to a specific program
                  </p>

                  <select
                    name="sponsorship"
                    value={formState.sponsorship}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none transition-all"
                  >
                    {sponsorships.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <div className="mt-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message (optional)
                    </label>
                    <textarea
                      name="message"
                      value={formState.message}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none transition-all resize-none"
                      placeholder="Add a personal message..."
                    />
                  </div>
                </div>
              </FadeUp>

              {/* Payment Details */}
              <FadeUp delay={0.25}>
                <div className="bg-[#FBFBFB] rounded-2xl p-8 mb-8">
                  <div className="flex items-center gap-3 mb-6">
                    <CreditCard className="w-6 h-6 text-[#EF8046]" />
                    <h3 className="text-2xl font-bold text-gray-900">
                      Payment Details
                    </h3>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-5">
                      {error}
                    </div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name on Card *
                      </label>
                      <input
                        type="text"
                        name="cardName"
                        value={formState.cardName}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none transition-all"
                        placeholder="Name on card"
                      />
                    </div>

                    <SquarePayment
                      onTokenReceived={handleTokenReceived}
                      onError={handlePaymentError}
                      onValidationChange={handleValidationChange}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </FadeUp>

              {/* Submit Button */}
              <FadeUp delay={0.3}>
                <motion.button
                  type="submit"
                  disabled={!amount || isSubmitting}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-[#EF8046] text-white py-5 rounded-xl font-bold text-xl flex items-center justify-center gap-3 hover:bg-[#d96a2f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
                        className="w-6 h-6 border-3 border-white border-t-transparent rounded-full"
                      />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Heart className="w-6 h-6" />
                      Donate {amount ? `$${amount}` : "Now"}
                      {isRecurring && " Monthly"}
                    </>
                  )}
                </motion.button>

                <p className="text-center text-gray-500 text-sm mt-4">
                  Your donation is tax-deductible. The JRE is a 501(c)(3)
                  nonprofit organization.
                </p>
              </FadeUp>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
