"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit2, Save, X, Plus } from "lucide-react";
import { STAGE_LABELS, INTERACTION_LABELS } from "@/types/database";
import type { OutreachStage, OutreachInteractionType } from "@/types/database";

interface TeamMember {
  id: string;
  name: string;
  gender: string;
}

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  gender: string;
  stage: OutreachStage;
  assigned_to: string | null;
  assigned_member?: { id: string; name: string; gender: string } | null;
  background: string | null;
  how_met: string | null;
  spouse_name: string | null;
  next_followup_date: string | null;
  source: string;
  engagement_score: number;
  created_at: string;
  interactions: Array<{
    id: string;
    type: OutreachInteractionType;
    date: string;
    notes: string | null;
    location: string | null;
    stage_before: string | null;
    stage_after: string | null;
    donation_amount: number | null;
    confirmation_status: string;
    created_at: string;
  }>;
}

const TYPE_COLORS: Record<string, string> = {
  met:      "bg-gray-100 text-gray-700",
  call:     "bg-blue-100 text-blue-700",
  text:     "bg-sky-100 text-sky-700",
  coffee:   "bg-amber-100 text-amber-800",
  shabbos:  "bg-indigo-100 text-indigo-700",
  event:    "bg-purple-100 text-purple-700",
  learning: "bg-yellow-100 text-yellow-800",
  email:    "bg-slate-100 text-slate-700",
  donation: "bg-green-100 text-green-700",
  other:    "bg-gray-100 text-gray-600",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  unknown: "Unknown",
};

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contact, setContact]     = useState<Contact | null>(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [editData, setEditData]   = useState<Partial<Contact>>({});
  const [saving, setSaving]       = useState(false);
  const [showLogForm, setShowLogForm] = useState(false);
  const [logForm, setLogForm]     = useState({ type: "coffee", date: new Date().toISOString().split("T")[0], notes: "", location: "" });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    fetch(`/api/admin/outreach/${id}`)
      .then(r => r.json())
      .then(d => { setContact(d.contact); setEditData(d.contact); setLoading(false); })
      .catch(() => setLoading(false));

    fetch("/api/admin/outreach/team")
      .then(r => r.json())
      .then(d => setTeamMembers(d.members || []))
      .catch(() => {});
  }, [id]);

  async function saveContact() {
    setSaving(true);
    const res = await fetch(`/api/admin/outreach/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    const data = await res.json();
    setContact(prev => ({ ...prev!, ...data.contact }));
    setEditing(false);
    setSaving(false);
  }

  async function logInteraction() {
    if (!logForm.type) return;
    const res = await fetch("/api/admin/outreach/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact_id: id, ...logForm }),
    });
    const data = await res.json();
    if (data.interaction) {
      setContact(prev => prev ? {
        ...prev,
        interactions: [data.interaction, ...prev.interactions],
      } : prev);
      setShowLogForm(false);
      setLogForm({ type: "coffee", date: new Date().toISOString().split("T")[0], notes: "", location: "" });
    }
  }

  if (loading) return <div className="text-center py-20 text-gray-400">Loading...</div>;
  if (!contact) return <div className="text-center py-20 text-red-500">Contact not found.</div>;

  const menTeam   = teamMembers.filter(m => m.gender === "male");
  const womenTeam = teamMembers.filter(m => m.gender === "female");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/outreach/contacts" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editData.first_name || ""}
                onChange={e => setEditData(p => ({ ...p, first_name: e.target.value }))}
                placeholder="First name"
                className="text-lg font-bold text-gray-900 border-b-2 border-[#EF8046] outline-none bg-transparent w-32"
              />
              <input
                type="text"
                value={editData.last_name || ""}
                onChange={e => setEditData(p => ({ ...p, last_name: e.target.value }))}
                placeholder="Last name"
                className="text-lg font-bold text-gray-900 border-b-2 border-[#EF8046] outline-none bg-transparent w-36"
              />
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-gray-900">{contact.first_name} {contact.last_name}</h1>
          )}
          <p className="text-gray-500 text-sm mt-0.5">
            {STAGE_LABELS[contact.stage]} · Score {contact.engagement_score}
            {contact.assigned_member && (
              <span className="ml-2 text-gray-400">· {contact.assigned_member.name}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => editing ? saveContact() : setEditing(true)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-[#EF8046] text-white rounded-lg hover:bg-[#d96a2f] transition-colors disabled:opacity-60"
        >
          {editing ? <><Save className="w-4 h-4" /> Save</> : <><Edit2 className="w-4 h-4" /> Edit</>}
        </button>
        {editing && (
          <button onClick={() => { setEditing(false); setEditData(contact); }} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email" value={contact.email} editing={editing} editValue={editData.email || ""} onChange={v => setEditData(p => ({ ...p, email: v }))} />
          <Field label="Phone" value={contact.phone} editing={editing} editValue={editData.phone || ""} onChange={v => setEditData(p => ({ ...p, phone: v }))} />
          <Field label="Spouse" value={contact.spouse_name} editing={editing} editValue={editData.spouse_name || ""} onChange={v => setEditData(p => ({ ...p, spouse_name: v }))} />
          <Field label="How Met" value={contact.how_met} editing={editing} editValue={editData.how_met || ""} onChange={v => setEditData(p => ({ ...p, how_met: v }))} />
        </div>

        {/* Gender, Stage, Assigned To */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Gender</label>
            {editing ? (
              <select
                value={editData.gender || ""}
                onChange={e => setEditData(p => ({ ...p, gender: e.target.value }))}
                className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unknown">Unknown</option>
              </select>
            ) : (
              <p className="mt-1 text-sm text-gray-700 flex items-center gap-1.5">
                {GENDER_LABELS[contact.gender] || contact.gender}
                <span className={`w-2 h-2 rounded-full ${contact.gender === "male" ? "bg-blue-400" : contact.gender === "female" ? "bg-pink-400" : "bg-gray-300"}`} />
              </p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Stage</label>
            {editing ? (
              <select
                value={editData.stage}
                onChange={e => setEditData(p => ({ ...p, stage: e.target.value as OutreachStage }))}
                className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              >
                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-sm text-gray-700">{STAGE_LABELS[contact.stage]}</p>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Assigned To</label>
            {editing ? (
              <select
                value={editData.assigned_to || ""}
                onChange={e => setEditData(p => ({ ...p, assigned_to: e.target.value || null }))}
                className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="">Unassigned</option>
                {menTeam.length > 0 && (
                  <optgroup label="Men's Team">
                    {menTeam.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>
                )}
                {womenTeam.length > 0 && (
                  <optgroup label="Women's Team">
                    {womenTeam.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>
                )}
              </select>
            ) : (
              <p className="mt-1 text-sm text-gray-700">
                {contact.assigned_member?.name || <span className="text-gray-300">—</span>}
              </p>
            )}
          </div>
        </div>

        {/* Follow-up date */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Next Follow-up</label>
          {editing ? (
            <input
              type="date"
              value={editData.next_followup_date ? editData.next_followup_date.split("T")[0] : ""}
              onChange={e => setEditData(p => ({ ...p, next_followup_date: e.target.value || null }))}
              className="mt-1 block text-sm border border-gray-200 rounded-lg px-3 py-2"
            />
          ) : (
            <p className="mt-1 text-sm text-gray-700">
              {contact.next_followup_date
                ? new Date(contact.next_followup_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : <span className="text-gray-300">—</span>}
            </p>
          )}
        </div>

        {/* Background */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Background / Notes</label>
          {editing ? (
            <textarea
              value={editData.background || ""}
              onChange={e => setEditData(p => ({ ...p, background: e.target.value }))}
              rows={3}
              className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none"
            />
          ) : (
            <p className="mt-1 text-sm text-gray-700">{contact.background || <span className="text-gray-300">—</span>}</p>
          )}
        </div>

        {/* Meta */}
        <div className="pt-2 border-t border-gray-50 flex gap-6 text-xs text-gray-400">
          <span>Source: {contact.source}</span>
          <span>Added: {new Date(contact.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>

      {/* Interaction Log */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Interaction Log ({contact.interactions.length})</h2>
          <button
            onClick={() => setShowLogForm(!showLogForm)}
            className="flex items-center gap-1.5 text-sm text-[#EF8046] hover:text-[#d96a2f]"
          >
            <Plus className="w-4 h-4" />
            Log Interaction
          </button>
        </div>

        {showLogForm && (
          <div className="mb-4 p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Type</label>
                <select value={logForm.type} onChange={e => setLogForm(p => ({ ...p, type: e.target.value }))} className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2">
                  {Object.entries(INTERACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Date</label>
                <input type="date" value={logForm.date} onChange={e => setLogForm(p => ({ ...p, date: e.target.value }))} className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500">Location (optional)</label>
              <input type="text" value={logForm.location} onChange={e => setLogForm(p => ({ ...p, location: e.target.value }))} placeholder="Where did you meet?" className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Notes</label>
              <input type="text" value={logForm.notes} onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} placeholder="What happened? Key observations..." className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowLogForm(false)} className="text-sm text-gray-500 px-3 py-1.5">Cancel</button>
              <button onClick={logInteraction} className="text-sm bg-[#EF8046] text-white px-4 py-1.5 rounded-lg hover:bg-[#d96a2f]">Save</button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {contact.interactions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No interactions logged yet.</p>
          ) : contact.interactions.map((i) => (
            <div key={i.id} className="flex gap-3">
              <div className="mt-1 shrink-0">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[i.type] || "bg-gray-100 text-gray-600"}`}>
                  {INTERACTION_LABELS[i.type] || i.type}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">{new Date(i.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  {i.location && <span className="text-xs text-gray-400">@ {i.location}</span>}
                  {i.confirmation_status === "pending" && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Pending</span>}
                </div>
                {i.notes && <p className="text-sm text-gray-600 mt-0.5">{i.notes}</p>}
                {i.donation_amount && <p className="text-sm text-green-700 mt-0.5">Donated ${i.donation_amount.toFixed(2)}</p>}
                {i.stage_after && i.stage_before !== i.stage_after && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Stage: {STAGE_LABELS[i.stage_before as OutreachStage] || i.stage_before} → {STAGE_LABELS[i.stage_after as OutreachStage] || i.stage_after}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, editing, editValue, onChange }: {
  label: string; value: string | null; editing: boolean; editValue: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wide">{label}</label>
      {editing ? (
        <input type="text" value={editValue} onChange={e => onChange(e.target.value)} className="mt-1 block w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
      ) : (
        <p className="mt-1 text-sm text-gray-700">{value || <span className="text-gray-300">—</span>}</p>
      )}
    </div>
  );
}
