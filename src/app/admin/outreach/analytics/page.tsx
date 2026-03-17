"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone, TrendingUp, AlertCircle, Users, Heart, Star, Zap } from "lucide-react";

interface AnalyticsData {
  pipeline: {
    stageCounts: Record<string, number>;
    total: number;
    maleContacts: number;
    femaleContacts: number;
    unknownGender: number;
    overdueContacts: number;
    newLast30: number;
  };
  donors: {
    total: number;
    pyramid: Array<{ label: string; sublabel: string; count: number; color: string }>;
    lapsed: Array<{ id: string; first_name: string; last_name: string; email: string | null; ltd: number; lastGift: string; donorSince: number }>;
    activeYTD: Array<{ id: string; first_name: string; last_name: string; ytd: number; ltd: number }>;
    upgradeCandidates: Array<{ id: string; first_name: string; last_name: string; ltd: number; lastGift: string; email: string | null }>;
    loyalists: Array<{ id: string; first_name: string; last_name: string; ltd: number; donorSince: number; lastGift: string }>;
    reengagement2023: Array<{ id: string; first_name: string; last_name: string; email: string | null; ltd: number; lastGift: string | null }>;
    cohorts: Record<string, number>;
  };
  warmProspects: Array<{ id: string; first_name: string; last_name: string; email: string; stage: string }>;
  gaps: { noEmail: number; noGender: number; noInteraction: number };
  interactions: { typeCounts: Record<string, number>; totalLast90Days: number };
}

const STAGE_LABELS: Record<string, string> = {
  new_contact: "New Contact", in_touch: "In Touch", event_connected: "Event Connected",
  deepening: "Deepening", learning: "Learning", inner_circle: "Inner Circle", multiplying: "Multiplying",
};

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toFixed(0)}`;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-gray-900 mb-4">{children}</h2>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${className}`}>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/outreach/analytics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading insights...</div>;
  if (!data) return <div className="text-center py-20 text-red-500">Failed to load data.</div>;

  const { pipeline, donors, warmProspects, gaps, interactions } = data;

  // Cohort chart
  const cohortEntries = Object.entries(donors.cohorts).sort();
  const maxCohort = Math.max(...cohortEntries.map(([, v]) => v), 1);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/outreach" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insights & Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">{pipeline.total.toLocaleString()} people — live data, updates as contacts come in</p>
        </div>
      </div>

      {/* Top-line numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total in System",   value: pipeline.total,           color: "text-gray-900",  icon: <Users className="w-4 h-4 text-blue-400" /> },
          { label: "Active Donors",     value: donors.total,             color: "text-gray-900",  icon: <Heart className="w-4 h-4 text-red-400" /> },
          { label: "Active This Year",  value: donors.activeYTD.length,  color: "text-green-600", icon: <TrendingUp className="w-4 h-4 text-green-400" /> },
          { label: "Need Follow-up",    value: pipeline.overdueContacts, color: pipeline.overdueContacts > 0 ? "text-red-600" : "text-gray-900", icon: <AlertCircle className="w-4 h-4 text-orange-400" /> },
        ].map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-2 mb-1">{s.icon}<span className="text-xs text-gray-500">{s.label}</span></div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
          </Card>
        ))}
      </div>

      {/* Donor Pyramid + Active YTD */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pyramid */}
        <Card>
          <SectionHeader>Donor Pyramid</SectionHeader>
          <div className="space-y-2">
            {donors.pyramid.map((tier) => (
              <div key={tier.label} className="flex items-center gap-3">
                <div className="w-28 text-right">
                  <span className="text-xs font-medium text-gray-700">{tier.label}</span>
                  <div className="text-xs text-gray-400">{tier.sublabel}</div>
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                  <div
                    className="h-5 rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max(5, (tier.count / Math.max(...donors.pyramid.map(t => t.count), 1)) * 100)}%`, backgroundColor: tier.color + "33", borderLeft: `3px solid ${tier.color}` }}
                  >
                    <span className="text-xs font-bold" style={{ color: tier.color }}>{tier.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Active YTD */}
        <Card>
          <SectionHeader>Active This Year (YTD)</SectionHeader>
          <div className="space-y-2">
            {donors.activeYTD.map((c) => (
              <Link key={c.id} href={`/admin/outreach/${c.id}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group">
                <span className="text-sm font-medium text-gray-800 group-hover:text-[#EF8046]">{c.first_name} {c.last_name}</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-green-600">{fmt(c.ytd)} YTD</span>
                  <span className="text-xs text-gray-400 ml-2">{fmt(c.ltd)} LTD</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Lapsed Major Donors */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <SectionHeader>🚨 Lapsed Major Donors — Call These First</SectionHeader>
            <p className="text-sm text-gray-500 -mt-3 mb-4">Gave $500+ but haven't given since 2024. They already believe in the mission.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Name</th>
                <th className="text-right pb-2 font-medium">LTD</th>
                <th className="text-right pb-2 font-medium">Last Gift</th>
                <th className="text-right pb-2 font-medium">Donor Since</th>
                <th className="text-right pb-2 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {donors.lapsed.map((c) => {
                const yearsLapsed = new Date().getFullYear() - new Date(c.lastGift).getFullYear();
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2">
                      <Link href={`/admin/outreach/${c.id}`} className="font-medium text-gray-800 hover:text-[#EF8046]">
                        {c.first_name} {c.last_name}
                      </Link>
                    </td>
                    <td className="text-right font-bold text-gray-900">{fmt(c.ltd)}</td>
                    <td className="text-right text-gray-500">{c.lastGift}</td>
                    <td className="text-right text-gray-400">{c.donorSince || "—"}</td>
                    <td className="text-right">
                      {c.email ? (
                        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <Phone className="w-3 h-3" /> email
                        </a>
                      ) : (
                        <span className="text-xs text-gray-300">no email</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 2023 Re-engagement */}
      {donors.reengagement2023.length > 0 && (
        <Card>
          <div className="mb-4">
            <SectionHeader>🔄 2023 Re-engagement — Your June Campaign List</SectionHeader>
            <p className="text-sm text-gray-500 -mt-3">
              These <strong>{donors.reengagement2023.length} people</strong> gave in your very first campaign (2023) but haven't given since.
              They said yes once — they're the most likely to say yes again. A personal outreach before your June campaign has the highest ROI of anything in this system.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Name</th>
                  <th className="text-right pb-2 font-medium">Gave in 2023</th>
                  <th className="text-right pb-2 font-medium">Last Gift</th>
                  <th className="text-right pb-2 font-medium">Reach Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {donors.reengagement2023.map((c) => (
                  <tr key={c.id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="py-2">
                      <Link href={`/admin/outreach/${c.id}`} className="font-medium text-gray-800 hover:text-[#EF8046]">
                        {c.first_name} {c.last_name}
                      </Link>
                    </td>
                    <td className="text-right font-bold text-[#EF8046]">{fmt(c.ltd)}</td>
                    <td className="text-right text-gray-400 text-xs">{c.lastGift || "unknown"}</td>
                    <td className="text-right">
                      {c.email ? (
                        <a href={`mailto:${c.email}?subject=Checking in from JRE&body=Hi ${c.first_name},%0D%0A%0D%0AJust wanted to reach out personally...`}
                          className="text-xs text-blue-600 hover:underline">email</a>
                      ) : (
                        <span className="text-xs text-gray-300">no email</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
            💡 Best approach: a personal text or call from someone who knows them. "Hey, I was thinking of you" converts 3–5x better than a blast email.
          </p>
        </Card>
      )}

      {/* Upgrade Candidates + Loyalists */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <SectionHeader>⬆️ Upgrade Candidates</SectionHeader>
          <p className="text-xs text-gray-400 mb-3">Gave $500–$3k, still active. Ready to give more with the right ask.</p>
          <div className="space-y-2">
            {donors.upgradeCandidates.map((c) => (
              <Link key={c.id} href={`/admin/outreach/${c.id}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group">
                <div>
                  <div className="text-sm font-medium text-gray-800 group-hover:text-[#EF8046]">{c.first_name} {c.last_name}</div>
                  <div className="text-xs text-gray-400">last: {c.lastGift}</div>
                </div>
                <span className="text-sm font-bold text-purple-600">{fmt(c.ltd)} LTD</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader>💎 Multi-Year Loyalists</SectionHeader>
          <p className="text-xs text-gray-400 mb-3">First gave in 2022 or earlier AND still gave in 2024+. These are your foundation.</p>
          <div className="space-y-2">
            {donors.loyalists.map((c) => (
              <Link key={c.id} href={`/admin/outreach/${c.id}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group">
                <div>
                  <div className="text-sm font-medium text-gray-800 group-hover:text-[#EF8046]">{c.first_name} {c.last_name}</div>
                  <div className="text-xs text-gray-400">donor since {c.donorSince}</div>
                </div>
                <span className="text-sm font-bold text-[#EF8046]">{fmt(c.ltd)} LTD</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Warm Prospects */}
      <Card>
        <SectionHeader>🌱 Warm Prospects — Came to Events, Never Asked to Give</SectionHeader>
        <p className="text-sm text-gray-500 mb-4">These {warmProspects.length}+ people show up. They already care. A personal ask from someone they know converts at 20–30%.</p>
        <div className="grid md:grid-cols-2 gap-2">
          {warmProspects.map((c) => (
            <Link key={c.id} href={`/admin/outreach/${c.id}`} className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 hover:border-[#EF8046]/30 hover:bg-orange-50/30 transition-all group">
              <div>
                <div className="text-sm font-medium text-gray-800 group-hover:text-[#EF8046]">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-gray-400">{STAGE_LABELS[c.stage] || c.stage}</div>
              </div>
              <a href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()} className="text-xs text-blue-500 hover:underline truncate max-w-[140px]">{c.email}</a>
            </Link>
          ))}
        </div>
      </Card>

      {/* Donor Cohorts */}
      <Card>
        <SectionHeader>📅 New Donors by Year</SectionHeader>
        <p className="text-sm text-gray-500 mb-4">When did each person first give? The 2023 spike shows something worked exceptionally that year.</p>
        <div className="space-y-2">
          {cohortEntries.map(([year, count]) => (
            <div key={year} className="flex items-center gap-3">
              <span className="w-10 text-xs text-gray-500 font-mono">{year}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4">
                <div
                  className="h-4 rounded-full bg-[#EF8046]/70 flex items-center justify-end pr-2 transition-all"
                  style={{ width: `${Math.max(2, (count / maxCohort) * 100)}%` }}
                >
                  {count > 5 && <span className="text-xs font-bold text-white">{count}</span>}
                </div>
              </div>
              {count <= 5 && <span className="text-xs text-gray-400">{count}</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* Pipeline + Gaps */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Pipeline */}
        <Card>
          <SectionHeader>Pipeline Stages</SectionHeader>
          <div className="space-y-2">
            {Object.entries(pipeline.stageCounts).sort((a, b) => b[1] - a[1]).map(([stage, count]) => (
              <Link key={stage} href={`/admin/outreach/contacts?stage=${stage}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                <span className="text-sm text-gray-700">{STAGE_LABELS[stage] || stage}</span>
                <span className="text-sm font-bold text-gray-900">{count}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Gaps */}
        <Card>
          <SectionHeader>🔧 What's Missing</SectionHeader>
          <div className="space-y-4">
            <GapRow
              value={gaps.noEmail}
              total={pipeline.total}
              label="No email address"
              sublabel="Can't reach them digitally — mostly Banquest donors who gave by check"
              color="bg-red-400"
            />
            <GapRow
              value={gaps.noGender}
              total={pipeline.total}
              label="Unknown gender"
              sublabel="Can't assign to men's or women's team — need a human to review"
              color="bg-orange-400"
            />
            <GapRow
              value={gaps.noInteraction}
              total={pipeline.total}
              label="No real interaction logged"
              sublabel="Still at 'new contact' — no one has connected with them yet"
              color="bg-yellow-400"
            />
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-[#EF8046] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-500">
                  <strong>Start logging interactions</strong> via email to <code className="bg-gray-100 px-1 rounded">log@thejre.org</code>.
                  Every coffee, every call, every Shabbos visit. The data gets richer with every interaction logged.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Men / Women split */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <div className="text-3xl font-bold text-blue-600">{pipeline.maleContacts}</div>
          <div className="text-sm text-gray-500 mt-1">Men in system</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-pink-500">{pipeline.femaleContacts}</div>
          <div className="text-sm text-gray-500 mt-1">Women in system</div>
        </Card>
        <Card className="text-center">
          <div className="text-3xl font-bold text-gray-300">{pipeline.unknownGender}</div>
          <div className="text-sm text-gray-500 mt-1">Unknown gender</div>
          <Link href="/admin/outreach/contacts?gender=" className="text-xs text-[#EF8046] hover:underline mt-1 block">Review →</Link>
        </Card>
      </div>
    </div>
  );
}

function GapRow({ value, total, label, sublabel, color }: { value: number; total: number; label: string; sublabel: string; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="text-sm font-bold text-gray-900">{value.toLocaleString()} <span className="text-xs font-normal text-gray-400">({pct}%)</span></span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400">{sublabel}</p>
    </div>
  );
}
