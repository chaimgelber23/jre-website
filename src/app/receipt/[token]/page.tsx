import { notFound } from "next/navigation";
import { verifyReceiptToken } from "@/lib/receipt-token";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

interface DonationRow {
  id: string;
  campaign_id: string;
  name: string;
  email: string;
  amount_cents: number;
  payment_method: string;
  payment_status: string;
  payment_reference: string | null;
  created_at: string;
}

interface CampaignRow {
  title: string;
  tax_id: string | null;
  tax_deductible_note: string | null;
}

function methodLabel(method: string, ref: string | null): string {
  if (ref?.startsWith("bq_")) return "Credit Card";
  if (ref?.startsWith("tdf_")) return "The Donors' Fund";
  if (ref?.startsWith("ojc_")) return "OJC Charity Card";
  const map: Record<string, string> = {
    card: "Credit Card",
    daf: "DAF Pledge",
    fidelity: "Fidelity Charitable",
    ojc_fund: "OJC Charity Card",
    donors_fund: "The Donors' Fund",
    check: "Check",
    zelle: "Zelle",
    other: "Other",
  };
  return map[method] || method;
}

export default async function ReceiptPage({ params }: Props) {
  const { token } = await params;
  const donationId = verifyReceiptToken(token);
  if (!donationId) notFound();

  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: donation } = await db
    .from("campaign_donations")
    .select(
      "id, campaign_id, name, email, amount_cents, payment_method, payment_status, payment_reference, created_at"
    )
    .eq("id", donationId)
    .maybeSingle();
  if (!donation) notFound();

  // Only completed donations get a tax receipt; pledges and failed rows do not.
  if ((donation as DonationRow).payment_status !== "completed") notFound();

  const { data: campaign } = await db
    .from("campaigns")
    .select("title, tax_id, tax_deductible_note, org_id")
    .eq("id", (donation as DonationRow).campaign_id)
    .maybeSingle();
  if (!campaign) notFound();

  const d = donation as DonationRow;
  const c = campaign as CampaignRow & { org_id?: string | null };

  // Multi-tenant: prefer the owning organization's identity over the campaign's
  // stale defaults (which all say "JRE EIN 20-8978145" from the old single-tenant era).
  let orgName: string | null = null;
  let orgEin: string | null = null;
  let orgLegalName: string | null = null;
  if (c.org_id) {
    const { data: org } = await db
      .from("organizations")
      .select("name, legal_name, tax_id")
      .eq("id", c.org_id)
      .maybeSingle();
    if (org) {
      orgName = (org as { name?: string }).name ?? null;
      orgLegalName = (org as { legal_name?: string | null }).legal_name ?? null;
      const raw = (org as { tax_id?: string }).tax_id ?? null;
      // Format as "XX-XXXXXXX" if we have 9 digits.
      orgEin = raw && /^\d{9}$/.test(raw) ? `${raw.slice(0, 2)}-${raw.slice(2)}` : raw;
    }
  }
  const displayOrgName = orgName || "The JRE";
  const displayEin = orgEin || c.tax_id || null;
  const amount = (d.amount_cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  const dateStr = new Date(d.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const reference = d.payment_reference || d.id;
  const method = methodLabel(d.payment_method, d.payment_reference);
  const legalNote =
    c.tax_deductible_note ||
    `${displayOrgName} is a registered 501(c)(3) nonprofit. Please save this receipt for your tax records. No goods or services were provided in exchange for this donation.`;
  const firstName = (d.name?.trim().split(/\s+/)[0]) || "Friend";

  return (
    <div className="receipt-shell">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body { background: #f8f9fa; }
            .receipt-shell {
              min-height: 100vh;
              background: #f8f9fa;
              padding: 60px 20px;
              display: flex;
              justify-content: center;
            }
            .receipt-wrap { max-width: 600px; width: 100%; }
            .receipt-logo { text-align: center; padding: 0 0 8px; }
            .receipt-logo img { max-width: 140px; height: auto; display: inline-block; }
            .receipt-card {
              background: #ffffff;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1);
            }
            .receipt-accent { height: 3px; background: linear-gradient(90deg, #EF8046, #f59e0b); }
            .receipt-head { padding: 56px 48px 48px; text-align: center; border-bottom: 1px solid #f0f0f0; }
            .receipt-head-rule { width: 40px; height: 2px; background: linear-gradient(90deg, transparent, #EF8046, transparent); margin: 0 auto 32px; }
            .receipt-head h1 { color: #1a1a1a; margin: 0 0 12px; font-size: 36px; font-weight: 600; letter-spacing: -0.8px; }
            .receipt-head p { color: #6b7280; margin: 0; font-size: 15px; font-weight: 400; line-height: 1.6; }
            .receipt-body { padding: 48px 48px 40px; }
            .receipt-greeting { color: #1a1a1a; font-size: 16px; margin: 0 0 8px; line-height: 1.5; }
            .receipt-thank { color: #6b7280; font-size: 15px; margin: 0 0 40px; line-height: 1.6; }
            .receipt-amount-block {
              padding: 32px;
              background: #fafafa;
              border-left: 4px solid #EF8046;
              border-radius: 8px;
              text-align: center;
              margin: 0 0 32px;
            }
            .receipt-amount-label { color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600; }
            .receipt-amount-value { color: #EF8046; font-size: 40px; font-weight: 600; letter-spacing: -1px; line-height: 1.1; }
            .receipt-details-title { color: #9ca3af; font-size: 11px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
            .receipt-details { width: 100%; margin: 0 0 32px; border-collapse: collapse; }
            .receipt-details td { padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
            .receipt-details td.k { color: #6b7280; }
            .receipt-details td.v { color: #1a1a1a; font-weight: 500; text-align: right; word-break: break-word; }
            .receipt-details td.ref { color: #9ca3af; font-size: 12px; padding-top: 12px; padding-bottom: 0; font-family: ui-monospace, 'SF Mono', Menlo, monospace; border-bottom: none; }
            .receipt-tax {
              background: #f0fdf4;
              border-radius: 8px;
              border-left: 4px solid #10b981;
              margin: 0 0 40px;
              padding: 20px;
            }
            .receipt-tax p { color: #065f46; font-size: 13px; margin: 0; line-height: 1.6; }
            .receipt-tax strong { font-weight: 600; }
            .receipt-actions { text-align: center; margin: 0 0 24px; }
            .receipt-print-btn {
              display: inline-block;
              background: #EF8046;
              color: #ffffff;
              border: none;
              padding: 14px 32px;
              font-size: 14px;
              font-weight: 600;
              letter-spacing: 0.3px;
              border-radius: 8px;
              cursor: pointer;
              font-family: inherit;
              transition: filter 150ms ease-out;
            }
            .receipt-print-btn:hover { filter: brightness(0.94); }
            .receipt-hint { color: #9ca3af; font-size: 12px; margin: 12px 0 0; line-height: 1.5; }
            .receipt-closing { color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.5; }
            .receipt-closing span { color: #1a1a1a; font-weight: 500; }
            .receipt-footer { padding: 48px 20px; text-align: center; }
            .receipt-footer-rule { width: 32px; height: 1px; background: linear-gradient(90deg, transparent, #d1d5db, transparent); margin: 0 auto 24px; }
            .receipt-footer-brand { color: #1a1a1a; font-size: 11px; margin: 0 0 4px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
            .receipt-footer-name { color: #9ca3af; font-size: 12px; margin: 0 0 12px; font-weight: 400; }
            .receipt-footer-addr { color: #d1d5db; font-size: 11px; margin: 0 0 12px; line-height: 1.6; }
            .receipt-footer-contact { color: #d1d5db; font-size: 11px; margin: 0; }
            .receipt-footer-contact a { color: #9ca3af; text-decoration: none; }
            .receipt-footer-contact .dot { color: #e5e7eb; margin: 0 8px; }
            @media print {
              html, body { background: #ffffff !important; }
              .receipt-shell { padding: 0; background: #ffffff; }
              .receipt-card { box-shadow: none; border-radius: 0; }
              .no-print { display: none !important; }
              .receipt-footer { padding: 24px 0 0; }
            }
            @media (max-width: 640px) {
              .receipt-shell { padding: 32px 0; }
              .receipt-head { padding: 40px 24px 32px; }
              .receipt-head h1 { font-size: 28px; }
              .receipt-body { padding: 32px 24px 32px; }
              .receipt-amount-value { font-size: 32px; }
              .receipt-card { border-radius: 0; }
            }
          `,
        }}
      />

      <div className="receipt-wrap">
        <div className="receipt-logo">
          {/* eslint-disable-next-line @next/next/no-img-element -- static logo on a print-target page; next/image adds no value here */}
          <img src="https://thejre.org/images/logo.png" alt="The JRE" width={140} />
        </div>

        <div className="receipt-card">
          <div className="receipt-accent" />

          <div className="receipt-head">
            <div className="receipt-head-rule" />
            <h1>Tax Receipt</h1>
            <p>Official 501(c)(3) record of your donation</p>
          </div>

          <div className="receipt-body">
            <p className="receipt-greeting">Dear {firstName},</p>
            <p className="receipt-thank">
              Thank you for your gift to The JRE. Your generosity helps us provide meaningful
              Jewish experiences for the Westchester community. Please keep this receipt for
              your tax records.
            </p>

            <div className="receipt-amount-block">
              <div className="receipt-amount-label">Tax-deductible amount</div>
              <div className="receipt-amount-value">{amount}</div>
            </div>

            <div>
              <h3 className="receipt-details-title">Transaction Details</h3>
              <table className="receipt-details">
                <tbody>
                  <tr>
                    <td className="k">Donor</td>
                    <td className="v">{d.name}</td>
                  </tr>
                  <tr>
                    <td className="k">Email</td>
                    <td className="v">{d.email}</td>
                  </tr>
                  <tr>
                    <td className="k">Campaign</td>
                    <td className="v">{c.title}</td>
                  </tr>
                  <tr>
                    <td className="k">Date of gift</td>
                    <td className="v">{dateStr}</td>
                  </tr>
                  <tr>
                    <td className="k">Payment method</td>
                    <td className="v">{method}</td>
                  </tr>
                  {orgLegalName || displayOrgName ? (
                    <tr>
                      <td className="k">Donated to</td>
                      <td className="v">{orgLegalName || displayOrgName}</td>
                    </tr>
                  ) : null}
                  {displayEin ? (
                    <tr>
                      <td className="k">EIN</td>
                      <td className="v">{displayEin}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <td colSpan={2} className="ref">
                      Reference: {reference}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="receipt-tax">
              <p>
                <strong>Tax-Deductible:</strong> {legalNote}
              </p>
            </div>

            <div className="receipt-actions no-print">
              <button type="button" className="receipt-print-btn">
                Print or save as PDF
              </button>
              <p className="receipt-hint">
                Tip: choose &ldquo;Save as PDF&rdquo; as the destination in your browser&rsquo;s print dialog.
              </p>
            </div>

            <p className="receipt-closing">
              With gratitude,
              <br />
              <span>The JRE Team</span>
            </p>
          </div>
        </div>

        <div className="receipt-footer no-print">
          <div className="receipt-footer-rule" />
          <p className="receipt-footer-brand">The JRE</p>
          <p className="receipt-footer-name">Jewish Renaissance Experience</p>
          <p className="receipt-footer-addr">
            1495 Weaver Street
            <br />
            Scarsdale, NY 10583
          </p>
          <p className="receipt-footer-contact">
            <a href="mailto:office@thejre.org">office@thejre.org</a>
            <span className="dot">·</span>
            <a href="tel:914-713-4355">914-713-4355</a>
          </p>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var b=document.querySelector('.receipt-print-btn');if(b)b.addEventListener('click',function(){window.print();});})();`,
        }}
      />
    </div>
  );
}
