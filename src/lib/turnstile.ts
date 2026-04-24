// Cloudflare Turnstile server-side verification.
// Used by every public form that triggers money movement (donations, event registrations).
//
// In production, set TURNSTILE_SECRET_KEY. If unset, verification is skipped with a
// console warning — so dev/preview doesn't break, but an unconfigured prod is loudly logged.

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
  ok: boolean;
  skipped?: boolean;
  errorCodes?: string[];
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not set — skipping verification");
    return { ok: true, skipped: true };
  }

  if (!token || typeof token !== "string") {
    return { ok: false, errorCodes: ["missing-input-response"] };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success) return { ok: true };
    return { ok: false, errorCodes: data["error-codes"] ?? ["unknown"] };
  } catch (err) {
    console.error("[turnstile] verification request failed:", err);
    return { ok: false, errorCodes: ["network-error"] };
  }
}

export function getClientIp(req: { headers: Headers }): string | null {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") || null;
}
