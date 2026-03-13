"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, TrendingUp, AlertCircle, Star, Plus, Inbox, BarChart2, ArrowLeft, X, UserPlus } from "lucide-react";
import { STAGE_LABELS } from "@/types/database";

interface Analytics {
  pipeline: {
    stageCounts: Record<string, number>;
    total: number;
    maleContacts: number;
    femaleContacts: number;
    overdueContacts: number;
    newLast30: number;
  };
  interactions: {
    typeCounts: Record<string, number>;
    totalLast90Days: number;
    conversionRates: Array<{ type: string; total: number; advances: number; rate: number }>;
  };
  team: Array<{ id: string; name: string; gender: string; interactions: number; contacts: number }>;
  sources: Record<string, number>;
}

interface TeamMember {
  id: string;
  name: string;
  gender: string;
  email: string | null;
}

const STAGE_ORDER = ["new_contact","in_touch","event_connected","deepening","learning","inner_circle","multiplying"];
const STAGE_COLORS: Record<string, string> = {
  new_contact:     "bg-gray-100 text-gray-700",
  in_touch:        "bg-blue-100 text-blue-700",
  event_connected: "bg-purple-100 text-purple-700",
  deepening:       "bg-orange-100 text-orange-700",
  learning:        "bg-yellow-100 text-yellow-700",
  inner_circle:    "bg-green-100 text-green-700",
  multiplying:     "bg-emerald-100 text-emerald-700",
};

export default function OutreachDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", gender: "male", email: "" });
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    fetch("/api/admin/outreach/analytics")
      .then((r) => r.json())
      .then((d) => { setAnalytics(d); setLoading(false); })
      .catch(() => setLoading(false));

    fetch("/api/admin/outreach/team")
      .then(r => r.json())
      .then(d => setTeamMembers(d.members || []))
      .catch(() => {});
  }, []);

  async function addTeamMember() {
    if (!addForm.name.trim()) return;
    setAddingMember(true);
    try {
      const res = await fetch("/api/admin/outreach/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (data.member) {
        setTeamMembers(prev => [...prev, data.member]);
        setAddForm({ name: "", gender: "male", email: "" });
        setShowAddMember(false);
      }
    } finally {
      setAddingMember(false);
    }
  }

  const pipeline = analytics?.pipeline;
  const interactions = analytics?.interactions;
  const team = analytics?.team;

  const menMembers = teamMembers.filter(m => m.gender === "male");
  const womenMembers = teamMembers.filter(m => m.gender === "female");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Outreach Dashboard</h1>
            <p className="text-gray-500 mt-1">
              {loading ? "Loading..." : pipeline ? `${pipeline.total} people in the system` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/outreach/contacts" className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Users className="w-4 h-4" />
            Contacts
          </Link>
          <Link href="/admin/outreach/inbox" className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Inbox className="w-4 h-4" />
            Inbox
          </Link>
          <Link href="/admin/outreach/analytics" className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <BarChart2 className="w-4 h-4" />
            Insights
          </Link>
          <Link href="/admin/outreach/contacts?addNew=1" className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Plus className="w-4 h-4" />
            Add Contact
          </Link>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-400">Loading dashboard data...</div>
      )}

      {!loading && !analytics && (
        <div className="text-center py-16 text-red-500">Failed to load analytics. The API may have timed out — try refreshing.</div>
      )}

      {!loading && analytics && pipeline && interactions && team && (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Users className="w-5 h-5 text-blue-500" />} label="Total in System" value={pipeline.total} />
            <StatCard icon={<TrendingUp className="w-5 h-5 text-green-500" />} label="New This Month" value={pipeline.newLast30} />
            <StatCard icon={<AlertCircle className="w-5 h-5 text-red-500" />} label="Need Follow-up" value={pipeline.overdueContacts} highlight={pipeline.overdueContacts > 0} />
            <StatCard icon={<Star className="w-5 h-5 text-yellow-500" />} label="Interactions (90d)" value={interactions.totalLast90Days} />
          </div>

          {/* Nobody Left Behind */}
          {pipeline.overdueContacts > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-red-700">{pipeline.overdueContacts} people haven't heard from us in 30+ days</p>
                <p className="text-sm text-red-600 mt-0.5">One message could change everything.</p>
              </div>
              <Link href="/admin/outreach/contacts?overdue=true" className="text-sm font-medium text-red-700 underline underline-offset-2">
                See who
              </Link>
            </div>
          )}

          {/* Pipeline stages */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Pipeline</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STAGE_ORDER.map((stage) => {
                const count = pipeline.stageCounts[stage] || 0;
                return (
                  <Link
                    key={stage}
                    href={`/admin/outreach/contacts?stage=${stage}`}
                    className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                  >
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                    <div className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[stage]}`}>
                      {STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Men / Women team panels */}
          <div className="grid grid-cols-2 gap-4">
            {/* Men's Team */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-gray-900">Men's Team</h2>
                <button
                  onClick={() => { setShowAddMember(true); setAddForm(f => ({ ...f, gender: "male" })); }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="text-3xl font-bold text-blue-600">{pipeline.maleContacts}</div>
              <p className="text-sm text-gray-500 mt-1 mb-3">active contacts</p>
              {menMembers.map((m) => {
                const stats = team.find(t => t.id === m.id);
                return (
                  <div key={m.id} className="flex justify-between text-sm mt-2 text-gray-600">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-400">
                      {stats ? `${stats.contacts} contacts · ${stats.interactions} interactions` : "—"}
                    </span>
                  </div>
                );
              })}
              {menMembers.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No men added yet.</p>
              )}
            </div>

            {/* Women's Team */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-gray-900">Women's Team</h2>
                <button
                  onClick={() => { setShowAddMember(true); setAddForm(f => ({ ...f, gender: "female" })); }}
                  className="flex items-center gap-1 text-xs text-pink-500 hover:text-pink-600 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="text-3xl font-bold text-pink-500">{pipeline.femaleContacts}</div>
              <p className="text-sm text-gray-500 mt-1 mb-3">active contacts</p>
              {womenMembers.map((m) => {
                const stats = team.find(t => t.id === m.id);
                return (
                  <div key={m.id} className="flex justify-between text-sm mt-2 text-gray-600">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-gray-400">
                      {stats ? `${stats.contacts} contacts · ${stats.interactions} interactions` : "—"}
                    </span>
                  </div>
                );
              })}
              {womenMembers.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No women added yet.</p>
              )}
            </div>
          </div>

          {/* What's Working */}
          {interactions.conversionRates.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-4">What's Working</h2>
              <div className="space-y-3">
                {interactions.conversionRates.slice(0, 5).map((r) => (
                  <div key={r.type} className="flex items-center gap-4">
                    <span className="w-24 text-sm font-medium capitalize text-gray-700">{r.type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-2 bg-[#EF8046] rounded-full" style={{ width: `${r.rate}%` }} />
                    </div>
                    <span className="text-sm text-gray-500 w-20 text-right">{r.total} logged</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4">Based on interactions that led to a stage advancement.</p>
            </div>
          )}
        </>
      )}

      {/* Add Team Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Add Team Member</h3>
              <button onClick={() => setShowAddMember(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Name</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#EF8046]/20"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Gender</label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setAddForm(f => ({ ...f, gender: "male" }))}
                    className={`flex-1 py-2 text-sm rounded-lg border-2 font-medium transition-colors ${addForm.gender === "male" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600"}`}
                  >
                    Men's Team
                  </button>
                  <button
                    onClick={() => setAddForm(f => ({ ...f, gender: "female" }))}
                    className={`flex-1 py-2 text-sm rounded-lg border-2 font-medium transition-colors ${addForm.gender === "female" ? "border-pink-500 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600"}`}
                  >
                    Women's Team
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Email (optional)</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#EF8046]/20"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowAddMember(false)} className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={addTeamMember}
                disabled={!addForm.name.trim() || addingMember}
                className="flex-1 py-2 text-sm bg-[#EF8046] text-white rounded-lg hover:bg-[#d96a2f] disabled:opacity-50 font-medium"
              >
                {addingMember ? "Adding..." : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${highlight ? "border-red-200" : "border-gray-100"}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-sm text-gray-500">{label}</span></div>
      <div className={`text-3xl font-bold ${highlight ? "text-red-600" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}
