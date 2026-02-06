// Square Payment Processing
// Server-side payment processing using Square Payments API

import { SquareClient, SquareEnvironment } from "square";

// Initialize Square client
const getSquareClient = () => {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("SQUARE_ACCESS_TOKEN not configured");
  }

  // Use sandbox for development, production for live
  // Detect by application ID prefix: sandbox-sq0idb- = sandbox, sq0idp- = production
  const appId = process.env.SQUARE_APPLICATION_ID || "";
  const environment = appId.startsWith("sandbox")
    ? SquareEnvironment.Sandbox
    : SquareEnvironment.Production;

  return new SquareClient({
    token: accessToken,
    environment,
  });
};

interface SquarePaymentData {
  sourceId: string; // Payment token from Web Payments SDK
  amount: number; // Amount in dollars (will be converted to cents)
  email: string;
  name?: string;
  description?: string;
  idempotencyKey?: string;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  receiptUrl?: string;
}

/**
 * Process a payment using Square
 * @param data Payment data including token from frontend
 * @returns Payment result with transaction ID or error
 */
export async function processSquarePayment(data: SquarePaymentData): Promise<PaymentResult> {
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!locationId) {
    console.error("Square location ID not configured");
    return { success: false, error: "Payment system not configured" };
  }

  if (!data.sourceId) {
    return { success: false, error: "Payment token is required" };
  }

  try {
    const client = getSquareClient();

    // Generate idempotency key if not provided (prevents duplicate charges)
    const idempotencyKey = data.idempotencyKey || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Square expects amount in cents
    const amountInCents = Math.round(data.amount * 100);

    console.log("Processing Square payment for amount:", data.amount, "cents:", amountInCents);

    const response = await client.payments.create({
      sourceId: data.sourceId,
      idempotencyKey,
      amountMoney: {
        amount: BigInt(amountInCents),
        currency: "USD",
      },
      locationId,
      note: data.description || "JRE Payment",
      buyerEmailAddress: data.email,
    });

    if (response.payment) {
      const payment = response.payment;
      return {
        success: true,
        transactionId: payment.id || `sq_${Date.now()}`,
        receiptUrl: payment.receiptUrl || undefined,
      };
    } else {
      console.error("Square payment failed - no payment in response");
      return {
        success: false,
        error: "Payment failed. Please try again.",
      };
    }
  } catch (error: unknown) {
    console.error("Square payment error:", error);

    // Extract error message from Square API error
    if (error && typeof error === "object" && "errors" in error) {
      const squareError = error as { errors: Array<{ detail?: string; code?: string }> };
      const firstError = squareError.errors?.[0];
      if (firstError) {
        // User-friendly error messages
        const errorCode = firstError.code;
        if (errorCode === "CARD_DECLINED") {
          return { success: false, error: "Card was declined. Please try a different card." };
        }
        if (errorCode === "INVALID_CARD") {
          return { success: false, error: "Invalid card details. Please check and try again." };
        }
        if (errorCode === "CVV_FAILURE") {
          return { success: false, error: "CVV verification failed. Please check your card details." };
        }
        if (errorCode === "INSUFFICIENT_FUNDS") {
          return { success: false, error: "Insufficient funds. Please try a different card." };
        }
        return { success: false, error: firstError.detail || "Payment failed" };
      }
    }

    return {
      success: false,
      error: "Failed to process payment. Please try again.",
    };
  }
}

/**
 * Verify Square configuration
 * @returns true if Square is properly configured
 */
export function isSquareConfigured(): boolean {
  return !!(
    process.env.SQUARE_ACCESS_TOKEN &&
    process.env.SQUARE_LOCATION_ID
  );
}
