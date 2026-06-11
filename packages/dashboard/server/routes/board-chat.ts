/**
 * /api/board-chat — the AI chat wired to board sources (Poppy-parity Phase 2).
 *
 * GET  /models                      models usable with the keys in env
 * GET  /:boardId/messages           persisted history
 * POST /:boardId/messages           send a turn — streams SSE back
 *                                   { message, modelId?, refs?: BoardChatRef[] }
 * DELETE /:boardId/messages         clear history
 * POST /develop                     push an assistant answer into the
 *                                   Inspiration Inbox, audience-tagged via the
 *                                   persona matcher  { content, model? }
 *
 * SSE events: {type:'token', text} · {type:'meta', tokensUsed, truncated,
 * missing} · {type:'done', messageId} · {type:'error', error}
 *
 * Context is assembled SERVER-side from media-asset ids (a single transcript
 * can be 60k chars — inlining refs client-side would blow the 2mb JSON cap).
 * Canvas node refs carry their text inline (canvas state lives client-side).
 */
import path from "path";
import { Router } from "express";
import { sqlite } from "../db.js";
import { assembleChatContext } from "../lib/chat-context.js";
import { streamChat, availableModels, providerForModel, type ChatTurn } from "../lib/model-router.js";
import { parsePersonas, scoreIdeaAgainstPersonas } from "../lib/persona-parser.js";
import type { BoardChatMessage, BoardChatRef } from "../../shared/types.js";

const HISTORY_TURNS_FOR_MODEL = 30;   // most recent turns sent to the model
const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Providers reject message arrays that start with 'assistant', contain
 * empty-content turns, or (Anthropic/Gemini) don't alternate roles — all of
 * which the persisted history can produce (failed streams leave consecutive
 * user rows; the 30-turn window can cut mid-pair). Normalize before sending.
 */
function normalizeTurns(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    if (!t.content.trim()) continue;
    if (!out.length && t.role === "assistant") continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === t.role) prev.content += `\n\n${t.content}`;
    else out.push({ role: t.role, content: t.content });
  }
  return out;
}

type Row = Record<string, unknown>;

function rowToMessage(r: Row): BoardChatMessage {
  let refs: BoardChatRef[] = [];
  if (r.refs_json) {
    try { refs = JSON.parse(r.refs_json as string); } catch { /* legacy/garbage */ }
  }
  return {
    id: r.id as number,
    boardId: r.board_id as string,
    role: r.role as "user" | "assistant",
    content: r.content as string,
    model: (r.model as string) ?? null,
    refs,
    createdAt: r.created_at as string,
  };
}

export function createBoardChatRouter(industryDir: string) {
  const router = Router();

  // ── GET /api/board-chat/models ────────────────────────────────────────────
  router.get("/models", (_req, res) => {
    res.json({ models: availableModels(), default: DEFAULT_MODEL });
  });

  // ── POST /api/board-chat/develop ──────────────────────────────────────────
  // (registered before /:boardId routes so 'develop' isn't matched as a board id)
  router.post("/develop", (req, res) => {
    try {
      const body = req.body as { content?: string; model?: string };
      const content = body.content?.trim();
      if (!content) { res.status(400).json({ error: "content is required" }); return; }

      // Audience-tag via the persona keyword matcher (top 2, same as the ranker).
      const personas = parsePersonas(path.join(industryDir, "audiences.md"));
      const matches = scoreIdeaAgainstPersonas(content, personas);
      const audienceTags = matches.slice(0, 2).map((m) => m.id);

      const result = sqlite.prepare(`
        INSERT INTO inspiration_inbox (content, source_url, status, audience_tags, source, metadata)
        VALUES (?, NULL, 'inbox', ?, 'board_chat', ?)
      `).run(
        content.slice(0, 4000),
        audienceTags.length ? audienceTags.join(",") : null,
        JSON.stringify({ model: body.model ?? null, developedAt: new Date().toISOString() }),
      );

      res.status(201).json({ ok: true, id: Number(result.lastInsertRowid), audienceTags });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── GET /api/board-chat/:boardId/messages ─────────────────────────────────
  router.get("/:boardId/messages", (req, res) => {
    const rows = sqlite.prepare(
      "SELECT * FROM board_messages WHERE board_id = ? ORDER BY id ASC",
    ).all(String(req.params.boardId)) as Row[];
    res.json({ messages: rows.map(rowToMessage) });
  });

  // ── DELETE /api/board-chat/:boardId/messages ──────────────────────────────
  router.delete("/:boardId/messages", (req, res) => {
    const result = sqlite.prepare("DELETE FROM board_messages WHERE board_id = ?").run(String(req.params.boardId));
    res.json({ ok: true, deleted: result.changes });
  });

  // ── POST /api/board-chat/:boardId/messages — SSE stream ──────────────────
  router.post("/:boardId/messages", async (req, res) => {
    const boardId = String(req.params.boardId);
    const body = req.body as { message?: string; modelId?: string; refs?: BoardChatRef[] };
    const message = body.message?.trim();
    if (!message) { res.status(400).json({ error: "message is required" }); return; }

    const modelId = body.modelId ?? DEFAULT_MODEL;
    if (!providerForModel(modelId)) {
      res.status(400).json({ error: `unknown model: ${modelId}` });
      return;
    }
    const refs = Array.isArray(body.refs) ? body.refs.slice(0, 20) : [];

    // Assemble context BEFORE opening the stream so validation errors are
    // plain JSON, and history reflects the state before this turn.
    let context;
    try {
      context = assembleChatContext(industryDir, refs);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      return;
    }

    const history = (sqlite.prepare(
      "SELECT * FROM board_messages WHERE board_id = ? ORDER BY id DESC LIMIT ?",
    ).all(boardId, HISTORY_TURNS_FOR_MODEL) as Row[]).reverse().map(rowToMessage);

    // Persist the user turn first — it survives even if the model call dies.
    sqlite.prepare(
      "INSERT INTO board_messages (board_id, role, content, refs_json) VALUES (?, 'user', ?, ?)",
    ).run(boardId, message, refs.length ? JSON.stringify(refs) : null);

    // The grounded sources ride on the user turn (not the system prompt) so
    // history turns don't replay stale context blocks.
    const turns: ChatTurn[] = normalizeTurns([
      ...history.map((m): ChatTurn => ({ role: m.role, content: m.content })),
      { role: "user", content: context.contextBlock + message },
    ]);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (data: Record<string, unknown>) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Detect client disconnect via res 'close' + writableEnded — req 'close'
    // fires when the request BODY completes (Node 16+), i.e. ~immediately.
    const abortController = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abortController.abort();
    });

    sendEvent({ type: "meta", tokensUsed: context.tokensUsed, truncated: context.truncated, missing: context.missing });

    let fullText = "";
    try {
      for await (const token of streamChat({
        modelId: modelId as Parameters<typeof streamChat>[0]["modelId"],
        system: context.system,
        messages: turns,
        signal: abortController.signal,
      })) {
        fullText += token;
        sendEvent({ type: "token", text: token });
      }

      // Skip empty completions — an empty assistant row would poison every
      // subsequent provider call on this board (empty content is rejected).
      if (fullText.trim()) {
        const result = sqlite.prepare(
          "INSERT INTO board_messages (board_id, role, content, model) VALUES (?, 'assistant', ?, ?)",
        ).run(boardId, fullText, modelId);
        sendEvent({ type: "done", messageId: Number(result.lastInsertRowid) });
      } else {
        sendEvent({ type: "done", messageId: null });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const aborted = abortController.signal.aborted || /abort/i.test(msg);
      if (fullText.trim()) {
        // Keep partial answers in history — on disconnect AND on provider
        // errors (the client's local copy is wiped by the history refetch).
        sqlite.prepare(
          "INSERT INTO board_messages (board_id, role, content, model) VALUES (?, 'assistant', ?, ?)",
        ).run(boardId, fullText + "\n[response interrupted]", modelId);
      }
      if (!aborted) {
        console.error("[board-chat] stream failed:", msg);
        sendEvent({ type: "error", error: msg });
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  });

  return router;
}
