// Weekly audit view — per-draft-type accuracy + upgrade offers.

import Link from "next/link";
import { computeWeeklySummary } from "@/lib/secretary/audit-engine";
import { getAutomationFlags } from "@/lib/db/secretary";
import UpgradeButton from "./UpgradeButton";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  email_speaker: "Email #1 (speaker confirm)",
  email_cc_1: "Email CC-1 (Mon AM)",
  email_cc_2: "Email CC-2 (Tue AM)",
  email_payment: "Payment request",
  email_reminder: "Payment reminder",
  email_elisheva_ask: "Ask Elisheva",
};

export default async function AuditPage() {
  const summary = await computeWeeklySummary();
  const flags = await getAutomationFlags();

  return (
    <div className="max-w-4xl">
      <Link href="/admin/secretary" className="text-sm text-[#EF8046] hover:underline">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">Weekly audit</h1>
      <p className="text-sm text-gray-500 mb-4">Week of {summary.weekOf}</p>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Draft type</th>
              <th className="px-3 py-2 text-right">Perfect / Total</th>
              <th className="px-3 py-2 text-right">Avg diff</th>
              <th className="px-3 py-2 text-right">Streak (w)</th>
              <th className="px-3 py-2 text-left">Auto-send</th>
            </tr>
          </thead>
          <tbody>
            {summary.byDraftType.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-sm text-gray-500 text-center">
                  No drafts sent this week.
                </td>
              </tr>
            )}
            {summary.byDraftType.map((r) => {
              const streak = summary.streaksByDraftType[r.draftType] ?? 0;
              const autoKey = `${r.draftType}_auto` as keyof typeof flags;
              const autoOn = !!flags[autoKey];
              const eligible = summary.eligibleForAutoSend.includes(r.draftType);
              return (
                <tr key={r.draftType} className="border-t border-gray-100">
                  <td className="px-3 py-2">{LABEL[r.draftType] ?? r.draftType}</td>
                  <td className="px-3 py-2 text-right">
                    {r.perfectCount} / {r.count}
                  </td>
                  <td className="px-3 py-2 text-right">{r.avgDiffScore.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{streak}</td>
                  <td className="px-3 py-2">
                    {autoOn ? (
                      <span className="text-green-700 text-xs">ON</span>
                    ) : eligible ? (
                      <UpgradeButton draftType={r.draftType} />
                    ) : (
                      <span className="text-xs text-gray-400">off ({streak}/4)</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Draft-types become eligible for auto-send after 4 consecutive perfect
        weeks (no meaningful edits, no human intervention, sent on time).
      </p>
    </div>
  );
}
