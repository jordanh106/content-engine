import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db.js";
import { performanceMetrics } from "../../shared/schema.js";
import { sql } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseIdeaBank } from "../parsers/idea-bank.js";
import { parseConfig } from "../parsers/config.js";
import { parseViralInsights } from "../parsers/viral-insights.js";
import { parseResearchReport } from "../parsers/last30days.js";
import { parseHookPatterns } from "../parsers/hook-patterns.js";
import { FORMATS } from "../../shared/types.js";
import type { MetricsInsight, ContentRecommendation } from "../../shared/types.js";

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
}

function buildFormatTable(): string {
  return Object.entries(FORMATS)
    .map(([id, f]) => `${id}: ${f.name}`)
    .join(", ");
}

export function createMetricsAiRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const brandPath = path.join(industryDir, "brand.md");
  const configPath = path.join(industryDir, "config.json");
  const ideaBankPath = path.join(industryDir, "idea-bank.md");

  const viralInsightsDir = path.join(industryDir, "viral-insights");
  const hookPatternsPath = path.join(industryDir, "hook-patterns.md");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let client: Anthropic | null = null;
  if (apiKey) {
    client = new Anthropic({ apiKey });
  }

  // POST /api/metrics-ai/insights - AI-powered strategy + performance analysis
  router.post("/insights", async (_req, res) => {
    if (!client) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY must be set in .env" });
      return;
    }

    try {
      // Load intelligence data
      const digest = parseViralInsights(viralInsightsDir);

      // Gather personal metrics data
      const topPerformers = db
        .select({
          videoCode: performanceMetrics.videoCode,
          totalViews: sql<number>`SUM(${performanceMetrics.views})`,
          totalLikes: sql<number>`SUM(${performanceMetrics.likes})`,
          totalSaves: sql<number>`SUM(${performanceMetrics.saves})`,
          totalShares: sql<number>`SUM(${performanceMetrics.shares})`,
          totalComments: sql<number>`SUM(${performanceMetrics.comments})`,
        })
        .from(performanceMetrics)
        .groupBy(performanceMetrics.videoCode)
        .orderBy(sql`SUM(${performanceMetrics.views}) DESC`)
        .limit(20)
        .all();

      const hasPersonalMetrics = topPerformers.length > 0;

      // Load research data
      const research = parseResearchReport();
      const hasResearch = research !== null && (research.reddit.length > 0 || research.x.length > 0 || research.web.length > 0);

      // If no intelligence, no personal metrics, and no research, return empty
      if (!digest && !hasPersonalMetrics && !hasResearch) {
        res.json({
          insights: [],
          summary: "No data available. Run Research to gather Reddit/X discussions, run the Content Intelligence workflow for market insights, or add performance data manually.",
          recommendations: [],
        });
        return;
      }

      // Load shared context
      const brandVoice = fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8").slice(0, 1000) : "";
      const config = parseConfig(configPath);
      const audiences = config.audiences.map((a) => a.label).join(", ");
      const ideas = parseIdeaBank(ideaBankPath);
      const pendingIdeas = ideas
        .filter((i) => i.category !== "archived")
        .map((i) => `- ${i.topic} (${i.category}, ${i.suggestedFormat}, ${i.priority})`)
        .slice(0, 50)
        .join("\n");

      // Build intelligence context block
      let intelligenceBlock = "";
      if (digest) {
        intelligenceBlock = `
MARKET INTELLIGENCE (from ${digest.date} digest):

Trending Topics:
${digest.trendingTopics.map((t) => `- ${t.topic} (${t.platforms.join(", ")}) - ${t.context}, ${t.engagementRange}`).join("\n")}

Hook Patterns Working Now:
${digest.hookPatterns.map((h) => `- [${h.type}] "${h.text}" (${h.platform}, ${h.priority} priority)`).join("\n")}

Format Trends:
${digest.formatTrends.map((f) => `- Format ${f.format} (${f.platforms}): ${f.trend}`).join("\n")}

Content Gaps (Underserved Opportunities):
${digest.contentGaps.map((g) => `- ${g.area}: ${g.description}`).join("\n")}

Creator Highlights:
${digest.creatorHighlights.join("\n")}

Recommended Ideas from Intelligence:
${digest.recommendedIdeas.join("\n")}`;
      }

      // Build personal metrics context block
      let performanceBlock = "";
      if (hasPersonalMetrics) {
        const byPlatform = db
          .select({
            platform: performanceMetrics.platform,
            totalViews: sql<number>`SUM(${performanceMetrics.views})`,
            totalLikes: sql<number>`SUM(${performanceMetrics.likes})`,
            totalSaves: sql<number>`SUM(${performanceMetrics.saves})`,
            totalShares: sql<number>`SUM(${performanceMetrics.shares})`,
            totalComments: sql<number>`SUM(${performanceMetrics.comments})`,
            videoCount: sql<number>`COUNT(DISTINCT ${performanceMetrics.videoCode})`,
          })
          .from(performanceMetrics)
          .groupBy(performanceMetrics.platform)
          .all();

        const videos = parseContentLibrary(contentLibraryPath);
        const videoMap = new Map(videos.map((v) => [v.code, v]));

        const enrichedPerformers = topPerformers.map((row) => {
          const video = videoMap.get(row.videoCode);
          const engagement = (row.totalLikes ?? 0) + (row.totalSaves ?? 0) + (row.totalShares ?? 0) + (row.totalComments ?? 0);
          const engRate = row.totalViews > 0 ? Math.round((engagement / row.totalViews) * 10000) / 100 : 0;
          return {
            code: row.videoCode,
            title: video?.title ?? row.videoCode,
            format: video?.format ?? "?",
            formatName: video?.formatName ?? "Unknown",
            audience: video?.audienceLabel ?? "Unknown",
            views: row.totalViews ?? 0,
            likes: row.totalLikes ?? 0,
            saves: row.totalSaves ?? 0,
            shares: row.totalShares ?? 0,
            comments: row.totalComments ?? 0,
            engagementRate: engRate,
          };
        });

        const byFormat: Record<string, { views: number; count: number; saves: number; engagement: number }> = {};
        for (const p of enrichedPerformers) {
          if (!byFormat[p.format]) byFormat[p.format] = { views: 0, count: 0, saves: 0, engagement: 0 };
          byFormat[p.format].views += p.views;
          byFormat[p.format].count += 1;
          byFormat[p.format].saves += p.saves;
          byFormat[p.format].engagement += p.likes + p.saves + p.shares + p.comments;
        }

        performanceBlock = `
YOUR PERFORMANCE DATA:

Top Performers:
${enrichedPerformers.map((p) => `${p.code} "${p.title}" (Format ${p.format}, ${p.audience}): ${p.views} views, ${p.engagementRate}% engagement, ${p.saves} saves`).join("\n")}

By Platform:
${byPlatform.map((p) => `${p.platform}: ${p.totalViews} views, ${p.videoCount} videos, ${p.totalSaves} saves`).join("\n")}

By Format:
${Object.entries(byFormat).map(([f, d]) => `Format ${f} (${FORMATS[f as keyof typeof FORMATS]?.name ?? f}): ${d.views} total views across ${d.count} videos, avg ${Math.round(d.views / d.count)} views`).join("\n")}`;
      }

      // Build social research block
      let researchBlock = "";
      if (hasResearch && research) {
        const redditLines = research.reddit
          .slice(0, 10)
          .map((r) => `- r/${r.subreddit}: "${r.title}" (score: ${r.score}, relevance: ${r.relevance}) - ${r.why_relevant}`)
          .join("\n");
        const xLines = research.x
          .slice(0, 10)
          .map((x) => `- @${x.author_handle}: "${x.text.slice(0, 100)}" (score: ${x.score}) - ${x.why_relevant}`)
          .join("\n");
        const commentInsights = research.reddit
          .flatMap((r) => r.comment_insights)
          .slice(0, 10)
          .map((i) => `- ${i}`)
          .join("\n");
        const webLines = research.web
          .slice(0, 5)
          .map((w) => `- ${w.source_domain}: "${w.title}" - ${w.snippet.slice(0, 100)}`)
          .join("\n");

        researchBlock = `
SOCIAL RESEARCH (topic: "${research.topic}", ${research.range.from} to ${research.range.to}):

${redditLines ? `Top Reddit Discussions:\n${redditLines}` : ""}
${xLines ? `\nTop X/Twitter Posts:\n${xLines}` : ""}
${commentInsights ? `\nKey Insights from Reddit Comments:\n${commentInsights}` : ""}
${webLines ? `\nWeb Sources:\n${webLines}` : ""}`;
      }

      // Build hook patterns library block
      const hookLibrary = parseHookPatterns(hookPatternsPath);
      let hookBlock = "";
      if (hookLibrary.length > 0) {
        hookBlock = `
PROVEN HOOK PATTERNS FROM OUR LIBRARY:
${hookLibrary.map((cat) => `${cat.name}: ${cat.patterns.slice(0, 2).map((p) => `"${p.pattern}" (${p.platform}, optimizes ${p.optimizes})`).join("; ")}`).join("\n")}`;
      }

      const dataSources: string[] = [];
      if (digest) dataSources.push("market intelligence digest");
      if (hasResearch) dataSources.push("social media research (Reddit, X, web)");
      if (hasPersonalMetrics) dataSources.push("personal performance data");
      if (hookLibrary.length > 0) dataSources.push("hook patterns library");

      const modeDescription = `Analyze the following data sources: ${dataSources.join(", ")}. ${
        hasResearch
          ? "Cross-reference Reddit discussions and X posts with content gaps to find opportunities others are missing. Identify what people are asking about that we haven't covered."
          : ""
      } ${hasPersonalMetrics ? "Compare your results to market trends." : "Focus on which trends to capitalize on, which formats to prioritize, and which content gaps to fill first."}`;

      const systemPrompt = `You are a predictive content strategy analyst for a chiropractic practice's social media content. ${modeDescription}

BRAND CONTEXT:
${brandVoice}

VIDEO FORMATS: ${buildFormatTable()}
AUDIENCE SEGMENTS: ${audiences}
${intelligenceBlock}
${researchBlock}
${hookBlock}
${performanceBlock}

PENDING IDEAS IN IDEA BANK:
${pendingIdeas || "(empty)"}

Analyze this data and return a JSON response with this exact structure:
{
  "summary": "A 2-3 sentence executive summary of the strategic landscape and key opportunities",
  "insights": [
    {
      "type": "win" | "opportunity" | "trend" | "recommendation",
      "title": "Short insight title",
      "detail": "1-2 sentence explanation with specific data points",
      "relatedFormat": "A" (optional),
      "relatedPlatform": "instagram_reels" (optional)
    }
  ],
  "recommendations": [
    {
      "ideaTopic": "Specific content topic to create",
      "reason": "Why this should be prioritized based on the data",
      "suggestedFormat": "A",
      "suggestedPlatform": "instagram_reels",
      "confidenceScore": "high" | "medium" | "low"
    }
  ]
}

Rules:
- Provide 5-8 insights mixing trends, opportunities, and ${hasPersonalMetrics ? "wins" : "recommendations"}
- Provide 4-6 content recommendations, prioritizing ideas from the pending idea bank when they align with trends
- Reference specific trending topics, engagement ranges, and hook patterns from the data
${hasResearch ? "- Cross-reference Reddit/X discussions with content gaps. Flag high-engagement threads as content opportunities.\n- Suggest specific hooks from the hook library that match trending topics." : ""}
- No emdashes. Use commas, periods, or restructure.
- Focus on actionable, predictive strategy. What should we create NEXT based on what's working NOW?
- Return ONLY valid JSON, no markdown fences`;

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          { role: "user", content: systemPrompt },
        ],
      });

      const responseText = message.content[0].type === "text" ? message.content[0].text : "";
      const cleaned = stripCodeFences(responseText);

      try {
        const parsed = JSON.parse(cleaned) as {
          summary: string;
          insights: MetricsInsight[];
          recommendations: ContentRecommendation[];
        };
        res.json(parsed);
      } catch {
        res.json({
          summary: responseText.slice(0, 200),
          insights: [{ type: "trend" as const, title: "Analysis Complete", detail: responseText }],
          recommendations: [],
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate insights";
      console.error("[metrics-ai-insights] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
