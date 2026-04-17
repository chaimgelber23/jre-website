// Speaker tracker — full roster + fee history + last-spoke-at.

import Link from "next/link";
import { listActiveSpeakers } from "@/lib/db/secretary";

export const dynamic = "force-dynamic";

export default async function SpeakersPage() {
  const speakers = await listActiveSpeakers();
  return (
    <div className="max-w-5xl">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <Link href="/admin/secretary" className="text-sm text-[#EF8046] hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Speakers</h1>
        </div>
        <span className="text-xs text-gray-500">{speakers.length} speakers</span>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Last spoke</th>
              <th className="px-3 py-2 text-right">Last fee</th>
              <th className="px-3 py-2 text-right">Talks</th>
            </tr>
          </thead>
          <tbody>
            {speakers.map((s) => (
              <tr key={s.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium">{s.full_name}</td>
                <td className="px-3 py-2 text-gray-600">{s.email ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600">{s.last_spoke_at ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {s.last_fee_usd ? `$${s.last_fee_usd}` : "—"}
                </td>
                <td className="px-3 py-2 text-right">{s.total_talks}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {speakers.length === 0 && (
          <div className="p-6 text-sm text-gray-500 text-center">
            No speakers yet. Run the seed: <code>npm run seed:jre-speakers</code>
          </div>
        )}
      </div>
    </div>
  );
}
