"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CreditCard, Lock } from "lucide-react";

// Extend window to include CollectJS
declare global {
  interface Window {
    CollectJS?: {
      configure: (config: CollectJSConfig) => void;
      startPaymentRequest: () => void;
    };
  }
}

interface CollectJSConfig {
  variant: "inline" | "lightbox";
  callback: (response: CollectJSResponse) => void;
  validationCallback?: (field: string, valid: boolean, message: string) => void;
  fieldsAvailableCallback?: () => void;
  timeoutCallback?: () => void;
  timeoutDuration?: number;
  tokenizationKey?: string;
  customCss?: Record<string, Record<string, string>>;
  fields?: {
    ccnumber?: FieldConfig;
    ccexp?: FieldConfig;
    cvv?: FieldConfig;
  };
}

interface FieldConfig {
  selector?: string;
  title?: string;
  placeholder?: string;
}

interface CollectJSResponse {
  token?: string;
  card?: {
    number?: string;
    bin?: string;
    exp?: string;
    type?: string;
  };
}

interface CollectJsPaymentProps {
  onTokenReceived: (token: string, cardInfo?: { last4?: string; type?: string }) => void;
  onError: (error: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
}

export default function CollectJsPayment({
  onTokenReceived,
  onError,
  onValidationChange,
  disabled = false,
}: CollectJsPaymentProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fieldValidation, setFieldValidation] = useState({
    ccnumber: false,
    ccexp: false,
    cvv: false,
  });
  const configuredRef = useRef(false);

  const tokenizationKey = process.env.NEXT_PUBLIC_BANQUEST_TOKENIZATION_KEY;

  // Load Collect.js script
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already loaded
    if (window.CollectJS) {
      setIsLoaded(true);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="collect.js"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => setIsLoaded(true));
      return;
    }

    // Load the script
    const script = document.createElement("script");
    script.src = "https://secure.networkmerchants.com/token/Collect.js";
    script.dataset.tokenizationKey = tokenizationKey;
    script.async = true;

    script.onload = () => {
      setIsLoaded(true);
    };

    script.onerror = () => {
      onError("Failed to load payment system. Please refresh and try again.");
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove script on cleanup - it may be used by other components
    };
  }, [tokenizationKey, onError]);

  // Configure Collect.js when loaded
  useEffect(() => {
    if (!isLoaded || !window.CollectJS || configuredRef.current || disabled) return;

    configuredRef.current = true;

    window.CollectJS.configure({
      variant: "inline",
      tokenizationKey: tokenizationKey,
      callback: (response) => {
        setIsProcessing(false);
        if (response.token) {
          const cardInfo = response.card
            ? {
              last4: response.card.number?.slice(-4),
              type: response.card.type,
            }
            : undefined;
          onTokenReceived(response.token, cardInfo);
        } else {
          onError("Failed to process card. Please check your details and try again.");
        }
      },
      validationCallback: (field, valid, message) => {
        setFieldValidation((prev) => {
          const updated = { ...prev, [field]: valid };
          // Check if all fields are valid
          const allValid = updated.ccnumber && updated.ccexp && updated.cvv;
          onValidationChange?.(allValid);
          return updated;
        });
        if (!valid && message) {
          console.log(`Field ${field} validation: ${message}`);
        }
      },
      fieldsAvailableCallback: () => {
        console.log("Collect.js fields available");
      },
      timeoutCallback: () => {
        setIsProcessing(false);
        onError("Payment request timed out. Please try again.");
      },
      timeoutDuration: 30000,
      customCss: {
        "": {
          "font-family": "Inter, system-ui, sans-serif",
          "font-size": "14px",
          color: "#1f2937",
          padding: "10px 16px",
          height: "42px",
          "border-radius": "8px",
          border: "1px solid #e5e7eb",
          "background-color": "#ffffff",
          width: "100%",
          "box-sizing": "border-box",
        },
        ":focus": {
          "border-color": "#EF8046",
          "box-shadow": "0 0 0 2px rgba(239, 128, 70, 0.2)",
          outline: "none",
        },
        "::placeholder": {
          color: "#9ca3af",
        },
      },
      fields: {
        ccnumber: {
          selector: "#ccnumber",
          title: "Card Number",
          placeholder: "Card Number",
        },
        ccexp: {
          selector: "#ccexp",
          title: "Expiration",
          placeholder: "MM / YY",
        },
        cvv: {
          selector: "#cvv",
          title: "CVV",
          placeholder: "CVV",
        },
      },
    });
  }, [isLoaded, disabled, tokenizationKey, onTokenReceived, onError, onValidationChange]);

  const requestToken = useCallback(() => {
    if (!window.CollectJS || isProcessing || disabled) return;
    setIsProcessing(true);
    window.CollectJS.startPaymentRequest();
  }, [isProcessing, disabled]);

  // Expose requestToken method to parent
  useEffect(() => {
    // Store reference on window for parent component access
    (window as unknown as { requestPaymentToken?: () => void }).requestPaymentToken = requestToken;
    return () => {
      delete (window as unknown as { requestPaymentToken?: () => void }).requestPaymentToken;
    };
  }, [requestToken]);

  if (!tokenizationKey) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
        Payment system not configured. Please contact support.
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Card Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <CreditCard className="w-4 h-4 inline mr-1.5" />
          Card Number
        </label>
        <div
          id="ccnumber"
          className="w-full h-[42px] rounded-lg border border-gray-200 bg-white"
        />
      </div>

      {/* Expiry and CVV */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Expiration</label>
          <div
            id="ccexp"
            className="w-full h-[42px] rounded-lg border border-gray-200 bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">CVV</label>
          <div
            id="cvv"
            className="w-full h-[42px] rounded-lg border border-gray-200 bg-white"
          />
        </div>
      </div>

      {/* Security Badge */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Lock className="w-3 h-3" />
        <span>Secured by Banquest. Your card details are encrypted.</span>
      </div>

      {/* Loading indicator */}
      {!isLoaded && (
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#EF8046]" />
          <span className="ml-2 text-sm text-gray-500">Loading secure payment...</span>
        </div>
      )}
    </div>
  );
}

// Export a hook for triggering payment
export function useCollectJs() {
  const requestToken = useCallback(() => {
    const fn = (window as unknown as { requestPaymentToken?: () => void }).requestPaymentToken;
    if (fn) {
      fn();
      return true;
    }
    return false;
  }, []);

  return { requestToken };
}
