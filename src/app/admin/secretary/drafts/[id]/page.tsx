// Draft preview + inline editor (subject + body HTML). Approve/Hold buttons.

import { getDraft, getClassById, getSpeakerById } from "@/lib/db/secretary";
import DraftEditor from "./DraftEditor";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DraftPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draft = await getDraft(id);
  if (!draft) {
    return (
      <div>
        <Link href="/admin/secretary" className="text-sm text-[#EF8046] hover:underline">
          ← Back
        </Link>
        <p className="mt-4">Draft not found.</p>
      </div>
    );
  }
  const cls = await getClassById(draft.class_id);
  const speaker = cls?.speaker_id ? await getSpeakerById(cls.speaker_id) : null;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/secretary" className="text-sm text-[#EF8046] hover:underline">
        ← Back
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-1">
        {draft.draft_type}
      </h1>
      <p className="text-sm text-gray-600 mb-4">
        Status: <b>{draft.status}</b>
        {cls ? ` · Class ${cls.class_date}` : ""}
        {speaker ? ` · ${speaker.full_name}` : ""}
        {draft.cloned_from_id
          ? ` · Cloned from ${draft.cloned_from_provider} id ${draft.cloned_from_id.slice(0, 10)}…`
          : ""}
      </p>

      <DraftEditor draft={draft} />
    </div>
  );
}
