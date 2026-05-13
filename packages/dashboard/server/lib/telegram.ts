/**
 * Telegram sendMessage helper.
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from process.env. Posts to the
 * Telegram Bot API. Returns true on 200, false on any failure — never throws,
 * so a Telegram outage cannot break an orchestrator chain.
 *
 * Bot setup (5 min):
 *   1. Telegram → @BotFather → /newbot → copy the HTTP API token
 *   2. Message your new bot once (any text)
 *   3. curl "https://api.telegram.org/bot${TOKEN}/getUpdates" → find your chat.id
 *   4. Put both into packages/dashboard/.env:
 *        TELEGRAM_BOT_TOKEN=...
 *        TELEGRAM_CHAT_ID=...
 *   5. Restart dashboard
 */

export async function sendTelegram(text: string, opts?: { silent?: boolean }): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping message");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_notification: opts?.silent ?? false,
      }),
    });
    if (!res.ok) {
      console.warn(`[telegram] send failed: ${res.status} ${res.statusText}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[telegram] send threw: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/** Convenience: returns true if the bot token + chat ID are both configured. */
export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}
