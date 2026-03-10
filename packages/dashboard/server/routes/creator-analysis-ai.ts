import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { parseWatchlist, invalidateWatchlistCache } from "../parsers/watchlist.js";
import { parseCreatorInsights, invalidateCreatorInsightsCache } from "../parsers/creator-insights.js";
import { updateCreatorInFile } from "./watchlist.js";

async function callWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  options: { timeout: number },
  maxRetries = 2,
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.messages.create(params, options);
    } catch (err) {
      const isRateLimit = err instanceof Anthropic.RateLimitError;
      if (!isRateLimit || attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt + 1) * 1000;
      console.log(`[creator-analysis-ai] Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("Unreachable");
}

function buildSystemPrompt(
  brand: string,
  hookPatterns: string,
  config: string,
): string {
  return `You are a content creator analyst specializing in social media strategy for short-form video creators.

BRAND CONTEXT (the practice we're analyzing competitors for):
${brand.slice(0, 1000)}

KNOWN HOOK PATTERNS (identify which ones the creator uses):
${hookPatterns.slice(0, 1500)}

INDUSTRY CONFIG:
${config.slice(0, 500)}

ANALYSIS INSTRUCTIONS:
1. Use web search to find the creator's recent content, follower count, and engagement patterns.
2. Analyze their hook patterns, content format preferences, and posting cadence.
3. Identify their strengths we can learn from and content gaps we can fill.
4. Extract hook patterns adapted to our brand voice.

OUTPUT FORMAT (use these exact markdown headers):
# Creator Analysis: @[handle]

**Platform:** [primary platform]
**Followers:** [count]
**Niche:** [their positioning]
**Analyzed:** [YYYY-MM-DD]

## Overview
[2-3 sentence summary]

## Top Performing Content
[List their best content with hook type and format analysis]

## Content Patterns
- [Pattern 1]
- [Pattern 2]
- [etc.]

## Hook Preferences
- [Hook style 1]
- [Hook style 2]
- [etc.]

## Format Preferences
- [Format mapping to our A-G system]

## Posting Frequency
- [Cadence details]

## Key Takeaways
- [Takeaway 1]
- [Takeaway 2]
- [etc.]

## Gaps (Opportunities for Us)
- [Gap 1]
- [Gap 2]

## Hooks Worth Adapting
| Their Hook | Our Version | Format | Platform |
|-----------|-------------|--------|----------|

## Content Ideas Inspired By This Creator
| Idea | Format | Hook Angle | Priority |
|------|--------|------------|----------|

RULES:
- No emdashes. Use commas, periods, or restructure.
- Be specific with examples, not generic.
- Map their content to our format system (A-G).
- Focus on actionable intelligence.`;
}

export function createCreatorAnalysisAiRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const watchlistPath = path.join(industryDir, "watchlist.md");
  const creatorInsightsDir = path.join(industryDir, "creator-insights");
  const hookPatternsPath = path.join(industryDir, "hook-patterns.md");
  const configPath = path.join(industryDir, "config.json");
  const brandPath = path.join(industryDir, "brand.md");

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn("[creator-analysis-ai] ANTHROPIC_API_KEY not set.");
  }

  // POST /:handle/trigger - Primary endpoint: uses n8n workflow, falls back to direct API
  router.post("/:handle/trigger", async (req, res) => {
    const rawHandle = req.params.handle;
    const handle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;
    const cleanHandle = handle.replace("@", "").toLowerCase();
    const webhookUrl = process.env.N8N_CREATOR_ANALYSIS_WEBHOOK_URL;

    if (!webhookUrl) {
      // No n8n configured - forward to direct API fallback
      console.log("[creator-analysis-ai] No n8n webhook configured, using direct API fallback");
      req.url = `/${rawHandle}/analyze`;
      req.params.handle = rawHandle;
      return router(req, res, () => {
        res.status(404).json({ error: "Analysis endpoint not found" });
      });
    }

    try {
      // Load creator context from watchlist
      const creators = parseWatchlist(watchlistPath);
      const creator = creators.find((c) => c.handle.toLowerCase() === handle.toLowerCase());

      // Call n8n webhook (synchronous - waits for workflow to complete)
      console.log(`[creator-analysis-ai] Triggering n8n workflow for ${handle}`);
      const n8nResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          platform: creator?.platform || "",
          followers: creator?.followers || "",
          whyTracking: creator?.whyTracking || "",
          contentStyle: creator?.contentStyle || "",
        }),
        signal: AbortSignal.timeout(240_000),
      });

      if (!n8nResponse.ok) {
        const errText = await n8nResponse.text().catch(() => "Unknown error");
        throw new Error(`n8n workflow failed (${n8nResponse.status}): ${errText}`);
      }

      const result = await n8nResponse.json() as { success?: boolean; markdown?: string; handle?: string; analyzedAt?: string };

      if (!result.markdown) {
        throw new Error("n8n workflow returned no markdown");
      }

      // Strip preamble
      let markdown = result.markdown;
      const headerIdx = markdown.indexOf("\n# ");
      if (headerIdx > 0) markdown = markdown.slice(headerIdx + 1);

      // Save to creator-insights
      fs.mkdirSync(creatorInsightsDir, { recursive: true });
      const insightPath = path.join(creatorInsightsDir, `${cleanHandle}.md`);
      fs.writeFileSync(insightPath, markdown);
      invalidateCreatorInsightsCache();

      // Update lastAnalyzed in watchlist.md
      const today = new Date().toISOString().split("T")[0];
      if (creator) {
        updateCreatorInFile(watchlistPath, handle, { lastAnalyzed: today });
        invalidateWatchlistCache();
      }

      // Parse the saved insight for structured response
      const updatedInsights = parseCreatorInsights(creatorInsightsDir);
      const newInsight = updatedInsights.get(cleanHandle);

      res.json({ success: true, handle, insight: newInsight });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      console.error("[creator-analysis-ai] n8n trigger error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /:handle/analyze - Direct API fallback (used when n8n not configured)
  router.post("/:handle/analyze", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY in .env" });
      return;
    }

    const rawHandle = req.params.handle;
    const handle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;
    const cleanHandle = handle.replace("@", "").toLowerCase();

    try {
      // Load context
      const creators = parseWatchlist(watchlistPath);
      const creator = creators.find((c) => c.handle.toLowerCase() === handle.toLowerCase());
      const existingInsights = parseCreatorInsights(creatorInsightsDir);
      const existingInsight = existingInsights.get(cleanHandle);

      const brand = fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8") : "";
      const hookPatterns = fs.existsSync(hookPatternsPath) ? fs.readFileSync(hookPatternsPath, "utf-8") : "";
      const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf-8") : "";

      const systemPrompt = buildSystemPrompt(brand, hookPatterns, config);

      let userContent = `Analyze the content creator ${handle}. Search for their social media presence and recent content.`;
      if (creator) {
        userContent += `\n\nKnown info:\n- Platform: ${creator.platform}\n- Followers: ${creator.followers}\n- Why tracking: ${creator.whyTracking}\n- Content style: ${creator.contentStyle}\n- Frequency: ${creator.frequency}`;
      }
      if (existingInsight) {
        userContent += `\n\nPrevious analysis exists (${existingInsight.analyzedAt}). Update with fresh data. Previous key takeaways:\n${existingInsight.keyTakeaways.slice(0, 5).map((t) => `- ${t}`).join("\n")}`;
      }

      // Try with web_search tool first, fall back to without
      // web_search_20250305 is a server-side tool - the API executes searches internally
      // and returns results in a single response (no client-side tool-use loop needed)
      let finalText = "";
      try {
        const response = await callWithRetry(client, {
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: systemPrompt,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: userContent }],
        }, { timeout: 120_000 });

        for (const block of response.content) {
          if (block.type === "text") finalText += block.text;
        }
      } catch (toolError) {
        // Fallback: no web search
        console.warn("[creator-analysis-ai] web_search not available, falling back:", toolError instanceof Error ? toolError.message : "unknown");
        const response = await callWithRetry(client, {
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent + "\n\n(Note: Web search is not available. Use your training knowledge and the provided context to analyze this creator.)" }],
        }, { timeout: 90_000 });

        for (const block of response.content) {
          if (block.type === "text") finalText += block.text;
        }
      }

      if (!finalText) {
        res.status(500).json({ error: "No analysis generated" });
        return;
      }

      // Strip AI preamble (e.g. "Let me compile...") before the markdown header
      const headerIdx = finalText.indexOf("\n# ");
      if (headerIdx > 0) finalText = finalText.slice(headerIdx + 1);

      // Save to creator-insights
      fs.mkdirSync(creatorInsightsDir, { recursive: true });
      const insightPath = path.join(creatorInsightsDir, `${cleanHandle}.md`);
      fs.writeFileSync(insightPath, finalText);
      invalidateCreatorInsightsCache();

      // Update lastAnalyzed in watchlist.md
      const today = new Date().toISOString().split("T")[0];
      if (creator) {
        updateCreatorInFile(watchlistPath, handle, { lastAnalyzed: today });
        invalidateWatchlistCache();
      }

      // Parse the saved insight for structured response
      const updatedInsights = parseCreatorInsights(creatorInsightsDir);
      const newInsight = updatedInsights.get(cleanHandle);

      res.json({
        success: true,
        handle,
        insight: newInsight,
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        console.warn("[creator-analysis-ai] Rate limited after retries");
        res.status(429).json({ error: "Rate limited. Wait a minute and try again." });
        return;
      }
      const message = error instanceof Error ? error.message : "Analysis failed";
      console.error("[creator-analysis-ai] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
