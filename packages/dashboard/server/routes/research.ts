import fs from "fs";
import path from "path";
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseHookPatterns } from "../parsers/hook-patterns.js";
import { parseWatchlist } from "../parsers/watchlist.js";
import type { ResearchResult } from "../../shared/types.js";

function stripCodeFences(text: string): string {
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
    hookSummary: string;
    librarySummary: string;
    watchlistSummary: string;
  } {
    // Config
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

    // Hook patterns
    let hookSummary = "";
    try {
      const patterns = parseHookPatterns(path.join(industryDir, "hook-patterns.md"));
      hookSummary = patterns
        .slice(0, 4)
        .map((cat) => `${cat.name}: ${cat.patterns.slice(0, 2).map((p) => `"${p.example}"`).join(", ")}`)
        .join("\n");
    } catch {
      hookSummary = "";
    }

    // Content library (titles only for gap detection)
    let librarySummary = "";
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      librarySummary = videos.map((v) => `${v.code}: "${v.title}" (Format ${v.format}, ${v.audienceLabel})`).join("\n");
    } catch {
      librarySummary = "";
    }

    // Watchlist
    let watchlistSummary = "";
    try {
      const creators = parseWatchlist(path.join(industryDir, "watchlist.md"));
      watchlistSummary = creators
        .map((c) => `@${c.handle} (${c.platform}, ${c.followers} followers) - ${c.whyTracking?.slice(0, 100)}`)
        .join("\n");
    } catch {
      watchlistSummary = "";
    }

    return { configSummary, hookSummary, librarySummary, watchlistSummary };
  }

  // POST /api/research/viral-scout
  router.post("/viral-scout", async (_req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { configSummary, hookSummary, librarySummary } = loadContext();

      const prompt = `You are a content strategist specializing in chiropractic social media. Search for the most viral and trending chiropractic content right now across TikTok, Instagram Reels, and YouTube Shorts.

CONTEXT:
${configSummary}

EXISTING CONTENT (don't suggest duplicates):
${librarySummary.slice(0, 3000)}

PROVEN HOOK PATTERNS WE USE:
${hookSummary}

Search for:
1. Viral chiropractic videos from the last 2-4 weeks (views, engagement patterns)
2. Trending topics and hooks working right now in the chiropractic niche
3. Prenatal/pediatric chiropractic content that's performing well
4. Hook types and formats driving saves/shares in health/wellness content

Respond with JSON only (no markdown):
{
  "summary": "2-3 sentence overview of what's trending right now",
  "patterns": [
    {
      "name": "pattern name",
      "hookType": "question|statistic|myth|story|challenge",
      "example": "exact hook text example from research",
      "ourAdaptation": "how we'd adapt this for Collective Family Chiropractic",
      "formatMatch": "A|B|C|D|E|F|G",
      "platform": "TikTok|Instagram|YouTube",
      "priority": "high|medium|low"
    }
  ],
  "topicHotspots": [
    {
      "topic": "topic name",
      "platform": "where it's trending",
      "whyHot": "why this is resonating right now",
      "audienceMatch": "which of our audiences this serves"
    }
  ],
  "contentIdeas": [
    {
      "topic": "specific video topic",
      "format": "A|B|C|D|E|F|G",
      "hookAngle": "the opening hook to use",
      "priority": "high|medium|low",
      "platform": "primary platform"
    }
  ]
}

Return 4-6 patterns, 4-6 topic hotspots, and 6-8 content ideas. Focus on what's actionable for a small family chiropractic practice.`;

      const responsePromise = client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        tools: [{
          type: "web_search_20250305" as const,
          name: "web_search" as const,
          max_uses: 3,
        }],
        messages: [{ role: "user", content: prompt }],
      }, { timeout: 90_000 });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Research timed out after 100s")), 100_000),
      );

      const response = await Promise.race([responsePromise, timeoutPromise]);

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text)) as ResearchResult;
      res.json(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research failed";
      console.error("[research/viral-scout] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/research/competitor-research
  router.post("/competitor-research", async (_req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { configSummary, hookSummary, librarySummary, watchlistSummary } = loadContext();

      const prompt = `You are a content strategist doing competitive intelligence for Collective Family Chiropractic, a family chiropractic practice in Woodstock, GA specializing in prenatal and pediatric care.

CONTEXT:
${configSummary}

CURRENT WATCHLIST (creators we already track):
${watchlistSummary.slice(0, 2000)}

EXISTING CONTENT (for gap detection):
${librarySummary.slice(0, 2000)}

PROVEN HOOK PATTERNS:
${hookSummary}

Research:
1. What are top chiropractic creators posting RIGHT NOW that's getting high engagement?
2. What content gaps exist in the prenatal/pediatric chiropractic space?
3. Are there any rising creators in the chiropractic or family wellness niche worth watching?
4. What formats and hooks are working for health/wellness creators this month?
5. What are local Woodstock/North Atlanta health practices doing on social (or NOT doing)?

Respond with JSON only (no markdown):
{
  "summary": "2-3 sentence competitive landscape overview",
  "patterns": [
    {
      "name": "pattern name",
      "hookType": "question|statistic|myth|story|challenge",
      "example": "exact hook text from a competitor's content",
      "ourAdaptation": "how we'd use this at Collective Family",
      "formatMatch": "A|B|C|D|E|F|G",
      "platform": "TikTok|Instagram|YouTube",
      "priority": "high|medium|low"
    }
  ],
  "topicHotspots": [
    {
      "topic": "topic name",
      "platform": "where it's trending",
      "whyHot": "why competitors are doing this well",
      "audienceMatch": "which audience this targets"
    }
  ],
  "contentIdeas": [
    {
      "topic": "specific video concept",
      "format": "A|B|C|D|E|F|G",
      "hookAngle": "opening hook",
      "priority": "high|medium|low",
      "platform": "primary platform"
    }
  ],
  "watchlistSuggestions": [
    {
      "handle": "@handle",
      "platform": "Instagram|TikTok|YouTube",
      "why": "why they're worth tracking"
    }
  ]
}

Return 4-5 patterns, 4-5 topic hotspots, 5-7 content ideas, and 2-4 watchlist suggestions. Prioritize gaps in the prenatal/pediatric/family wellness space.`;

      const responsePromise = client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        tools: [{
          type: "web_search_20250305" as const,
          name: "web_search" as const,
          max_uses: 3,
        }],
        messages: [{ role: "user", content: prompt }],
      }, { timeout: 90_000 });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Research timed out after 100s")), 100_000),
      );

      const response = await Promise.race([responsePromise, timeoutPromise]);

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text)) as ResearchResult;
      res.json(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research failed";
      console.error("[research/competitor-research] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
