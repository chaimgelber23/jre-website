"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Save, Trash2, Plus, Check, Loader2, AlertCircle } from "lucide-react";
import DonationsPanel from "./DonationsPanel";
import type {
  Campaign, CampaignTier, CampaignCause, CampaignMatcher, CampaignTeam,
  CampaignDonation, FaqEntry,
} from "@/types/campaign";

interface LoadPayload {
  campaign: Campaign;
  causes: CampaignCause[];
  tiers: CampaignTier[];
  matchers: CampaignMatcher[];
  teams: CampaignTeam[];
  donations: CampaignDonation[];
  progress: { raised_cents: number; matched_cents: number; donor_count: number } | null;
}

export default function AdminCampaignEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<LoadPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`/api/admin/campaigns/${id}`);
    const json = await res.json();
    if (json.success) setData(json as LoadPayload);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!data) return <div className="p-10 text-sm text-gray-500">Loading...</div>;
  const { campaign } = data;

  const save = async (patch: Partial<Campaign>) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMsg("Saved ✓");
      setTimeout(() => setMsg(null), 1500);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-6 py-8 pb-24">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <Link href="/admin/campaigns" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> All campaigns
        </Link>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-gray-600">{msg}</span>}
          <Link
            href={`/campaign/${campaign.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#EF8046]"
          >
            View page <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{campaign.title}</h1>
      <div className="text-sm text-gray-500 mb-8">/campaign/{campaign.slug}</div>

      {/* Core fields */}
      <Section title="Core details">
        <CoreEditor campaign={campaign} onSave={save} saving={saving} />
      </Section>

      <Section title="Story">
        <StoryEditor campaign={campaign} onSave={save} saving={saving} />
      </Section>

      <Section title="Causes (Donor Fund / OJC Fund split)">
        <CollectionEditor
          campaignId={id}
          collection="causes"
          rows={data.causes}
          reload={load}
          fields={[
            { name: "slug", label: "Slug", type: "text" },
            { name: "name", label: "Name", type: "text" },
            { name: "description", label: "Description", type: "text" },
            { name: "sort_order", label: "Order", type: "number" },
          ]}
          defaults={{ slug: "", name: "", description: "", sort_order: 0 }}
        />
      </Section>

      <Section title="Giving tiers">
        <CollectionEditor
          campaignId={id}
          collection="tiers"
          rows={data.tiers}
          reload={load}
          fields={[
            { name: "amount_cents", label: "Amount", type: "dollars" },
            { name: "label", label: "Label", type: "text" },
            { name: "description", label: "Description", type: "text" },
            { name: "hebrew_value", label: "Hebrew", type: "text" },
            { name: "is_featured", label: "Featured?", type: "boolean" },
            { name: "sort_order", label: "Order", type: "number" },
          ]}
          defaults={{
            amount_cents: 3600, label: "", description: "",
            hebrew_value: "", is_featured: false, sort_order: 0,
          }}
        />
      </Section>

      <Section title="Matchers">
        <CollectionEditor
          campaignId={id}
          collection="matchers"
          rows={data.matchers}
          reload={load}
          fields={[
            { name: "name", label: "Matcher name", type: "text" },
            { name: "multiplier", label: "Multiplier (e.g. 2, 3)", type: "number" },
            { name: "cap_cents", label: "Cap (blank=uncapped)", type: "dollars" },
            { name: "logo_url", label: "Logo URL", type: "text" },
            { name: "story", label: "Story", type: "text" },
            { name: "is_active", label: "Active?", type: "boolean" },
            { name: "sort_order", label: "Order", type: "number" },
          ]}
          defaults={{ name: "", multiplier: 2, cap_cents: null, logo_url: "", story: "", is_active: true, sort_order: 0 }}
        />
      </Section>

      <Section title="Teams">
        <div className="text-xs text-gray-500 mb-3">
          Each team has its own fundraising goal. Captains can message you their number
          — you paste it here in dollars (no zeros padding).
        </div>
        <CollectionEditor
          campaignId={id}
          collection="teams"
          rows={data.teams}
          reload={load}
          fields={[
            { name: "slug", label: "Slug", type: "text" },
            { name: "name", label: "Team name", type: "text" },
            { name: "leader_name", label: "Captain", type: "text" },
            { name: "leader_email", label: "Captain email", type: "text" },
            { name: "goal_cents", label: "Team goal", type: "dollars" },
            { name: "avatar_url", label: "Avatar / photo URL", type: "text" },
            { name: "story", label: "Team story", type: "textarea" },
            { name: "is_active", label: "Active?", type: "boolean" },
            { name: "sort_order", label: "Order", type: "number" },
          ]}
          defaults={{ slug: "", name: "", leader_name: "", leader_email: "", goal_cents: null, avatar_url: "", story: "", is_active: true, sort_order: 0 }}
        />
      </Section>

      <Section title="FAQ">
        <FaqEditor campaign={campaign} onSave={save} saving={saving} />
      </Section>

      <Section title={`Donations (${data.donations.length})`}>
        <DonationsPanel
          campaignId={id}
          donations={data.donations}
          teams={data.teams}
          tiers={data.tiers}
          causes={data.causes}
          reload={load}
        />
      </Section>
    </div>
  );
}

// ----------------- sections -----------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 shadow-sm">
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  );
}

function CoreEditor({
  campaign, onSave, saving,
}: { campaign: Campaign; onSave: (p: Partial<Campaign>) => void; saving: boolean }) {
  const [f, setF] = useState({
    title: campaign.title,
    tagline: campaign.tagline ?? "",
    slug: campaign.slug,
    goal_cents: campaign.goal_cents,
    status: campaign.status,
    start_at: campaign.start_at.slice(0, 16),
    end_at: campaign.end_at.slice(0, 16),
    hero_image_url: campaign.hero_image_url ?? "",
    video_url: campaign.video_url ?? "",
    theme_color: campaign.theme_color ?? "",
    share_text: campaign.share_text ?? "",
    allow_anonymous: campaign.allow_anonymous,
    allow_dedication: campaign.allow_dedication,
    allow_team: campaign.allow_team,
  });

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Title"><input className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Slug"><input className={inputCls} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} /></Field>
      <Field label="Tagline" full><input className={inputCls} value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></Field>
      <Field label="Goal (dollars)"><input type="number" className={inputCls} value={Math.round(f.goal_cents / 100)} onChange={(e) => setF({ ...f, goal_cents: Math.round(Number(e.target.value) * 100) })} /></Field>
      <Field label="Status">
        <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Campaign["status"] })}>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="live">Live</option>
          <option value="ended">Ended</option>
          <option value="archived">Archived</option>
        </select>
      </Field>
      <Field label="Start (datetime)"><input type="datetime-local" className={inputCls} value={f.start_at} onChange={(e) => setF({ ...f, start_at: e.target.value })} /></Field>
      <Field label="End (datetime)"><input type="datetime-local" className={inputCls} value={f.end_at} onChange={(e) => setF({ ...f, end_at: e.target.value })} /></Field>
      <Field label="Hero image URL" full><input className={inputCls} value={f.hero_image_url} onChange={(e) => setF({ ...f, hero_image_url: e.target.value })} /></Field>
      <Field label="Video URL (embed)" full><input className={inputCls} value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} /></Field>
      <Field label="Share text" full><input className={inputCls} value={f.share_text} onChange={(e) => setF({ ...f, share_text: e.target.value })} /></Field>
      <div className="sm:col-span-2 flex items-center gap-4 text-sm text-gray-700 pt-2">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.allow_anonymous} onChange={(e) => setF({ ...f, allow_anonymous: e.target.checked })} /> Allow anonymous</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.allow_dedication} onChange={(e) => setF({ ...f, allow_dedication: e.target.checked })} /> Allow dedication</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.allow_team} onChange={(e) => setF({ ...f, allow_team: e.target.checked })} /> Allow teams</label>
      </div>
      <div className="sm:col-span-2">
        <button
          onClick={() => onSave({
            title: f.title, tagline: f.tagline || null, slug: f.slug, goal_cents: f.goal_cents,
            status: f.status, start_at: new Date(f.start_at).toISOString(), end_at: new Date(f.end_at).toISOString(),
            hero_image_url: f.hero_image_url || null, video_url: f.video_url || null,
            share_text: f.share_text || null, allow_anonymous: f.allow_anonymous,
            allow_dedication: f.allow_dedication, allow_team: f.allow_team,
          })}
          disabled={saving}
          className="mt-3 inline-flex items-center gap-2 bg-[#EF8046] hover:bg-[#d96a2f] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Save
        </button>
      </div>
    </div>
  );
}

function StoryEditor({
  campaign, onSave, saving,
}: { campaign: Campaign; onSave: (p: Partial<Campaign>) => void; saving: boolean }) {
  const [story, setStory] = useState(campaign.story_md ?? "");
  return (
    <div>
      <textarea
        value={story}
        onChange={(e) => setStory(e.target.value)}
        rows={10}
        placeholder="The mission, the why, the stakes. Plain text — line breaks preserved."
        className={`${inputCls} font-mono`}
      />
      <button
        onClick={() => onSave({ story_md: story || null })}
        disabled={saving}
        className="mt-3 inline-flex items-center gap-2 bg-[#EF8046] hover:bg-[#d96a2f] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
      >
        <Save className="w-4 h-4" /> Save story
      </button>
    </div>
  );
}

function FaqEditor({
  campaign, onSave, saving,
}: { campaign: Campaign; onSave: (p: Partial<Campaign>) => void; saving: boolean }) {
  const [faq, setFaq] = useState<FaqEntry[]>(campaign.faq ?? []);
  const update = (i: number, k: "q" | "a", v: string) => {
    setFaq(faq.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
  };
  return (
    <div className="space-y-3">
      {faq.map((entry, i) => (
        <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
          <input value={entry.q} onChange={(e) => update(i, "q", e.target.value)} placeholder="Question" className={inputCls} />
          <textarea value={entry.a} onChange={(e) => update(i, "a", e.target.value)} placeholder="Answer" rows={3} className={inputCls} />
          <button onClick={() => setFaq(faq.filter((_, idx) => idx !== i))} className="text-xs text-red-600 inline-flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        </div>
      ))}
      <button
        onClick={() => setFaq([...faq, { q: "", a: "" }])}
        className="inline-flex items-center gap-1 text-sm text-[#EF8046] font-semibold"
      >
        <Plus className="w-4 h-4" /> Add question
      </button>
      <div>
        <button
          onClick={() => onSave({ faq })}
          disabled={saving}
          className="mt-2 inline-flex items-center gap-2 bg-[#EF8046] hover:bg-[#d96a2f] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> Save FAQ
        </button>
      </div>
    </div>
  );
}

interface CollectionField {
  name: string;
  label: string;
  /**
   * "dollars" is stored as cents in the DB but displayed / edited in whole
   * dollars. "textarea" renders a multi-line input. Everything else is a
   * straight text/number/checkbox.
   */
  type: "text" | "number" | "boolean" | "dollars" | "textarea";
}

type Row = { id?: string } & Record<string, unknown>;
type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function CollectionEditor({
  campaignId, collection, rows, reload, fields, defaults,
}: {
  campaignId: string;
  collection: string;
  rows: readonly unknown[];
  reload: () => void;
  fields: CollectionField[];
  defaults: Record<string, unknown>;
}) {
  const typed = rows as Row[];
  // Local mirror of row data. Users edit fields inline; nothing persists until Save.
  const [localRows, setLocalRows] = useState<Record<string, Row>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<Record<string, unknown> | null>(null);

  // Refresh local mirror from server rows, but don't clobber rows the user is
  // currently editing (state === "dirty" means unsaved local changes).
  useEffect(() => {
    setLocalRows((prev) => {
      const next: Record<string, Row> = { ...prev };
      for (const r of typed) {
        if (!r.id) continue;
        if (saveStates[r.id] === "dirty" || saveStates[r.id] === "saving") continue;
        next[r.id] = { ...r };
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const setSaveState = (id: string, s: SaveState, err?: string) => {
    setSaveStates((prev) => ({ ...prev, [id]: s }));
    if (err !== undefined) setErrors((prev) => ({ ...prev, [id]: err }));
  };

  const onField = (id: string, name: string, value: unknown) => {
    setLocalRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), [name]: value } }));
    setSaveState(id, "dirty", "");
  };

  const saveRow = async (id: string) => {
    const row = localRows[id];
    if (!row) return;
    setSaveState(id, "saving", "");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/${collection}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Save failed");
      setSaveState(id, "saved");
      setTimeout(() => setSaveStates((p) => (p[id] === "saved" ? { ...p, [id]: "idle" } : p)), 1800);
      reload();
    } catch (e) {
      setSaveState(id, "error", e instanceof Error ? e.message : "Save failed");
    }
  };

  const resetRow = (id: string) => {
    const serverRow = typed.find((r) => r.id === id);
    if (serverRow) {
      setLocalRows((prev) => ({ ...prev, [id]: { ...serverRow } }));
      setSaveState(id, "idle", "");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this row?")) return;
    const res = await fetch(`/api/admin/campaigns/${campaignId}/${collection}?row_id=${id}`, { method: "DELETE" });
    if ((await res.json()).success) reload();
  };
  const create = async () => {
    if (!creating) return;
    const res = await fetch(`/api/admin/campaigns/${campaignId}/${collection}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creating),
    });
    const json = await res.json();
    if (json.success) { setCreating(null); reload(); }
  };

  const renderField = (obj: Record<string, unknown>, f: CollectionField, onChange: (v: unknown) => void) => {
    const v = obj[f.name];
    if (f.type === "boolean") {
      return (
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(v)} onChange={(e) => onChange(e.target.checked)} /> {f.label}
        </label>
      );
    }
    if (f.type === "dollars") {
      const dollars = v == null ? "" : String(Math.round((v as number) / 100));
      return (
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">{f.label}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              value={dollars}
              onChange={(e) => {
                const raw = e.target.value;
                onChange(raw === "" ? null : Math.round(Number(raw) * 100));
              }}
              placeholder="0"
              className={`${inputCls} pl-7`}
            />
          </div>
        </div>
      );
    }
    if (f.type === "textarea") {
      return (
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">{f.label}</label>
          <textarea
            value={v == null ? "" : String(v)}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </div>
      );
    }
    return (
      <div>
        <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">{f.label}</label>
        <input
          type={f.type === "number" ? "number" : "text"}
          value={v == null ? "" : String(v)}
          onChange={(e) => {
            if (f.type === "number") onChange(e.target.value === "" ? null : Number(e.target.value));
            else onChange(e.target.value);
          }}
          className={inputCls}
        />
      </div>
    );
  };

  return (
    <div>
      <div className="space-y-2 mb-3">
        {typed.map((r) => {
          const rowId = r.id as string;
          const rowData = localRows[rowId] ?? r;
          const state: SaveState = saveStates[rowId] ?? "idle";
          const err = errors[rowId];
          const isDirty = state === "dirty" || state === "error";
          const isSaving = state === "saving";
          return (
            <div
              key={rowId}
              className={`border rounded-xl p-3 transition-colors ${
                isDirty ? "border-[#EF8046]/40 bg-[#FFF8F3]" : "border-gray-200"
              }`}
            >
              <div className="grid sm:grid-cols-3 gap-3">
                {fields.map((f) => (
                  <div key={f.name} className={f.type === "boolean" ? "self-end" : ""}>
                    {renderField(
                      rowData as Record<string, unknown>,
                      f,
                      (v) => onField(rowId, f.name, v)
                    )}
                  </div>
                ))}
                <div className="sm:col-span-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs">
                    {state === "saving" && (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" /><span className="text-gray-500">Saving…</span></>
                    )}
                    {state === "saved" && (
                      <><Check className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700">Saved — live on the site</span></>
                    )}
                    {state === "error" && (
                      <><AlertCircle className="w-3.5 h-3.5 text-red-600" /><span className="text-red-700">{err || "Save failed"}</span></>
                    )}
                    {state === "dirty" && (
                      <span className="text-[#EF8046] font-medium">Unsaved changes</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <button
                        type="button"
                        onClick={() => resetRow(rowId)}
                        className="text-sm text-gray-500 hover:text-gray-800"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => saveRow(rowId)}
                      disabled={!isDirty || isSaving}
                      className="inline-flex items-center gap-1.5 bg-[#EF8046] hover:bg-[#d96a2f] disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
                    >
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                    <button
                      onClick={() => remove(rowId)}
                      className="text-red-600 hover:text-red-700 inline-flex items-center gap-1 text-sm"
                      type="button"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {creating ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-3 grid sm:grid-cols-3 gap-3">
          {fields.map((f) => (
            <div key={f.name} className={f.type === "boolean" ? "self-end" : ""}>
              {renderField(creating, f, (v) => setCreating({ ...creating, [f.name]: v }))}
            </div>
          ))}
          <div className="sm:col-span-3 flex gap-2">
            <button onClick={create} className="bg-[#EF8046] text-white px-3 py-1.5 rounded-lg text-sm font-semibold">Create</button>
            <button onClick={() => setCreating(null)} className="text-sm text-gray-500">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreating({ ...defaults })} className="inline-flex items-center gap-1 text-sm text-[#EF8046] font-semibold">
          <Plus className="w-4 h-4" /> Add row
        </button>
      )}
    </div>
  );
}


// ----------------- small helpers -----------------
const inputCls = "w-full px-3 py-2 rounded-xl border border-gray-200 bg-[#FAFAFA] focus:border-[#EF8046] focus:ring-4 focus:ring-[#EF8046]/10 outline-none text-sm transition-all";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">{label}</label>
      {children}
    </div>
  );
}
