"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JreEmailDraft } from "@/types/secretary";

export default function DraftEditor({ draft }: { draft: JreEmailDraft }) {
  const [subject, setSubject] = useState(draft.subject);
  const [bodyHtml, setBodyHtml] = useState(draft.body_html);
  const [scheduledAt, setScheduledAt] = useState(
    draft.scheduled_send_at ? draft.scheduled_send_at.slice(0, 16) : ""
  );
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"preview" | "edit">("preview");
  const router = useRouter();
  const readOnly = draft.status !== "drafted" && draft.status !== "held";

  async function call(action: "approve" | "hold") {
    if (busy) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { approval_channel: "dashboard" };
      if (action === "approve") {
        body.subject = subject;
        body.body_html = bodyHtml;
        if (scheduledAt) body.scheduled_send_at = new Date(scheduledAt).toISOString();
      }
      const res = await fetch(`/api/secretary/drafts/${draft.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        alert(`${action} failed: ${await res.text()}`);
      } else {
        router.refresh();
        router.push("/admin/secretary");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <p>
          <b>From:</b> {draft.from_name} &lt;{draft.from_email}&gt;
        </p>
        {draft.reply_to ? <p><b>Reply-to:</b> {draft.reply_to}</p> : null}
        {draft.to_list.length > 0 && (
          <p><b>To:</b> {draft.to_list.join(", ")}</p>
        )}
        {draft.cc_list.length > 0 && (
          <p><b>CC:</b> {draft.cc_list.join(", ")}</p>
        )}
        {draft.delivery_channel === "constant_contact" && (
          <p><b>Channel:</b> Constant Contact → JRE Ladies list</p>
        )}
      </div>

      <label className="block text-sm">
        <span className="text-gray-600 font-medium">Subject</span>
        <input
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={readOnly}
        />
      </label>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("preview")}
          className={`px-3 py-2 text-sm ${tab === "preview" ? "font-semibold border-b-2 border-[#EF8046]" : "text-gray-500"}`}
        >
          Preview
        </button>
        <button
          onClick={() => setTab("edit")}
          className={`px-3 py-2 text-sm ${tab === "edit" ? "font-semibold border-b-2 border-[#EF8046]" : "text-gray-500"}`}
        >
          Edit HTML
        </button>
      </div>

      {tab === "preview" ? (
        <div
          className="rounded-lg border border-gray-200 bg-white p-4 min-h-[300px]"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      ) : (
        <textarea
          className="w-full min-h-[360px] rounded border border-gray-300 p-3 font-mono text-xs"
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          disabled={readOnly}
        />
      )}

      {!readOnly && (
        <>
          <label className="block text-sm">
            <span className="text-gray-600 font-medium">
              Send at (leave blank = immediate on next cron pickup)
            </span>
            <input
              type="datetime-local"
              className="mt-1 rounded border border-gray-300 px-3 py-2 text-sm"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => call("approve")}
              disabled={busy}
              className="px-4 py-2 text-sm rounded bg-[#EF8046] text-white hover:bg-[#d96d35] disabled:opacity-60"
            >
              Approve
            </button>
            <button
              onClick={() => call("hold")}
              disabled={busy}
              className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
            >
              Hold
            </button>
          </div>
        </>
      )}
    </div>
  );
}
