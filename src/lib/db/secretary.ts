// JRE Secretary DB helpers.
// All writes use service role; routes are auth-gated (see /admin/secretary).

import { createClient } from "@supabase/supabase-js";
import type {
  JreSpeaker,
  JreWeeklyClass,
  JreEmailDraft,
  JrePayment,
  JreAuditLog,
  JreAutomationFlags,
  WeeklyClassStatus,
  EmailDraftType,
  EmailDraftStatus,
} from "@/types/secretary";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---- Speakers --------------------------------------------------------------

export async function getSpeakerById(id: string): Promise<JreSpeaker | null> {
  const { data } = await db().from("jre_speakers").select("*").eq("id", id).single();
  return (data as JreSpeaker) ?? null;
}

export async function getSpeakerByName(fullName: string): Promise<JreSpeaker | null> {
  const { data } = await db()
    .from("jre_speakers")
    .select("*")
    .ilike("full_name", fullName.trim())
    .maybeSingle();
  return (data as JreSpeaker) ?? null;
}

export async function upsertSpeaker(
  speaker: Partial<JreSpeaker> & { full_name: string }
): Promise<JreSpeaker> {
  const existing = await getSpeakerByName(speaker.full_name);
  if (existing) {
    const { data, error } = await db()
      .from("jre_speakers")
      .update(speaker)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as JreSpeaker;
  }
  const { data, error } = await db()
    .from("jre_speakers")
    .insert(speaker)
    .select("*")
    .single();
  if (error) throw error;
  return data as JreSpeaker;
}

export async function listActiveSpeakers(): Promise<JreSpeaker[]> {
  const { data } = await db()
    .from("jre_speakers")
    .select("*")
    .eq("is_active", true)
    .order("last_spoke_at", { ascending: false, nullsFirst: false });
  return (data as JreSpeaker[]) ?? [];
}

export async function incrementSpeakerTalks(
  speakerId: string,
  classDate: string,
  fee?: number
): Promise<void> {
  const speaker = await getSpeakerById(speakerId);
  if (!speaker) return;
  await db()
    .from("jre_speakers")
    .update({
      total_talks: speaker.total_talks + 1,
      last_spoke_at: classDate,
      ...(fee ? { last_fee_usd: fee } : {}),
    })
    .eq("id", speakerId);
}

// ---- Weekly classes --------------------------------------------------------

export async function getClassByDate(classDate: string): Promise<JreWeeklyClass | null> {
  const { data } = await db()
    .from("jre_weekly_classes")
    .select("*")
    .eq("class_date", classDate)
    .maybeSingle();
  return (data as JreWeeklyClass) ?? null;
}

export async function getClassById(id: string): Promise<JreWeeklyClass | null> {
  const { data } = await db()
    .from("jre_weekly_classes")
    .select("*")
    .eq("id", id)
    .single();
  return (data as JreWeeklyClass) ?? null;
}

export async function ensureClassForDate(
  classDate: string,
  zoomLink?: string
): Promise<JreWeeklyClass> {
  const existing = await getClassByDate(classDate);
  if (existing) return existing;
  const { data, error } = await db()
    .from("jre_weekly_classes")
    .insert({
      class_date: classDate,
      zoom_link: zoomLink ?? null,
      status: "awaiting_speaker" as WeeklyClassStatus,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as JreWeeklyClass;
}

export async function updateClass(
  id: string,
  patch: Partial<JreWeeklyClass>
): Promise<JreWeeklyClass> {
  const { data, error } = await db()
    .from("jre_weekly_classes")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as JreWeeklyClass;
}

export async function setClassStatus(
  id: string,
  status: WeeklyClassStatus,
  extra?: Partial<JreWeeklyClass>
): Promise<JreWeeklyClass> {
  return updateClass(id, { status, ...(extra ?? {}) });
}

export async function listUpcomingClasses(limit = 10): Promise<JreWeeklyClass[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db()
    .from("jre_weekly_classes")
    .select("*")
    .gte("class_date", today)
    .order("class_date", { ascending: true })
    .limit(limit);
  return (data as JreWeeklyClass[]) ?? [];
}

export async function getNextUpcomingClass(): Promise<JreWeeklyClass | null> {
  const [next] = await listUpcomingClasses(1);
  return next ?? null;
}

// ---- Email drafts ----------------------------------------------------------

export async function createDraft(
  draft: Omit<JreEmailDraft, "id" | "created_at" | "updated_at" | "draft_v1_subject" | "draft_v1_body_html"> & {
    draft_v1_subject?: string;
    draft_v1_body_html?: string;
  }
): Promise<JreEmailDraft> {
  const row = {
    ...draft,
    draft_v1_subject: draft.draft_v1_subject ?? draft.subject,
    draft_v1_body_html: draft.draft_v1_body_html ?? draft.body_html,
  };
  const { data, error } = await db()
    .from("jre_email_drafts")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data as JreEmailDraft;
}

export async function getDraft(id: string): Promise<JreEmailDraft | null> {
  const { data } = await db()
    .from("jre_email_drafts")
    .select("*")
    .eq("id", id)
    .single();
  return (data as JreEmailDraft) ?? null;
}

export async function getDraftsForClass(classId: string): Promise<JreEmailDraft[]> {
  const { data } = await db()
    .from("jre_email_drafts")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: true });
  return (data as JreEmailDraft[]) ?? [];
}

export async function findDraftForClass(
  classId: string,
  draftType: EmailDraftType
): Promise<JreEmailDraft | null> {
  const { data } = await db()
    .from("jre_email_drafts")
    .select("*")
    .eq("class_id", classId)
    .eq("draft_type", draftType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as JreEmailDraft) ?? null;
}

export async function updateDraft(
  id: string,
  patch: Partial<JreEmailDraft>
): Promise<JreEmailDraft> {
  const { data, error } = await db()
    .from("jre_email_drafts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as JreEmailDraft;
}

export async function setDraftStatus(
  id: string,
  status: EmailDraftStatus,
  extra?: Partial<JreEmailDraft>
): Promise<JreEmailDraft> {
  return updateDraft(id, { status, ...(extra ?? {}) });
}

export async function listPendingApprovals(): Promise<JreEmailDraft[]> {
  const { data } = await db()
    .from("jre_email_drafts")
    .select("*")
    .eq("status", "drafted")
    .order("scheduled_send_at", { ascending: true, nullsFirst: false });
  return (data as JreEmailDraft[]) ?? [];
}

// ---- Payments --------------------------------------------------------------

export async function getPaymentByClass(classId: string): Promise<JrePayment | null> {
  const { data } = await db()
    .from("jre_payments")
    .select("*")
    .eq("class_id", classId)
    .maybeSingle();
  return (data as JrePayment) ?? null;
}

export async function upsertPaymentForClass(
  classId: string,
  patch: Partial<JrePayment> & { amount_usd: number; speaker_id?: string | null }
): Promise<JrePayment> {
  const existing = await getPaymentByClass(classId);
  if (existing) {
    const { data, error } = await db()
      .from("jre_payments")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as JrePayment;
  }
  const { data, error } = await db()
    .from("jre_payments")
    .insert({ class_id: classId, ...patch })
    .select("*")
    .single();
  if (error) throw error;
  return data as JrePayment;
}

export async function markPaid(
  classId: string,
  source: string = "dashboard",
  paidAt: string = new Date().toISOString()
): Promise<JrePayment | null> {
  const payment = await getPaymentByClass(classId);
  if (!payment) return null;
  const { data, error } = await db()
    .from("jre_payments")
    .update({ paid: true, paid_at: paidAt, paid_source: source })
    .eq("id", payment.id)
    .select("*")
    .single();
  if (error) throw error;

  // Bubble status up on the class.
  await updateClass(classId, { status: "paid" });
  return data as JrePayment;
}

export async function listUnpaidPayments(): Promise<JrePayment[]> {
  const { data } = await db()
    .from("jre_payments")
    .select("*")
    .eq("paid", false)
    .order("request_sent_at", { ascending: true, nullsFirst: false });
  return (data as JrePayment[]) ?? [];
}

// ---- Audit log -------------------------------------------------------------

export async function logAudit(
  entry: Omit<JreAuditLog, "id" | "created_at">
): Promise<void> {
  await db().from("jre_audit_log").insert(entry);
}

export async function getAuditForWeek(weekOf: string): Promise<JreAuditLog[]> {
  const { data } = await db()
    .from("jre_audit_log")
    .select("*")
    .eq("week_of", weekOf)
    .order("created_at", { ascending: true });
  return (data as JreAuditLog[]) ?? [];
}

export async function getAuditRange(
  fromWeek: string,
  toWeek: string
): Promise<JreAuditLog[]> {
  const { data } = await db()
    .from("jre_audit_log")
    .select("*")
    .gte("week_of", fromWeek)
    .lte("week_of", toWeek)
    .order("week_of", { ascending: true });
  return (data as JreAuditLog[]) ?? [];
}

// ---- Automation flags ------------------------------------------------------

export async function getAutomationFlags(): Promise<JreAutomationFlags> {
  const { data } = await db()
    .from("jre_automation_flags")
    .select("*")
    .eq("id", 1)
    .single();
  return data as JreAutomationFlags;
}

export async function setAutomationFlag(
  key: keyof JreAutomationFlags,
  value: boolean | string | null
): Promise<void> {
  await db().from("jre_automation_flags").update({ [key]: value }).eq("id", 1);
}

// ---- Helpers ---------------------------------------------------------------

/**
 * Find the date of the next Tuesday (local time). Used by the Mon 9am
 * "ensure next class" cron.
 */
export function nextTuesdayISO(from: Date = new Date()): string {
  const d = new Date(from);
  // 0 = Sun, 1 = Mon, ..., 2 = Tue
  const daysUntilTue = (2 - d.getDay() + 7) % 7 || 7; // always pick NEXT Tue, never today
  d.setDate(d.getDate() + daysUntilTue);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Monday-of-week ISO date for audit grouping.
 */
export function weekOfISO(d: Date = new Date()): string {
  const copy = new Date(d);
  const day = copy.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}
