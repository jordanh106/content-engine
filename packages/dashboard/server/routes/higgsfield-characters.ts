/**
 * Higgsfield Soul Characters — CRUD + activation.
 * Syncs the SQLite mirror table with the CLI's `higgsfield soul-id list`.
 * Exposes endpoints for the dashboard to manage which character is "active"
 * so generations can auto-inject the soul_id as a reference.
 */
import { Router } from "express";
import { sqlite } from "../db.js";
import {
  isConfigured,
  listSoulCharacters,
  createSoulCharacter,
  uploadMediaFromUrl,
  uploadMediaFromPath,
} from "../lib/higgsfield-client.js";

type CharacterRow = {
  id: number;
  name: string;
  soul_id: string;
  training_image_ids: string | null;
  thumbnail_url: string | null;
  status: string;
  active: number;
  created_at: string;
};

export function createHiggsfieldCharactersRouter() {
  const router = Router();

  // GET /api/higgsfield/characters — list (mirrors SQLite, sync-on-demand)
  router.get("/", async (req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield not configured" });
      return;
    }
    const sync = req.query.sync === "1";
    if (sync) await syncFromCli();
    const rows = sqlite
      .prepare("SELECT * FROM higgsfield_characters ORDER BY active DESC, name")
      .all() as CharacterRow[];
    res.json({
      characters: rows.map((r) => ({
        id: r.id,
        name: r.name,
        soulId: r.soul_id,
        status: r.status,
        active: r.active === 1,
        thumbnailUrl: r.thumbnail_url,
        createdAt: r.created_at,
      })),
      active: rows.find((r) => r.active === 1)
        ? {
            soulId: rows.find((r) => r.active === 1)!.soul_id,
            name: rows.find((r) => r.active === 1)!.name,
          }
        : null,
    });
  });

  // POST /api/higgsfield/characters/sync — pull from CLI, upsert into SQLite
  router.post("/sync", async (_req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield not configured" });
      return;
    }
    try {
      const synced = await syncFromCli();
      res.json({ synced });
    } catch (e) {
      res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  // POST /api/higgsfield/characters — train a new character
  // Body: { name: string, imageUrls: string[] (5-20), model?: "soul-2" | "soul-cinematic" }
  router.post("/", async (req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield not configured" });
      return;
    }
    try {
      const { name, imageUrls, imagePaths, model } = req.body as {
        name: string;
        imageUrls?: string[];
        imagePaths?: string[];
        model?: "soul-2" | "soul-cinematic";
      };
      if (!name) {
        res.status(400).json({ error: "name required" });
        return;
      }
      const allRefs = [...(imageUrls || []), ...(imagePaths || [])];
      if (allRefs.length < 5) {
        res.status(400).json({ error: "5+ reference images required" });
        return;
      }
      // Upload each reference
      const uploadIds: string[] = [];
      for (const ref of allRefs) {
        const id = /^https?:\/\//i.test(ref)
          ? await uploadMediaFromUrl(ref)
          : await uploadMediaFromPath(ref);
        uploadIds.push(id);
      }
      const result = await createSoulCharacter({ name, imageUploadIds: uploadIds, model });
      sqlite
        .prepare(
          `INSERT INTO higgsfield_characters (name, soul_id, training_image_ids, status, active)
           VALUES (?, ?, ?, ?, 0)`,
        )
        .run(name, result.id, JSON.stringify(uploadIds), result.status);
      res.json({ soulId: result.id, status: result.status });
    } catch (e) {
      console.error("[hf/characters] create error:", e);
      res.status(500).json({ error: String(e instanceof Error ? e.message : e) });
    }
  });

  // POST /api/higgsfield/characters/:id/activate — set as the sole active character
  router.post("/:id/activate", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad id" });
      return;
    }
    sqlite.transaction(() => {
      sqlite.prepare("UPDATE higgsfield_characters SET active = 0").run();
      sqlite.prepare("UPDATE higgsfield_characters SET active = 1 WHERE id = ?").run(id);
    })();
    const row = sqlite.prepare("SELECT * FROM higgsfield_characters WHERE id = ?").get(id) as CharacterRow | undefined;
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json({ active: { soulId: row.soul_id, name: row.name } });
  });

  // POST /api/higgsfield/characters/deactivate — clear active selection
  router.post("/deactivate", (_req, res) => {
    sqlite.prepare("UPDATE higgsfield_characters SET active = 0").run();
    res.json({ active: null });
  });

  // DELETE /api/higgsfield/characters/:id — soft delete from local mirror (Higgsfield retains)
  router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad id" });
      return;
    }
    sqlite.prepare("DELETE FROM higgsfield_characters WHERE id = ?").run(id);
    res.json({ deleted: id });
  });

  return router;
}

/** Pull the latest character list from the CLI, upsert into SQLite. Idempotent. */
async function syncFromCli(): Promise<number> {
  const remote = await listSoulCharacters();
  const upsert = sqlite.prepare(
    `INSERT INTO higgsfield_characters (name, soul_id, status, active)
     VALUES (?, ?, ?, 0)
     ON CONFLICT(soul_id) DO UPDATE SET name = excluded.name, status = excluded.status`,
  );
  let count = 0;
  for (const c of remote) {
    upsert.run(c.name, c.id, c.status);
    count++;
  }
  return count;
}
