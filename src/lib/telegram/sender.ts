// ============================================================================
// JRE Telegram Sender — severity-filtered, single-channel focus
// Adapted from seo-business (~/seo-business/src/lib/telegram/sender.ts).
// Designed so the JRE AI Secretary can ping a single "JRE Ops" group for
// approval requests, status, and critical alerts.
// ============================================================================

const BOT_TOKEN = process.env.JRE_TELEGRAM_BOT_TOKEN || process.env.BG_TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_JRE || process.env.BG_TELEGRAM_CHAT_ID;

export type TelegramChannel = "jre" | "health";
export type Severity = "critical" | "warning" | "info" | "debug";

const SEVERITY_RANK: Record<Severity, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  critical: 3,
};

interface ChannelConfig {
  enabled: boolean;
  minSeverity: Severity;
  emoji: string;
  name: string;
  chatIdEnv: string;
}

const CHANNEL_CONFIG: Record<TelegramChannel, ChannelConfig> = {
  jre:    { enabled: true, minSeverity: "info",     emoji: "✡️", name: "JRE Secretary", chatIdEnv: "TELEGRAM_CHAT_JRE"    },
  health: { enabled: true, minSeverity: "warning",  emoji: "🏥", name: "JRE Health",    chatIdEnv: "TELEGRAM_CHAT_JRE"    },
};

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "ℹ️",
  debug: "🔵",
};

function getChatId(channel: TelegramChannel): string | undefined {
  const config = CHANNEL_CONFIG[channel];
  return process.env[config.chatIdEnv] ?? DEFAULT_CHAT_ID;
}

export type InlineButton = {
  text: string;
  callback_data: string;
};

export type InlineKeyboard = InlineButton[][];

export async function sendTelegram(
  channel: TelegramChannel,
  message: string,
  options?: {
    parseMode?: "HTML" | "Markdown";
    silent?: boolean;
    severity?: Severity;
    inlineKeyboard?: InlineKeyboard;
  }
): Promise<boolean> {
  const severity = options?.severity ?? "info";
  const config = CHANNEL_CONFIG[channel];

  if (!config.enabled) return false;
  if (SEVERITY_RANK[severity] < SEVERITY_RANK[config.minSeverity]) {
    console.log(`[Telegram] ${config.name} filtered — ${severity} < ${config.minSeverity}`);
    return false;
  }
  if (!BOT_TOKEN) {
    console.warn("[Telegram] Not configured — missing JRE_TELEGRAM_BOT_TOKEN");
    return false;
  }

  const chatId = getChatId(channel);
  if (!chatId) {
    console.warn(`[Telegram] No chat ID for channel ${channel}`);
    return false;
  }

  const sevEmoji = severity === "critical" ? SEVERITY_EMOJI.critical + " " : "";
  const prefix = `${sevEmoji}${config.emoji} <b>[${config.name}]</b>\n`;
  const fullMessage = prefix + message;
  const isSilent = options?.silent ?? severity !== "critical";

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: fullMessage,
    parse_mode: options?.parseMode || "HTML",
    disable_web_page_preview: true,
    disable_notification: isSilent,
  };

  if (options?.inlineKeyboard) {
    body.reply_markup = { inline_keyboard: options.inlineKeyboard };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Telegram] Send failed:", res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Telegram] Error:", err);
    return false;
  }
}

/**
 * Answer a callback query (tap on an inline button). Acknowledges the tap
 * and optionally shows a small toast to the user.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  opts?: { text?: string; showAlert?: boolean }
): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: opts?.text,
          show_alert: opts?.showAlert ?? false,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Edit a message in-place, typically to "consume" an approval card after the
 * coordinator taps Approve/Hold.
 */
export async function editMessageText(
  chatId: string | number,
  messageId: number,
  newText: string,
  opts?: { parseMode?: "HTML" | "Markdown" }
): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: newText,
          parse_mode: opts?.parseMode || "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** Helper: build an Approve/Edit-in-dashboard/Hold row for a draft. */
export function approvalKeyboard(draftId: string): InlineKeyboard {
  return [
    [
      { text: "✅ Approve", callback_data: `approve:${draftId}` },
      { text: "✏️ Edit", callback_data: `edit:${draftId}` },
      { text: "✋ Hold", callback_data: `hold:${draftId}` },
    ],
  ];
}
