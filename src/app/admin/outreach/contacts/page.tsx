"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, Users, ArrowLeft, ChevronRight } from "lucide-react";
import { STAGE_LABELS, INTERACTION_LABELS } from "@/types/database";
import type { OutreachStage } from "@/types/database";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: string;
  stage: OutreachStage;
  group_name: string | null;
  assigned_member?: { id: string; name: string } | null;
  last_interaction_date: string | null;
  last_interaction_type: string | null;
  interaction_count: number;
  next_followup_date: string | null;
  engagement_score: number;
}

interface TeamMember {
  id: string;
  name: string;
  gender: string;
}

const STAGE_COLORS: Record<string, string> = {
  new_contact:     "bg-gray-100 text-gray-700",
  in_touch:        "bg-blue-100 text-blue-700",
  event_connected: "bg-purple-100 text-purple-700",
  deepening:       "bg-orange-100 text-orange-700",
  learning:        "bg-yellow-100 text-yellow-700",
  inner_circle:    "bg-green-100 text-green-700",
  multiplying:     "bg-emerald-100 text-emerald-700",
};

function GenderDot({ gender }: { gender: string }) {
  if (gender === "male")   return <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1.5 shrink-0" title="Male" />;
  if (gender === "female") return <span className="inline-block w-2 h-2 rounded-full bg-pink-400 mr-1.5 shrink-0" title="Female" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-1.5 shrink-0" title="Unknown" />;
}

function relativeDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function ContactsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [groups, setGroups]         = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);

  // Search with debounce
  const [searchInput, setSearchInput]   = useState("");
  const [search, setSearch]             = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stage, setStage]         = useState(searchParams.get("stage") || "");
  const [gender, setGender]       = useState(searchParams.get("gender") || "");
  const [group, setGroup]         = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [overdue, setOverdue]     = useState(searchParams.get("overdue") === "true");
  const [page, setPage]           = useState(1);

  // Debounce search input
  function handleSearchInput(val: string) {
    setSearchInput(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 300);
  }

  // Load filters data
  useEffect(() => {
    fetch("/api/admin/outreach/groups")
      .then(r => r.json())
      .then(d => setGroups(d.groups || []))
      .catch(() => {});
    fetch("/api/admin/outreach/team")
      .then(r => r.json())
      .then(d => setTeamMembers(d.members || []))
      .catch(() => {});
  }, []);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search)     params.set("search", search);
    if (stage)      params.set("stage", stage);
    if (gender)     params.set("gender", gender);
    if (group)      params.set("group", group);
    if (assignedTo) params.set("assigned_to", assignedTo);
    if (overdue)    params.set("overdue", "true");
    params.set("page", String(page));

    const res = await fetch(`/api/admin/outreach?${params}`);
    const data = await res.json();
    setContacts(data.contacts || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [search, stage, gender, group, assignedTo, overdue, page]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  function clearAll() {
    setSearchInput(""); setSearch(""); setStage(""); setGender("");
    setGroup(""); setAssignedTo(""); setOverdue(false); setPage(1);
  }

  const hasFilters = search || stage || gender || group || assignedTo || overdue;
  const maleCount   = contacts.filter(c => c.gender === "male").length;
  const femaleCount = contacts.filter(c => c.gender === "female").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/outreach" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
            <p className="text-gray-500 mt-0.5 text-sm">
              {total} total
              {!gender && (
                <span className="ml-3">
                  <span className="text-blue-500">● {maleCount} men</span>
                  <span className="mx-1 text-gray-300">·</span>
                  <span className="text-pink-500">● {femaleCount} women</span>
                </span>
              )}
            </p>
          </div>
        </div>
        <Link href="/admin/outreach/contacts/new" className="flex items-center gap-2 px-4 py-2 text-sm bg-[#EF8046] text-white rounded-lg hover:bg-[#d96a2f] transition-colors">
          <Plus className="w-4 h-4" />
          Add Contact
        </Link>
      </div>

      {/* Gender quick-toggle pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setGender(""); setPage(1); }} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${!gender ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
          Everyone
        </button>
        <button onClick={() => { setGender("male"); setPage(1); }} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${gender === "male" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          Men's
        </button>
        <button onClick={() => { setGender("female"); setPage(1); }} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${gender === "female" ? "bg-pink-600 text-white" : "bg-pink-50 text-pink-700 hover:bg-pink-100"}`}>
          <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
          Women's
        </button>

        {groups.length > 0 && (
          <>
            <span className="text-gray-200 mx-1">|</span>
            {groups.map(g => (
              <button
                key={g}
                onClick={() => { setGroup(group === g ? "" : g); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${group === g ? "bg-[#EF8046] text-white" : "bg-orange-50 text-orange-700 hover:bg-orange-100"}`}
              >
                <Users className="w-3.5 h-3.5" />
                {g}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Smart search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, email, phone..."
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8046]/20 w-64"
          />
        </div>

        {/* Stage filter */}
        <select
          value={stage}
          onChange={e => { setStage(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#EF8046]/20"
        >
          <option value="">All Stages</option>
          {Object.entries(STAGE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        {/* Assigned to filter */}
        {teamMembers.length > 0 && (
          <select
            value={assignedTo}
            onChange={e => { setAssignedTo(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#EF8046]/20"
          >
            <option value="">All Team Members</option>
            {teamMembers.filter(m => m.gender === "male").length > 0 && (
              <optgroup label="Men's Team">
                {teamMembers.filter(m => m.gender === "male").map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            )}
            {teamMembers.filter(m => m.gender === "female").length > 0 && (
              <optgroup label="Women's Team">
                {teamMembers.filter(m => m.gender === "female").map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        )}

        {/* Overdue toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={overdue}
            onChange={e => { setOverdue(e.target.checked); setPage(1); }}
            className="rounded"
          />
          Overdue only
        </label>

        {hasFilters && (
          <button onClick={clearAll} className="text-sm text-gray-400 hover:text-gray-600">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No contacts found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Stage</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Crew</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Assigned To</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Last Contact</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Interactions</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const daysAgo = c.last_interaction_date
                  ? Math.floor((Date.now() - new Date(c.last_interaction_date).getTime()) / 86400000)
                  : 999;
                const isOverdue = daysAgo >= 30;

                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/admin/outreach/${c.id}`)}
                    className="border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center">
                        <GenderDot gender={c.gender} />
                        <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5 pl-3.5">{c.email || c.phone || ""}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[c.stage] || "bg-gray-100 text-gray-600"}`}>
                        {STAGE_LABELS[c.stage] || c.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {c.group_name ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">{c.group_name}</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 text-sm">
                      {c.assigned_member?.name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={isOverdue ? "text-red-600 font-medium" : "text-gray-600"}>
                        {relativeDate(c.last_interaction_date)}
                      </span>
                      {c.last_interaction_type && (
                        <span className="text-gray-400 text-xs ml-1">
                          ({INTERACTION_LABELS[c.last_interaction_type as keyof typeof INTERACTION_LABELS] || c.last_interaction_type})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">{c.interaction_count || 0}</td>
                    <td className="px-4 py-3.5">
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#EF8046]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {total > 50 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Prev</button>
              <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
