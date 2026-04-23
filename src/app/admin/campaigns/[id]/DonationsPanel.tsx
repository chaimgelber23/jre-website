"use client";

import { Fragment, useMemo, useState } from "react";
import { Plus, X, Check, AlertCircle, Clock, Search, StickyNote, Eye, EyeOff, Pencil } from "lucide-react";
import { formatUsd } from "@/lib/campaign";
import type {
  CampaignDonation,
  CampaignTeam,
  CampaignTier,
  CampaignCause,
  PaymentMethod,
  PaymentStatus,
  DedicationType,
} from "@/types/campaign";

interface Props {
  campaignId: string;
  donations: CampaignDonation[];
  teams: CampaignTeam[];
  tiers: CampaignTier[];
  causes: CampaignCause[];
  reload: () => void;
}

const STATUS_STYLES: Record<PaymentStatus, { label: string; className: string }> = {
  completed: { label: "Paid",     className: "bg-green-100 text-green-800 border-green-200" },
  pledged:   { label: "Pledge",   className: "bg-amber-100 text-amber-800 border-amber-200" },
  pending:   { label: "Pending",  className: "bg-gray-100 text-gray-700 border-gray-200" },
  failed:    { label: "Failed",   className: "bg-red-100 text-red-800 border-red-200" },
  refunded:  { label: "Refunded", className: "bg-gray-100 text-gray-600 border-gray-200 line-through" },
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Card",
  daf: "DAF",
  fidelity: "Fidelity",
  ojc_fund: "OJC",
  donors_fund: "TDF",
  check: "Check",
  zelle: "Zelle",
  other: "Other",
};

type StatusFilter = "all" | PaymentStatus;

export default function DonationsPanel({ campaignId, donations, teams, tiers, causes, reload }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "visible" | "hidden">("visible");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const teamById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return donations.filter((d) => {
      if (statusFilter !== "all" && d.payment_status !== statusFilter) return false;
      if (visibilityFilter === "visible" && d.is_hidden) return false;
      if (visibilityFilter === "hidden" && !d.is_hidden) return false;
      if (!q) return true;
      const hay = `${d.name} ${d.email} ${d.display_name ?? ""} ${d.message ?? ""} ${d.dedication_name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [donations, search, statusFilter, visibilityFilter]);

  const stats = useMemo(() => {
    let raisedCents = 0;
    let pledgedCents = 0;
    let failedCount = 0;
    let hiddenCount = 0;
    const byStatus: Record<string, number> = {};
    for (const d of donations) {
      if (d.is_hidden) hiddenCount += 1;
      // Totals reflect what counts publicly: completed + pledged AND not hidden.
      if (!d.is_hidden) {
        byStatus[d.payment_status] = (byStatus[d.payment_status] ?? 0) + 1;
        if (d.payment_status === "completed") raisedCents += d.amount_cents;
        if (d.payment_status === "pledged") pledgedCents += d.amount_cents;
      }
      if (d.payment_status === "failed") failedCount += 1;
    }
    return { raisedCents, pledgedCents, failedCount, hiddenCount, byStatus };
  }, [donations]);

  const patchDonation = async (donationId: string, patch: Record<string, unknown>) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/donations/${donationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Update failed");
      reload();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Update failed");
    }
  };

  return (
    <div>
      {/* ====== Stats row ====== */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <StatCard label="Paid" value={formatUsd(stats.raisedCents)} sub={`${stats.byStatus.completed ?? 0} donations`} tone="green" />
        <StatCard label="Pledged" value={formatUsd(stats.pledgedCents)} sub={`${stats.byStatus.pledged ?? 0} open`} tone="amber" />
        <StatCard label="Failed" value={String(stats.failedCount)} sub="attempts" tone="red" />
        <StatCard label="Hidden" value={String(stats.hiddenCount)} sub="off public wall" tone="gray" />
        <StatCard label="Total records" value={String(donations.length)} sub="all statuses" tone="gray" />
      </div>

      {/* ====== Toolbar ====== */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, message, dedication"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white"
        >
          <option value="all">All statuses</option>
          <option value="completed">Paid</option>
          <option value="pledged">Pledge (unpaid)</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={visibilityFilter}
          onChange={(e) => setVisibilityFilter(e.target.value as "all" | "visible" | "hidden")}
          className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white"
        >
          <option value="visible">Visible only</option>
          <option value="hidden">Hidden only</option>
          <option value="all">All (visible + hidden)</option>
        </select>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? "Cancel" : "Add pledge"}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-3 p-2.5 text-sm bg-red-50 border border-red-200 text-red-700 rounded">
          {errorMsg}
        </div>
      )}

      {showAddForm && (
        <AddPledgeForm
          campaignId={campaignId}
          teams={teams}
          tiers={tiers}
          causes={causes}
          onCancel={() => setShowAddForm(false)}
          onCreated={() => {
            setShowAddForm(false);
            reload();
          }}
        />
      )}

      {/* ====== Table ====== */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2">Donor</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Team</th>
              <th className="px-3 py-2">Dedication / Message</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">
                  No donations match the current filter.
                </td>
              </tr>
            )}
            {filtered.map((d) => {
              const statusStyle = STATUS_STYLES[d.payment_status];
              const team = d.team_id ? teamById[d.team_id] : null;
              return (
                <Fragment key={d.id}>
                <tr className={`border-b border-gray-100 last:border-0 align-top ${d.is_hidden ? "bg-blue-50/40" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{d.name}</div>
                    <div className="text-xs text-gray-500">{d.email}</div>
                    {d.phone && <div className="text-xs text-gray-500">{d.phone}</div>}
                    {d.is_anonymous && <div className="text-[10px] uppercase text-gray-400 mt-0.5">Listed as {d.display_name ?? "Anonymous"}</div>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-bold tabular-nums text-gray-900">{formatUsd(d.amount_cents)}</div>
                    {d.matched_cents > 0 && (
                      <div className="text-xs text-gray-500 tabular-nums">+{formatUsd(d.matched_cents)} match</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${statusStyle.className}`}>
                      {statusStyle.label}
                    </span>
                    {d.is_hidden && (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-blue-200 bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wide">
                        <EyeOff className="w-2.5 h-2.5" /> Hidden
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {METHOD_LABELS[d.payment_method]}
                    {d.payment_reference && <div className="text-[10px] text-gray-400 font-mono mt-0.5">{d.payment_reference}</div>}
                    {d.check_number && <div className="text-[10px] text-gray-400 mt-0.5">Check #{d.check_number}</div>}
                    {d.daf_sponsor && <div className="text-[10px] text-gray-500 mt-0.5">{d.daf_sponsor}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{team?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-700 max-w-xs">
                    {d.dedication_name && (
                      <div>
                        <span className="text-gray-500">
                          {d.dedication_type === "memory" ? "In memory of " : "In honor of "}
                        </span>
                        <span className="font-medium">{d.dedication_name}</span>
                      </div>
                    )}
                    {d.message && <div className="italic text-gray-600 line-clamp-2">&ldquo;{d.message}&rdquo;</div>}
                    {d.admin_notes && (
                      <div className="mt-1 text-[11px] text-blue-700 flex items-start gap-1">
                        <StickyNote className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{d.admin_notes}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    <div className="text-[10px] text-gray-400">
                      {new Date(d.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {d.payment_status !== "completed" && (
                        <button
                          type="button"
                          onClick={() => patchDonation(d.id, { payment_status: "completed" })}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-green-200 text-green-700 bg-white hover:bg-green-50"
                          title="Mark as paid"
                        >
                          <Check className="w-3 h-3" /> Mark paid
                        </button>
                      )}
                      {d.payment_status !== "failed" && d.payment_status !== "completed" && (
                        <button
                          type="button"
                          onClick={() => patchDonation(d.id, { payment_status: "failed" })}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-red-200 text-red-700 bg-white hover:bg-red-50"
                          title="Mark as failed"
                        >
                          <AlertCircle className="w-3 h-3" /> Failed
                        </button>
                      )}
                      {d.payment_status === "completed" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Mark as refunded?")) patchDonation(d.id, { payment_status: "refunded" });
                          }}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
                          title="Mark as refunded"
                        >
                          <Clock className="w-3 h-3" /> Refund
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingRowId(editingRowId === d.id ? null : d.id)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                        title="Edit donor / amount / team"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => patchDonation(d.id, { is_hidden: !d.is_hidden })}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${d.is_hidden ? "border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100" : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50"}`}
                        title={d.is_hidden ? "Unhide — restore to donor wall + totals" : "Hide — remove from donor wall + totals"}
                      >
                        {d.is_hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {d.is_hidden ? "Unhide" : "Hide"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(editingNoteId === d.id ? null : d.id)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <StickyNote className="w-3 h-3" /> Note
                      </button>
                    </div>

                    {editingNoteId === d.id && (
                      <NoteEditor
                        initial={d.admin_notes ?? ""}
                        onCancel={() => setEditingNoteId(null)}
                        onSave={async (note) => {
                          await patchDonation(d.id, { admin_notes: note });
                          setEditingNoteId(null);
                        }}
                      />
                    )}
                  </td>
                </tr>
                {editingRowId === d.id && (
                  <tr className="border-b border-gray-100 bg-amber-50/40">
                    <td colSpan={8} className="p-4">
                      <EditDonationForm
                        donation={d}
                        teams={teams}
                        tiers={tiers}
                        causes={causes}
                        onCancel={() => setEditingRowId(null)}
                        onSave={async (patch) => {
                          await patchDonation(d.id, patch);
                          setEditingRowId(null);
                        }}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 mt-2">
        Showing {filtered.length} of {donations.length}
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "green" | "amber" | "red" | "gray";
}) {
  const tones: Record<string, string> = {
    green: "border-green-200 bg-green-50",
    amber: "border-amber-200 bg-amber-50",
    red: "border-red-200 bg-red-50",
    gray: "border-gray-200 bg-gray-50",
  };
  return (
    <div className={`p-3 rounded-lg border ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-600 font-semibold">{label}</div>
      <div className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}

function NoteEditor({
  initial, onSave, onCancel,
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initial);
  return (
    <div className="mt-2 border border-gray-200 rounded p-2 bg-gray-50">
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        rows={2}
        placeholder="Internal note (e.g. payment expected 5/1)"
        className="w-full text-xs p-1.5 border border-gray-200 rounded bg-white resize-none"
      />
      <div className="flex gap-1 mt-1">
        <button
          type="button"
          onClick={() => onSave(val)}
          className="text-xs px-2 py-1 rounded bg-gray-900 text-white hover:bg-gray-800"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AddPledgeForm({
  campaignId, teams, tiers, causes, onCancel, onCreated,
}: {
  campaignId: string;
  teams: CampaignTeam[];
  tiers: CampaignTier[];
  causes: CampaignCause[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    amount: "",
    teamId: "",
    tierId: "",
    causeId: "",
    method: "other" as PaymentMethod,
    status: "pledged" as PaymentStatus,
    message: "",
    dedicationType: "" as "" | DedicationType,
    dedicationName: "",
    dedicationEmail: "",
    adminNotes: "",
    paymentReference: "",
    checkNumber: "",
    isAnonymous: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const amountDollars = parseFloat(form.amount);
    if (!Number.isFinite(amountDollars) || amountDollars < 1) {
      setError("Amount must be at least $1");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/donations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          amount_cents: Math.round(amountDollars * 100),
          team_id: form.teamId || null,
          tier_id: form.tierId || null,
          cause_id: form.causeId || null,
          payment_method: form.method,
          payment_status: form.status,
          is_anonymous: form.isAnonymous,
          message: form.message.trim() || null,
          dedication_type: form.dedicationType || null,
          dedication_name: form.dedicationName.trim() || null,
          dedication_email: form.dedicationEmail.trim() || null,
          admin_notes: form.adminNotes.trim() || null,
          payment_reference: form.paymentReference.trim() || null,
          check_number: form.checkNumber.trim() || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Create failed");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full px-2 py-1.5 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-gray-400";

  return (
    <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-semibold text-gray-900 mb-3">Add manual donation / pledge</div>
      {error && <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Name *"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email *"><input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>

        <Field label="Amount (USD) *">
          <input className={inputCls} type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Payment method">
          <select className={inputCls} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
            <option value="other">Other / To follow up</option>
            <option value="check">Check</option>
            <option value="zelle">Zelle</option>
            <option value="daf">DAF</option>
            <option value="fidelity">Fidelity Charitable</option>
            <option value="ojc_fund">OJC Fund</option>
            <option value="donors_fund">Donor&apos;s Fund</option>
            <option value="card">Card (already charged elsewhere)</option>
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PaymentStatus })}>
            <option value="pledged">Pledge (not paid yet)</option>
            <option value="completed">Paid</option>
            <option value="pending">Pending</option>
          </select>
        </Field>

        {teams.length > 0 && (
          <Field label="Team">
            <select className={inputCls} value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              <option value="">— no team —</option>
              {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </Field>
        )}
        {tiers.length > 0 && (
          <Field label="Tier">
            <select className={inputCls} value={form.tierId} onChange={(e) => setForm({ ...form, tierId: e.target.value })}>
              <option value="">— custom —</option>
              {tiers.map((t) => (<option key={t.id} value={t.id}>{t.label} ({formatUsd(t.amount_cents)})</option>))}
            </select>
          </Field>
        )}
        {causes.length > 0 && (
          <Field label="Cause">
            <select className={inputCls} value={form.causeId} onChange={(e) => setForm({ ...form, causeId: e.target.value })}>
              <option value="">— default —</option>
              {causes.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </Field>
        )}

        <Field label="Dedication type">
          <select className={inputCls} value={form.dedicationType} onChange={(e) => setForm({ ...form, dedicationType: e.target.value as "" | DedicationType })}>
            <option value="">None</option>
            <option value="honor">In honor of</option>
            <option value="memory">In memory of</option>
          </select>
        </Field>
        <Field label="Dedication name"><input className={inputCls} value={form.dedicationName} onChange={(e) => setForm({ ...form, dedicationName: e.target.value })} /></Field>
        <Field label="Dedication email (honoree)"><input className={inputCls} value={form.dedicationEmail} onChange={(e) => setForm({ ...form, dedicationEmail: e.target.value })} /></Field>

        {form.method === "check" && (
          <Field label="Check #"><input className={inputCls} value={form.checkNumber} onChange={(e) => setForm({ ...form, checkNumber: e.target.value })} /></Field>
        )}
        <Field label="Payment reference (optional)">
          <input className={inputCls} value={form.paymentReference} onChange={(e) => setForm({ ...form, paymentReference: e.target.value })} placeholder="external ID, transaction number, etc." />
        </Field>

        <Field label="Public wall message" span={2}>
          <textarea className={inputCls + " resize-none"} rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </Field>
        <Field label="Internal note (admin only)">
          <textarea className={inputCls + " resize-none"} rows={2} value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} placeholder="e.g. Will pay by 5/15 via Zelle" />
        </Field>

        <label className="col-span-full inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isAnonymous} onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })} />
          List on donor wall as Anonymous
        </label>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="px-4 py-2 text-sm bg-[#EF8046] text-white rounded-md font-semibold hover:bg-[#d96a2f] disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save donation"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-200 text-gray-700 rounded-md hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span === 2 ? "md:col-span-2" : undefined}>
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function EditDonationForm({
  donation, teams, tiers, causes, onCancel, onSave,
}: {
  donation: CampaignDonation;
  teams: CampaignTeam[];
  tiers: CampaignTier[];
  causes: CampaignCause[];
  onCancel: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: donation.name,
    email: donation.email,
    phone: donation.phone ?? "",
    amount: (donation.amount_cents / 100).toString(),
    teamId: donation.team_id ?? "",
    tierId: donation.tier_id ?? "",
    causeId: donation.cause_id ?? "",
    method: donation.payment_method,
    status: donation.payment_status,
    message: donation.message ?? "",
    dedicationType: (donation.dedication_type ?? "") as "" | DedicationType,
    dedicationName: donation.dedication_name ?? "",
    dedicationEmail: donation.dedication_email ?? "",
    isAnonymous: donation.is_anonymous,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const amountDollars = parseFloat(form.amount);
    if (!Number.isFinite(amountDollars) || amountDollars < 1) {
      setError("Amount must be at least $1");
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        amount_cents: Math.round(amountDollars * 100),
        team_id: form.teamId || null,
        tier_id: form.tierId || null,
        cause_id: form.causeId || null,
        payment_method: form.method,
        payment_status: form.status,
        message: form.message.trim() || null,
        dedication_type: form.dedicationType || null,
        dedication_name: form.dedicationName.trim() || null,
        dedication_email: form.dedicationEmail.trim() || null,
        is_anonymous: form.isAnonymous,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full px-2 py-1.5 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-gray-400";

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-900">Edit donation</div>
        <div className="text-[11px] text-gray-500 font-mono">{donation.id}</div>
      </div>
      {error && <div className="mb-3 p-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Name *"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email *"><input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>

        <Field label="Amount (USD) *">
          <input className={inputCls} type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Payment method">
          <select className={inputCls} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
            <option value="card">Card</option>
            <option value="check">Check</option>
            <option value="zelle">Zelle</option>
            <option value="daf">DAF</option>
            <option value="fidelity">Fidelity Charitable</option>
            <option value="ojc_fund">OJC Fund</option>
            <option value="donors_fund">Donor&apos;s Fund</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PaymentStatus })}>
            <option value="completed">Paid</option>
            <option value="pledged">Pledge</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </Field>

        {teams.length > 0 && (
          <Field label="Team">
            <select className={inputCls} value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              <option value="">— no team —</option>
              {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </Field>
        )}
        {tiers.length > 0 && (
          <Field label="Tier">
            <select className={inputCls} value={form.tierId} onChange={(e) => setForm({ ...form, tierId: e.target.value })}>
              <option value="">— custom —</option>
              {tiers.map((t) => (<option key={t.id} value={t.id}>{t.label} ({formatUsd(t.amount_cents)})</option>))}
            </select>
          </Field>
        )}
        {causes.length > 0 && (
          <Field label="Cause">
            <select className={inputCls} value={form.causeId} onChange={(e) => setForm({ ...form, causeId: e.target.value })}>
              <option value="">— default —</option>
              {causes.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </Field>
        )}

        <Field label="Dedication type">
          <select className={inputCls} value={form.dedicationType} onChange={(e) => setForm({ ...form, dedicationType: e.target.value as "" | DedicationType })}>
            <option value="">None</option>
            <option value="honor">In honor of</option>
            <option value="memory">In memory of</option>
          </select>
        </Field>
        <Field label="Dedication name"><input className={inputCls} value={form.dedicationName} onChange={(e) => setForm({ ...form, dedicationName: e.target.value })} /></Field>
        <Field label="Dedication email"><input className={inputCls} value={form.dedicationEmail} onChange={(e) => setForm({ ...form, dedicationEmail: e.target.value })} /></Field>

        <Field label="Public wall message" span={2}>
          <textarea className={inputCls + " resize-none"} rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </Field>

        <label className="col-span-full inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.isAnonymous} onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })} />
          List on donor wall as Anonymous
        </label>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="px-4 py-2 text-sm bg-[#EF8046] text-white rounded-md font-semibold hover:bg-[#d96a2f] disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-200 text-gray-700 rounded-md hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
