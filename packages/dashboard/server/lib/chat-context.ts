/**
 * Board-chat context assembly.
 *
 * Builds the system prompt + grounded-context block for a chat turn:
 *   system  = brand voice + locked quarterly goal + audience persona summary
 *   context = the @-referenced sources, expanded server-side:
 *             - media refs by id → transcript / extracted text from media_assets
 *             - node refs carry their serialized text inline (canvas state
 *               lives client-side in localStorage; the server never sees it)
 *
 * Budgeting: 200k-token ceiling (matching Poppy's per-connection cap, ~4 chars
 * per token). References are packed first-to-last; an overflowing source is
 * truncated to the remaining budget and flagged so the UI can show it.
 */
import path from "path";
import { getCurrentBrandVoice, formatBrandVoiceForPrompt } from "./brand-voice.js";
import { readGoalLock } from "./idea-ranker.js";
import { parsePersonas } from "./persona-parser.js";
import { getMediaAsset, estimateTokens } from "./media-ingest.js";
import type { BoardChatRef } from "../../shared/types.js";

// 150k, not the full 200k of the smallest model window (Haiku) — leaves
// headroom for chat history, the user message, and the completion.
const CONTEXT_TOKEN_BUDGET = 150_000;
const NODE_TEXT_CAP = 8_000;          // chars — node refs are small canvas items

export type AssembledContext = {
  system: string;
  /** Grounded sources block to prepend to the user turn ("" when no refs). */
  contextBlock: string;
  tokensUsed: number;
  truncated: string[];                // labels of refs that got cut to fit
  missing: string[];                  // labels of refs that resolved to nothing
};

export function assembleChatContext(industryDir: string, refs: BoardChatRef[]): AssembledContext {
  // ── System prompt: voice + goal + audiences ────────────────────────────────
  const voice = formatBrandVoiceForPrompt(getCurrentBrandVoice(industryDir));
  const goal = readGoalLock(industryDir);
  const personas = parsePersonas(path.join(industryDir, "audiences.md"));

  const personaLine = personas.length
    ? `Audience segments: ${personas.map((p) => `${p.label} (${p.id})`).join(", ")}.`
    : "";

  const system = [
    "You are the creative partner inside Collective Family Chiropractic's content engine. You help brainstorm, script, compare sources, and shape content ideas into production-ready direction.",
    "",
    voice,
    "",
    goal ? `LOCKED QUARTERLY GOAL (filter every suggestion through this): ${goal.goalSummary}` : "",
    personaLine,
    "",
    "When sources are provided below, ground your answers in them — quote or reference them specifically rather than answering generically. NO emdashes in any drafted copy.",
  ].filter(Boolean).join("\n");

  // ── Context block from refs, budgeted ──────────────────────────────────────
  const systemTokens = estimateTokens(system);
  let remaining = CONTEXT_TOKEN_BUDGET - systemTokens;

  const parts: string[] = [];
  const truncated: string[] = [];
  const missing: string[] = [];

  for (const ref of refs) {
    let body: string | null = null;
    let header: string;

    if (ref.type === "media") {
      const asset = getMediaAsset(Number(ref.id));
      if (!asset) { missing.push(ref.label); continue; }
      header = `SOURCE [@${ref.label}] (${asset.kind}${asset.platform ? ` · ${asset.platform}` : ""}${asset.sourceUrl ? ` · ${asset.sourceUrl}` : ""})`;
      body = asset.transcript || asset.textContent || null;
      if (!body && asset.transcriptStatus === "pending" || !body && asset.transcriptStatus === "running") {
        body = `[transcript still processing — only metadata available]\ntitle: ${asset.title ?? "unknown"}\nauthor: ${asset.author ?? "unknown"}`;
      } else if (!body) {
        body = `[no text content available]\ntitle: ${asset.title ?? "unknown"}\nauthor: ${asset.author ?? "unknown"}`;
      }
    } else {
      header = `SOURCE [@${ref.label}] (canvas node)`;
      body = (ref.text ?? "").slice(0, NODE_TEXT_CAP) || null;
      if (!body) { missing.push(ref.label); continue; }
    }

    const bodyTokens = estimateTokens(body);
    if (bodyTokens > remaining) {
      const allowedChars = Math.max(0, remaining * 4);
      if (allowedChars < 200) { truncated.push(ref.label); continue; } // no meaningful room left
      body = body.slice(0, allowedChars) + "\n[...truncated to fit context budget]";
      truncated.push(ref.label);
    }

    parts.push(`${header}\n${body}`);
    remaining = Math.max(0, remaining - estimateTokens(body));
  }

  const contextBlock = parts.length
    ? `=== REFERENCED SOURCES ===\n\n${parts.join("\n\n---\n\n")}\n\n=== END SOURCES ===\n\n`
    : "";

  return {
    system,
    contextBlock,
    tokensUsed: CONTEXT_TOKEN_BUDGET - remaining,
    truncated,
    missing,
  };
}
