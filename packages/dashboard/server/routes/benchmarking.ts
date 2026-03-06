import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db.js";
import { channelSnapshots, performanceMetrics } from "../../shared/schema.js";
import { parseCreatorInsights } from "../parsers/creator-insights.js";
import { parseWatchlist } from "../parsers/watchlist.js";

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned;
}

export function createBenchmarkingRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const brandPath = path.join(industryDir, "brand.md");
  const watchlistPath = path.join(industryDir, "watchlist.md");
  const creatorInsightsDir = path.join(industryDir, "creator-insights");

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn("[benchmarking] ANTHROPIC_API_KEY not set.");
  }

  // GET /api/benchmarking/snapshots - all channel snapshots grouped by handle
  router.get("/snapshots", (_req, res) => {
    const rows = db
      .select()
      .from(channelSnapshots)
      .orderBy(desc(channelSnapshots.recordedAt))
      .all();

    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!grouped[row.handle]) grouped[row.handle] = [];
      grouped[row.handle].push(row);
    }

    res.json({ snapshots: grouped, total: rows.length });
  });

  // POST /api/benchmarking/snapshots - manually log a channel snapshot
  router.post("/snapshots", (req, res) => {
    const { handle, platform, followers, avgViews, engagementRateBps, saveRateBps, postsPerWeek, notes } = req.body;
    if (!handle || !platform) {
      res.status(400).json({ error: "handle and platform are required" });
      return;
    }

    const result = db
      .insert(channelSnapshots)
      .values({
        handle,
        platform,
        followers: followers || null,
        avgViews: avgViews || null,
        engagementRateBps: engagementRateBps || null,
        saveRateBps: saveRateBps || null,
        postsPerWeek: postsPerWeek || null,
        recordedAt: new Date().toISOString().split("T")[0],
        notes: notes || null,
      })
      .returning()
      .get();

    res.status(201).json(result);
  });

  // GET /api/benchmarking/compare - your metrics vs all tracked channels
  router.get("/compare", (_req, res) => {
    // Your aggregate metrics from performanceMetrics
    const yourStats = db
      .select({
        avgViews: sql<number>`COALESCE(AVG(${performanceMetrics.views}), 0)`,
        totalViews: sql<number>`COALESCE(SUM(${performanceMetrics.views}), 0)`,
        avgLikes: sql<number>`COALESCE(AVG(${performanceMetrics.likes}), 0)`,
        avgSaves: sql<number>`COALESCE(AVG(${performanceMetrics.saves}), 0)`,
        totalEntries: sql<number>`COUNT(*)`,
      })
      .from(performanceMetrics)
      .get();

    const avgViews = Math.round(Number(yourStats?.avgViews) || 0);
    const avgLikes = Math.round(Number(yourStats?.avgLikes) || 0);
    const avgSaves = Math.round(Number(yourStats?.avgSaves) || 0);
    const totalEntries = Number(yourStats?.totalEntries) || 0;

    // Calculate engagement and save rates
    const avgEngagementRate = avgViews > 0 ? Math.round(((avgLikes + avgSaves) / avgViews) * 10000) : 0;
    const avgSaveRate = avgViews > 0 ? Math.round((avgSaves / avgViews) * 10000) : 0;

    // Count distinct weeks with entries for posts/week
    const weekCount = db
      .select({ weeks: sql<number>`COUNT(DISTINCT strftime('%Y-%W', ${performanceMetrics.recordedAt}))` })
      .from(performanceMetrics)
      .get();
    const weeks = Number(weekCount?.weeks) || 1;
    const postsPerWeek = Math.round(totalEntries / weeks);

    // Published count
    const publishedResult = db.all(sql`SELECT COUNT(*) as count FROM video_status WHERE current_status = 'PUBLISHED'`);
    const totalPublished = Number((publishedResult[0] as Record<string, unknown>)?.count) || 0;

    // Get latest snapshot for each competitor handle
    const allSnapshots = db
      .select()
      .from(channelSnapshots)
      .orderBy(desc(channelSnapshots.recordedAt))
      .all();

    const latestByHandle: Record<string, typeof allSnapshots[0]> = {};
    for (const s of allSnapshots) {
      if (!latestByHandle[s.handle]) {
        latestByHandle[s.handle] = s;
      }
    }

    // Determine trend from multiple snapshots
    const competitors = Object.values(latestByHandle).map((latest) => {
      const handleSnapshots = allSnapshots.filter((s) => s.handle === latest.handle);
      let trend: "growing" | "stable" | "declining" | "unknown" = "unknown";
      if (handleSnapshots.length >= 2) {
        const newest = handleSnapshots[0];
        const oldest = handleSnapshots[handleSnapshots.length - 1];
        if (newest.followers && oldest.followers) {
          const growth = newest.followers - oldest.followers;
          trend = growth > 0 ? "growing" : growth < 0 ? "declining" : "stable";
        }
      }
      return {
        handle: latest.handle,
        platform: latest.platform,
        latestSnapshot: latest,
        trend,
      };
    });

    res.json({
      yourMetrics: {
        avgViews,
        avgEngagementRate,
        avgSaveRate,
        postsPerWeek,
        totalPublished,
      },
      competitors,
    });
  });

  // POST /api/benchmarking/analyze - AI-powered competitive analysis
  router.post("/analyze", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY in .env" });
      return;
    }

    try {
      const brand = fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8").slice(0, 1000) : "";
      const creators = parseWatchlist(watchlistPath);
      const insights = parseCreatorInsights(creatorInsightsDir);

      // Get comparison data
      const compareRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/benchmarking/compare`);
      let comparisonData = null;
      if (compareRes.ok) {
        comparisonData = await compareRes.json();
      }

      // Build context
      let competitorContext = "";
      for (const creator of creators.slice(0, 8)) {
        const handle = creator.handle.replace("@", "").toLowerCase();
        const insight = insights.get(handle);
        competitorContext += `\n${creator.handle} (${creator.platform}, ${creator.followers} followers):\n`;
        competitorContext += `- Style: ${creator.contentStyle}\n`;
        competitorContext += `- Frequency: ${creator.frequency}\n`;
        if (insight) {
          competitorContext += `- Key Takeaways: ${insight.keyTakeaways.slice(0, 3).join("; ")}\n`;
          competitorContext += `- Top Formats: ${insight.topPerformingFormats.join(", ")}\n`;
        }
      }

      const systemPrompt = `You are a social media competitive analyst for a chiropractic practice. Analyze the competitive landscape and provide actionable insights.

BRAND CONTEXT:
${brand}

RULES:
1. No emdashes. Use commas, periods, or restructure.
2. Be specific with numbers and comparisons.
3. Focus on actionable gaps and opportunities.

RESPONSE FORMAT:
Return a JSON object with:
- "strengths": array of 2-3 strings (what we do well vs competitors)
- "gaps": array of 2-3 strings (where competitors outperform us)
- "opportunities": array of 2-3 strings (specific content or strategy recommendations)
- "summary": 2-3 sentence overall competitive position summary

Your entire response must be a single valid JSON object. No markdown code fences, no extra text.`;

      const userContent = `Analyze our competitive position.

OUR METRICS:
${comparisonData ? JSON.stringify(comparisonData.yourMetrics, null, 2) : "No metrics data yet"}

COMPETITORS:
${competitorContext || "No competitor data available"}

COMPETITOR SNAPSHOTS:
${comparisonData?.competitors ? comparisonData.competitors.map((c: Record<string, unknown>) => `${(c as Record<string, unknown>).handle}: ${JSON.stringify((c as Record<string, unknown>).latestSnapshot)}`).join("\n") : "None logged yet"}

What are our strengths, gaps, and opportunities compared to these competitors?`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));
      res.json(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      console.error("[benchmarking] Analyze error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
