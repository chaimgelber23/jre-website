// OJC Charity Card API client
// Docs: internal PDF from OJC Fund (office@ojcfund.org)
// Base URL: https://api.ojcfund.org:3391/api
// Auth: HTTP Basic (user + pass) — dev creds shared by OJC, production creds TBD
//
// OJC Charity Cards are Jewish-DAF-style cards (like The Donors' Fund "Giving Card").
// A donor holds the card; we charge it; OJC moves money from their DAF to our org.
//
// The `OrgId` value in the POST body and the `orgAPIKey` path segment in the void URL
// are the same value — a per-organization encrypted API key that OJC issues us.
// We store it as an env var and treat it like a secret (do not log, do not echo).

const USE_SANDBOX = process.env.OJC_USE_SANDBOX === "true";

const OJC_BASE_URL = "https://api.ojcfund.org:3391/api";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

function getBasicAuthHeader(): string {
  const user = requireEnv("OJC_BASIC_USER");
  const pass = requireEnv("OJC_BASIC_PASS");
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

function getOrgApiKey(): string {
  return requireEnv("OJC_ORG_API_KEY");
}

// ============================================
// TYPES
// ============================================

export interface OjcChargeRequest {
  /** 16-digit OJC Charity Card number */
  cardNo: string;
  /** 4-digit expiration in MMYY format (e.g. "1226" = Dec 2026) */
  expDate: string;
  /** Dollar amount (number, e.g. 36 or 36.50) */
  amount: number;
  /** Our internal reference — e.g. donation row id or campaign-donation id */
  externalReferenceId: string;
  /** Number of months to split the charge across. 0 = charge all at once. */
  splitByMonths?: number;
}

export interface OjcChargeResult {
  success: boolean;
  /** OJC's reference number for the transaction — used later to void */
  referenceNumber?: string;
  /** Original HTTP status from OJC */
  statusCode?: number;
  /** User-friendly error message */
  error?: string;
  /** Raw OJC response code (461/462/451/452/etc) */
  errorCode?: number;
}

export interface OjcVoidResult {
  success: boolean;
  error?: string;
  statusCode?: number;
}

export interface OjcValidationResult {
  valid: boolean;
  error?: string;
  statusCode?: number;
}

export interface OjcOrgLookupItem {
  // OJC hasn't documented the full shape — we pass through whatever they return.
  [key: string]: unknown;
}

// ============================================
// ERROR CODE → USER-FRIENDLY MESSAGE
// ============================================

// Codes from OJC API PDF (4 pages). Anything unmapped falls through to a generic.
export const OJC_ERROR_MESSAGES: Record<number, string> = {
  451: "That amount is more than this OJC Charity Card's donor has approved. Try a smaller amount.",
  452: "This OJC Charity Card has hit its daily limit. Please try again tomorrow.",
  453: "Missing OJC organization ID on our side. Please contact us — this is on us to fix.",
  454: "We couldn't find that OJC transaction.",
  461: "JRE isn't set up to receive OJC Charity Card donations correctly. Please contact us.",
  462: "This OJC Charity Card isn't valid or isn't activated yet.",
  406: "That OJC Charity Card number or expiration date isn't valid.",
};

export function friendlyError(
  errorCode: number | undefined,
  fallback = "Your OJC Charity Card couldn't be processed. Please try again or contact us.",
): string {
  if (errorCode && OJC_ERROR_MESSAGES[errorCode]) return OJC_ERROR_MESSAGES[errorCode];
  return fallback;
}

// ============================================
// /vouchers/processcharitycardtransaction — charge
// ============================================

export async function processCharityCardTransaction(
  req: OjcChargeRequest,
): Promise<OjcChargeResult> {
  if (!req.cardNo || !req.expDate) {
    return { success: false, error: "Please enter your OJC Charity Card number and expiration." };
  }
  const cardNo = req.cardNo.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(cardNo)) {
    return { success: false, error: "That card number doesn't look right." };
  }
  if (!/^\d{4}$/.test(req.expDate)) {
    return { success: false, error: "Expiration must be MMYY (4 digits, e.g. 1226)." };
  }
  if (req.amount <= 0) {
    return { success: false, error: "Please enter a valid amount." };
  }

  try {
    const body = {
      CardNo: cardNo,
      ExpDate: req.expDate,
      OrgId: getOrgApiKey(),
      Amount: req.amount,
      ExternalreferenceId: req.externalReferenceId,
      SplitByMonths: req.splitByMonths ?? 0,
    };

    const res = await fetch(`${OJC_BASE_URL}/vouchers/processcharitycardtransaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getBasicAuthHeader(),
        "User-Agent": "JRE-Website/1.0",
      },
      body: JSON.stringify(body),
    });

    const raw = await res.text();

    if (res.status === 200) {
      // 200 = approved, body is the reference number (per docs).
      // It may come back as a quoted string, a bare number, or JSON — handle all.
      const referenceNumber = raw.trim().replace(/^"|"$/g, "");
      return { success: true, referenceNumber, statusCode: 200 };
    }

    // Non-200: map known OJC codes (461/462/451/452) to friendly text.
    return {
      success: false,
      statusCode: res.status,
      errorCode: res.status,
      error: friendlyError(res.status),
    };
  } catch (e) {
    console.error("OJC processCharityCardTransaction error:", e);
    if (e instanceof Error && /OJC_(BASIC|ORG)/.test(e.message)) {
      return { success: false, error: "OJC isn't configured on our side." };
    }
    return { success: false, error: "Couldn't reach OJC Fund. Please try again." };
  }
}

// ============================================
// /vouchers/VoidCharityCardTransaction — void / refund
// ============================================

export async function voidCharityCardTransaction(
  referenceNumber: string | number,
  amount: number,
): Promise<OjcVoidResult> {
  try {
    const orgKey = getOrgApiKey();
    // orgAPIKey may contain `==` and `/` — encode for URL safety.
    const url = `${OJC_BASE_URL}/vouchers/VoidCharityCardTransaction/${encodeURIComponent(
      String(referenceNumber),
    )}/${encodeURIComponent(orgKey)}/${amount}`;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: getBasicAuthHeader(),
        "User-Agent": "JRE-Website/1.0",
      },
    });

    if (res.status === 200) {
      return { success: true, statusCode: 200 };
    }
    return {
      success: false,
      statusCode: res.status,
      error: friendlyError(res.status, `OJC void failed (HTTP ${res.status}).`),
    };
  } catch (e) {
    console.error("OJC voidCharityCardTransaction error:", e);
    return { success: false, error: "Couldn't reach OJC Fund." };
  }
}

// ============================================
// /vouchers/ValidateCard — pre-charge check (optional)
// ============================================

export async function validateCharityCard(
  cardNo: string,
  expDate: string,
): Promise<OjcValidationResult> {
  try {
    const url = `${OJC_BASE_URL}/vouchers/ValidateCard?cardno=${encodeURIComponent(
      cardNo.replace(/\s/g, ""),
    )}&expdate=${encodeURIComponent(expDate)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: getBasicAuthHeader(),
        "User-Agent": "JRE-Website/1.0",
      },
    });

    if (res.status === 200) return { valid: true, statusCode: 200 };
    return {
      valid: false,
      statusCode: res.status,
      error: friendlyError(res.status),
    };
  } catch (e) {
    console.error("OJC validateCharityCard error:", e);
    return { valid: false, error: "Couldn't reach OJC Fund." };
  }
}

// ============================================
// /organizations/orgapikey/{taxId} — admin utility
// ============================================

export async function getOrgApiKeyByTaxId(taxId: string): Promise<{
  success: boolean;
  organizations?: OjcOrgLookupItem[];
  error?: string;
}> {
  try {
    const res = await fetch(
      `${OJC_BASE_URL}/organizations/orgapikey/${encodeURIComponent(taxId)}`,
      {
        method: "GET",
        headers: {
          Authorization: getBasicAuthHeader(),
          "User-Agent": "JRE-Website/1.0",
        },
      },
    );

    if (res.status !== 200) {
      return { success: false, error: `OJC lookup failed (HTTP ${res.status}).` };
    }
    const json = (await res.json()) as OjcOrgLookupItem[] | OjcOrgLookupItem;
    const organizations = Array.isArray(json) ? json : [json];
    return { success: true, organizations };
  } catch (e) {
    console.error("OJC getOrgApiKeyByTaxId error:", e);
    return { success: false, error: "Couldn't reach OJC Fund." };
  }
}

export const __test__ = { USE_SANDBOX, OJC_BASE_URL };
