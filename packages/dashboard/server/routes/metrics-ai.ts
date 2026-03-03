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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let client: Anthropic | null = null;
  if (apiKey) {
    client = new Anthropic({ apiKey });
  }

  // POST /api/metrics-ai/insights - AI-powered performance analysis
  router.post("/insights", async (_req, res) => {
    if (!client) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY must be set in .env" });
      return;
    }

    try {
      // Gather all metrics data
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

      if (topPerformers.length === 0) {
        res.json({
          insights: [],
          summary: "No metrics data yet. Add performance data to get AI-powered insights.",
          recommendations: [],
        });
        return;
      }

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

      // Enrich with video metadata
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

      // Format breakdown
      const byFormat: Record<string, { views: number; count: number; saves: number; engagement: number }> = {};
      for (const p of enrichedPerformers) {
        if (!byFormat[p.format]) byFormat[p.format] = { views: 0, count: 0, saves: 0, engagement: 0 };
        byFormat[p.format].views += p.views;
        byFormat[p.format].count += 1;
        byFormat[p.format].saves += p.saves;
        byFormat[p.format].engagement += p.likes + p.saves + p.shares + p.comments;
      }

      // Load context
      const brandVoice = fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8").slice(0, 1000) : "";
      const config = parseConfig(configPath);
      const audiences = config.audiences.map((a) => a.label).join(", ");
      const ideas = parseIdeaBank(ideaBankPath);
      const pendingIdeas = ideas
        .filter((i) => i.category !== "archived")
        .map((i) => `- ${i.topic} (${i.category}, ${i.suggestedFormat}, ${i.priority})`)
        .slice(0, 50)
        .join("\n");

      const systemPrompt = `You are a content strategy analyst for a chiropractic practice's social media content. Analyze performance data and provide actionable insights.

BRAND CONTEXT:
${brandVoice}

VIDEO FORMATS: ${buildFormatTable()}
AUDIENCE SEGMENTS: ${audiences}

PERFORMANCE DATA:

Top Performers:
${enrichedPerformers.map((p) => `${p.code} "${p.title}" (Format ${p.format}, ${p.audience}): ${p.views} views, ${p.engagementRate}% engagement, ${p.saves} saves`).join("\n")}

By Platform:
${byPlatform.map((p) => `${p.platform}: ${p.totalViews} views, ${p.videoCount} videos, ${p.totalSaves} saves`).join("\n")}

By Format:
${Object.entries(byFormat).map(([f, d]) => `Format ${f} (${FORMATS[f as keyof typeof FORMATS]?.name ?? f}): ${d.views} total views across ${d.count} videos, avg ${Math.round(d.views / d.count)} views`).join("\n")}

PENDING IDEAS IN IDEA BANK:
${pendingIdeas || "(empty)"}

Analyze this data and return a JSON response with this exact structure:
{
  "summary": "A 2-3 sentence executive summary of overall content performance",
  "insights": [
    {
      "type": "win" | "opportunity" | "trend" | "recommendation",
      "title": "Short insight title",
      "detail": "1-2 sentence explanation with specific numbers",
      "relatedFormat": "A" (optional),
      "relatedPlatform": "instagram_reels" (optional)
    }
  ],
  "recommendations": [
    {
      "ideaTopic": "Exact topic from pending ideas OR a new suggestion",
      "reason": "Why this should be prioritized based on the data",
      "suggestedFormat": "A",
      "suggestedPlatform": "instagram_reels",
      "confidenceScore": "high" | "medium" | "low"
    }
  ]
}

Rules:
- Provide 4-6 insights mixing wins, opportunities, and trends
- Provide 3-5 content recommendations, prioritizing ideas from the pending idea bank
- Be specific with numbers and percentages
- No emdashes. Use commas, periods, or restructure.
- Focus on actionable advice, not generic observations
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
