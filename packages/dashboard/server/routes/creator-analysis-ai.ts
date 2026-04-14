import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic, { RateLimitError, APIError } from "@anthropic-ai/sdk";
import { parseWatchlist, invalidateWatchlistCache } from "../parsers/watchlist.js";
import { parseCreatorInsights, invalidateCreatorInsightsCache } from "../parsers/creator-insights.js";
import { parseConfig } from "../parsers/config.js";
import { updateCreatorInFile } from "./watchlist.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithRetry<T>(fn: () => Promise<T>, label: string, maxRetries = 2): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error instanceof RateLimitError ||
        (error instanceof APIError && error.status === 429);
      if (isRateLimit && attempt < maxRetries) {
        const retryAfter = error instanceof APIError
          ? Number(error.headers?.get("retry-after")) || 0
          : 0;
        const waitSec = retryAfter > 0 ? retryAfter : 15 * (attempt + 1);
        console.log(`[${label}] Rate limited, retrying in ${waitSec}s (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(waitSec * 1000);
        continue;
      }
      if (isRateLimit) {
        throw new Error("Rate limit reached. Please wait a minute and try again.");
      }
      throw error;
    }
  }
  throw new Error("Unexpected retry exhaustion");
}

function buildCreatorAnalysisPrompt(
  brandVoice: string,
  audiences: string,
): string {
  return `You are a competitive intelligence analyst for Collective Family Chiropractic, a family chiropractic practice creating short-form video content.

BRAND CONTEXT:
${brandVoice}

TARGET AUDIENCES:
${audiences}

VIDEO FORMAT SYSTEM (map creator content to these):
- A (Explainer): 30-45s, "What Is [X]?" education/awareness
- B (Checklist): 30-45s, "Signs Your [X] Needs [Y]" shareability/saves
- C (Demo): 30-60s, exercise/tutorial actionable value
- D (Myth Buster): 15-30s, "Myth vs. Truth" engagement/comments
- E (Walkthrough): 45-60s, "What Happens During [X]" conversion
- F (Quick Tip): 6-15s, "Did You Know?" TikTok micro-content
- G (Patient Story): 15-30s, social proof/testimonials

TASK:
Use web search to deeply research the creator. You MUST search for:
1. Their social media profile(s) to get real follower counts and bio info
2. Their actual recent videos/posts with titles, hooks, and engagement metrics
3. Any press, interviews, or cross-platform presence

Search aggressively across different angles. Try platform-specific searches (e.g. "site:tiktok.com @handle", "site:instagram.com handle", "handle chiropractic tiktok").

QUALITY STANDARDS:
- Every claim must be backed by something you found in search results
- Cite specific video titles, post captions, or content examples you actually found
- If you found a video, include the hook text and approximate engagement
- Label anything you're inferring (vs. confirmed from search) as "[Inferred]"
- If the creator has very limited online presence, say so clearly in the Overview and produce a shorter, honest report. Do NOT fabricate fake video examples or engagement data
- A short, honest, data-backed report is always better than a long, fabricated one

OUTPUT FORMAT:
Return your analysis as markdown with these EXACT section headers (the parser depends on them):

# Creator Analysis: @{handle}

**Platform:** [primary platform(s)]
**Followers:** [count with platform breakdown, or "Not confirmed" if unknown]
**Niche:** [their positioning]
**Analyzed:** [today's date YYYY-MM-DD]

---

## Overview
[2-3 paragraph summary of who they are, their positioning, and content strategy. If limited data was found, state that clearly.]

---

## Top Performing Content
[5-7 numbered entries, each with: content description, Hook type annotation, Format designation (Format A/B/C etc.), engagement note. Only include real content you found. If you found fewer than 5, list what you found and note the gap.]

---

## Content Patterns
- [Pattern 1: specific observation with example]
- [Pattern 2]
- [5-8 bullet points]

---

## Hook Preferences
- [Hook style 1: with specific example from their content]
- [Hook style 2]
- [5-8 bullet points]

---

## Format Preferences
- [Map their content to Format A-G system with explanations]
- [3-5 bullet points]

---

## Posting Frequency
- [Platform-specific cadence details]

---

## Key Takeaways
- [Takeaway 1: actionable insight for our practice]
- [Takeaway 2]
- [8-10 bullet points, each mapping to something we can actually do]

---

## Gaps (Opportunities for Us)
- [Gap 1: specific content void they don't fill that we can]
- [Gap 2]
- [5-8 bullet points]

---

## Hooks Worth Adapting
| Their Hook | Our Version | Format | Platform |
|---|---|---|---|
| [their actual hook text] | [our chiropractic adaptation] | [A-G] | [platform] |
[5-7 rows]

---

## Content Ideas Inspired By This Creator
| Idea | Format | Hook Angle | Priority |
|---|---|---|---|
| [specific idea for our practice] | [A-G] | [hook approach] | [High/Medium/Low] |
[5-8 rows]

AFTER the markdown report, include an enrichment data block in this exact format (this will be parsed programmatically to update our database):

<!-- ENRICHMENT_JSON
{"followers": "[follower count with platform, e.g. '693K IG' or 'Not confirmed']", "platform": "[primary platform(s)]", "contentStyle": "[1-2 sentence summary of their content style]", "frequency": "[posting frequency, e.g. '5-6x/week' or 'Unknown']"}
-->

RULES:
- No emdashes in any text. Use commas, periods, or restructure.
- Be specific with examples, not generic observations.
- Every takeaway must map to something actionable for a family chiropractic practice.
- Cite specific content examples when possible.
- If search results are limited, say so honestly rather than fabricating details.
- The ENRICHMENT_JSON block must always be present, even if values are "Not confirmed" or "Unknown".`;
}

function parseEnrichmentJson(markdown: string): Record<string, string> {
  const match = markdown.match(/<!-- ENRICHMENT_JSON\s*\n([\s\S]*?)\n-->/);
  if (!match) return {};
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return {};
  }
}

function stripEnrichmentBlock(markdown: string): string {
  return markdown.replace(/\n*<!-- ENRICHMENT_JSON\s*\n[\s\S]*?\n-->\s*$/, "").trim();
}

export function createCreatorAnalysisAiRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const watchlistPath = path.join(industryDir, "watchlist.md");
  const creatorInsightsDir = path.join(industryDir, "creator-insights");
  const brandPath = path.join(industryDir, "brand.md");
  const configPath = path.join(industryDir, "config.json");

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn("[creator-analysis-ai] ANTHROPIC_API_KEY not set. Creator analysis will be unavailable.");
  }

  // POST /:handle/trigger - Analyze a creator using Anthropic API with web search
  router.post("/:handle/trigger", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY in .env" });
      return;
    }

    const rawHandle = req.params.handle;
    const handle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;
    const cleanHandle = handle.replace("@", "").toLowerCase();

    // Validate handle to prevent path traversal
    if (!/^[a-z0-9._-]+$/.test(cleanHandle)) {
      res.status(400).json({ error: "Invalid handle format" });
      return;
    }

    try {
      // Load creator context from watchlist
      const creators = parseWatchlist(watchlistPath);
      const creator = creators.find((c) => c.handle.toLowerCase() === handle.toLowerCase());

      // Load brand voice and config
      let brandVoice = "";
      try {
        brandVoice = fs.readFileSync(brandPath, "utf-8").slice(0, 2000);
      } catch {
        brandVoice = "Family chiropractic practice serving all ages.";
      }

      let audiences = "";
      try {
        const config = parseConfig(configPath);
        audiences = config.audiences.map((a) => a.label).join(", ");
      } catch {
        audiences = "pregnant women, parents with infants, kids and teens, athletes, adults with back/neck pain, seniors, general wellness";
      }

      const today = new Date().toISOString().split("T")[0];

      // Build the user message with creator context
      const creatorContext = creator
        ? `Known info about this creator:
- Platform: ${creator.platform || "unknown"}
- Followers: ${creator.followers || "unknown"}
- Why we track them: ${creator.whyTracking || "not specified"}
- Content style: ${creator.contentStyle || "not specified"}
- Posting frequency: ${creator.frequency || "unknown"}`
        : `No prior info available. Research from scratch.`;

      console.log(`[creator-analysis-ai] Analyzing ${handle} via Anthropic API...`);
      const startTime = Date.now();

      const response = await callWithRetry(
        () => client!.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          tools: [{
            type: "web_search_20250305" as const,
            name: "web_search" as const,
            max_uses: 8,
          }],
          system: buildCreatorAnalysisPrompt(brandVoice, audiences),
          messages: [{
            role: "user",
            content: `Research and analyze the social media creator ${handle} for competitive intelligence.

${creatorContext}

Today's date: ${today}

Search thoroughly for this creator. Try multiple search strategies: their handle on different platforms, their name if known, their niche + platform combinations. Find real videos, real engagement data, real follower counts. Then produce the full analysis report in the exact markdown format specified, followed by the ENRICHMENT_JSON block.`,
          }],
        }),
        "creator-analysis",
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[creator-analysis-ai] Analysis complete for ${handle} in ${elapsed}s`);

      // Extract text blocks from response
      const textBlocks = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text);

      if (textBlocks.length === 0) {
        throw new Error("AI returned no text content");
      }

      let fullOutput = textBlocks.join("\n\n");

      // Extract enrichment data before stripping it
      const enrichment = parseEnrichmentJson(fullOutput);

      // Remove the enrichment block from the markdown
      let markdown = stripEnrichmentBlock(fullOutput);

      // Strip any preamble before the # header
      const headerIdx = markdown.indexOf("\n# ");
      if (headerIdx > 0) {
        markdown = markdown.slice(headerIdx + 1);
      } else if (!markdown.startsWith("# ")) {
        const directIdx = markdown.indexOf("# Creator Analysis");
        if (directIdx > 0) {
          markdown = markdown.slice(directIdx);
        }
      }

      // Save to creator-insights
      fs.mkdirSync(creatorInsightsDir, { recursive: true });
      const insightPath = path.join(creatorInsightsDir, `${cleanHandle}.md`);
      fs.writeFileSync(insightPath, markdown);
      invalidateCreatorInsightsCache();

      // Update watchlist with enrichment data + lastAnalyzed
      if (creator) {
        const updates: Record<string, string> = { lastAnalyzed: today };

        if (enrichment.followers && enrichment.followers !== "Not confirmed") {
          updates.followers = enrichment.followers;
        }
        if (enrichment.contentStyle) {
          updates.contentStyle = enrichment.contentStyle;
        }
        if (enrichment.frequency && enrichment.frequency !== "Unknown") {
          updates.frequency = enrichment.frequency;
        }
        if (enrichment.platform) {
          updates.platform = enrichment.platform;
        }

        const enrichedFields = Object.keys(updates).filter(k => k !== "lastAnalyzed");
        if (enrichedFields.length > 0) {
          console.log(`[creator-analysis-ai] Enriching ${handle}: ${enrichedFields.join(", ")}`);
        }

        updateCreatorInFile(watchlistPath, handle, updates);
        invalidateWatchlistCache();
      }

      // Parse the saved insight for structured response
      const updatedInsights = parseCreatorInsights(creatorInsightsDir);
      const newInsight = updatedInsights.get(cleanHandle);

      res.json({ success: true, handle, insight: newInsight });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      console.error("[creator-analysis-ai] error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
