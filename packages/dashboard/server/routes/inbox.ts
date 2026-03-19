import { Router } from "express";
import { db, sqlite } from "../db.js";
import { inspirationInbox } from "../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import path from "path";
import fs from "fs";

function getIdeaBankPath(contentLibraryPath: string): string {
  return path.join(path.dirname(contentLibraryPath), "idea-bank.md");
}

function appendToIdeaBank(ideaBankPath: string, topic: string, category: string, priority: string): void {
  const date = new Date().toISOString().split("T")[0];
  const line = `- **${topic}** | Format: | Hook: | Priority: ${priority} | Source: Inspiration Inbox | Date: ${date} | Category: ${category}\n`;
  if (fs.existsSync(ideaBankPath)) {
    fs.appendFileSync(ideaBankPath, line);
  }
}

export function createInboxRouter(contentLibraryPath: string) {
  const router = Router();

  // GET /api/inbox — list all non-dismissed inbox items, newest first
  router.get("/", (_req, res) => {
    try {
      const items = db
        .select()
        .from(inspirationInbox)
        .where(eq(inspirationInbox.status, "inbox"))
        .orderBy(desc(inspirationInbox.createdAt))
        .all();
      res.json({ items });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // GET /api/inbox/count — pending inbox count for badges
  router.get("/count", (_req, res) => {
    try {
      const row = sqlite.prepare(`SELECT COUNT(*) as count FROM inspiration_inbox WHERE status = 'inbox'`).get() as { count: number };
      res.json({ count: row.count });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // POST /api/inbox — capture a new item
  router.post("/", (req, res) => {
    const { content, sourceUrl } = req.body as { content: string; sourceUrl?: string };
    if (!content?.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    try {
      const result = db
        .insert(inspirationInbox)
        .values({ content: content.trim(), sourceUrl: sourceUrl?.trim() || null, status: "inbox" })
        .returning()
        .get();
      res.status(201).json({ item: result });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // DELETE /api/inbox/:id — dismiss an item
  router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
    try {
      db.update(inspirationInbox).set({ status: "dismissed" }).where(eq(inspirationInbox.id, id)).run();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // POST /api/inbox/:id/develop — promote to idea bank
  router.post("/:id/develop", (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
    const { topic, category = "personal", priority = "Medium" } = req.body as {
      topic?: string;
      category?: string;
      priority?: string;
    };

    try {
      const item = db.select().from(inspirationInbox).where(eq(inspirationInbox.id, id)).get();
      if (!item) { res.status(404).json({ error: "item not found" }); return; }

      const finalTopic = topic?.trim() || item.content.slice(0, 120);
      const ideaBankPath = getIdeaBankPath(contentLibraryPath);
      appendToIdeaBank(ideaBankPath, finalTopic, category, priority);
      db.update(inspirationInbox).set({ status: "developed" }).where(eq(inspirationInbox.id, id)).run();

      res.json({ ok: true, topic: finalTopic });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return router;
}
