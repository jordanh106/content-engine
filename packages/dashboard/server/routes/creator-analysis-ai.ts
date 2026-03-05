import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { parseWatchlist, invalidateWatchlistCache } from "../parsers/watchlist.js";
import { parseCreatorInsights, invalidateCreatorInsightsCache } from "../parsers/creator-insights.js";
import { updateCreatorInFile } from "./watchlist.js";

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

  // POST /:handle/analyze
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
      let finalText = "";
      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: systemPrompt,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: userContent }],
        });

        // Handle multi-turn tool use loop
        type MessageParam = { role: "user" | "assistant"; content: string | Anthropic.ContentBlockParam[] };
        const messages: MessageParam[] = [{ role: "user", content: userContent }];
        let currentResponse = response;

        while (currentResponse.stop_reason === "tool_use") {
          messages.push({ role: "assistant", content: currentResponse.content as Anthropic.ContentBlockParam[] });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of currentResponse.content) {
            if (block.type === "tool_use") {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: "Search completed",
              });
            }
          }
          messages.push({ role: "user", content: toolResults });

          currentResponse = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: systemPrompt,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            messages: messages as Anthropic.MessageParam[],
          });
        }

        for (const block of currentResponse.content) {
          if (block.type === "text") finalText += block.text;
        }
      } catch (toolError) {
        // Fallback: no web search
        console.warn("[creator-analysis-ai] web_search not available, falling back:", toolError instanceof Error ? toolError.message : "unknown");
        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent + "\n\n(Note: Web search is not available. Use your training knowledge and the provided context to analyze this creator.)" }],
        });

        for (const block of response.content) {
          if (block.type === "text") finalText += block.text;
        }
      }

      if (!finalText) {
        res.status(500).json({ error: "No analysis generated" });
        return;
      }

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
      const message = error instanceof Error ? error.message : "Analysis failed";
      console.error("[creator-analysis-ai] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
