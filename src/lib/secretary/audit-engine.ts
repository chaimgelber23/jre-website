/**
 * Self-learning audit engine.
 *
 * For every email the AI drafts, we snapshot v1 (the exact words the AI
 * wrote). When the draft ships — either auto or after human edits — we
 * diff v1 vs the final sent body. Over weeks we aggregate:
 *
 *   perfect-week streak  — 4+ consecutive weeks with 0 meaningful edits
 *                          per draft-type graduates that type to auto-send.
 *
 * The engine posts a Sat 8pm Telegram report: "This week: Email #1 perfect,
 * Email #2 one minor tweak, Rabbi Oratz payment email — 8-week streak, OK
 * to upgrade to full auto-send? [Yes] [Not yet]".
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getDraft,
  logAudit,
  getAuditRange,
  getAutomationFlags,
  setAutomationFlag,
  weekOfISO,
} from "@/lib/db/secretary";
import type { EmailDraftType } from "@/types/secretary";
import { sendTelegram } from "@/lib/telegram/sender";

// ---- Diff scoring ----------------------------------------------------------

/** Levenshtein distance (O(n*m)). Cap inputs at ~8k chars for perf. */
function levenshtein(a: string, b: string): number {
  const aa = a.length > 8000 ? a.slice(0, 8000) : a;
  const bb = b.length > 8000 ? b.slice(0, 8000) : b;
  if (aa === bb) return 0;
  if (!aa.length) return bb.length;
  if (!bb.length) return aa.length;
  const prev = new Array(bb.length + 1);
  const curr = new Array(bb.length + 1);
  for (let j = 0; j <= bb.length; j++) prev[j] = j;
  for (let i = 1; i <= aa.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= bb.length; j++) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= bb.length; j++) prev[j] = curr[j];
  }
  return prev[bb.length];
}

export function diffScore(v1: string, v2: string): number {
  const maxLen = Math.max(v1.length, v2.length) || 1;
  return Math.min(1, levenshtein(v1, v2) / maxLen);
}

// ---- Semantic judgment (Claude Haiku) --------------------------------------

function getAnthropic(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

/**
 * Ask Claude Haiku whether the human edit was meaningful (tone, content,
 * semantics) or cosmetic (whitespace, one typo, one word reorder).
 * Cheap call, ~$0.0001/draft. Returns null on API failure (treat as unknown).
 */
export async function judgeMeaningfulEdit(
  v1: string,
  v2: string
): Promise<boolean | null> {
  if (v1 === v2) return false;
  if (diffScore(v1, v2) < 0.02) return false; // trivial

  const client = getAnthropic();
  if (!client) return null;

  try {
    const res = await client.messages.create(
      {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 50,
        messages: [
          {
            role: "user",
            content: `You are comparing an AI-drafted email to the final version a human sent.
Was the human's edit MEANINGFUL (changed tone, content, or intent) or COSMETIC (whitespace, typo, small word swap)?

--- AI draft ---
${v1.slice(0, 3000)}

--- Final sent ---
${v2.slice(0, 3000)}

Answer with exactly one word: MEANINGFUL or COSMETIC`,
          },
        ],
      },
      { timeout: 20_000 }
    );
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .toUpperCase();
    if (text.includes("MEANINGFUL")) return true;
    if (text.includes("COSMETIC")) return false;
    return null;
  } catch (err) {
    console.error("[audit] Haiku judge failed:", err);
    return null;
  }
}

// ---- Record an audit event when a draft ships ------------------------------

export async function recordDraftOutcome(
  draftId: string,
  opts: { sentOnTime: boolean; humanIntervention?: boolean; notes?: string }
): Promise<void> {
  const draft = await getDraft(draftId);
  if (!draft) return;

  const score = diffScore(draft.draft_v1_body_html, draft.body_html);
  const meaningful =
    score === 0 ? false : await judgeMeaningfulEdit(draft.draft_v1_body_html, draft.body_html);

  await logAudit({
    week_of: weekOfISO(new Date()),
    class_id: draft.class_id,
    draft_id: draft.id,
    draft_type: draft.draft_type,
    was_edited: score > 0.02,
    edit_diff_score: score,
    edit_is_meaningful: meaningful,
    was_sent_on_time: opts.sentOnTime,
    was_sent_at_all: !!draft.sent_at,
    human_intervention: opts.humanIntervention ?? false,
    notes: opts.notes ?? null,
  });
}

// ---- Weekly aggregation & upgrade eligibility ------------------------------

export type WeeklySummary = {
  weekOf: string;
  byDraftType: Array<{
    draftType: EmailDraftType;
    count: number;
    perfectCount: number;
    avgDiffScore: number;
    onTimeCount: number;
    humanInterventions: number;
  }>;
  streaksByDraftType: Partial<Record<EmailDraftType, number>>; // consecutive perfect weeks
  eligibleForAutoSend: EmailDraftType[];
};

const AUTO_SEND_THRESHOLD_WEEKS = 4;
const PERFECT_DIFF_THRESHOLD = 0.05;

export async function computeWeeklySummary(
  weekOf: string = weekOfISO(new Date()),
  weeksOfHistory = 8
): Promise<WeeklySummary> {
  const fromDate = new Date(weekOf);
  fromDate.setDate(fromDate.getDate() - weeksOfHistory * 7);
  const fromWeek = fromDate.toISOString().slice(0, 10);
  const rows = await getAuditRange(fromWeek, weekOf);

  // Per-week per-draftType: was this week "perfect" for that draft-type?
  const perWeekPerType = new Map<string, Map<EmailDraftType, { perfect: boolean; count: number }>>();
  for (const r of rows) {
    const wk = r.week_of;
    const type = r.draft_type as EmailDraftType;
    if (!perWeekPerType.has(wk)) perWeekPerType.set(wk, new Map());
    const byType = perWeekPerType.get(wk)!;
    const cell = byType.get(type) ?? { perfect: true, count: 0 };
    cell.count += 1;
    const badScore = (r.edit_diff_score ?? 0) > PERFECT_DIFF_THRESHOLD;
    const meaningfulFlag = r.edit_is_meaningful === true;
    const human = r.human_intervention;
    if (badScore || meaningfulFlag || human || r.was_sent_at_all === false) {
      cell.perfect = false;
    }
    byType.set(type, cell);
  }

  // This week's breakdown
  const thisWeek = rows.filter((r) => r.week_of === weekOf);
  const typeKeys = Array.from(new Set(thisWeek.map((r) => r.draft_type))) as EmailDraftType[];
  const byDraftType = typeKeys.map((t) => {
    const subset = thisWeek.filter((r) => r.draft_type === t);
    const perfectCount = subset.filter(
      (r) =>
        (r.edit_diff_score ?? 0) <= PERFECT_DIFF_THRESHOLD &&
        r.edit_is_meaningful !== true &&
        !r.human_intervention &&
        r.was_sent_at_all !== false
    ).length;
    const avg = subset.length
      ? subset.reduce((a, r) => a + (r.edit_diff_score ?? 0), 0) / subset.length
      : 0;
    const onTime = subset.filter((r) => r.was_sent_on_time).length;
    const human = subset.filter((r) => r.human_intervention).length;
    return {
      draftType: t,
      count: subset.length,
      perfectCount,
      avgDiffScore: avg,
      onTimeCount: onTime,
      humanInterventions: human,
    };
  });

  // Streak calculation: walk back from this week.
  const streaksByDraftType: Partial<Record<EmailDraftType, number>> = {};
  const sortedWeeks = Array.from(perWeekPerType.keys()).sort((a, b) => b.localeCompare(a));
  for (const t of typeKeys) {
    let streak = 0;
    for (const wk of sortedWeeks) {
      const cell = perWeekPerType.get(wk)?.get(t);
      if (cell && cell.perfect && cell.count > 0) streak++;
      else break;
    }
    streaksByDraftType[t] = streak;
  }

  const eligibleForAutoSend = (Object.entries(streaksByDraftType) as [EmailDraftType, number][])
    .filter(([, s]) => s >= AUTO_SEND_THRESHOLD_WEEKS)
    .map(([t]) => t);

  return { weekOf, byDraftType, streaksByDraftType, eligibleForAutoSend };
}

// ---- Telegram report -------------------------------------------------------

function draftLabel(t: EmailDraftType): string {
  switch (t) {
    case "email_speaker": return "Email #1 (speaker confirm)";
    case "email_cc_1":    return "Email CC-1 (Mon AM promo)";
    case "email_cc_2":    return "Email CC-2 (Tue AM reminder)";
    case "email_payment": return "Payment request (Rabbi Oratz)";
    case "email_reminder":return "Payment reminder";
    case "email_elisheva_ask": return "Elisheva ask-for-speaker";
  }
}

export async function postWeeklyReport(summary: WeeklySummary): Promise<void> {
  const lines: string[] = [];
  lines.push(`<b>JRE AI Secretary — Week of ${summary.weekOf}</b>`);
  if (summary.byDraftType.length === 0) {
    lines.push("No drafts sent this week.");
  } else {
    for (const row of summary.byDraftType) {
      const check = row.perfectCount === row.count ? "✅" : "⚠️";
      const streak = summary.streaksByDraftType[row.draftType] ?? 0;
      const streakSuffix = streak >= 1 ? ` (${streak}w streak)` : "";
      lines.push(
        `${check} ${draftLabel(row.draftType)}: ${row.perfectCount}/${row.count} perfect${streakSuffix}`
      );
    }
  }
  const flags = await getAutomationFlags();
  for (const t of summary.eligibleForAutoSend) {
    const flagKey = `${t}_auto` as keyof typeof flags;
    if (flags[flagKey] === false) {
      lines.push(
        `\n🎯 <b>${draftLabel(t)}</b> hit a ${AUTO_SEND_THRESHOLD_WEEKS}-week perfect streak. Upgrade to full auto-send?`
      );
    }
  }
  await sendTelegram("jre", lines.join("\n"), { severity: "info" });
}

/** Called by the Sat 8pm cron. */
export async function runWeeklyAudit(): Promise<WeeklySummary> {
  const summary = await computeWeeklySummary();
  await postWeeklyReport(summary);
  return summary;
}

/** Toggle a specific draft-type to auto-send (human approval of offer). */
export async function enableAutoSendFor(draftType: EmailDraftType): Promise<void> {
  const key = `${draftType}_auto` as Parameters<typeof setAutomationFlag>[0];
  await setAutomationFlag(key, true);
}
