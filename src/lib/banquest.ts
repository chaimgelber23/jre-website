// Banquest Gateway Payment Processing (NMI-based)

// API URLs - Banquest uses NMI infrastructure
const BANQUEST_SANDBOX_URL = "https://secure.networkmerchants.com/api/transact.php";
const BANQUEST_PRODUCTION_URL = "https://secure.networkmerchants.com/api/transact.php";

// Use same URL for both - the security_key determines sandbox vs production
const BANQUEST_API_URL = BANQUEST_PRODUCTION_URL;

interface PaymentData {
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
}

export async function processPayment(data: PaymentData): Promise<PaymentResult> {
  const securityKey = process.env.BANQUEST_SOURCE_KEY;

  if (!securityKey) {
    console.error("Banquest security key not configured");
    return { success: false, error: "Payment system not configured" };
  }

  // Parse expiry date - handle both MM/YY and MM/YYYY formats
  const expiryParts = data.cardExpiry.split("/");
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
      order_description: data.description || "JRE Event Registration",
    });

    console.log("Processing payment for amount:", data.amount.toFixed(2));

    // Make the API request
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

// Tokenize card for future use (recurring payments)
export async function tokenizeCard(cardData: {
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardName: string;
}): Promise<{ success: boolean; token?: string; error?: string }> {
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
