// Banquest Gateway Payment Processing (NMI-based)
// Supports both Collect.js tokenized payments and direct card payments

// API URL - Banquest uses NMI infrastructure
const BANQUEST_API_URL = "https://secure.networkmerchants.com/api/transact.php";

// ============================================
// TOKENIZED PAYMENT (Collect.js) - PREFERRED
// ============================================

interface TokenizedPaymentData {
  paymentToken: string; // Token from Collect.js
  amount: number;
  email: string;
  firstName?: string;
  lastName?: string;
  description?: string;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  authCode?: string;
}

/**
 * Process payment using a Collect.js payment_token
 * This is the PREFERRED method - card data never touches our server
 */
export async function processTokenizedPayment(data: TokenizedPaymentData): Promise<PaymentResult> {
  const securityKey = process.env.BANQUEST_SOURCE_KEY;

  if (!securityKey) {
    console.error("Banquest security key not configured");
    return { success: false, error: "Payment system not configured" };
  }

  if (!data.paymentToken) {
    return { success: false, error: "Payment token is required" };
  }

  try {
    const formData = new URLSearchParams({
      security_key: securityKey,
      type: "sale",
      amount: data.amount.toFixed(2),
      payment_token: data.paymentToken, // Token from Collect.js
      email: data.email,
      order_description: data.description || "JRE Payment",
    });

    // Add optional name fields if provided
    if (data.firstName) {
      formData.append("first_name", data.firstName);
    }
    if (data.lastName) {
      formData.append("last_name", data.lastName);
    }

    console.log("Processing tokenized payment for amount:", data.amount.toFixed(2));

    const response = await fetch(BANQUEST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log("Payment response:", responseText);

    // Parse the response (query string format: response=1&responsetext=SUCCESS&...)
    const result = new URLSearchParams(responseText);
    const responseCode = result.get("response");
    const responseText2 = result.get("responsetext");
    const transactionId = result.get("transactionid");
    const authCode = result.get("authcode");

    // Response code 1 = Approved, 2 = Declined, 3 = Error
    if (responseCode === "1") {
      return {
        success: true,
        transactionId: transactionId || `txn_${Date.now()}`,
        authCode: authCode || undefined,
      };
    } else {
      return {
        success: false,
        error: responseText2 || "Payment declined",
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
// DIRECT CARD PAYMENT (Legacy) - BACKUP
// ============================================

interface DirectPaymentData {
  amount: number;
  cardNumber: string;
  cardExpiry: string; // MM/YY or MM/YYYY format
  cardCvv: string;
  cardName: string;
  email: string;
  description?: string;
}

/**
 * Process payment with direct card details
 * NOTE: This sends card data through our server - use tokenized method when possible
 */
export async function processDirectPayment(data: DirectPaymentData): Promise<PaymentResult> {
  const securityKey = process.env.BANQUEST_SOURCE_KEY;

  if (!securityKey) {
    console.error("Banquest security key not configured");
    return { success: false, error: "Payment system not configured" };
  }

  // Validate card expiry format
  if (!data.cardExpiry || !data.cardExpiry.includes("/")) {
    return { success: false, error: "Invalid expiry date format. Please use MM/YY or MM/YYYY" };
  }

  // Parse expiry date - handle both MM/YY and MM/YYYY formats
  const expiryParts = data.cardExpiry.split("/");
  if (expiryParts.length < 2 || !expiryParts[0] || !expiryParts[1]) {
    return { success: false, error: "Invalid expiry date format. Please use MM/YY or MM/YYYY" };
  }
  const expMonth = expiryParts[0].padStart(2, "0");
  let expYear = expiryParts[1];
  // If 4-digit year, take last 2 digits
  if (expYear.length === 4) {
    expYear = expYear.slice(-2);
  }
  const ccexp = `${expMonth}${expYear}`; // MMYY format

  try {
    // Build form data - NMI uses application/x-www-form-urlencoded
    const formData = new URLSearchParams({
      security_key: securityKey,
      type: "sale",
      amount: data.amount.toFixed(2),
      ccnumber: data.cardNumber.replace(/\s/g, ""),
      ccexp: ccexp,
      cvv: data.cardCvv,
      first_name: data.cardName.split(" ")[0] || data.cardName,
      last_name: data.cardName.split(" ").slice(1).join(" ") || "",
      email: data.email,
      order_description: data.description || "JRE Payment",
    });

    console.log("Processing direct payment for amount:", data.amount.toFixed(2));

    const response = await fetch(BANQUEST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log("Payment response:", responseText);

    // Parse the response (query string format: response=1&responsetext=SUCCESS&...)
    const result = new URLSearchParams(responseText);
    const responseCode = result.get("response");
    const responseText2 = result.get("responsetext");
    const transactionId = result.get("transactionid");
    const authCode = result.get("authcode");

    // Response code 1 = Approved, 2 = Declined, 3 = Error
    if (responseCode === "1") {
      return {
        success: true,
        transactionId: transactionId || `txn_${Date.now()}`,
        authCode: authCode || undefined,
      };
    } else {
      return {
        success: false,
        error: responseText2 || "Payment declined",
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
// LEGACY EXPORT (for backward compatibility)
// ============================================

interface PaymentData {
  amount: number;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardName?: string;
  paymentToken?: string; // NEW: Accept token from Collect.js
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
// CUSTOMER VAULT (for recurring payments)
// ============================================

export async function addToCustomerVault(paymentToken: string): Promise<{ success: boolean; vaultId?: string; error?: string }> {
  const securityKey = process.env.BANQUEST_SOURCE_KEY;

  if (!securityKey) {
    return { success: false, error: "Vault not configured" };
  }

  try {
    const formData = new URLSearchParams({
      security_key: securityKey,
      customer_vault: "add_customer",
      payment_token: paymentToken,
    });

    const response = await fetch(BANQUEST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    const result = new URLSearchParams(responseText);
    const responseCode = result.get("response");
    const customerId = result.get("customer_vault_id");

    if (responseCode === "1" && customerId) {
      return { success: true, vaultId: customerId };
    } else {
      return { success: false, error: result.get("responsetext") || "Failed to save card" };
    }
  } catch (error) {
    console.error("Vault error:", error);
    return { success: false, error: "Failed to save card" };
  }
}

// Legacy export for tokenizeCard (deprecated - use Collect.js instead)
export async function tokenizeCard(cardData: {
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardName: string;
}): Promise<{ success: boolean; token?: string; error?: string }> {
  console.warn("tokenizeCard is deprecated - use Collect.js for secure tokenization");

  const securityKey = process.env.BANQUEST_SOURCE_KEY;

  if (!securityKey) {
    return { success: false, error: "Tokenization not configured" };
  }

  try {
    const expiryParts = cardData.cardExpiry.split("/");
    const expMonth = expiryParts[0].padStart(2, "0");
    let expYear = expiryParts[1];
    if (expYear.length === 4) {
      expYear = expYear.slice(-2);
    }
    const ccexp = `${expMonth}${expYear}`;

    const formData = new URLSearchParams({
      security_key: securityKey,
      type: "validate",
      ccnumber: cardData.cardNumber.replace(/\s/g, ""),
      ccexp: ccexp,
      cvv: cardData.cardCvv,
      customer_vault: "add_customer",
    });

    const response = await fetch(BANQUEST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    const result = new URLSearchParams(responseText);
    const responseCode = result.get("response");
    const customerId = result.get("customer_vault_id");

    if (responseCode === "1" && customerId) {
      return { success: true, token: customerId };
    } else {
      return { success: false, error: result.get("responsetext") || "Failed to tokenize card" };
    }
  } catch (error) {
    console.error("Tokenization error:", error);
    return { success: false, error: "Failed to save card" };
  }
}
