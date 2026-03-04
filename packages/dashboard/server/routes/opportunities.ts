import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db.js";
import { performanceMetrics } from "../../shared/schema.js";
import { sql } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseIdeaBank, invalidateIdeaCache } from "../parsers/idea-bank.js";
import { parseConfig } from "../parsers/config.js";
import { parseViralInsights } from "../parsers/viral-insights.js";
import { parseResearchReport } from "../parsers/last30days.js";
import { parseHookPatterns } from "../parsers/hook-patterns.js";
import { computeSignals } from "../lib/opportunity-signals.js";
import { FORMATS } from "../../shared/types.js";
import type { ContentOpportunity, OpportunitiesResponse, IdeaCategory } from "../../shared/types.js";

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
}

// In-memory cache with TTL
let cachedResult: OpportunitiesResponse | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Category headers for idea-bank.md insertion
const VALID_CATEGORIES: IdeaCategory[] = ["trending", "competitor", "evergreen", "audience", "personal"];
const CATEGORY_HEADERS: Record<string, string> = {
  trending: "## Trending Ideas",
  competitor: "## Competitor-Inspired Ideas",
  evergreen: "## Evergreen Ideas",
  audience: "## Audience Requests",
  personal: "## Personal/Creative Ideas",
};

function appendIdeaToFile(filePath: string, topic: string, format: string, hook: string, priority: string, category: IdeaCategory): boolean {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const cat = VALID_CATEGORIES.includes(category) ? category : "trending";
  const header = CATEGORY_HEADERS[cat];
  if (!header) return false;

  const headerIdx = lines.findIndex((l) => l.trim() === header);
  if (headerIdx === -1) return false;

  let sepIdx = -1;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (lines[i].includes("|") && lines[i].includes("---")) {
      sepIdx = i;
      break;
    }
    if (lines[i].startsWith("## ")) break;
  }
  if (sepIdx === -1) return false;

  let insertIdx = sepIdx + 1;
  while (insertIdx < lines.length && lines[insertIdx].startsWith("|")) {
    insertIdx++;
  }

  const today = new Date().toISOString().split("T")[0];
  const row = `| ${topic} | ${format} | ${hook} | ${priority} | Opportunities AI | ${today} |`;
  lines.splice(insertIdx, 0, row);
  fs.writeFileSync(filePath, lines.join("\n"));
  return true;
}

export function createOpportunitiesRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const configPath = path.join(industryDir, "config.json");
  const ideaBankPath = path.join(industryDir, "idea-bank.md");
  const viralInsightsDir = path.join(industryDir, "viral-insights");
  const hookPatternsPath = path.join(industryDir, "hook-patterns.md");
  const brandPath = path.join(industryDir, "brand.md");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let client: Anthropic | null = null;
  if (apiKey) {
    client = new Anthropic({ apiKey });
  }

  // GET /api/opportunities - Return cached opportunities or empty
  router.get("/", (_req, res) => {
    if (cachedResult && Date.now() - cacheTime < CACHE_TTL_MS) {
      res.json(cachedResult);
      return;
    }
    res.json({
      opportunities: [],
      generatedAt: "",
      dataSourceSummary: {
        redditThreads: 0,
        xPosts: 0,
        webResults: 0,
        hookPatterns: 0,
        existingVideos: 0,
        ideasInBank: 0,
        hasDigest: false,
      },
      staleWarnings: ["Click 'Generate Opportunities' to analyze your data sources and discover content opportunities."],
    } satisfies OpportunitiesResponse);
  });

  // POST /api/opportunities/generate - Full AI scoring pipeline
  router.post("/generate", async (_req, res) => {
    if (!client) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY must be set in .env" });
      return;
    }

    try {
      // Gather all data sources
      const videos = parseContentLibrary(contentLibraryPath);
      const ideas = parseIdeaBank(ideaBankPath);
      const digest = parseViralInsights(viralInsightsDir);
      const research = parseResearchReport();
      const hookLibrary = parseHookPatterns(hookPatternsPath);
      const config = parseConfig(configPath);

      // Gather performance data
      const performanceData = db
        .select({
          videoCode: performanceMetrics.videoCode,
          views: sql<number>`SUM(${performanceMetrics.views})`,
          likes: sql<number>`SUM(${performanceMetrics.likes})`,
          saves: sql<number>`SUM(${performanceMetrics.saves})`,
          shares: sql<number>`SUM(${performanceMetrics.shares})`,
          comments: sql<number>`SUM(${performanceMetrics.comments})`,
        })
        .from(performanceMetrics)
        .groupBy(performanceMetrics.videoCode)
        .all()
        .map((r) => ({
          videoCode: r.videoCode,
          views: r.views ?? 0,
          likes: r.likes ?? 0,
          saves: r.saves ?? 0,
          shares: r.shares ?? 0,
          comments: r.comments ?? 0,
        }));

      // Pre-compute signals
      const signals = computeSignals(videos, ideas, digest, research, hookLibrary, config, performanceData);

      // Check minimum data threshold
      const hasResearch = (research?.reddit?.length ?? 0) + (research?.x?.length ?? 0) + (research?.web?.length ?? 0) > 0;
      const hasDigest = digest !== null;
      const hasIdeas = ideas.filter((i) => i.category !== "archived").length >= 5;

      if (!hasResearch && !hasDigest && !hasIdeas) {
        res.json({
          opportunities: [],
          generatedAt: new Date().toISOString(),
          dataSourceSummary: signals.dataSourceSummary,
          staleWarnings: [
            "Not enough data to generate opportunities. You need at least one of:",
            "- Research data (run Research from Metrics page)",
            "- Viral insights digest (run /viral-scout)",
            "- 5+ ideas in the Idea Bank",
          ],
        } satisfies OpportunitiesResponse);
        return;
      }

      const brandVoice = fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8").slice(0, 800) : "";
      const audiences = config.audiences.map((a) => `${a.id}: ${a.label}`).join(", ");
      const formatTable = Object.entries(FORMATS)
        .map(([id, f]) => `${id}: ${f.name}`)
        .join(", ");

      const systemPrompt = `You are a content opportunity scoring engine for a chiropractic practice's social media. You cross-reference multiple data sources to find the highest-value content opportunities and score them across 7 dimensions.

BRAND CONTEXT:
${brandVoice}

VIDEO FORMATS: ${formatTable}
AUDIENCE SEGMENTS: ${audiences}
PLATFORM CADENCE: ${Object.entries(signals.platformCadence).map(([p, c]) => `${p}: ${c}`).join(", ")}

${signals.researchSummary}

${signals.digestSummary}

${signals.hookSummary}

${signals.ideaSummary}

${signals.librarySummary}

${Object.keys(signals.avgViewsByFormat).length > 0 ? `PERFORMANCE BASELINES:\n${Object.entries(signals.avgViewsByFormat).map(([f, v]) => `Format ${f}: avg ${v} views, avg ${signals.avgEngagementByFormat[f] ?? 0} engagements`).join("\n")}` : ""}

SCORING DIMENSIONS (score each 0-100):
1. Audience Demand (25%): How actively people discuss this topic online. High Reddit/X engagement = high score.
2. Competition Gap (20%): Topic demand vs our content library coverage. High demand + low/no coverage = high score.
3. Trend Momentum (15%): Is this topic growing or fading? Recent spikes, multiple platforms = high score.
4. Format Fit (10%): Does a natural format match exist? Clear fit to Format A-G = high score.
5. Hook Availability (10%): Do we have proven hooks that match? Direct hook match = high score.
6. Platform Alignment (10%): Does this fill an underserved platform in our cadence? Gap-filling = high score.
7. Engagement Potential (10%): Based on similar content performance. High baseline = high score.

Return a JSON array of 10-15 ContentOpportunity objects:
{
  "opportunities": [
    {
      "id": "opp-1",
      "topic": "Specific content topic title",
      "overallScore": 82,
      "dimensions": [
        { "dimension": "audienceDemand", "score": 90, "rationale": "One sentence explaining score" },
        { "dimension": "competitionGap", "score": 85, "rationale": "..." },
        { "dimension": "trendMomentum", "score": 70, "rationale": "..." },
        { "dimension": "formatFit", "score": 80, "rationale": "..." },
        { "dimension": "hookAvailability", "score": 75, "rationale": "..." },
        { "dimension": "platformAlignment", "score": 60, "rationale": "..." },
        { "dimension": "engagementPotential", "score": 70, "rationale": "..." }
      ],
      "suggestedFormat": "A",
      "formatRationale": "Why this format fits",
      "suggestedHook": {
        "pattern": "Exact pattern from hook library",
        "example": "Filled-in example for this topic",
        "category": "Hook category name",
        "optimizes": "What metric it optimizes"
      },
      "targetPlatform": "instagram_reels",
      "targetAudience": "adult",
      "evidence": [
        { "type": "x", "title": "Post title or preview", "detail": "Why this supports the opportunity", "url": "https://...", "engagement": { "score": 85 } }
      ],
      "whyNow": "2-3 sentence narrative explaining timing, urgency, and data support for this opportunity",
      "competitionCheck": {
        "coveredVideos": ["D3", "D5"],
        "gapDescription": "We have explainers on general back pain but nothing specifically about...",
        "coverageLevel": "partial"
      },
      "communitySignals": {
        "redditThreads": 3,
        "topRedditTitle": "Top thread title or null",
        "topRedditScore": 85,
        "xPosts": 5,
        "topXPreview": "Top post text preview or null",
        "topXScore": 92,
        "webArticles": 2
      },
      "ideaBankMatch": "Matching idea topic or null"
    }
  ]
}

RULES:
- overallScore = weighted average of dimensions (25/20/15/10/10/10/10)
- Cross-reference Reddit/X discussions with content library to find what's NOT covered
- Match hooks from our hook library, using exact patterns where possible
- Evidence must reference actual data from the sources above
- coveredVideos should list video codes that partially overlap
- coverageLevel: "none" if no videos on this topic, "partial" if related but not exact, "saturated" if well-covered
- ideaBankMatch: set to the matching idea topic string if a pending idea covers this, null otherwise
- Sort by overallScore descending
- No emdashes. Use commas, periods, or restructure.
- Return ONLY valid JSON, no markdown fences`;

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [{ role: "user", content: systemPrompt }],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      const cleaned = stripCodeFences(responseText);

      let opportunities: ContentOpportunity[] = [];
      try {
        const parsed = JSON.parse(cleaned);
        opportunities = (parsed.opportunities ?? parsed) as ContentOpportunity[];
      } catch {
        console.error("[opportunities] Failed to parse AI response:", cleaned.slice(0, 200));
        res.status(500).json({ error: "Failed to parse AI response" });
        return;
      }

      const result: OpportunitiesResponse = {
        opportunities,
        generatedAt: new Date().toISOString(),
        dataSourceSummary: signals.dataSourceSummary,
        staleWarnings: signals.staleWarnings,
      };

      cachedResult = result;
      cacheTime = Date.now();

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate opportunities";
      console.error("[opportunities] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/opportunities/:id/add-to-ideas - Convert opportunity to idea bank entry
  router.post("/:id/add-to-ideas", (req, res) => {
    const { topic, suggestedFormat, suggestedHook, targetAudience, whyNow } = req.body;

    if (!topic) {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    const hookAngle = suggestedHook?.example || suggestedHook?.pattern || "";
    const format = suggestedFormat || "";
    const category: IdeaCategory = "trending";

    const success = appendIdeaToFile(ideaBankPath, topic, format, hookAngle, "High", category);

    if (success) {
      invalidateIdeaCache();
      res.json({ success: true, message: `Added "${topic}" to idea bank` });
    } else {
      res.status(500).json({ error: "Failed to write to idea-bank.md" });
    }
  });

  return router;
}
