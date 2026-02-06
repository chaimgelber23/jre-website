"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CreditCard, Lock } from "lucide-react";

// Square Web Payments SDK types
interface Card {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<TokenResult>;
  destroy: () => void;
  addEventListener: (event: string, callback: (event: CardInputEvent) => void) => void;
}

interface TokenResult {
  status: "OK" | "ERROR";
  token?: string;
  errors?: Array<{ message: string }>;
}

interface CardInputEvent {
  detail: {
    currentState: {
      isCompletelyValid: boolean;
    };
  };
}

interface Payments {
  card: (options?: CardOptions) => Promise<Card>;
}

interface CardOptions {
  style?: {
    ".input-container"?: Record<string, string>;
    input?: Record<string, string>;
    "input::placeholder"?: Record<string, string>;
    ".message-text"?: Record<string, string>;
    ".message-icon"?: Record<string, string>;
  };
}

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<Payments>;
    };
  }
}

interface SquarePaymentProps {
  onTokenReceived: (token: string, cardInfo?: { last4?: string; brand?: string }) => void;
  onError: (error: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
}

export default function SquarePayment({
  onTokenReceived,
  onError,
  onValidationChange,
  disabled = false,
}: SquarePaymentProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const cardRef = useRef<Card | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializingRef = useRef(false);

  const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;

  // Load Square Web Payments SDK
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!appId || !locationId) {
      console.error("[Square] Missing NEXT_PUBLIC_SQUARE_APPLICATION_ID or NEXT_PUBLIC_SQUARE_LOCATION_ID");
      return;
    }

    // Check if already loaded
    if (window.Square) {
      setIsLoaded(true);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="square.js"]');
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.Square) {
          clearInterval(checkLoaded);
          setIsLoaded(true);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    // Load the Square Web Payments SDK
    const script = document.createElement("script");
    script.src = "https://sandbox.web.squarecdn.com/v1/square.js"; // Use sandbox for dev
    script.async = true;

    script.onload = () => {
      console.log("[Square] SDK loaded successfully");
      setIsLoaded(true);
    };

    script.onerror = () => {
      onError("Failed to load payment system. Please refresh and try again.");
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove script on cleanup
    };
  }, [appId, locationId, onError]);

  // Initialize card payment form
  useEffect(() => {
    if (!isLoaded || !window.Square || !appId || !locationId || disabled) return;
    if (!containerRef.current) return;
    if (initializingRef.current) return;

    const initializeCard = async () => {
      initializingRef.current = true;

      try {
        // Destroy existing card if any
        if (cardRef.current) {
          try {
            cardRef.current.destroy();
          } catch {
            // Ignore destroy errors
          }
          cardRef.current = null;
        }

        // Wait for container to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!containerRef.current) {
          initializingRef.current = false;
          return;
        }

        // Clear container
        containerRef.current.innerHTML = "";

        const payments = await window.Square!.payments(appId, locationId);

        const card = await payments.card({
          style: {
            ".input-container": {
              borderRadius: "8px",
            },
            input: {
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "14px",
              color: "#1f2937",
            },
            "input::placeholder": {
              color: "#9ca3af",
            },
            ".message-text": {
              color: "#ef4444",
            },
            ".message-icon": {
              color: "#ef4444",
            },
          },
        });

        await card.attach("#square-card-container");

        // Listen for validation changes
        card.addEventListener("cardBrandChanged", () => {
          // Card brand changed
        });

        card.addEventListener("inputEventReceived", (event: CardInputEvent) => {
          const isValid = event.detail.currentState.isCompletelyValid;
          onValidationChange?.(isValid);
        });

        cardRef.current = card;
        console.log("[Square] Card form initialized");
      } catch (error) {
        console.error("[Square] Failed to initialize card:", error);
        onError("Failed to initialize payment form. Please refresh and try again.");
      } finally {
        initializingRef.current = false;
      }
    };

    initializeCard();

    return () => {
      if (cardRef.current) {
        try {
          cardRef.current.destroy();
        } catch {
          // Ignore destroy errors
        }
        cardRef.current = null;
      }
      initializingRef.current = false;
    };
  }, [isLoaded, disabled, appId, locationId, onError, onValidationChange]);

  const requestToken = useCallback(async () => {
    if (!cardRef.current || isProcessing || disabled) return false;

    setIsProcessing(true);

    try {
      const result = await cardRef.current.tokenize();

      if (result.status === "OK" && result.token) {
        onTokenReceived(result.token);
        return true;
      } else {
        const errorMessage = result.errors?.[0]?.message || "Please check your card details and try again.";
        onError(errorMessage);
        return false;
      }
    } catch (error) {
      console.error("[Square] Tokenization error:", error);
      onError("Failed to process card. Please try again.");
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, disabled, onTokenReceived, onError]);

  // Expose requestToken method to parent via window
  useEffect(() => {
    (window as unknown as { requestPaymentToken?: () => Promise<boolean> }).requestPaymentToken = requestToken;
    return () => {
      delete (window as unknown as { requestPaymentToken?: () => Promise<boolean> }).requestPaymentToken;
    };
  }, [requestToken]);

  if (!appId || !locationId) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
        Payment system not configured. Missing Square credentials.
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Square Card Element Container */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          <CreditCard className="w-4 h-4 inline mr-1.5" />
          Card Details
        </label>
        <div
          id="square-card-container"
          ref={containerRef}
          className="min-h-[50px] rounded-lg border border-gray-200 bg-white overflow-hidden"
        />
      </div>

      {/* Security Badge */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Lock className="w-3 h-3" />
        <span>Secured by Square. Your card details are encrypted.</span>
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
export function useSquarePayment() {
  const requestToken = useCallback(async () => {
    const fn = (window as unknown as { requestPaymentToken?: () => Promise<boolean> }).requestPaymentToken;
    if (fn) {
      return await fn();
    }
    return false;
  }, []);

  return { requestToken };
}
