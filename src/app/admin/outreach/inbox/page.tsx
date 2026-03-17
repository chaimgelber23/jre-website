"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Edit2, ArrowLeft } from "lucide-react";
import { INTERACTION_LABELS } from "@/types/database";

interface PendingInteraction {
  id: string;
  type: string;
  date: string;
  notes: string | null;
  location: string | null;
  raw_input: string | null;
  confirmation_status: string;
  created_at: string;
  contact: { id: string; first_name: string; last_name: string; email: string | null } | null;
  team_member: { id: string; name: string } | null;
}

export default function InboxPage() {
  const [items, setItems] = useState<PendingInteraction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/outreach/interactions?pending_only=true")
      .then((r) => r.json())
      .then((d) => { setItems(d.interactions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function confirm(id: string) {
    await fetch(`/api/admin/outreach/interactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation_status: "confirmed" }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function dismiss(id: string) {
    await fetch(`/api/admin/outreach/interactions/${id}`, {
      method: "DELETE",
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/outreach" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Log Inbox</h1>
          <p className="text-gray-500 mt-1">Interactions parsed by AI from emails — confirm or correct before they're final.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">All clear!</p>
          <p className="text-sm mt-1">No pending interactions to review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-yellow-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {item.contact
                        ? `${item.contact.first_name} ${item.contact.last_name}`
                        : "Unknown Contact"}
                    </span>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      {INTERACTION_LABELS[item.type as keyof typeof INTERACTION_LABELS] || item.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    {item.team_member && (
                      <span className="text-xs text-gray-400">logged by {item.team_member.name}</span>
                    )}
                  </div>
                  {item.notes && <p className="text-sm text-gray-700">"{item.notes}"</p>}
                  {item.location && <p className="text-xs text-gray-400">@ {item.location}</p>}
                  {item.raw_input && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-400 cursor-pointer">Show original message</summary>
                      <pre className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mt-1 whitespace-pre-wrap">{item.raw_input}</pre>
                    </details>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {item.contact && (
                    <Link
                      href={`/admin/outreach/${item.contact.id}`}
                      className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </Link>
                  )}
                  <button
                    onClick={() => dismiss(item.id)}
                    className="flex items-center gap-1.5 text-sm text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                  <button
                    onClick={() => confirm(item.id)}
                    className="flex items-center gap-1.5 text-sm text-white bg-green-600 px-3 py-1.5 rounded-lg hover:bg-green-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
