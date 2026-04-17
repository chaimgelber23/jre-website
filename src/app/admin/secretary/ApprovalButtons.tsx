"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalButtons({ draftId }: { draftId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function call(action: "approve" | "hold") {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/secretary/drafts/${draftId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const txt = await res.text();
        alert(`${action} failed: ${txt}`);
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => call("approve")}
        disabled={busy}
        className="px-3 py-1.5 text-xs rounded bg-[#EF8046] text-white hover:bg-[#d96d35] disabled:opacity-60"
      >
        Approve
      </button>
      <button
        onClick={() => call("hold")}
        disabled={busy}
        className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
      >
        Hold
      </button>
    </>
  );
}
