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

function normalizeAudienceTags(tags: string[] | string | undefined): string | null {
  if (!tags) return null;
  if (Array.isArray(tags)) {
    const cleaned = tags.map((t) => String(t).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(",") : null;
  }
  const s = String(tags).trim();
  return s.length > 0 ? s : null;
}

function normalizeMetadata(metadata: object | string | undefined): string | null {
  if (metadata == null) return null;
  if (typeof metadata === "string") return metadata.length > 0 ? metadata : null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
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
    const body = req.body as {
      content: string;
      sourceUrl?: string;
      audienceTags?: string[] | string;
      source?: string;
      metadata?: object | string;
    };
    if (!body.content?.trim()) {
      res.status(400).json({ error: "content is required" });
      return;
    }
    try {
      const result = db
        .insert(inspirationInbox)
        .values({
          content: body.content.trim(),
          sourceUrl: body.sourceUrl?.trim() || null,
          status: "inbox",
          audienceTags: normalizeAudienceTags(body.audienceTags),
          source: body.source?.trim() || "manual",
          metadata: normalizeMetadata(body.metadata),
        })
        .returning()
        .get();
      res.status(201).json({ item: result });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // POST /api/inbox/bulk-seed — n8n / scripted bulk insert
  // Requires `secret` matching process.env.INBOX_BULK_SECRET
  // Accepts up to 50 items per call
  router.post("/bulk-seed", (req, res) => {
    const body = req.body as {
      secret?: string;
      items?: Array<{
        content: string;
        sourceUrl?: string;
        audienceTags?: string[] | string;
        source?: string;
        metadata?: object | string;
      }>;
    };

    const expectedSecret = process.env.INBOX_BULK_SECRET;
    if (!expectedSecret) {
      res.status(503).json({ error: "INBOX_BULK_SECRET not configured on server" });
      return;
    }
    if (!body.secret || body.secret !== expectedSecret) {
      res.status(401).json({ error: "invalid secret" });
      return;
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: "items array required" });
      return;
    }
    if (body.items.length > 50) {
      res.status(400).json({ error: "max 50 items per call" });
      return;
    }

    const valid = body.items.filter((it) => it.content?.trim().length > 0);
    if (valid.length === 0) {
      res.status(400).json({ error: "no items with non-empty content" });
      return;
    }

    try {
      const ids: number[] = [];
      const insert = sqlite.prepare(
        `INSERT INTO inspiration_inbox (content, source_url, status, audience_tags, source, metadata)
         VALUES (?, ?, 'inbox', ?, ?, ?)`,
      );
      const tx = sqlite.transaction((rows: typeof valid) => {
        for (const r of rows) {
          const result = insert.run(
            r.content.trim(),
            r.sourceUrl?.trim() || null,
            normalizeAudienceTags(r.audienceTags),
            r.source?.trim() || "bulk_seed",
            normalizeMetadata(r.metadata),
          );
          ids.push(Number(result.lastInsertRowid));
        }
      });
      tx(valid);
      res.status(201).json({ inserted: valid.length, ids });
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
