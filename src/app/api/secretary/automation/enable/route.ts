import { NextRequest, NextResponse } from "next/server";
import { enableAutoSendFor } from "@/lib/secretary/audit-engine";
import type { EmailDraftType } from "@/types/secretary";

const ALLOWED: EmailDraftType[] = [
  "email_speaker",
  "email_cc_1",
  "email_cc_2",
  "email_payment",
  "email_reminder",
];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const t = body.draftType as EmailDraftType | undefined;
  if (!t || !ALLOWED.includes(t)) {
    return NextResponse.json({ error: "bad draftType" }, { status: 400 });
  }
  await enableAutoSendFor(t);
  return NextResponse.json({ ok: true });
}
