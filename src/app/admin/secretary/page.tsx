// Server component: this-week-at-a-glance JRE Secretary dashboard.
// Shows next Tuesday's class, all 5 drafts, approve/hold buttons, Rabbi Oratz
// payment status, and quick links to speaker tracker + audit.

import Link from "next/link";
import {
  getNextUpcomingClass,
  getSpeakerById,
  getDraftsForClass,
  getPaymentByClass,
  getAutomationFlags,
} from "@/lib/db/secretary";
import type { JreEmailDraft, EmailDraftType } from "@/types/secretary";
import ApprovalButtons from "./ApprovalButtons";

export const dynamic = "force-dynamic";

const DRAFT_LABEL: Record<EmailDraftType, string> = {
  email_speaker: "Email #1 — Thu confirmation (Gmail)",
  email_cc_1: "Email CC-1 — Monday 8am (CC)",
  email_cc_2: "Email CC-2 — Tuesday 9am (CC)",
  email_payment: "Payment request — Rabbi Oratz (Gmail)",
  email_reminder: "Payment reminder — Rabbi Oratz (Gmail)",
  email_elisheva_ask: "Ask Elisheva — who's speaking? (Gmail)",
};

function statusBadge(status: string): string {
  const base = "inline-flex px-2 py-0.5 rounded text-[11px] font-medium border";
  if (status === "sent") return `${base} bg-green-50 text-green-700 border-green-200`;
  if (status === "approved") return `${base} bg-blue-50 text-blue-700 border-blue-200`;
  if (status === "held") return `${base} bg-yellow-50 text-yellow-700 border-yellow-200`;
  if (status === "failed") return `${base} bg-red-50 text-red-700 border-red-200`;
  if (status === "drafted") return `${base} bg-gray-50 text-gray-700 border-gray-200`;
  return `${base} bg-gray-50 text-gray-600 border-gray-200`;
}

export default async function SecretaryDashboard() {
  const cls = await getNextUpcomingClass();
  const flags = await getAutomationFlags();

  if (!cls) {
    return (
      <div className="max-w-4xl">
        <h1 className="text-2xl font-semibold mb-4">JRE Secretary</h1>
        <p className="text-gray-600">
          No upcoming class. The Monday 9 AM cron (<code>/api/cron/jre/ensure-next-class</code>) will create one for next Tuesday.
        </p>
        <QuickLinks />
      </div>
    );
  }

  const speaker = cls.speaker_id ? await getSpeakerById(cls.speaker_id) : null;
  const drafts = await getDraftsForClass(cls.id);
  const payment = await getPaymentByClass(cls.id);

  const byType: Partial<Record<EmailDraftType, JreEmailDraft>> = {};
  for (const d of drafts) byType[d.draft_type] = d;

  const displayOrder: EmailDraftType[] = [
    "email_elisheva_ask",
    "email_speaker",
    "email_cc_1",
    "email_cc_2",
    "email_payment",
    "email_reminder",
  ];

  return (
    <div className="max-w-4xl">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-2xl font-semibold">JRE Secretary</h1>
        <span className="text-sm text-gray-500">
          Kill switch: {flags.kill_switch ? <b className="text-red-600">ON</b> : "off"}
        </span>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 mb-5">
        <h2 className="font-semibold mb-1">
          Week of Tuesday {cls.class_date}
        </h2>
        <p className="text-sm text-gray-600">
          Status: <b>{cls.status}</b>
          {speaker ? (
            <>
              {" · "}Speaker: <b>{speaker.full_name}</b>{" "}
              {cls.fee_usd ? `· Fee: $${cls.fee_usd}` : null}
            </>
          ) : (
            " · Speaker not yet confirmed"
          )}
        </p>
        {cls.zoom_link ? (
          <p className="text-xs text-gray-500 mt-1">
            Zoom:{" "}
            <a href={cls.zoom_link} className="underline" target="_blank" rel="noreferrer">
              {cls.zoom_link}
            </a>
          </p>
        ) : null}
      </section>

      <section className="space-y-3 mb-5">
        {displayOrder.map((t) => {
          const draft = byType[t];
          return (
            <div
              key={t}
              className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{DRAFT_LABEL[t]}</span>
                  {draft ? (
                    <span className={statusBadge(draft.status)}>{draft.status}</span>
                  ) : (
                    <span className="text-xs text-gray-400">pending</span>
                  )}
                  {flags[`${t}_auto` as keyof typeof flags] ? (
                    <span className="text-[11px] text-green-700 border border-green-200 bg-green-50 rounded px-1.5 py-0.5">
                      auto-send
                    </span>
                  ) : null}
                </div>
                {draft ? (
                  <p className="text-xs text-gray-600 truncate">
                    <b>{draft.subject}</b> → {draft.to_list.length ? draft.to_list.join(", ") : "(CC list)"}
                  </p>
                ) : null}
              </div>
              {draft ? (
                <div className="flex gap-2">
                  <Link
                    href={`/admin/secretary/drafts/${draft.id}`}
                    className="px-3 py-1.5 text-xs rounded border border-gray-200 hover:bg-gray-50"
                  >
                    Preview
                  </Link>
                  {draft.status === "drafted" ? (
                    <ApprovalButtons draftId={draft.id} />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 mb-5">
        <h3 className="font-semibold mb-2">Payment</h3>
        {payment ? (
          <div className="text-sm">
            <p>
              ${payment.amount_usd} via {payment.payment_method}{" "}
              — <b className={payment.paid ? "text-green-700" : "text-yellow-700"}>
                {payment.paid ? "paid" : "unpaid"}
              </b>
            </p>
            {payment.request_sent_at && (
              <p className="text-xs text-gray-500 mt-0.5">
                Requested {new Date(payment.request_sent_at).toLocaleString()}
                {payment.reminder_count > 0 ? ` · ${payment.reminder_count} reminder(s)` : ""}
              </p>
            )}
            {!payment.paid && (
              <form action={`/api/secretary/classes/${cls.id}/mark-paid`} method="post" className="mt-2">
                <button className="px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700">
                  Mark paid
                </button>
              </form>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No payment row yet — will be created Tue night.</p>
        )}
      </section>

      <QuickLinks />
    </div>
  );
}

function QuickLinks() {
  return (
    <div className="flex gap-4 text-sm">
      <Link href="/admin/secretary/speakers" className="text-[#EF8046] hover:underline">
        Speaker tracker
      </Link>
      <Link href="/admin/secretary/audit" className="text-[#EF8046] hover:underline">
        Weekly audit
      </Link>
      <Link href="/api/secretary/gmail/authorize" className="text-gray-600 hover:underline">
        Connect Gmail (Gitty)
      </Link>
    </div>
  );
}
