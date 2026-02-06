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

  const handleSubmit = (e: React.FormEvent) => {
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
        {/* Sandbox Banner */}
        <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2 mb-6 text-center">
          <span className="text-yellow-800 font-medium">SANDBOX MODE</span>
          <p className="text-yellow-700 text-xs">Using test credentials - no real charges</p>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Banquest Payment Test</h1>
        <p className="text-gray-600 mb-6">Test the Banquest Hosted Tokenization + JSON API</p>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Card Details via Hosted Tokenization */}
          <div className="pt-2">
            <CollectJsPayment
              onTokenReceived={handleTokenReceived}
              onError={handleError}
              onValidationChange={setCardValid}
              disabled={isProcessing}
              useSandbox={true}
            />
          </div>

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
            <p>Card Ready: {cardValid ? "Yes" : "No"}</p>
            <p>Token: {paymentToken ? paymentToken.substring(0, 30) + "..." : "None"}</p>
            <p>Processing: {isProcessing ? "Yes" : "No"}</p>
            <p>Environment: Sandbox</p>
          </div>
        </div>

        {/* Sandbox Test Card Info */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-2">Sandbox Test Cards</h3>
          <div className="text-xs space-y-1 text-blue-700">
            <p><strong>Visa:</strong> 4761 5300 0111 1118</p>
            <p><strong>MasterCard:</strong> 5137 2211 1111 6668</p>
            <p><strong>Discover:</strong> 6011 2087 0111 7775</p>
            <p><strong>Amex:</strong> 3710 300 8911 1338</p>
            <p><strong>Diners Club:</strong> 3618 590 001 1112</p>
            <p><strong>JCB:</strong> 3566 0023 4543 2153</p>
            <p className="mt-2"><strong>Expiry:</strong> Any future date (e.g., 12/27)</p>
            <p><strong>CVV:</strong> Any 3 digits (4 for Amex)</p>
          </div>
        </div>

        {/* Amount Testing Info */}
        <div className="mt-4 p-4 bg-purple-50 rounded-lg">
          <h3 className="font-medium text-purple-800 mb-2">Amount Testing</h3>
          <div className="text-xs space-y-1 text-purple-700">
            <p><strong>$45.67</strong> = Timeout simulation</p>
            <p><strong>Under $100</strong> = Approved</p>
            <p><strong>Over $100</strong> = Decline (last 3 digits = response code)</p>
            <p><strong>$101.06</strong> = Decline code 106</p>
            <p><strong>$109.02</strong> = Error response</p>
          </div>
        </div>
      </div>
    </div>
  );
}
