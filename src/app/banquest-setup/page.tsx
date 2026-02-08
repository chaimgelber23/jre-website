"use client";

import { useState } from "react";
import CollectJsPayment, { useCollectJs } from "@/components/payment/CollectJsPayment";

export default function BanquestSetupPage() {
  const [amount, setAmount] = useState("1.00");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [paymentToken, setPaymentToken] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: Record<string, unknown>;
  } | null>(null);
  const [cardValid, setCardValid] = useState(false);

  // Direct card input state (workaround for tokenization issues)
  const [useDirectInput, setUseDirectInput] = useState(true);
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");

  const { requestToken } = useCollectJs();

  const handleTokenReceived = async (token: string) => {
    setPaymentToken(token);
    console.log("Token received:", token);

    // Now process the payment
    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch("/api/banquest-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentToken: token,
          amount: parseFloat(amount),
          name,
          email,
        }),
      });

      const data = await response.json();
      setResult({
        success: data.success,
        message: data.success
          ? `Payment successful! Transaction ID: ${data.transactionId}`
          : `Payment failed: ${data.error}`,
        details: data,
      });
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleError = (error: string) => {
    setResult({
      success: false,
      message: `Card error: ${error}`,
    });
    setIsProcessing(false);
  };

  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email) {
      setResult({ success: false, message: "Please fill in name and email" });
      return;
    }

    if (!cardNumber || !expiryMonth || !expiryYear || !cvv) {
      setResult({ success: false, message: "Please fill in all card details" });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    try {
      const response = await fetch("/api/banquest-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Direct card details (no tokenization)
          cardNumber: cardNumber.replace(/\s/g, ""),
          expiryMonth: parseInt(expiryMonth),
          expiryYear: parseInt(expiryYear),
          cvv,
          amount: parseFloat(amount),
          name,
          email,
        }),
      });

      const data = await response.json();
      setResult({
        success: data.success,
        message: data.success
          ? `Payment successful! Transaction ID: ${data.transactionId}`
          : `Payment failed: ${data.error}`,
        details: data,
      });
    } catch (error) {
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTokenizedSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email) {
      setResult({ success: false, message: "Please fill in name and email" });
      return;
    }

    if (!cardValid) {
      setResult({ success: false, message: "Please enter valid card details" });
      return;
    }

    setIsProcessing(true);
    setResult(null);

    // Request token from Hosted Tokenization - this will trigger handleTokenReceived
    const started = requestToken();
    if (!started) {
      setResult({ success: false, message: "Payment system not ready. Please wait and try again." });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setUseDirectInput(true)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              useDirectInput
                ? "bg-[#EF8046] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Direct Input
          </button>
          <button
            type="button"
            onClick={() => setUseDirectInput(false)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              !useDirectInput
                ? "bg-[#EF8046] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Tokenized (iframe)
          </button>
        </div>

        {/* Mode Banner */}
        {useDirectInput ? (
          <div className="bg-green-100 border border-green-300 rounded-lg px-4 py-2 mb-6 text-center">
            <span className="text-green-800 font-medium">DIRECT INPUT MODE</span>
            <p className="text-green-700 text-xs">Bypasses tokenization (for testing)</p>
          </div>
        ) : (
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2 mb-6 text-center">
            <span className="text-yellow-800 font-medium">TOKENIZED MODE (Sandbox)</span>
            <p className="text-yellow-700 text-xs">Uses HostedTokenization iframe</p>
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Banquest Payment Test</h1>
        <p className="text-gray-600 mb-6">Test the Banquest JSON API v2</p>

        <form onSubmit={useDirectInput ? handleDirectSubmit : handleTokenizedSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
              placeholder="1.00"
            />
            <p className="text-xs text-gray-500 mt-1">
              Under $100 = approved. Over $100 uses last 3 digits as decline code.
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name on Card
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
              placeholder="John Doe"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
              placeholder="john@example.com"
            />
          </div>

          {/* Card Details */}
          {useDirectInput ? (
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                  placeholder="4761 5300 0111 1118"
                  maxLength={19}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Month
                  </label>
                  <input
                    type="text"
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                    placeholder="12"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year
                  </label>
                  <input
                    type="text"
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                    placeholder="2027"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CVV
                  </label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[#EF8046] focus:ring-2 focus:ring-[#EF8046]/20 outline-none"
                    placeholder="123"
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              <CollectJsPayment
                onTokenReceived={handleTokenReceived}
                onError={handleError}
                onValidationChange={setCardValid}
                disabled={isProcessing}
                useSandbox={false}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isProcessing}
            className="w-full bg-[#EF8046] text-white py-3 rounded-lg font-medium hover:bg-[#d96a2f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? "Processing..." : `Charge $${amount}`}
          </button>
        </form>

        {/* Result Display */}
        {result && (
          <div
            className={`mt-6 p-4 rounded-lg ${
              result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            }`}
          >
            <p className={`font-medium ${result.success ? "text-green-800" : "text-red-800"}`}>
              {result.message}
            </p>
            {result.details && (
              <pre className="mt-2 text-xs overflow-auto max-h-40 bg-white p-2 rounded">
                {JSON.stringify(result.details, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Debug Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-700 mb-2">Debug Info</h3>
          <div className="text-xs space-y-1 text-gray-600">
            <p>Mode: {useDirectInput ? "Direct Input" : "Tokenized"}</p>
            {!useDirectInput && <p>Card Ready: {cardValid ? "Yes" : "No"}</p>}
            {!useDirectInput && <p>Token: {paymentToken ? paymentToken.substring(0, 30) + "..." : "None"}</p>}
            <p>Processing: {isProcessing ? "Yes" : "No"}</p>
            <p>Environment: Sandbox</p>
          </div>
        </div>

        {/* Sandbox Test Cards */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-2">Sandbox Test Cards</h3>
          <div className="text-xs space-y-1 text-blue-700">
            <p><strong>Visa:</strong> 4761 5300 0111 1118</p>
            <p><strong>MasterCard:</strong> 5137 2211 1111 6668</p>
            <p><strong>Expiry:</strong> 12 / 2027</p>
            <p><strong>CVV:</strong> 123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
