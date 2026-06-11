/**
 * /api/boards — persistent named canvases (Poppy-parity Phase 3).
 *
 * GET    /          board summaries (id, name, nodeCount, updatedAt)
 * POST   /          create board { name?, nodes?, edges?, migrateChatFromCanvasV1? }
 * GET    /:id       full board (nodes + edges)
 * PUT    /:id       save { name?, nodes?, edges? } — partial update
 * DELETE /:id       remove board + its chat history
 *
 * nodes/edges are opaque serialized React Flow state — the server never
 * interprets them beyond JSON validity. The client strips handler functions
 * before saving (same rule as the old localStorage path).
 */
import { Router } from "express";
import { sqlite } from "../db.js";
import type { Board, BoardSummary } from "../../shared/types.js";

type Row = Record<string, unknown>;

function parseJsonArray(raw: unknown): unknown[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToBoard(r: Row): Board {
  return {
    id: r.id as number,
    name: r.name as string,
    nodes: parseJsonArray(r.nodes_json),
    edges: parseJsonArray(r.edges_json),
    updatedAt: r.updated_at as string,
  };
}

/** The chat id BoardChat uses for a given board row. */
export function chatBoardId(boardId: number): string {
  return `board-${boardId}`;
}

export function createBoardsRouter() {
  const router = Router();

  // ── GET /api/boards ─────────────────────────────────────────────────────────
  router.get("/", (_req, res) => {
    const rows = sqlite.prepare(`
      SELECT id, name, updated_at, json_array_length(nodes_json) AS node_count
      FROM boards ORDER BY updated_at DESC
    `).all() as Row[];
    const boards: BoardSummary[] = rows.map((r) => ({
      id: r.id as number,
      name: r.name as string,
      nodeCount: (r.node_count as number) ?? 0,
      updatedAt: r.updated_at as string,
    }));
    res.json({ boards });
  });

  // ── POST /api/boards ────────────────────────────────────────────────────────
  router.post("/", (req, res) => {
    try {
      const body = req.body as {
        name?: string;
        nodes?: unknown[];
        edges?: unknown[];
        /** One-time migration: adopt the pre-Phase-3 'canvas-v1' chat history. */
        migrateChatFromCanvasV1?: boolean;
      };
      const name = (body.name ?? "").trim().slice(0, 80) || "Untitled board";
      const nodes = Array.isArray(body.nodes) ? body.nodes : [];
      const edges = Array.isArray(body.edges) ? body.edges : [];

      // The migration POST is a bootstrap: it must be idempotent, because
      // React StrictMode double-fires the client's mount effect (and two
      // tabs can race). If a board already exists, return it instead of
      // creating a duplicate — the first caller owns the chat migration.
      if (body.migrateChatFromCanvasV1) {
        const bootstrap = sqlite.transaction(() => {
          const existing = sqlite.prepare("SELECT * FROM boards ORDER BY id ASC LIMIT 1").get() as Row | undefined;
          if (existing) return { row: existing, created: false };
          const result = sqlite.prepare(
            "INSERT INTO boards (name, nodes_json, edges_json) VALUES (?, ?, ?)",
          ).run(name, JSON.stringify(nodes), JSON.stringify(edges));
          const id = Number(result.lastInsertRowid);
          sqlite.prepare("UPDATE board_messages SET board_id = ? WHERE board_id = 'canvas-v1'")
            .run(chatBoardId(id));
          const row = sqlite.prepare("SELECT * FROM boards WHERE id = ?").get(id) as Row;
          return { row, created: true };
        });
        const { row, created } = bootstrap();
        res.status(created ? 201 : 200).json({ board: rowToBoard(row) });
        return;
      }

      const result = sqlite.prepare(
        "INSERT INTO boards (name, nodes_json, edges_json) VALUES (?, ?, ?)",
      ).run(name, JSON.stringify(nodes), JSON.stringify(edges));
      const row = sqlite.prepare("SELECT * FROM boards WHERE id = ?").get(Number(result.lastInsertRowid)) as Row;
      res.status(201).json({ board: rowToBoard(row) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── GET /api/boards/:id ─────────────────────────────────────────────────────
  router.get("/:id", (req, res) => {
    const row = sqlite.prepare("SELECT * FROM boards WHERE id = ?").get(Number(req.params.id)) as Row | undefined;
    if (!row) { res.status(404).json({ error: "board not found" }); return; }
    res.json({ board: rowToBoard(row) });
  });

  // ── PUT /api/boards/:id ─────────────────────────────────────────────────────
  router.put("/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const exists = sqlite.prepare("SELECT id FROM boards WHERE id = ?").get(id);
      if (!exists) { res.status(404).json({ error: "board not found" }); return; }

      const body = req.body as { name?: string; nodes?: unknown[]; edges?: unknown[] };
      const sets: string[] = [];
      const params: unknown[] = [];
      if (typeof body.name === "string" && body.name.trim()) {
        sets.push("name = ?");
        params.push(body.name.trim().slice(0, 80));
      }
      if (Array.isArray(body.nodes)) {
        sets.push("nodes_json = ?");
        params.push(JSON.stringify(body.nodes));
      }
      if (Array.isArray(body.edges)) {
        sets.push("edges_json = ?");
        params.push(JSON.stringify(body.edges));
      }
      if (!sets.length) { res.status(400).json({ error: "nothing to update" }); return; }

      sets.push("updated_at = datetime('now')");
      sqlite.prepare(`UPDATE boards SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── DELETE /api/boards/:id ──────────────────────────────────────────────────
  router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    const result = sqlite.prepare("DELETE FROM boards WHERE id = ?").run(id);
    if (!result.changes) { res.status(404).json({ error: "board not found" }); return; }
    sqlite.prepare("DELETE FROM board_messages WHERE board_id = ?").run(chatBoardId(id));
    res.json({ ok: true });
  });

  return router;
}
