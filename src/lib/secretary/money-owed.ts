/**
 * Money-owed tracker — generalized "JRE owes X to Y" register.
 *
 * Mirrors the manual "Zelle Payments - IMPORTANT" digest emails Gitty sends.
 * The cron sends one digest grouped by payee_email; the inbox watcher parses
 * the payer's reply ("paid Yocheved", "paid all") to mark items off.
 */
import { createClient } from "@supabase/supabase-js";

export type MoneyOwed = {
  id: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  amount_usd: number;
  reason: string | null;
  payee_email: string;
  status: "open" | "paid" | "cancelled";
  paid_at: string | null;
  paid_method: string | null;
  paid_reference: string | null;
  paid_source: string | null;
  digest_send_count: number;
  last_digest_at: string | null;
  related_class_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function listOpenMoneyOwed(payeeEmail?: string): Promise<MoneyOwed[]> {
  let q = db().from("jre_money_owed").select("*").eq("status", "open").order("created_at", { ascending: true });
  if (payeeEmail) q = q.eq("payee_email", payeeEmail);
  const { data } = await q;
  return (data ?? []) as MoneyOwed[];
}

export async function listAllMoneyOwed(limit = 100): Promise<MoneyOwed[]> {
  const { data } = await db()
    .from("jre_money_owed")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MoneyOwed[];
}

export async function addMoneyOwed(input: {
  recipient_name: string;
  recipient_phone?: string;
  recipient_email?: string;
  amount_usd: number;
  reason?: string;
  payee_email?: string;
  related_class_id?: string;
  notes?: string;
}): Promise<MoneyOwed | null> {
  const { data, error } = await db()
    .from("jre_money_owed")
    .insert({
      recipient_name: input.recipient_name,
      recipient_phone: input.recipient_phone ?? null,
      recipient_email: input.recipient_email ?? null,
      amount_usd: input.amount_usd,
      reason: input.reason ?? null,
      payee_email: input.payee_email ?? "elishevaoratz@gmail.com",
      related_class_id: input.related_class_id ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) {
    console.error("[money-owed] insert failed:", error);
    return null;
  }
  return data as MoneyOwed;
}

export async function markMoneyOwedPaid(
  id: string,
  opts?: { method?: string; reference?: string; source?: string }
): Promise<void> {
  await db()
    .from("jre_money_owed")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      paid_method: opts?.method ?? "zelle",
      paid_reference: opts?.reference ?? null,
      paid_source: opts?.source ?? "manual",
    })
    .eq("id", id);
}

export async function bumpDigestCounter(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  // Fetch current counts so we can increment
  const { data: rows } = await db().from("jre_money_owed").select("id, digest_send_count").in("id", ids);
  for (const r of rows ?? []) {
    await db()
      .from("jre_money_owed")
      .update({
        digest_send_count: (r.digest_send_count ?? 0) + 1,
        last_digest_at: now,
      })
      .eq("id", r.id);
  }
}

/**
 * Build the digest email body in Gitty's exact format (matches her
 * 2026-04-20 manual email to elishevaoratz@gmail.com):
 *
 *   1) Yocheved Bakst (Purim 2026)
 *   *845-263-7241*
 *   *$1,200*
 *
 *   2) ...
 */
export function buildDigestEmail(items: MoneyOwed[]): { subject: string; html: string; text: string } {
  const total = items.reduce((s, i) => s + i.amount_usd, 0);
  const subject = items.length === 1
    ? `Zelle Payment - ${items[0].recipient_name} ($${items[0].amount_usd.toLocaleString()})`
    : `Zelle Payments - IMPORTANT (${items.length} items, $${total.toLocaleString()} total)`;

  const lines = items.map((it, i) => {
    const num = i + 1;
    const reason = it.reason ? ` (${it.reason})` : "";
    const contact = it.recipient_phone || it.recipient_email || "(no contact info)";
    return `${num}) ${it.recipient_name}${reason}\n*${contact}*\n*$${it.amount_usd.toLocaleString()}*`;
  });

  const text = `Hi,

The following ${items.length === 1 ? "payment is" : "payments are"} pending:

${lines.join("\n\n")}

When sent, please reply with "paid <name>" or "paid all" so I can mark ${items.length === 1 ? "it" : "them"} off.

Thank you!

--
All the best,

Gitty Levi

1495 Weaver Street
Scarsdale, NY 10583
(323) 329-9445
`;

  const htmlLines = items.map((it, i) => {
    const num = i + 1;
    const reason = it.reason ? ` <span style="color:#666">(${it.reason})</span>` : "";
    const contact = it.recipient_phone || it.recipient_email || "(no contact info)";
    return `<p style="margin:0 0 16px 0">${num}) <strong>${it.recipient_name}</strong>${reason}<br/>
<strong>${contact}</strong><br/>
<strong>$${it.amount_usd.toLocaleString()}</strong></p>`;
  }).join("\n");

  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;line-height:1.5">
<p>Hi,</p>
<p>The following ${items.length === 1 ? "payment is" : "payments are"} pending:</p>
${htmlLines}
<p style="color:#666;font-size:13px;margin-top:24px">When sent, please reply with <em>"paid &lt;name&gt;"</em> or <em>"paid all"</em> so I can mark ${items.length === 1 ? "it" : "them"} off.</p>
<p>Thank you!</p>
<p>--<br/>
All the best,<br/><br/>
<strong>Gitty Levi</strong><br/>
1495 Weaver Street<br/>
Scarsdale, NY 10583<br/>
(323) 329-9445</p>
</div>`;

  return { subject, html, text };
}
