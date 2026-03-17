import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  'https://yhckumlsxrvfvtwrluge.supabase.co',
  ''
);

// Put your Resend key here
const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = 'cgelber@thejre.org';

function parseLTD(bg) {
  if (!bg) return 0;
  const m = bg.match(/Total giving: \$([0-9,.]+)/);
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
}
function parseLastGift(bg) {
  if (!bg) return null;
  const m = bg.match(/Last gift: (\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
function parseSince(bg) {
  if (!bg) return null;
  const m = bg.match(/Donor since (\d{4})/);
  return m ? parseInt(m[1]) : null;
}
function fmt(n) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}

async function fetchAll() {
  const all = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('outreach_contacts')
      .select('id, first_name, last_name, email, stage, how_met, background, engagement_score')
      .eq('is_active', true)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

function rows(list, cols) {
  return list.map(c => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      ${cols.map(col => `<td style="padding:8px 10px;font-size:13px;${col.style||''}">${col.fn(c)}</td>`).join('')}
    </tr>`).join('');
}

function table(headers, rowHtml) {
  return `
  <table style="width:100%;border-collapse:collapse;margin-top:8px;">
    <thead>
      <tr style="background:#f9fafb;">
        ${headers.map(h => `<th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">${h}</th>`).join('')}
      </tr>
    </thead>
    <tbody>${rowHtml}</tbody>
  </table>`;
}

function section(emoji, title, subtitle, content) {
  return `
  <div style="margin-bottom:32px;">
    <h2 style="font-size:17px;font-weight:700;color:#111827;margin:0 0 4px;">${emoji} ${title}</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">${subtitle}</p>
    ${content}
  </div>`;
}

async function main() {
  console.log('Fetching data...');
  const contacts = await fetchAll();
  const enriched = contacts.map(c => ({ ...c, ltd: parseLTD(c.background), lastGift: parseLastGift(c.background), donorSince: parseSince(c.background) }));
  const donors = enriched.filter(c => c.ltd > 0);
  const nonDonors = enriched.filter(c => c.ltd === 0);

  // Build lists
  const t1a = donors.filter(c => c.donorSince === 2023 && (!c.lastGift || c.lastGift < '2024-01-01')).sort((a, b) => b.ltd - a.ltd);
  const t1b = donors.filter(c => c.ltd >= 500 && c.lastGift && c.lastGift < '2024-01-01' && c.donorSince !== 2023).sort((a, b) => b.ltd - a.ltd).slice(0, 20);
  const t1c = donors.filter(c => c.ltd >= 500 && c.ltd < 5000 && c.lastGift && c.lastGift >= '2023-01-01').sort((a, b) => b.ltd - a.ltd).slice(0, 12);
  const t2a = nonDonors.filter(c => (c.engagement_score >= 3 || ['deepening','learning','inner_circle'].includes(c.stage)) && c.email).sort((a, b) => (b.engagement_score||0)-(a.engagement_score||0)).slice(0, 15);

  const totalHighPriority = new Set([...t1a, ...t1b, ...t1c].filter(c => c.email).map(c => c.id)).size;
  const conservativeRevenue = t1a.reduce((s, c) => s + c.ltd * 0.4, 0) + t1b.reduce((s, c) => s + c.ltd * 0.25, 0);
  const optimisticRevenue = t1a.reduce((s, c) => s + c.ltd * 0.7, 0) + t1b.reduce((s, c) => s + c.ltd * 0.5, 0) + t1c.reduce((s, c) => s + c.ltd * 0.3, 0);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
<div style="max-width:700px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#EF8046,#d96a2f);padding:32px 36px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;color:rgba(255,255,255,0.75);text-transform:uppercase;margin-bottom:8px;">The JRE — Campaign Prep</div>
    <h1 style="font-size:26px;font-weight:800;color:white;margin:0 0 6px;">June Campaign Brief</h1>
    <p style="font-size:14px;color:rgba(255,255,255,0.85);margin:0;">Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · ${contacts.length.toLocaleString()} people in system · ${donors.length} donors</p>
  </div>

  <div style="padding:36px;">

    <!-- Top-line numbers -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:36px;">
      ${[
        { label: 'High-Priority Contacts', value: totalHighPriority + ' people', sub: 'Tiers 1A, 1B, 1C with email' },
        { label: 'Conservative Revenue', value: '$' + Math.round(conservativeRevenue).toLocaleString(), sub: 'If 30–40% convert' },
        { label: 'Optimistic Revenue', value: '$' + Math.round(optimisticRevenue).toLocaleString(), sub: 'If 50–70% convert' },
      ].map(s => `
        <div style="background:#fafafa;border:1px solid #f3f4f6;border-radius:12px;padding:16px;">
          <div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">${s.label}</div>
          <div style="font-size:22px;font-weight:800;color:#111827;">${s.value}</div>
          <div style="font-size:11px;color:#d1d5db;margin-top:2px;">${s.sub}</div>
        </div>`).join('')}
    </div>

    <!-- TIER 1A -->
    ${section('🔄', `TIER 1A — 2023 First-Timers (${t1a.length} people)`,
      `Gave in your very first campaign. Haven't given since. Highest ROI outreach of everything in this list — they already said yes once.`,
      table(
        ['Name', 'Gave in 2023', 'Last Gift', 'Email'],
        rows(t1a, [
          { fn: c => `<strong>${c.first_name} ${c.last_name}</strong>` },
          { fn: c => `<span style="color:#EF8046;font-weight:700;">${fmt(c.ltd)}</span>`, style: 'text-align:right;' },
          { fn: c => c.lastGift || '—', style: 'color:#9ca3af;text-align:right;' },
          { fn: c => c.email ? `<a href="mailto:${c.email}?subject=Checking in from JRE&body=Hi ${c.first_name},%0D%0A%0D%0A" style="color:#3b82f6;text-decoration:none;">${c.email}</a>` : '<span style="color:#d1d5db;">no email</span>' },
        ])
      )
    )}

    <!-- TIER 1B -->
    ${section('🚨', `TIER 1B — Lapsed Major Donors (${t1b.length} people)`,
      `Gave $500+ but haven't given since 2024. These are people with a proven track record of significant giving. They haven't left — they just haven't been asked.`,
      table(
        ['Name', 'LTD', 'Last Gift', 'Email'],
        rows(t1b, [
          { fn: c => `<strong>${c.first_name} ${c.last_name}</strong>` },
          { fn: c => `<span style="font-weight:700;">${fmt(c.ltd)}</span>`, style: 'text-align:right;' },
          { fn: c => c.lastGift || '—', style: 'color:#9ca3af;text-align:right;' },
          { fn: c => c.email ? `<a href="mailto:${c.email}" style="color:#3b82f6;text-decoration:none;">${c.email}</a>` : '<span style="color:#d1d5db;">no email</span>' },
        ])
      )
    )}

    <!-- TIER 1C -->
    ${section('⬆️', `TIER 1C — Ready to Upgrade (${t1c.length} people)`,
      `Gave $500–$5k and are still active. A personal conversation about impact — not just a donation form — can move these donors to the next level.`,
      table(
        ['Name', 'LTD', 'Last Gift', 'Email'],
        rows(t1c, [
          { fn: c => `<strong>${c.first_name} ${c.last_name}</strong>` },
          { fn: c => `<span style="color:#7c3aed;font-weight:700;">${fmt(c.ltd)}</span>`, style: 'text-align:right;' },
          { fn: c => c.lastGift || '—', style: 'color:#9ca3af;text-align:right;' },
          { fn: c => c.email ? `<a href="mailto:${c.email}" style="color:#3b82f6;text-decoration:none;">${c.email}</a>` : '<span style="color:#d1d5db;">no email</span>' },
        ])
      )
    )}

    <!-- TIER 2A -->
    ${section('🌱', `TIER 2A — Engaged Non-Donors (${t2a.length} people)`,
      `Never donated but deeply engaged — high event attendance, warm stage. These people care. They've just never been personally asked.`,
      table(
        ['Name', 'Stage', 'Engagement', 'Email'],
        rows(t2a, [
          { fn: c => `<strong>${c.first_name} ${c.last_name}</strong>` },
          { fn: c => c.stage.replace(/_/g, ' '), style: 'color:#9ca3af;' },
          { fn: c => '★'.repeat(Math.min(c.engagement_score || 0, 5)), style: 'color:#f59e0b;' },
          { fn: c => c.email ? `<a href="mailto:${c.email}" style="color:#3b82f6;text-decoration:none;">${c.email}</a>` : '<span style="color:#d1d5db;">no email</span>' },
        ])
      )
    )}

    <!-- SOP Box -->
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:20px;margin-top:8px;">
      <h3 style="font-size:15px;font-weight:700;color:#92400e;margin:0 0 12px;">📋 Before You Start — SOP for the June Campaign</h3>
      <ol style="margin:0;padding-left:20px;color:#78350f;font-size:13px;line-height:1.9;">
        <li><strong>Start with Tier 1A</strong> — personal text or call, not email. "Hey, I was thinking of you and wanted to catch up." Mention the mission, not the money, first.</li>
        <li><strong>Tier 1B</strong> — these need a relationship re-warm before an ask. One genuine check-in, then a follow-up with the campaign 1–2 weeks later.</li>
        <li><strong>Tier 1C</strong> — coffee or a call. Share a specific impact story. Ask for a specific amount (their LTD × 1.5 is a good target).</li>
        <li><strong>Tier 2A</strong> — first invite them to the June event. Then make the ask personally at or after the event.</li>
        <li><strong>Log every interaction</strong> in the CRM — even a "left voicemail." This builds the history that makes next year's campaign easier.</li>
        <li><strong>Don't blast.</strong> A personal email with their name and a specific mention of how you know them converts 5–10× better than a mass email.</li>
      </ol>
    </div>

    <p style="font-size:12px;color:#d1d5db;margin-top:32px;text-align:center;">
      JRE Outreach CRM · <a href="https://thejre.org/admin/outreach/analytics" style="color:#EF8046;">View Full Analytics →</a>
    </p>
  </div>
</div>
</body>
</html>`;

  console.log('Sending email...');
  const { data, error } = await resend.emails.send({
    from: 'JRE Outreach <noreply@beta.thejre.org>',
    to: TO_EMAIL,
    subject: `June Campaign Brief — ${totalHighPriority} high-priority contacts, ${fmt(conservativeRevenue)}–${fmt(optimisticRevenue)} potential`,
    html,
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sent! Email ID:', data.id);
    console.log(`\nSummary:`);
    console.log(`  Tier 1A (2023 first-timers): ${t1a.length} people`);
    console.log(`  Tier 1B (lapsed major donors): ${t1b.length} people`);
    console.log(`  Tier 1C (upgrade candidates): ${t1c.length} people`);
    console.log(`  Tier 2A (engaged non-donors): ${t2a.length} people`);
    console.log(`  Conservative revenue potential: $${Math.round(conservativeRevenue).toLocaleString()}`);
    console.log(`  Optimistic revenue potential: $${Math.round(optimisticRevenue).toLocaleString()}`);
  }
}

main().catch(console.error);
