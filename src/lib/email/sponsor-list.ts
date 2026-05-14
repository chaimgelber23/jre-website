import { Resend } from "resend";

const FROM_EMAIL = "The JRE <noreply@beta.thejre.org>";
const REPLY_TO = "office@thejre.org";

let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export interface SponsorListInput {
  eventTitle: string;
  subtitle?: string | null;
  sponsorsByTier: Array<{ tier: string; names: string[] }>;
  to: string;
  subject?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderSponsorListHtml(input: SponsorListInput): string {
  const tiers = input.sponsorsByTier.filter((t) => t.names.length > 0);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="font-family:Georgia,serif;font-weight:400;color:#7a3b3b;margin:0 0 4px;">${esc(input.eventTitle)} — Sponsors</h2>
  ${input.subtitle ? `<p style="color:#666;margin:0 0 24px;font-size:14px;">${esc(input.subtitle)}</p>` : ""}
${tiers
  .map(
    (t) => `  <div style="margin-bottom:20px;">
    <h3 style="font-family:Georgia,serif;font-weight:500;color:#7a3b3b;border-bottom:1px solid #f0d6d2;padding-bottom:6px;margin:0 0 10px;font-size:17px;">${esc(t.tier)}</h3>
    <ul style="margin:0;padding-left:18px;line-height:1.7;">${t.names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
  </div>`
  )
  .join("\n")}
</div>`;
}

export function renderSponsorListText(input: SponsorListInput): string {
  const tiers = input.sponsorsByTier.filter((t) => t.names.length > 0);
  return (
    `${input.eventTitle} — Sponsors\n` +
    (input.subtitle ? `${input.subtitle}\n\n` : "\n") +
    tiers
      .map((t) => `${t.tier}\n` + t.names.map((n) => `  • ${n}`).join("\n"))
      .join("\n\n")
  );
}

export async function sendSponsorListEmail(
  input: SponsorListInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" };

  const subject = input.subject ?? `${input.eventTitle} — Sponsor list`;
  const html = renderSponsorListHtml(input);
  const text = renderSponsorListText(input);

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO,
    to: input.to,
    subject,
    html,
    text,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}
