// Banquest Gateway Payment Processing

// API URLs
const BANQUEST_SANDBOX_URL = "https://api.sandbox.banquestgateway.com/api/v2";
const BANQUEST_PRODUCTION_URL = "https://api.banquestgateway.com/api/v2";

// Use sandbox for development, production for live
const BANQUEST_API_URL = process.env.NODE_ENV === "production"
  ? BANQUEST_PRODUCTION_URL
  : BANQUEST_SANDBOX_URL;

interface PaymentData {
  amount: number;
  cardNumber: string;
  cardExpiry: string; // MM/YYYY format
  cardCvv: string;
  cardName: string;
  email: string;
  description?: string;
  isRecurring?: boolean;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  authCode?: string;
}

export async function processPayment(data: PaymentData): Promise<PaymentResult> {
  const sourceKey = process.env.BANQUEST_SOURCE_KEY;
  const pin = process.env.BANQUEST_PIN;

  if (!sourceKey || !pin) {
    console.error("Banquest credentials not configured");
    return { success: false, error: "Payment system not configured" };
  }

  // Parse expiry date
  const [expMonth, expYear] = data.cardExpiry.split("/");

  try {
    // Create the transaction request
    const transactionData = {
      command: "sale",
      amount: data.amount.toFixed(2),
      creditcard: {
        number: data.cardNumber.replace(/\s/g, ""),
        expiration: `${expMonth}${expYear.slice(-2)}`, // MMYY format
        cvv: data.cardCvv,
        cardholder: data.cardName,
      },
      billing: {
        email: data.email,
      },
      description: data.description || "JRE Payment",
    };

    // Make the API request
    const response = await fetch(`${BANQUEST_API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${Buffer.from(`${sourceKey}:${pin}`).toString("base64")}`,
        "User-Agent": "JRE-Website/1.0",
      },
      body: JSON.stringify(transactionData),
    });

    const result = await response.json();

    if (result.result === "Approved" || result.result_code === "A") {
      return {
        success: true,
        transactionId: result.refnum || result.transaction_id,
        authCode: result.authcode,
      };
    } else {
      return {
        success: false,
        error: result.error || result.result || "Payment declined",
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

// Tokenize card for future use (recurring payments)
export async function tokenizeCard(cardData: {
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardName: string;
}): Promise<{ success: boolean; token?: string; error?: string }> {
  const tokenKey = process.env.BANQUEST_TOKENIZATION_KEY;

  if (!tokenKey) {
    return { success: false, error: "Tokenization not configured" };
  }

  try {
    const [expMonth, expYear] = cardData.cardExpiry.split("/");

    const response = await fetch(`${BANQUEST_API_URL}/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${Buffer.from(`${tokenKey}:`).toString("base64")}`,
        "User-Agent": "JRE-Website/1.0",
      },
      body: JSON.stringify({
        creditcard: {
          number: cardData.cardNumber.replace(/\s/g, ""),
          expiration: `${expMonth}${expYear.slice(-2)}`,
          cvv: cardData.cardCvv,
          cardholder: cardData.cardName,
        },
      }),
    });

    const result = await response.json();

    if (result.key) {
      return { success: true, token: result.key };
    } else {
      return { success: false, error: result.error || "Failed to tokenize card" };
    }
  } catch (error) {
    console.error("Tokenization error:", error);
    return { success: false, error: "Failed to save card" };
  }
}
