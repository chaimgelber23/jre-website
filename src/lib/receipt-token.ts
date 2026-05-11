import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC-signed token used to gate `/receipt/<token>` access without a login.
// The token encodes `<donation_id>.<mac>` (base64url) so the donation_id
// stays opaque in the URL and a leaked URL can't be enumerated to other
// donations. Donors only ever see the encoded token. RECEIPT_SECRET must
// be set in Vercel env (one secret, server-only).

const MAC_BYTES = 12; // 96-bit MAC — more than enough to defeat enumeration

function getSecret(): string {
  const s = process.env.RECEIPT_SECRET;
  if (!s) {
    throw new Error(
      "RECEIPT_SECRET is not set. Configure it in Vercel env vars before signing receipts."
    );
  }
  return s;
}

function b64urlEncodeBuffer(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlEncodeString(s: string): string {
  return b64urlEncodeBuffer(Buffer.from(s, "utf8"));
}

function b64urlDecodeToBuffer(s: string): Buffer {
  let pad = s.replace(/-/g, "+").replace(/_/g, "/");
  while (pad.length % 4) pad += "=";
  return Buffer.from(pad, "base64");
}

function macFor(donationId: string): Buffer {
  return createHmac("sha256", getSecret())
    .update(donationId)
    .digest()
    .subarray(0, MAC_BYTES);
}

export function signReceiptToken(donationId: string): string {
  if (!donationId) throw new Error("signReceiptToken: donationId is required");
  const mac = macFor(donationId);
  const inner = `${donationId}.${b64urlEncodeBuffer(mac)}`;
  return b64urlEncodeString(inner);
}

export function verifyReceiptToken(token: string): string | null {
  try {
    const inner = b64urlDecodeToBuffer(token).toString("utf8");
    const dot = inner.lastIndexOf(".");
    if (dot < 1) return null;
    const donationId = inner.slice(0, dot);
    const presented = b64urlDecodeToBuffer(inner.slice(dot + 1));
    const expected = macFor(donationId);
    if (presented.length !== expected.length) return null;
    if (!timingSafeEqual(presented, expected)) return null;
    return donationId;
  } catch {
    return null;
  }
}

export function buildReceiptUrl(
  donationId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_SITE_URL || "https://thejre.org"
): string {
  return `${baseUrl.replace(/\/$/, "")}/receipt/${signReceiptToken(donationId)}`;
}
