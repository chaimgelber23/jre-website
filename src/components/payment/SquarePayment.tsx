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
  card: () => Promise<Card>;
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
  isActive?: boolean; // Whether this is the active payment processor
}

export default function SquarePayment({
  onTokenReceived,
  onError,
  onValidationChange,
  disabled = false,
  isActive = true, // Default to true for backwards compatibility
}: SquarePaymentProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const cardRef = useRef<Card | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializingRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

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
    script.src = "https://web.squarecdn.com/v1/square.js"; // Production
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

  // Initialize card payment form - only when active
  useEffect(() => {
    if (!isLoaded || !window.Square || !appId || !locationId || disabled) return;
    if (!containerRef.current) return;
    if (initializingRef.current) return;
    // Only initialize when this processor is active
    if (!isActive) return;
    // Don't re-initialize if already initialized
    if (cardRef.current) return;

    const initializeCard = async (retryAttempt = 0) => {
      initializingRef.current = true;
      setInitError(null);

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

        // Wait for container to be ready - longer wait on retries
        const waitTime = 200 + (retryAttempt * 300);
        await new Promise(resolve => setTimeout(resolve, waitTime));

        if (!containerRef.current) {
          initializingRef.current = false;
          return;
        }

        console.log("[Square] Initializing with appId:", appId, "locationId:", locationId, retryAttempt > 0 ? `(retry ${retryAttempt})` : "");

        const payments = await window.Square!.payments(appId, locationId);
        console.log("[Square] Payments object created");

        const card = await payments.card();

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
        retryCountRef.current = 0;
        console.log("[Square] Card form initialized successfully");
      } catch (error) {
        console.error("[Square] Failed to initialize card:", error);

        // Retry logic for transient failures
        if (retryAttempt < maxRetries) {
          console.log(`[Square] Retrying initialization (${retryAttempt + 1}/${maxRetries})...`);
          initializingRef.current = false;
          setTimeout(() => initializeCard(retryAttempt + 1), 500 * (retryAttempt + 1));
          return;
        }

        setInitError("Payment form failed to load. Please refresh the page.");
      } finally {
        initializingRef.current = false;
      }
    };

    initializeCard(0);

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
  }, [isLoaded, disabled, isActive, appId, locationId, onValidationChange]);

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
          className="min-h-[130px] rounded-lg border border-gray-200 bg-white overflow-hidden p-1"
          style={{ minHeight: '130px' }}
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

      {/* Error with retry */}
      {initError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{initError}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-3 text-amber-800 underline hover:no-underline"
          >
            Refresh
          </button>
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
