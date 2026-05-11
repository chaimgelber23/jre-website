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
    .select("title, tax_id, tax_deductible_note")
    .eq("id", (donation as DonationRow).campaign_id)
    .maybeSingle();
  if (!campaign) notFound();

  const d = donation as DonationRow;
  const c = campaign as CampaignRow;
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
    "The Jewish Renaissance Experience is a registered 501(c)(3) nonprofit organization. This serves as your official tax receipt. No goods or services were provided in exchange for this donation.";

  return (
    <main className="receipt-page">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body { background: #f3f4f6; }
            .receipt-page {
              max-width: 720px;
              margin: 48px auto;
              padding: 56px 56px 40px;
              background: #ffffff;
              color: #111827;
              font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
              box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06);
              border-radius: 4px;
            }
            .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 32px; border-bottom: 1px solid #e5e7eb; }
            .receipt-org-name { font-size: 18px; font-weight: 600; color: #111827; letter-spacing: -0.2px; margin: 0 0 4px; }
            .receipt-org-meta { font-size: 12px; color: #6b7280; line-height: 1.5; }
            .receipt-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #EF8046; text-transform: uppercase; text-align: right; }
            .receipt-subtitle { font-size: 22px; font-weight: 600; color: #111827; letter-spacing: -0.4px; margin: 8px 0 0; text-align: right; }
            .receipt-rows { padding: 36px 0 8px; }
            .receipt-row { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
            .receipt-row .k { color: #6b7280; font-weight: 500; }
            .receipt-row .v { color: #111827; font-weight: 500; text-align: right; max-width: 60%; word-break: break-word; }
            .receipt-row .v.ref { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 12px; color: #4b5563; }
            .receipt-total { display: flex; justify-content: space-between; padding: 24px 0 8px; margin-top: 12px; border-top: 2px solid #111827; }
            .receipt-total .k { font-size: 13px; font-weight: 600; color: #111827; text-transform: uppercase; letter-spacing: 1px; }
            .receipt-total .v { font-size: 28px; font-weight: 700; color: #EF8046; letter-spacing: -0.5px; }
            .receipt-legal { margin-top: 36px; padding: 20px 24px; background: #f9fafb; border-left: 3px solid #EF8046; border-radius: 4px; }
            .receipt-legal p { margin: 0; font-size: 12px; line-height: 1.7; color: #4b5563; }
            .receipt-actions { margin-top: 40px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
            .receipt-print-btn { background: #111827; color: #ffffff; border: none; padding: 12px 28px; font-size: 14px; font-weight: 500; letter-spacing: 0.3px; border-radius: 6px; cursor: pointer; font-family: inherit; }
            .receipt-print-btn:hover { background: #1f2937; }
            .receipt-hint { font-size: 12px; color: #9ca3af; text-align: center; }
            @media print {
              body { background: #ffffff; }
              .receipt-page { margin: 0; padding: 32px; box-shadow: none; border-radius: 0; max-width: none; }
              .no-print { display: none !important; }
            }
            @media (max-width: 600px) {
              .receipt-page { margin: 0; padding: 32px 24px; box-shadow: none; border-radius: 0; }
              .receipt-header { flex-direction: column; gap: 20px; }
              .receipt-title, .receipt-subtitle { text-align: left; }
            }
          `,
        }}
      />

      <header className="receipt-header">
        <div>
          <p className="receipt-org-name">The Jewish Renaissance Experience</p>
          <p className="receipt-org-meta">
            1495 Weaver Street, Scarsdale, NY 10583
            <br />
            office@thejre.org · 914-713-4355
            {c.tax_id ? (
              <>
                <br />
                EIN: {c.tax_id}
              </>
            ) : null}
          </p>
        </div>
        <div>
          <div className="receipt-title">Official Tax Receipt</div>
          <div className="receipt-subtitle">501(c)(3) Donation</div>
        </div>
      </header>

      <section className="receipt-rows">
        <div className="receipt-row">
          <span className="k">Donor</span>
          <span className="v">{d.name}</span>
        </div>
        <div className="receipt-row">
          <span className="k">Email</span>
          <span className="v">{d.email}</span>
        </div>
        <div className="receipt-row">
          <span className="k">Campaign</span>
          <span className="v">{c.title}</span>
        </div>
        <div className="receipt-row">
          <span className="k">Date of gift</span>
          <span className="v">{dateStr}</span>
        </div>
        <div className="receipt-row">
          <span className="k">Payment method</span>
          <span className="v">{method}</span>
        </div>
        <div className="receipt-row">
          <span className="k">Reference</span>
          <span className="v ref">{reference}</span>
        </div>
        <div className="receipt-total">
          <span className="k">Tax-deductible amount</span>
          <span className="v">{amount}</span>
        </div>
      </section>

      <section className="receipt-legal">
        <p>{legalNote}</p>
      </section>

      <div className="receipt-actions no-print">
        <button type="button" className="receipt-print-btn">
          Print or save as PDF
        </button>
        <div className="receipt-hint">
          Tip: choose &ldquo;Save as PDF&rdquo; as the destination in your browser&rsquo;s print dialog.
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var b=document.querySelector('.receipt-print-btn');if(b)b.addEventListener('click',function(){window.print();});})();`,
        }}
      />
    </main>
  );
}
