import fs from "fs";
import path from "path";
import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseWatchlist } from "../parsers/watchlist.js";
import { sqlite } from "../db.js";

function extractJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return match[0];
  }
  return cleaned;
}

export function createResearchRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);

  const client = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  function loadContext(): {
    configSummary: string;
    librarySummary: string;
    watchlistSummary: string;
  } {
    let configSummary = "";
    try {
      const configPath = path.join(industryDir, "config.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
        industry?: string;
        niche?: string;
        audiences?: Array<{ label: string; description?: string }>;
        platforms?: string[];
      };
      configSummary = `Industry: ${config.industry || config.niche || "chiropractic"}
Platforms: ${(config.platforms || []).join(", ")}
Audiences: ${(config.audiences || []).map((a) => a.label).join(", ")}`;
    } catch {
      configSummary = "Industry: chiropractic";
    }

    let librarySummary = "";
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      librarySummary = videos.map((v) => `${v.code}: "${v.title}" (Format ${v.format}, ${v.audienceLabel})`).join("\n");
    } catch {
      librarySummary = "";
    }

    let watchlistSummary = "";
    try {
      const creators = parseWatchlist(path.join(industryDir, "watchlist.md"));
      watchlistSummary = creators
        .map((c) => `@${c.handle} (${c.platform}, ${c.followers} followers)`)
        .join("\n");
    } catch {
      watchlistSummary = "";
    }

    return { configSummary, librarySummary, watchlistSummary };
  }

  async function callClaudeStream(
    prompt: string,
    req: Request,
    res: Response,
    routeName: string
  ): Promise<void> {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    // Send SSE headers immediately — resolves fetch() on client before Anthropic call
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (data: Record<string, unknown>) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 6000,
      messages: [{ role: "user", content: prompt }],
    });

    // Abort Anthropic stream when client disconnects (panel closed, navigate away)
    req.on("close", () => stream.abort());

    let fullText = "";
    let lastProgressChars = 0;

    stream.on("text", (textChunk: string) => {
      fullText += textChunk;
      if (fullText.length - lastProgressChars >= 100) {
        sendEvent({ type: "progress", chars: fullText.length });
        lastProgressChars = fullText.length;
      }
    });

    try {
      await stream.finalMessage();
      const parsed = JSON.parse(extractJSON(fullText));
      sendEvent({ type: "result", data: parsed });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        const status = (err as { status?: number }).status;
        const msg = status === 429
          ? "Rate limited — wait 30 seconds and try again."
          : err instanceof Error ? err.message : "Research failed";
        console.error(`[research/${routeName}] Error:`, msg);
        sendEvent({ type: "error", message: msg });
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  // POST /api/research/viral-scout
  router.post("/viral-scout", async (req, res) => {
    const { configSummary, librarySummary } = loadContext();

    const prompt = `You are a field scout who just spent 4 hours studying chiropractic and family wellness content on TikTok, Instagram, and YouTube. This is your field report — present tense, urgent. Describe what you OBSERVED. Show mechanics in action. Write hooks as verbatim text. Give concrete adaptations, not suggestions.

CONTEXT:
${configSummary}

EXISTING CONTENT (avoid duplicating):
${librarySummary.slice(0, 1000)}

Respond with JSON only (no markdown):
{
  "summary": "2-3 sentences — what is hitting RIGHT NOW in chiropractic/wellness content?",
  "reelTape": [
    {
      "mechanic": "mechanic name",
      "whatHappensOnScreen": "exact scene description — camera, action, text, cuts",
      "whyItStops": "psychological reason it stops scroll",
      "hookText": "verbatim hook line",
      "ourVersion": "CFC adaptation — specific",
      "timeToExecute": "15min|30min|1hr",
      "format": "A|B|C|D|E|F|G",
      "platform": "TikTok|Instagram|YouTube"
    }
  ],
  "shelfLifeRadar": [
    {
      "topic": "topic name",
      "trendPhase": "emerging|peak|cooling",
      "windowDays": 14,
      "signalSource": "why you believe this phase",
      "audienceMatch": "which CFC audience",
      "platformBet": "best platform right now"
    }
  ],
  "weeklySteal": [
    {
      "videoTitle": "compelling video title",
      "hook": "verbatim first 3 seconds",
      "structure": "Hook (3s) → ... → CTA (5s)",
      "format": "A|B|C|D|E|F|G",
      "estimatedRuntime": "e.g. 38 seconds",
      "platform": "TikTok|Instagram|YouTube",
      "whyThisWeek": "why film this now"
    }
  ]
}

Return exactly 3 reelTape items, 4 shelfLifeRadar items, and 3 weeklySteal items. Focus on prenatal, pediatric, and family wellness.`;

    await callClaudeStream(prompt, req, res, "viral-scout");
  });

  // POST /api/research/competitor-research
  router.post("/competitor-research", async (req, res) => {
    const { configSummary, librarySummary, watchlistSummary } = loadContext();

    const prompt = `You are a market strategist presenting a war room briefing on the prenatal/pediatric chiropractic content landscape. Your client is Collective Family Chiropractic — Webster-certified, Woodstock GA, specializing in prenatal and pediatric care.

Map content territory: unclaimed, contested, oversaturated. Identify specific creators missing specific things. Generate strategic positions, not content ideas. "Here's a topic" is an idea. "Here's the angle only we can own and how to execute it" is a position.

CONTEXT:
${configSummary}

WATCHLIST (already tracking):
${watchlistSummary.slice(0, 800)}

EXISTING CONTENT:
${librarySummary.slice(0, 800)}

Respond with JSON only (no markdown):
{
  "summary": "2-3 sentences — what is the actual competitive opportunity right now?",
  "territoryMap": {
    "claim": [
      {
        "territory": "territory name",
        "whyUnclaimed": "why no one owns this",
        "ownershipAngle": "how CFC executes and claims it",
        "format": "A|B|C|D|E|F|G",
        "seriesPotential": true
      }
    ],
    "contest": [
      {
        "territory": "territory name",
        "whoOwnsIt": "@handle1, @handle2",
        "ourDifferentiator": "what CFC does that they cannot"
      }
    ],
    "avoid": [
      {
        "territory": "territory name",
        "why": "why this is a trap"
      }
    ]
  },
  "positioningGaps": [
    {
      "gapName": "gap name",
      "gapDescription": "what's missing and why it matters",
      "whoMissesIt": ["@handle1"],
      "ourOwnershipPlay": "concrete content play CFC makes",
      "audienceLanguage": "exact words audience uses searching for this",
      "timeToOwn": "weeks|months|long-term"
    }
  ],
  "creatorDossiers": [
    {
      "handle": "@handle",
      "platform": "Instagram|TikTok|YouTube",
      "strength": "what they do well",
      "blindspot": "their specific weakness",
      "ourCounter": "how CFC exploits this gap",
      "topicsTheyOwn": ["topic1", "topic2"],
      "topicsTheyIgnore": ["topic1", "topic2"],
      "addToWatchlist": true
    }
  ]
}

Return 2-3 claim territories, 2 contest territories, 2 avoid territories, 2-3 positioningGaps, and 2 creatorDossiers. Be specific — name real creators, describe exact gaps.`;

    await callClaudeStream(prompt, req, res, "competitor-research");
  });

  // POST /api/research/save
  router.post("/save", (req, res) => {
    const { type, data } = req.body as { type?: string; data?: unknown };
    if (!type || !data) {
      res.status(400).json({ error: "type and data required" });
      return;
    }
    try {
      const stmt = sqlite.prepare("INSERT INTO research_reports (type, data) VALUES (?, ?)");
      const result = stmt.run(type, JSON.stringify(data));
      res.json({ id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ error: "Failed to save report" });
    }
  });

  // GET /api/research/history?type=viral-scout&limit=10
  router.get("/history", (req, res) => {
    const type = req.query.type as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    try {
      const rows = type
        ? sqlite.prepare("SELECT id, type, created_at FROM research_reports WHERE type = ? ORDER BY created_at DESC LIMIT ?").all(type, limit)
        : sqlite.prepare("SELECT id, type, created_at FROM research_reports ORDER BY created_at DESC LIMIT ?").all(limit);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  // GET /api/research/report/:id
  router.get("/report/:id", (req, res) => {
    try {
      const row = sqlite.prepare("SELECT * FROM research_reports WHERE id = ?").get(req.params.id) as { id: number; type: string; data: string; created_at: string } | undefined;
      if (!row) { res.status(404).json({ error: "Report not found" }); return; }
      res.json({ ...row, data: JSON.parse(row.data) });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  return router;
}
