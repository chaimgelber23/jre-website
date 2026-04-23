// The Donors' Fund API client — v1.2.0
// Docs: https://www.thedonorsfund.org/web/api-docs
// Sandbox: https://api.tdfcharitable.org/thedonorsfund/integration
// Production: https://api.thedonorsfund.org/thedonorsfund/integration
// Auth: two headers — API-Key (public, per-env) + Validation-Token (private, per-charity)

const USE_SANDBOX = process.env.TDF_USE_SANDBOX === "true";

const TDF_BASE_URL = USE_SANDBOX
  ? "https://api.tdfcharitable.org/thedonorsfund/integration"
  : "https://api.thedonorsfund.org/thedonorsfund/integration";

// API keys are PUBLIC (printed in the docs themselves) — safe to embed.
// Only the Validation-Token (per-charity secret) lives in env vars.
const TDF_PUBLIC_API_KEY = USE_SANDBOX
  ? "3Q1i2KzHmUCiPDr8gCtiRQB6ZtIJBVjEKwSUGwFdtfvw"
  : "CXtaaW9xqUafyffApPbfVQD0MmLhdprESvor9vi2GNLQ";

function getHeaders(): HeadersInit {
  const validationToken = process.env.TDF_VALIDATION_TOKEN;
  if (!validationToken) {
    throw new Error("TDF_VALIDATION_TOKEN not configured");
  }
  return {
    "Content-Type": "application/json",
    "API-Key": TDF_PUBLIC_API_KEY,
    "Validation-Token": validationToken,
  };
}

// ============================================
// TYPES
// ============================================

export type TdfScheduleType = "weekly" | "monthly" | "quarterly" | "annual" | "one-time";

export interface TdfGrantRequest {
  /** 9-digit charity EIN */
  taxId: string;
  /** 7-digit Donor's Fund account number */
  accountNumber: string;
  /** Dollar amount as string, e.g. "250" or "250.00" */
  amount: string;
  /** Donor's 16-digit Giving Card number OR account email */
  donor: string;
  /** CVV (for card) OR PIN (for email login) */
  donorAuthorization: string;
  /** Campaign tracking code — shows in charity reports */
  purposeNote?: string;
  recurring?: {
    scheduleType: TdfScheduleType;
    startDate: string; // e.g. "8/31/2024"
    numberOfPayments: number; // 0 = ongoing, 1 = one-time, N = N payments
  };
}

export interface TdfGrantResult {
  success: boolean;
  /** Donor's Fund confirmation number — user-facing receipt number */
  confirmationNumber?: number;
  /** UUID for API operations (use for /Cancel) */
  transactionId?: string;
  /** "Approved", "Pending", etc. */
  status?: string;
  batchId?: string;
  /** User-friendly error message */
  error?: string;
  /** Raw TDF error code (see TDF_ERROR_CODES) */
  errorCode?: number;
}

// ============================================
// ERROR CODE → USER-FRIENDLY MESSAGE
// ============================================

// Maps every documented error code to a message we can safely show a donor.
// Codes from the OpenAPI spec (v1.2.0). Anything unmapped falls through to the
// raw error string so we don't hide information.
export const TDF_ERROR_MESSAGES: Record<number, string> = {
  3100: "We couldn't find that Giving Card. Double-check the number and try again.",
  3101: "This card is flagged in the Donor's Fund system. Please contact Donor's Fund support.",
  3102: "This Giving Card was reported lost or stolen. Please contact Donor's Fund support.",
  3103: "This Giving Card isn't assigned to an account yet.",
  3104: "This Giving Card is locked. Please contact Donor's Fund support to unlock it.",
  3106: "The card number length doesn't look right — a Giving Card is 16 digits.",
  3112: "JRE isn't set up to receive grants through this Donor's Fund account. Please contact us.",
  3114: "This grant was already canceled.",
  3115: "This grant has already been processed and can't be canceled.",
  3116: "We couldn't find that grant. Please contact support.",
  3118: "This Giving Card hasn't been activated yet. Activate it in your Donor's Fund account first.",
  3119: "Please enter a valid amount.",
  3120: "This Giving Card has expired.",
  3121: "This card is locked or the start date is invalid.",
  3201: "Those credentials don't match. Check the card number (or email) and CVV (or PIN).",
  3204: "JRE isn't registered correctly with Donor's Fund. Please contact us — this is on our side.",
  3205: "That amount exceeds the maximum allowed for a single grant.",
  3206: "Daily limit reached on this Donor's Fund account. Try again tomorrow or a different account.",
  3208: "The card isn't activated yet or your Donor's Fund account needs verification.",
  3209: "Our Donor's Fund credentials are invalid. Please contact us — we'll fix it.",
  3210: "Our tax ID isn't matching on the Donor's Fund side. Please contact us.",
  3211: "Our charity account number isn't matching on the Donor's Fund side. Please contact us.",
  3212: "Insufficient funds in this Donor's Fund account.",
  3213: "Missing some fields for a recurring grant. Please try again.",
};

export function friendlyError(errorCode: number | undefined, rawError: string | undefined): string {
  if (errorCode && TDF_ERROR_MESSAGES[errorCode]) return TDF_ERROR_MESSAGES[errorCode];
  if (rawError) return rawError;
  return "Your Donor's Fund grant couldn't be processed. Please try again or contact us.";
}

// ============================================
// /Create — charge a grant
// ============================================

export async function createGrant(req: TdfGrantRequest): Promise<TdfGrantResult> {
  if (!req.taxId || !req.accountNumber) {
    return { success: false, error: "JRE's Donor's Fund account isn't configured yet." };
  }
  if (!req.donor || !req.donorAuthorization) {
    return { success: false, error: "Please enter your Giving Card + CVV (or email + PIN)." };
  }

  try {
    const body: Record<string, unknown> = {
      taxId: req.taxId,
      accountNumber: req.accountNumber,
      amount: req.amount,
      donor: req.donor,
      donorAuthorization: req.donorAuthorization,
      purposeType: "Other",
      purposeNote: req.purposeNote || "JRE Campaign",
    };
    if (req.recurring) {
      body.recurring = req.recurring;
    }

    const res = await fetch(`${TDF_BASE_URL}/Create`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    const raw = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return {
        success: false,
        error: `Donor's Fund returned a non-JSON response (${res.status}).`,
      };
    }

    return parseCreateResponse(json);
  } catch (e) {
    console.error("TDF createGrant error:", e);
    if (e instanceof Error && e.message.includes("TDF_VALIDATION_TOKEN")) {
      return { success: false, error: "Donor's Fund isn't configured on our side." };
    }
    return { success: false, error: "Couldn't reach Donor's Fund. Please try again." };
  }
}

// TDF wraps both success AND failure bodies inside HTTP 200.
// The shape varies slightly between endpoints — /Create success has a `data`
// property; failures are flat with `errorCode` + `error`/`message`.
interface TdfCreateSuccessBody {
  data?: {
    confirmationNumber?: number;
    transactionId?: string;
    status?: string;
    batchId?: string;
  };
  error?: string | null;
  errorCode?: number;
  statusCode?: number;
}

interface TdfFailBody {
  error?: string;
  message?: string;
  errorCode?: number;
  refNum?: string | null;
  status?: string;
}

function parseCreateResponse(json: unknown): TdfGrantResult {
  const body = json as TdfCreateSuccessBody & TdfFailBody;

  // Success case: errorCode 0 (or missing) + data.confirmationNumber
  if (body.data?.confirmationNumber && (body.errorCode === 0 || body.errorCode === undefined)) {
    return {
      success: true,
      confirmationNumber: body.data.confirmationNumber,
      transactionId: body.data.transactionId,
      status: body.data.status ?? "Approved",
      batchId: body.data.batchId,
    };
  }

  // Failure case
  const code = body.errorCode;
  const rawError = body.error ?? body.message ?? undefined;
  return {
    success: false,
    errorCode: code,
    error: friendlyError(code, rawError),
  };
}

// ============================================
// /Validate — pre-charge check (optional)
// ============================================

export async function validateDonor(
  donor: string,
  donorAuthorization: string
): Promise<{ valid: boolean; error?: string; errorCode?: number }> {
  try {
    const res = await fetch(`${TDF_BASE_URL}/Validate`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ donor, donorAuthorization }),
    });
    const json = (await res.json()) as {
      errorCode?: number;
      message?: string;
      error?: string;
    };
    if (json.errorCode === 0) return { valid: true };
    return {
      valid: false,
      errorCode: json.errorCode,
      error: friendlyError(json.errorCode, json.error ?? json.message),
    };
  } catch (e) {
    console.error("TDF validateDonor error:", e);
    return { valid: false, error: "Couldn't reach Donor's Fund." };
  }
}

// ============================================
// /Cancel — cancel a grant by transactionId
// ============================================

export async function cancelGrant(transactionId: string): Promise<TdfGrantResult> {
  try {
    const res = await fetch(`${TDF_BASE_URL}/Cancel`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify({ transactionId }),
    });
    const json = (await res.json()) as TdfCreateSuccessBody & TdfFailBody;
    if (json.data?.status === "Canceled" && (json.errorCode === 0 || json.errorCode === undefined)) {
      return {
        success: true,
        confirmationNumber: json.data.confirmationNumber,
        transactionId: json.data.transactionId,
        status: "Canceled",
      };
    }
    return {
      success: false,
      errorCode: json.errorCode,
      error: friendlyError(json.errorCode, json.error ?? json.message),
    };
  } catch (e) {
    console.error("TDF cancelGrant error:", e);
    return { success: false, error: "Couldn't reach Donor's Fund." };
  }
}

// ============================================
// /Charity/Account-Numbers/{taxId}
// ============================================

export async function listCharityAccounts(
  taxId: string
): Promise<{ success: boolean; accounts?: { accountNumber: number; dba: string }[]; error?: string }> {
  try {
    const res = await fetch(`${TDF_BASE_URL}/Charity/Account-Numbers/${encodeURIComponent(taxId)}`, {
      method: "GET",
      headers: getHeaders(),
    });
    const json = await res.json();
    if (Array.isArray(json)) {
      return { success: true, accounts: json };
    }
    return { success: false, error: "Unexpected response from Donor's Fund." };
  } catch (e) {
    console.error("TDF listCharityAccounts error:", e);
    return { success: false, error: "Couldn't reach Donor's Fund." };
  }
}

// ============================================
// /Grant/Details/{confirmationNumber}
// ============================================

export async function getGrantDetails(confirmationNumber: string | number): Promise<{
  success: boolean;
  grant?: { amount: number; donor: string; charity: string; grantStatus: string; confirmationNumber: number };
  error?: string;
}> {
  try {
    const res = await fetch(`${TDF_BASE_URL}/Grant/Details/${encodeURIComponent(String(confirmationNumber))}`, {
      method: "GET",
      headers: getHeaders(),
    });
    const json = await res.json();
    if (json && typeof json === "object" && "grantStatus" in json) {
      return { success: true, grant: json };
    }
    return { success: false, error: "Grant not found." };
  } catch (e) {
    console.error("TDF getGrantDetails error:", e);
    return { success: false, error: "Couldn't reach Donor's Fund." };
  }
}
