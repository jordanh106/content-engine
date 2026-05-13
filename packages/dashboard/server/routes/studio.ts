/**
 * /api/studio/* — Weekly Studio orchestration endpoints.
 *
 * The actual chain runs in n8n (Sunday 8pm Brisbane cron). This router exposes
 * a manual trigger so the dashboard's "Run Studio Now" button can fire the
 * chain off-schedule.
 */
import { Router } from "express";
import { sendTelegram, telegramConfigured } from "../lib/telegram.js";

export function createStudioRouter() {
  const router = Router();

  // GET /api/studio/status — quick check of integration health
  router.get("/status", (_req, res) => {
    res.json({
      telegramConfigured: telegramConfigured(),
      bulkSeedConfigured: Boolean(process.env.INBOX_BULK_SECRET),
      n8nWebhookConfigured: Boolean(process.env.N8N_WEEKLY_STUDIO_WEBHOOK_URL),
    });
  });

  // POST /api/studio/run-now — trigger the n8n Weekly Studio chain
  router.post("/run-now", async (_req, res) => {
    const webhookUrl = process.env.N8N_WEEKLY_STUDIO_WEBHOOK_URL;
    if (!webhookUrl) {
      res.status(503).json({
        error: "N8N_WEEKLY_STUDIO_WEBHOOK_URL not set. Configure the workflow webhook URL in .env.",
      });
      return;
    }

    try {
      const trigger = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggeredBy: "dashboard_button", triggeredAt: new Date().toISOString() }),
      });
      if (!trigger.ok) {
        res.status(502).json({ error: `n8n webhook returned ${trigger.status}` });
        return;
      }
      // Optimistic Telegram acknowledgment so the user knows the chain has been kicked off
      await sendTelegram("Weekly Studio chain triggered manually from dashboard. ~5 minutes until completion.", { silent: true });
      res.json({ ok: true, message: "Weekly Studio chain started. Check Telegram in ~5 minutes." });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "studio trigger failed" });
    }
  });

  // POST /api/studio/test-telegram — verify Telegram is wired correctly
  router.post("/test-telegram", async (_req, res) => {
    if (!telegramConfigured()) {
      res.status(503).json({ error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set" });
      return;
    }
    const ok = await sendTelegram("✓ Content Engine Telegram test — bot is wired and chat ID is reachable.");
    res.json({ ok });
  });

  return router;
}
