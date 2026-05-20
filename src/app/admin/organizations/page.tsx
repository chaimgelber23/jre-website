"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, CheckCircle2, AlertCircle, Plus, Loader2, KeyRound, Mail, Phone, Copy, ChevronDown, ChevronUp } from "lucide-react";

type OrgStatus = "pending" | "verified" | "live" | "paused" | "archived";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  tax_id: string;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  status: OrgStatus;
  ojc_verified_at: string | null;
  ojc_last_error: string | null;
  has_ojc_key: boolean;
  created_at: string;
}

interface ListResponse {
  success: boolean;
  organizations: OrgRow[];
}

interface CreateResponse {
  success: boolean;
  error?: string;
  ojcKeyFound?: boolean;
  ojcCandidates?: unknown[];
  organization?: OrgRow & { has_ojc_key: boolean };
}

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    taxId: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "warn" | "err";
    msg: string;
    candidates?: unknown[];
  } | null>(null);
  const [manualKey, setManualKey] = useState<Record<string, string>>({});
  const [openHelp, setOpenHelp] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/organizations");
      const json = (await res.json()) as ListResponse;
      if (json.success) setOrgs(json.organizations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as CreateResponse;
      if (!json.success) {
        setFeedback({ type: "err", msg: json.error || "Could not save organization." });
        return;
      }
      if (json.ojcKeyFound) {
        setFeedback({
          type: "ok",
          msg: `${json.organization?.name} onboarded and verified with OJC. Ready to accept donations.`,
        });
      } else {
        setFeedback({
          type: "warn",
          msg: `${json.organization?.name} saved, but OJC didn't return a usable API key automatically. Paste the key OJC emailed you below.`,
          candidates: json.ojcCandidates,
        });
      }
      setForm({ name: "", slug: "", taxId: "", contactEmail: "", contactPhone: "" });
      await load();
    } catch {
      setFeedback({ type: "err", msg: "Network error. Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const saveManualKey = async (orgId: string) => {
    const key = manualKey[orgId];
    if (!key?.trim()) return;
    const res = await fetch(`/api/admin/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ojcOrgApiKey: key.trim(), status: "verified" }),
    });
    const json = await res.json();
    if (json.success) {
      setManualKey((s) => ({ ...s, [orgId]: "" }));
      await load();
    }
  };

  const setStatus = async (orgId: string, status: OrgStatus) => {
    await fetch(`/api/admin/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Building2 className="w-6 h-6 text-[#EF8046]" />
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-sm text-gray-500">
            Each campaign on thegivinghq belongs to one organization. Onboarding fetches the
            OJC Fund API key automatically from the org&apos;s EIN.
          </p>
        </div>
      </header>

      {/* Intake reminder — what to collect from a new client BEFORE filling the form */}
      <details className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900">
        <summary className="font-semibold cursor-pointer">
          Before you onboard — what to ask a new client
        </summary>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>
            <strong>Confirm they have an OJC Fund account.</strong> If not, point them to{" "}
            <a className="underline" href="https://www.ojcfund.org" target="_blank" rel="noreferrer">
              ojcfund.org
            </a>
            {" "}or 1-718-599-1400. We can&apos;t onboard them until OJC has their org on file.
          </li>
          <li>
            <strong>Legal name on file with the IRS</strong> — must match exactly what OJC has, or
            the lookup will fail.
          </li>
          <li>
            <strong>EIN (9-digit tax ID)</strong> — used to auto-fetch their OJC API key. No dashes
            needed; we strip them.
          </li>
          <li>
            <strong>Contact email + phone</strong> for the org admin so receipts and onboarding
            issues route to the right person.
          </li>
          <li>
            <strong>Logo URL (optional)</strong> — for &quot;Powered by [Org]&quot; on their campaign pages.
          </li>
        </ol>
        <p className="mt-2 text-xs">
          If OJC&apos;s automatic key lookup fails, you&apos;ll see a Pending org below with an
          &quot;Ask OJC&quot; helper that gives you a ready-to-send email for Mrs. Stein.
        </p>
      </details>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-200 rounded-2xl p-5"
      >
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Onboard a new organization
        </h2>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            required
            placeholder="Organization name (e.g. Tomchei Shabbos of Lakewood)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="URL slug (e.g. tomchei-lakewood)"
            value={form.slug}
            onChange={(e) =>
              setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
            }
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
          />
          <input
            required
            placeholder="EIN / Tax ID (9 digits, e.g. 208978145)"
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value.replace(/\D/g, "") })}
            maxLength={9}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono md:col-span-2"
          />
          <input
            type="email"
            placeholder="Contact email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="Contact phone"
            value={form.contactPhone}
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              We&apos;ll call OJC&apos;s lookup endpoint to fetch this org&apos;s API key
              automatically. If OJC can&apos;t find them, you&apos;ll be able to paste the
              key manually below.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#EF8046] hover:bg-[#d96f3b] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Onboard
            </button>
          </div>
        </form>

        {feedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              feedback.type === "ok"
                ? "bg-green-50 text-green-800 border border-green-200"
                : feedback.type === "warn"
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <div className="flex items-start gap-2">
              {feedback.type === "ok" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p>{feedback.msg}</p>
                {feedback.candidates && Array.isArray(feedback.candidates) && feedback.candidates.length > 0 && (
                  <pre className="mt-2 text-xs bg-white/60 p-2 rounded overflow-x-auto">
                    {JSON.stringify(feedback.candidates, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.section>

      <section>
        <h2 className="font-semibold mb-3">All organizations ({orgs.length})</h2>
        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : orgs.length === 0 ? (
          <div className="text-sm text-gray-500">No organizations yet.</div>
        ) : (
          <div className="space-y-3">
            {orgs.map((org) => (
              <motion.div
                key={org.id}
                layout
                className="bg-white border border-gray-200 rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{org.name}</h3>
                      <StatusBadge status={org.status} />
                      {org.has_ojc_key ? (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                          <KeyRound className="w-3 h-3" /> OJC key on file
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          <KeyRound className="w-3 h-3" /> OJC key missing
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      /{org.slug} · EIN {org.tax_id}
                    </p>
                    {org.contact_email && (
                      <p className="text-xs text-gray-500 mt-0.5">{org.contact_email}</p>
                    )}
                    {org.ojc_last_error && (
                      <p className="text-xs text-red-600 mt-1">{org.ojc_last_error}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <select
                      value={org.status}
                      onChange={(e) => setStatus(org.id, e.target.value as OrgStatus)}
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="pending">pending</option>
                      <option value="verified">verified</option>
                      <option value="live">live</option>
                      <option value="paused">paused</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>
                </div>

                {!org.has_ojc_key && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Paste OJC API key from email (e.g. SRjLgme...==)"
                        value={manualKey[org.id] ?? ""}
                        onChange={(e) => setManualKey({ ...manualKey, [org.id]: e.target.value })}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                      />
                      <button
                        onClick={() => saveManualKey(org.id)}
                        className="bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-3 py-2 rounded-lg"
                      >
                        Save key
                      </button>
                    </div>

                    <button
                      onClick={() => setOpenHelp({ ...openHelp, [org.id]: !openHelp[org.id] })}
                      className="text-xs text-blue-700 hover:underline flex items-center gap-1"
                    >
                      {openHelp[org.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      How to get this org&apos;s OJC API key
                    </button>

                    {openHelp[org.id] && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-2">
                        <p className="font-semibold text-amber-900">Contact OJC Fund:</p>
                        <div className="space-y-1 text-amber-900">
                          <p className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            <a href="mailto:mk@ojcfund.org" className="underline">mk@ojcfund.org</a>
                            {" "}(Mrs. Stein, CSR)
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            (718) 599-1400 Ext. 106 · M-F 9 AM - 5 PM ET
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            <a href="mailto:office@ojcfund.org" className="underline">office@ojcfund.org</a>
                            {" "}(general)
                          </p>
                        </div>

                        <div className="bg-white border border-amber-300 rounded p-2 mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-amber-900">Ready-to-send email:</p>
                            <button
                              onClick={() => {
                                const subject = `OJC API key request — ${org.name} (EIN ${org.tax_id})`;
                                const body = `Hi Mrs. Stein,\n\nPlease send the OJC Fund API key for the following organization so we can enable donations on their thegivinghq campaign page:\n\n- Organization: ${org.legal_name || org.name}\n- EIN / Tax ID: ${org.tax_id}\n- Contact: ${org.contact_email || "(none on file)"}\n\nThank you,\nThe JRE / thegivinghq team`;
                                const mailto = `mailto:mk@ojcfund.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                                window.location.href = mailto;
                              }}
                              className="text-[10px] bg-amber-200 hover:bg-amber-300 px-2 py-0.5 rounded font-semibold"
                            >
                              Open in mail
                            </button>
                          </div>
                          <pre className="whitespace-pre-wrap text-[11px] text-gray-700 font-sans">
{`To: mk@ojcfund.org
Subject: OJC API key request — ${org.name} (EIN ${org.tax_id})

Hi Mrs. Stein,

Please send the OJC Fund API key for the following
organization so we can enable donations on their
thegivinghq campaign page:

- Organization: ${org.legal_name || org.name}
- EIN / Tax ID: ${org.tax_id}
- Contact: ${org.contact_email || "(none on file)"}

Thank you,
The JRE / thegivinghq team`}
                          </pre>
                          <button
                            onClick={() => {
                              const text = `To: mk@ojcfund.org\nSubject: OJC API key request — ${org.name} (EIN ${org.tax_id})\n\nHi Mrs. Stein,\n\nPlease send the OJC Fund API key for the following organization so we can enable donations on their thegivinghq campaign page:\n\n- Organization: ${org.legal_name || org.name}\n- EIN / Tax ID: ${org.tax_id}\n- Contact: ${org.contact_email || "(none on file)"}\n\nThank you,\nThe JRE / thegivinghq team`;
                              navigator.clipboard.writeText(text);
                              setCopied(org.id);
                              setTimeout(() => setCopied(null), 2000);
                            }}
                            className="mt-2 text-[10px] text-blue-700 hover:underline flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            {copied === org.id ? "Copied!" : "Copy as text"}
                          </button>
                        </div>

                        <p className="text-amber-800">
                          When Mrs. Stein replies with the key (looks like{" "}
                          <span className="font-mono bg-white px-1 rounded">SRjLgme...==</span>),
                          paste it into the field above and click <strong>Save key</strong>.
                          Status flips to verified automatically — they can accept donations
                          immediately.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: OrgStatus }) {
  const styles: Record<OrgStatus, string> = {
    pending: "bg-gray-100 text-gray-700",
    verified: "bg-blue-100 text-blue-700",
    live: "bg-green-100 text-green-700",
    paused: "bg-amber-100 text-amber-700",
    archived: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${styles[status]}`}>{status}</span>
  );
}
