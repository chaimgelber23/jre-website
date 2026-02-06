// Banquest Gateway Payment Processing - JSON API v2
// Sandbox: https://api.sandbox.banquestgateway.com/api/v2/
// Production: https://api.banquestgateway.com/api/v2/
// Auth: Basic Authentication (base64 of sourceKey:pin)

// Use sandbox for now - switch to production when ready
const USE_SANDBOX = true;

const BANQUEST_API_URL = USE_SANDBOX
  ? "https://api.sandbox.banquestgateway.com/api/v2/transactions/charge"
  : "https://api.banquestgateway.com/api/v2/transactions/charge";

// Helper to create Basic Auth header
function getAuthHeader(): string {
  const sourceKey = process.env.BANQUEST_SOURCE_KEY;
  const pin = process.env.BANQUEST_PIN;

  if (!sourceKey || !pin) {
    throw new Error("Banquest credentials not configured");
  }

  // Basic Auth: base64 encode "sourceKey:pin"
  const credentials = Buffer.from(`${sourceKey}:${pin}`).toString("base64");
  return `Basic ${credentials}`;
}

// ============================================
// TYPES
// ============================================

interface TokenizedPaymentData {
  paymentToken: string; // Nonce token from Hosted Tokenization
  amount: number;
  email: string;
  firstName?: string;
  lastName?: string;
  description?: string;
}

interface DirectPaymentData {
  amount: number;
  cardNumber: string;
  cardExpiry: string; // MM/YY or MM/YYYY format
  cardCvv: string;
  cardName: string;
  email: string;
  description?: string;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  authCode?: string;
  referenceNumber?: number;
  responseText?: string;
}

// Banquest API Response Types
interface BanquestResponse {
  version?: string;
  status: "Approved" | "Declined" | "Error" | string;
  status_code: string; // "A" = Approved
  error_message?: string;
  error_code?: string;
  error_details?: string;
  auth_amount?: number;
  auth_code?: string;
  reference_number?: number;
  transaction?: {
    id: number;
    created_at: string;
    amount_details?: {
      amount: number;
    };
    status_details?: {
      error_code?: string;
      error_message?: string;
      status: string;
    };
  };
  card_type?: string;
  last_4?: string;
  card_ref?: string;
}

// ============================================
// TOKENIZED PAYMENT (Hosted Tokenization) - PREFERRED
// ============================================

/**
 * Process payment using a nonce token from Hosted Tokenization
 * This is the PREFERRED method - card data never touches our server
 */
export async function processTokenizedPayment(data: TokenizedPaymentData): Promise<PaymentResult> {
  if (!data.paymentToken) {
    return { success: false, error: "Payment token is required" };
  }

  try {
    const authHeader = getAuthHeader();

    // The nonce token is passed as the "source" field
    // Nonce tokens should work directly - no prefix needed
    const requestBody = {
      amount: data.amount,
      source: data.paymentToken, // Nonce token from Hosted Tokenization
      customer: {
        email: data.email,
        send_receipt: false,
      },
      billing_info: {
        first_name: data.firstName || "",
        last_name: data.lastName || "",
      },
      transaction_details: {
        description: data.description || "JRE Payment",
      },
      capture: true, // Charge immediately (not just auth)
      save_card: false,
    };

    console.log("Processing tokenized payment for amount:", data.amount.toFixed(2));
    console.log("Using API URL:", BANQUEST_API_URL);

    const response = await fetch(BANQUEST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "User-Agent": "JRE-Website/1.0",
      },
      body: JSON.stringify(requestBody),
    });

    const result: BanquestResponse = await response.json();
    console.log("Payment response:", JSON.stringify(result, null, 2));

    // Check for approval - status_code "A" or status "Approved"
    if (result.status_code === "A" || result.status === "Approved") {
      return {
        success: true,
        transactionId: result.transaction?.id?.toString() || `txn_${Date.now()}`,
        authCode: result.auth_code,
        referenceNumber: result.reference_number,
        responseText: result.status,
      };
    } else {
      return {
        success: false,
        error: result.error_message || result.error_details || result.status || "Payment declined",
      };
    }
  } catch (error) {
    console.error("Payment processing error:", error);
    if (error instanceof Error && error.message.includes("credentials")) {
      return { success: false, error: "Payment system not configured" };
    }
    return {
      success: false,
      error: "Failed to process payment. Please try again.",
    };
  }
}

// ============================================
// DIRECT CARD PAYMENT (Legacy) - BACKUP
// ============================================

/**
 * Process payment with direct card details
 * NOTE: This sends card data through our server - use tokenized method when possible
 */
export async function processDirectPayment(data: DirectPaymentData): Promise<PaymentResult> {
  // Validate card expiry format
  if (!data.cardExpiry || !data.cardExpiry.includes("/")) {
    return { success: false, error: "Invalid expiry date format. Please use MM/YY or MM/YYYY" };
  }

  // Parse expiry date
  const expiryParts = data.cardExpiry.split("/");
  if (expiryParts.length < 2 || !expiryParts[0] || !expiryParts[1]) {
    return { success: false, error: "Invalid expiry date format. Please use MM/YY or MM/YYYY" };
  }
  const expMonth = parseInt(expiryParts[0], 10);
  let expYear = parseInt(expiryParts[1], 10);
  // If 2-digit year, convert to 4-digit
  if (expYear < 100) {
    expYear += 2000;
  }

  // Parse name
  const nameParts = data.cardName.trim().split(" ");
  const firstName = nameParts[0] || data.cardName;
  const lastName = nameParts.slice(1).join(" ") || "";

  try {
    const authHeader = getAuthHeader();

    const requestBody = {
      amount: data.amount,
      card: data.cardNumber.replace(/\s/g, ""),
      expiry_month: expMonth,
      expiry_year: expYear,
      cvv2: data.cardCvv,
      customer: {
        email: data.email,
        send_receipt: false,
      },
      billing_info: {
        first_name: firstName,
        last_name: lastName,
      },
      transaction_details: {
        description: data.description || "JRE Payment",
      },
      capture: true,
      save_card: false,
    };

    console.log("Processing direct payment for amount:", data.amount.toFixed(2));

    const response = await fetch(BANQUEST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "User-Agent": "JRE-Website/1.0",
      },
      body: JSON.stringify(requestBody),
    });

    const result: BanquestResponse = await response.json();
    console.log("Payment response:", JSON.stringify(result, null, 2));

    if (result.status_code === "A" || result.status === "Approved") {
      return {
        success: true,
        transactionId: result.transaction?.id?.toString() || `txn_${Date.now()}`,
        authCode: result.auth_code,
        referenceNumber: result.reference_number,
        responseText: result.status,
      };
    } else {
      return {
        success: false,
        error: result.error_message || result.error_details || result.status || "Payment declined",
      };
    }
  } catch (error) {
    console.error("Payment processing error:", error);
    return {
      success: false,
      error: "Failed to process payment. Please try again.",
    };
  }
}

// ============================================
// UNIFIED PAYMENT FUNCTION
// ============================================

interface PaymentData {
  amount: number;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardName?: string;
  paymentToken?: string; // Nonce token from Hosted Tokenization
  email: string;
  description?: string;
}

/**
 * Process payment - automatically uses tokenized or direct method
 * Prefers tokenized if paymentToken is provided
 */
export async function processPayment(data: PaymentData): Promise<PaymentResult> {
  // If payment token provided, use tokenized method
  if (data.paymentToken) {
    const nameParts = data.cardName?.split(" ") || [];
    return processTokenizedPayment({
      paymentToken: data.paymentToken,
      amount: data.amount,
      email: data.email,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" "),
      description: data.description,
    });
  }

  // Otherwise use direct method (requires card details)
  if (!data.cardNumber || !data.cardExpiry || !data.cardCvv || !data.cardName) {
    return { success: false, error: "Card details or payment token required" };
  }

  return processDirectPayment({
    amount: data.amount,
    cardNumber: data.cardNumber,
    cardExpiry: data.cardExpiry,
    cardCvv: data.cardCvv,
    cardName: data.cardName,
    email: data.email,
    description: data.description,
  });
}

// ============================================
// CUSTOMER VAULT (for saving cards)
// ============================================

export async function addToCustomerVault(paymentToken: string): Promise<{ success: boolean; vaultId?: string; error?: string }> {
  try {
    const authHeader = getAuthHeader();

    const requestBody = {
      amount: 0, // Zero-dollar auth to validate and save
      source: paymentToken,
      save_card: true,
    };

    const response = await fetch(BANQUEST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "User-Agent": "JRE-Website/1.0",
      },
      body: JSON.stringify(requestBody),
    });

    const result: BanquestResponse = await response.json();

    if ((result.status_code === "A" || result.status === "Approved") && result.card_ref) {
      return { success: true, vaultId: result.card_ref };
    } else {
      return { success: false, error: result.error_message || "Failed to save card" };
    }
  } catch (error) {
    console.error("Vault error:", error);
    return { success: false, error: "Failed to save card" };
  }
}

// ============================================
// CAPTURE (for two-step auth/capture flow)
// ============================================

const BANQUEST_CAPTURE_URL = USE_SANDBOX
  ? "https://api.sandbox.banquestgateway.com/api/v2/transactions/capture"
  : "https://api.banquestgateway.com/api/v2/transactions/capture";

export interface CaptureOptions {
  referenceNumber: number;
  amount?: number;
  email?: string;
  description?: string;
}

/**
 * Capture a previously authorized transaction
 * Use this when you charged with capture: false
 */
export async function captureTransaction(options: CaptureOptions | number): Promise<PaymentResult> {
  const opts: CaptureOptions = typeof options === "number"
    ? { referenceNumber: options }
    : options;

  try {
    const authHeader = getAuthHeader();

    const requestBody: Record<string, unknown> = {
      reference_number: opts.referenceNumber,
    };

    if (opts.amount !== undefined) {
      requestBody.amount = opts.amount;
    }
    if (opts.email) {
      requestBody.customer = { email: opts.email, send_receipt: false };
    }
    if (opts.description) {
      requestBody.transaction_details = { description: opts.description };
    }

    const response = await fetch(BANQUEST_CAPTURE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "User-Agent": "JRE-Website/1.0",
      },
      body: JSON.stringify(requestBody),
    });

    const result: BanquestResponse = await response.json();
    console.log("Capture response:", JSON.stringify(result, null, 2));

    if (result.status_code === "A" || result.status === "Approved") {
      return {
        success: true,
        transactionId: result.transaction?.id?.toString(),
        authCode: result.auth_code,
        referenceNumber: result.reference_number,
        responseText: result.status,
      };
    } else {
      return {
        success: false,
        error: result.error_message || result.error_details || "Capture failed",
      };
    }
  } catch (error) {
    console.error("Capture error:", error);
    return { success: false, error: "Failed to capture transaction" };
  }
}

// ============================================
// REFUND
// ============================================

const BANQUEST_REFUND_URL = USE_SANDBOX
  ? "https://api.sandbox.banquestgateway.com/api/v2/transactions/refund"
  : "https://api.banquestgateway.com/api/v2/transactions/refund";

export async function refundTransaction(referenceNumber: number, amount?: number): Promise<PaymentResult> {
  try {
    const authHeader = getAuthHeader();

    const requestBody: Record<string, unknown> = {
      reference_number: referenceNumber,
    };

    if (amount !== undefined) {
      requestBody.amount = amount;
    }

    const response = await fetch(BANQUEST_REFUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "User-Agent": "JRE-Website/1.0",
      },
      body: JSON.stringify(requestBody),
    });

    const result: BanquestResponse = await response.json();

    if (result.status_code === "A" || result.status === "Approved") {
      return {
        success: true,
        transactionId: result.transaction?.id?.toString(),
        referenceNumber: result.reference_number,
        responseText: result.status,
      };
    } else {
      return {
        success: false,
        error: result.error_message || "Refund failed",
      };
    }
  } catch (error) {
    console.error("Refund error:", error);
    return { success: false, error: "Failed to process refund" };
  }
}

// ============================================
// VOID
// ============================================

const BANQUEST_VOID_URL = USE_SANDBOX
  ? "https://api.sandbox.banquestgateway.com/api/v2/transactions/void"
  : "https://api.banquestgateway.com/api/v2/transactions/void";

export async function voidTransaction(referenceNumber: number): Promise<PaymentResult> {
  try {
    const authHeader = getAuthHeader();

    const requestBody = {
      reference_number: referenceNumber,
    };

    const response = await fetch(BANQUEST_VOID_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "User-Agent": "JRE-Website/1.0",
      },
      body: JSON.stringify(requestBody),
    });

    const result: BanquestResponse = await response.json();

    if (result.status_code === "A" || result.status === "Approved") {
      return {
        success: true,
        transactionId: result.transaction?.id?.toString(),
        referenceNumber: result.reference_number,
        responseText: result.status,
      };
    } else {
      return {
        success: false,
        error: result.error_message || "Void failed",
      };
    }
  } catch (error) {
    console.error("Void error:", error);
    return { success: false, error: "Failed to void transaction" };
  }
}

// Legacy export for tokenizeCard (deprecated - use Hosted Tokenization instead)
export async function tokenizeCard(_cardData: {
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardName: string;
}): Promise<{ success: boolean; token?: string; error?: string }> {
  console.warn("tokenizeCard is deprecated - use Hosted Tokenization for secure tokenization");
  return { success: false, error: "Use Hosted Tokenization for tokenization" };
}
