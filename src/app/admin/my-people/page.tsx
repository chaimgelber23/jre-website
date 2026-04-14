"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  how_met: string;
  location: string | null;
  notes: string | null;
  follow_up: string | null;
  date_met: string;
  jewish_background: string | null;
  spouse_name: string | null;
  kids: string | null;
  interests: string | null;
  created_at: string;
  updated_at: string;
}

const HOW_MET_OPTIONS = [
  { value: "shabbos", label: "Shabbos Meal" },
  { value: "event", label: "JRE Event" },
  { value: "shul", label: "Shul" },
  { value: "mutual_friend", label: "Mutual Friend" },
  { value: "community", label: "Community" },
  { value: "work", label: "Work/Professional" },
  { value: "other", label: "Other" },
];

const HOW_MET_LABELS: Record<string, string> = Object.fromEntries(
  HOW_MET_OPTIONS.map((o) => [o.value, o.label])
);

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  how_met: "shabbos",
  location: "",
  notes: "",
  follow_up: "",
  date_met: new Date().toISOString().split("T")[0],
  jewish_background: "",
  spouse_name: "",
  kids: "",
  interests: "",
};

export default function MyPeoplePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [search, setSearch] = useState("");

  // Check if already unlocked this session
  useEffect(() => {
    if (sessionStorage.getItem("my_people_unlocked") === "true") {
      setUnlocked(true);
    }
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/my-people/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setUnlocked(true);
      sessionStorage.setItem("my_people_unlocked", "true");
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  };

  if (!unlocked) {
    return (
      <div className="max-w-sm mx-auto mt-24">
        <form onSubmit={handleUnlock} className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#EF8046]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#EF8046]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">Private Page</h2>
          <p className="text-sm text-gray-400 mb-5">Enter your PIN to access</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setPinError(false); }}
            className={`w-full px-4 py-3 rounded-xl border ${pinError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-[#FAFAFA]'} text-center text-lg tracking-widest focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all mb-4`}
            placeholder="****"
            autoFocus
          />
          {pinError && <p className="text-red-500 text-sm mb-3">Wrong PIN</p>}
          <button
            type="submit"
            disabled={!pin}
            className="w-full bg-[#EF8046] text-white py-2.5 rounded-xl font-medium hover:bg-[#d96a2f] transition-colors disabled:opacity-50"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }
  const [filterHowMet, setFilterHowMet] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterHowMet) params.set("how_met", filterHowMet);

    const res = await fetch(`/api/admin/my-people?${params}`);
    const data = await res.json();

    if (res.status === 503) {
      setNeedsMigration(true);
      setLoading(false);
      return;
    }

    setContacts(data.contacts || []);
    setLoading(false);
  }, [search, filterHowMet]);

  useEffect(() => {
    const timer = setTimeout(fetchContacts, 300);
    return () => clearTimeout(timer);
  }, [fetchContacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const method = editingId ? "PATCH" : "POST";
    const body = editingId ? { id: editingId, ...form } : form;

    const res = await fetch("/api/admin/my-people", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingId(null);
      fetchContacts();
    }
    setSaving(false);
  };

  const handleEdit = (contact: Contact) => {
    setForm({
      name: contact.name,
      phone: contact.phone || "",
      email: contact.email || "",
      how_met: contact.how_met,
      location: contact.location || "",
      notes: contact.notes || "",
      follow_up: contact.follow_up || "",
      date_met: contact.date_met,
      jewish_background: contact.jewish_background || "",
      spouse_name: contact.spouse_name || "",
      kids: contact.kids || "",
      interests: contact.interests || "",
    });
    setEditingId(contact.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your list?`)) return;
    await fetch(`/api/admin/my-people?id=${id}`, { method: "DELETE" });
    fetchContacts();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const relativeDate = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr + "T12:00:00");
    const diff = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff} days ago`;
    if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  if (needsMigration) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-2xl shadow-lg text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Table Not Set Up Yet
        </h2>
        <p className="text-gray-600 mb-4">
          Run this SQL in your Supabase dashboard (SQL Editor):
        </p>
        <code className="block text-left text-xs bg-gray-100 p-4 rounded-lg overflow-auto max-h-64 mb-4">
          supabase/migrations/personal_contacts.sql
        </code>
        <button
          onClick={() => {
            setNeedsMigration(false);
            fetchContacts();
          }}
          className="bg-[#EF8046] text-white px-6 py-2 rounded-lg hover:bg-[#d96a2f] transition-colors"
        >
          I ran it, try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My People</h1>
          <p className="text-sm text-gray-500 mt-1">
            Private log — only you can see this
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setForm(EMPTY_FORM);
          }}
          className="bg-[#EF8046] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#d96a2f] transition-colors flex items-center gap-2"
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <span className="text-lg leading-none">+</span> Add Person
            </>
          )}
        </button>
      </div>

      {/* Add/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-lg p-6 mb-6 overflow-hidden"
          >
            <h3 className="font-semibold text-gray-800 mb-4">
              {editingId ? "Edit Person" : "New Person"}
            </h3>

            {/* Row 1: Name + How Met */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                  placeholder="Their name"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  How Met
                </label>
                <select
                  value={form.how_met}
                  onChange={(e) => setForm({ ...form, how_met: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                >
                  {HOW_MET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Date + Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Date Met
                </label>
                <input
                  type="date"
                  value={form.date_met}
                  onChange={(e) =>
                    setForm({ ...form, date_met: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Where (optional)
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                  placeholder="e.g. Shabbos at the Cohens"
                />
              </div>
            </div>

            {/* Row 3: Phone + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                  placeholder="(914) 555-1234"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            {/* Row 4: Spouse + Kids */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Spouse Name
                </label>
                <input
                  type="text"
                  value={form.spouse_name}
                  onChange={(e) =>
                    setForm({ ...form, spouse_name: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                  placeholder="Spouse's name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Kids
                </label>
                <input
                  type="text"
                  value={form.kids}
                  onChange={(e) => setForm({ ...form, kids: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                  placeholder="e.g. 3 kids, oldest is 12"
                />
              </div>
            </div>

            {/* Row 5: Background + Interests */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Jewish Background
                </label>
                <input
                  type="text"
                  value={form.jewish_background}
                  onChange={(e) =>
                    setForm({ ...form, jewish_background: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                  placeholder="e.g. Traditional, grew up Conservative"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Interests
                </label>
                <input
                  type="text"
                  value={form.interests}
                  onChange={(e) =>
                    setForm({ ...form, interests: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                  placeholder="e.g. Hiking, loves whiskey, tech"
                />
              </div>
            </div>

            {/* Row 6: Notes */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all resize-none"
                placeholder="Anything to remember about them..."
              />
            </div>

            {/* Row 7: Follow Up */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Follow Up
              </label>
              <input
                type="text"
                value={form.follow_up}
                onChange={(e) =>
                  setForm({ ...form, follow_up: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
                placeholder="e.g. Invite to next Shabbos, send that article"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="bg-[#EF8046] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#d96a2f] transition-colors disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Person"
                  : "Add Person"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
        />
        <select
          value={filterHowMet}
          onChange={(e) => setFilterHowMet(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-[#EF8046]/20 focus:border-[#EF8046] outline-none transition-all"
        >
          <option value="">All</option>
          {HOW_MET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Contacts List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-[#EF8046] border-t-transparent rounded-full"
          />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg mb-2">No people logged yet</p>
          <p className="text-gray-400 text-sm">
            Click &quot;Add Person&quot; to start tracking who you meet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400 mb-2">
            {contacts.length} {contacts.length === 1 ? "person" : "people"}
          </p>
          {contacts.map((c) => (
            <motion.div
              key={c.id}
              layout
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Main row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() =>
                  setExpandedId(expandedId === c.id ? null : c.id)
                }
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#EF8046]/10 flex items-center justify-center text-[#EF8046] font-bold text-sm shrink-0">
                  {c.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 truncate">
                      {c.name}
                    </span>
                    {c.spouse_name && (
                      <span className="text-xs text-gray-400">
                        &amp; {c.spouse_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {HOW_MET_LABELS[c.how_met] || c.how_met}
                    </span>
                    {c.location && (
                      <span className="truncate">{c.location}</span>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="text-right shrink-0">
                  <span className="text-xs text-gray-400">
                    {relativeDate(c.date_met)}
                  </span>
                </div>

                {/* Chevron */}
                <motion.span
                  animate={{ rotate: expandedId === c.id ? 180 : 0 }}
                  className="text-gray-300 text-sm shrink-0"
                >
                  ▼
                </motion.span>
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {expandedId === c.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-2">
                      {c.phone && (
                        <Detail label="Phone">
                          <a
                            href={`tel:${c.phone}`}
                            className="text-[#EF8046] hover:underline"
                          >
                            {c.phone}
                          </a>
                        </Detail>
                      )}
                      {c.email && (
                        <Detail label="Email">
                          <a
                            href={`mailto:${c.email}`}
                            className="text-[#EF8046] hover:underline"
                          >
                            {c.email}
                          </a>
                        </Detail>
                      )}
                      {c.jewish_background && (
                        <Detail label="Background">
                          {c.jewish_background}
                        </Detail>
                      )}
                      {c.kids && <Detail label="Kids">{c.kids}</Detail>}
                      {c.interests && (
                        <Detail label="Interests">{c.interests}</Detail>
                      )}
                      {c.notes && <Detail label="Notes">{c.notes}</Detail>}
                      {c.follow_up && (
                        <Detail label="Follow Up">
                          <span className="text-[#EF8046] font-medium">
                            {c.follow_up}
                          </span>
                        </Detail>
                      )}

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(c);
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(c.id, c.name);
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className="text-gray-700">{children}</span>
    </div>
  );
}
