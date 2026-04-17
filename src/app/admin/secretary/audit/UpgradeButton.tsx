"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UpgradeButton({ draftType }: { draftType: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function click() {
    setBusy(true);
    try {
      await fetch(`/api/secretary/automation/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftType }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={click}
      disabled={busy}
      className="text-xs px-2 py-1 rounded bg-[#EF8046] text-white hover:bg-[#d96d35] disabled:opacity-60"
    >
      Enable auto-send
    </button>
  );
}
