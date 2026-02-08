"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Lock } from "lucide-react";

// Extend window to include Banquest HostedTokenization
declare global {
  interface Window {
    HostedTokenization?: new (
      sourceKey: string,
      options?: HostedTokenizationOptions
    ) => HostedTokenizationInstance;
  }
}

interface HostedTokenizationOptions {
  target?: string | HTMLElement;
  showZip?: boolean;
  requireCvv2?: boolean;
  styles?: Record<string, unknown>;
  threeDS?: Record<string, unknown>;
}

interface HostedTokenizationInstance {
  getNonceToken: () => Promise<NonceTokenResponse>;
  getData: () => Promise<unknown>;
  getSurcharge: () => Promise<unknown>;
  setOptions: (options: HostedTokenizationOptions) => void;
  setStyles: (styles: Record<string, unknown>) => void;
  resetForm: () => void;
  destroy: () => void;
  on: (event: string, callback: (data?: unknown) => void) => void;
}

interface NonceTokenResponse {
  nonce?: string;
  token?: string;
  error?: string;
  message?: string;
  card?: {
    last4?: string;
    type?: string;
    expiry?: string;
  };
}

interface CollectJsPaymentProps {
  onTokenReceived: (token: string, cardInfo?: { last4?: string; type?: string }) => void;
  onError: (error: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  disabled?: boolean;
  useSandbox?: boolean;
}

export default function CollectJsPayment({
  onTokenReceived,
  onError,
  onValidationChange,
  disabled = false,
  useSandbox = false, // Default to production
}: CollectJsPaymentProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const tokenizerRef = useRef<HostedTokenizationInstance | null>(null);
  const configuredRef = useRef(false);

  const tokenizationKey = process.env.NEXT_PUBLIC_BANQUEST_TOKENIZATION_KEY;

  // Determine script URL based on environment
  const scriptUrl = useSandbox
    ? "https://tokenization.sandbox.banquestgateway.com/tokenization/v0.3"
    : "https://tokenization.banquestgateway.com/tokenization/v0.3";

  // Load Banquest tokenization script
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!tokenizationKey) {
      console.error("[Banquest] No tokenization key available");
      return;
    }

    console.log("[Banquest] Starting load, tokenizationKey: present, sandbox:", useSandbox);

    // Check if already loaded
    if (window.HostedTokenization) {
      console.log("[Banquest] Already loaded on window");
      setIsLoaded(true);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector(
      `script[src="${scriptUrl}"]`
    ) as HTMLScriptElement | null;

    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.HostedTokenization) {
          clearInterval(checkLoaded);
          setIsLoaded(true);
        }
      }, 100);

      existingScript.addEventListener("load", () => {
        clearInterval(checkLoaded);
        setIsLoaded(true);
      });

      return () => clearInterval(checkLoaded);
    }

    // Load the script
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;

    script.onload = () => {
      console.log("[Banquest] Script loaded successfully");
      setIsLoaded(true);
    };

    script.onerror = () => {
      onError("Failed to load payment system. Please refresh and try again.");
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove script on cleanup
    };
  }, [tokenizationKey, scriptUrl, useSandbox, onError]);

  // Initialize Banquest when loaded - run only once
  useEffect(() => {
    if (!isLoaded || !window.HostedTokenization || configuredRef.current || disabled) return;

    // Wait for DOM elements to be fully rendered
    const timeoutId = setTimeout(() => {
      const container = document.getElementById("card-form-container");

      if (!container) {
        console.error("[Banquest] Container element not found");
        return;
      }

      // Mark as configured immediately to prevent re-runs
      configuredRef.current = true;

      try {
        console.log("[Banquest] Initializing with container element...");

        // Initialize HostedTokenization with the actual DOM element
        const tokenizer = new window.HostedTokenization!(tokenizationKey!, {
          target: container, // Pass DOM element directly
          showZip: false,
          requireCvv2: true,
        });

        // Listen for ready event
        tokenizer.on("ready", () => {
          console.log("[Banquest] Card form ready");
          setIsReady(true);
          onValidationChange?.(true);
        });

        // Listen for input changes
        tokenizer.on("change", (data) => {
          console.log("[Banquest] Form changed:", data);
        });

        // Store reference for later use
        tokenizerRef.current = tokenizer;

        console.log("[Banquest] Tokenizer initialized successfully");

        // Set ready after a short delay if ready event doesn't fire
        setTimeout(() => {
          setIsReady(true);
          onValidationChange?.(true);
        }, 2000);

      } catch (error) {
        console.error("[Banquest] Failed to initialize:", error);
        onError("Failed to initialize payment form. Please refresh and try again.");
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, disabled, tokenizationKey]);

  const requestToken = useCallback(async () => {
    if (!tokenizerRef.current || isProcessing || disabled) return;

    setIsProcessing(true);

    try {
      console.log("[Banquest] Requesting nonce token...");
      const response = await tokenizerRef.current.getNonceToken();

      console.log("[Banquest] Token response:", response);

      if (response.error || response.message) {
        console.error("[Banquest] Token error:", response.error || response.message);
        onError(response.error || response.message || "Failed to get token");
        setIsProcessing(false);
        return;
      }

      // The token might be in 'nonce' or 'token' field
      const token = response.nonce || response.token;

      if (token) {
        console.log("[Banquest] Token received successfully");
        const cardInfo = response.card
          ? {
              last4: response.card.last4,
              type: response.card.type,
            }
          : undefined;
        onTokenReceived(token, cardInfo);
      } else {
        onError("Failed to get payment token. Please check your card details.");
      }
    } catch (error) {
      console.error("[Banquest] getNonceToken error:", error);
      onError("Failed to process card. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, disabled, onTokenReceived, onError]);

  // Expose requestToken method to parent
  useEffect(() => {
    (window as unknown as { requestPaymentToken?: () => void }).requestPaymentToken = requestToken;
    return () => {
      delete (window as unknown as { requestPaymentToken?: () => void }).requestPaymentToken;
    };
  }, [requestToken]);

  if (!tokenizationKey) {
    console.error("[Banquest] Missing NEXT_PUBLIC_BANQUEST_TOKENIZATION_KEY");
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
        Payment system not configured. Missing tokenization key. Please check .env.local and restart the server.
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Card Form Container - Banquest iframe will be mounted here */}
      <div
        id="card-form-container"
        className="w-full min-h-[80px] rounded-lg overflow-hidden border border-gray-200 bg-white"
      />

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

      {/* Ready indicator */}
      {isLoaded && !isReady && (
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#EF8046]" />
          <span className="ml-2 text-sm text-gray-500">Initializing payment form...</span>
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
