import fs from "fs";
import { Router } from "express";
import path from "path";
import { spawn } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import { db, sqlite } from "../db.js";
import { performanceMetrics, socialAttributions } from "../../shared/schema.js";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseViralInsights, listDigestDates } from "../parsers/viral-insights.js";
import { parseResearchReport, getReportPath, invalidateResearchCache } from "../parsers/last30days.js";
import { parseHookPatterns } from "../parsers/hook-patterns.js";
import type { MetricsSyncEntry, PlatformResearchItem } from "../../shared/types.js";

// Track running research process
let researchProcess: ReturnType<typeof spawn> | null = null;
// Track platform research phase
let platformSearchRunning = false;

async function runPlatformResearch(topic: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[research] Skipping platform search: no ANTHROPIC_API_KEY");
    return;
  }

  platformSearchRunning = true;
  console.log(`[research] Starting platform-specific web searches for: ${topic}`);

  try {
    const client = new Anthropic({ apiKey });
    const platforms = [
      { name: "instagram", query: `${topic} trending Instagram Reels content creators 2026` },
      { name: "tiktok", query: `${topic} trending TikTok viral content 2026` },
      { name: "facebook", query: `${topic} Facebook groups discussions community 2026` },
    ];

    const results: Record<string, PlatformResearchItem[]> = {
      instagram: [],
      tiktok: [],
      facebook: [],
    };

    // Run all platform searches in parallel
    await Promise.all(platforms.map(async (platform) => {
      try {
        const response = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          tools: [{
            type: "web_search_20250305" as const,
            name: "web_search" as const,
            max_uses: 3,
          }],
          messages: [{
            role: "user",
            content: `Search for recent ${platform.name === "instagram" ? "Instagram Reels" : platform.name === "tiktok" ? "TikTok" : "Facebook group"} content and trends about "${topic}".

Search query: ${platform.query}

Return a JSON array of 3-8 relevant findings. Each item should have:
- "title": What the content/trend is about
- "url": Source URL (the article/post where you found this)
- "source": Domain name of the source
- "snippet": 1-2 sentence summary of what's trending and why it matters
- "relevance": 0-100 how relevant to "${topic}"
- "score": 0-100 overall quality/usefulness

Focus on: trending formats, popular creators covering this topic, engagement patterns, hashtags, sounds/audio trends (TikTok), content strategies that are working.

Return ONLY valid JSON array, no other text.`,
          }],
        }, { timeout: 60_000 });

        const textBlock = response.content.find((b) => b.type === "text");
        if (textBlock && textBlock.type === "text") {
          let cleaned = textBlock.text.trim();
          if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
          }
          try {
            const parsed = JSON.parse(cleaned);
            const items = Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.items ?? []);
            results[platform.name] = items.map((item: Record<string, unknown>) => ({
              title: String(item.title || ""),
              url: String(item.url || ""),
              source: String(item.source || ""),
              snippet: String(item.snippet || ""),
              relevance: Number(item.relevance) || 0,
              score: Number(item.score) || 0,
            }));
          } catch {
            console.warn(`[research] Failed to parse ${platform.name} results`);
          }
        }
        console.log(`[research] ${platform.name}: found ${results[platform.name].length} results`);
      } catch (err) {
        console.warn(`[research] ${platform.name} search failed:`, err instanceof Error ? err.message : err);
      }
    }));

    // Merge results into existing report.json
    const reportPath = getReportPath();
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
      report.instagram = results.instagram;
      report.tiktok = results.tiktok;
      report.facebook = results.facebook;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      invalidateResearchCache();
      console.log(`[research] Platform data merged into report.json (IG: ${results.instagram.length}, TT: ${results.tiktok.length}, FB: ${results.facebook.length})`);
    }
  } finally {
    platformSearchRunning = false;
  }
}

export function createMetricsRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const viralInsightsDir = path.join(industryDir, "viral-insights");
  const hookPatternsPath = path.join(industryDir, "hook-patterns.md");
  const repoRoot = path.resolve(industryDir, "..", "..");
  const last30daysScript = path.join(repoRoot, "skills", "last30days", "scripts", "last30days.py");

  // GET /api/metrics - List all metrics, optionally filtered by video code or platform
  router.get("/", (_req, res) => {
    const { videoCode, platform } = _req.query;

    let query = db.select().from(performanceMetrics).orderBy(desc(performanceMetrics.recordedAt));

    const results = query.all();

    const filtered = results.filter((row) => {
      if (videoCode && row.videoCode !== videoCode) return false;
      if (platform && row.platform !== platform) return false;
      return true;
    });

    res.json({ metrics: filtered });
  });

  // GET /api/metrics/top-performers - Aggregate top performers by total engagement
  router.get("/top-performers", (_req, res) => {
    const rows = db
      .select({
        videoCode: performanceMetrics.videoCode,
        totalViews: sql<number>`SUM(${performanceMetrics.views})`,
        totalLikes: sql<number>`SUM(${performanceMetrics.likes})`,
        totalSaves: sql<number>`SUM(${performanceMetrics.saves})`,
        totalShares: sql<number>`SUM(${performanceMetrics.shares})`,
        totalComments: sql<number>`SUM(${performanceMetrics.comments})`,
        entryCount: sql<number>`COUNT(*)`,
      })
      .from(performanceMetrics)
      .groupBy(performanceMetrics.videoCode)
      .orderBy(sql`SUM(${performanceMetrics.views}) DESC`)
      .limit(20)
      .all();

    // Enrich with video metadata
    const videos = parseContentLibrary(contentLibraryPath);
    const enriched = rows.map((row) => {
      const video = videos.find((v) => v.code === row.videoCode);
      const totalEngagement =
        (row.totalLikes ?? 0) +
        (row.totalSaves ?? 0) +
        (row.totalShares ?? 0) +
        (row.totalComments ?? 0);
      const engagementRate =
        row.totalViews && row.totalViews > 0
          ? totalEngagement / row.totalViews
          : 0;
      const saveRate =
        row.totalViews && row.totalViews > 0
          ? (row.totalSaves ?? 0) / row.totalViews
          : 0;

      return {
        ...row,
        title: video?.title ?? row.videoCode,
        format: video?.format ?? null,
        audience: video?.audience ?? null,
        totalEngagement,
        engagementRate: Math.round(engagementRate * 10000) / 100,
        saveRate: Math.round(saveRate * 10000) / 100,
      };
    });

    res.json({ topPerformers: enriched });
  });

  // GET /api/metrics/by-format - Aggregate metrics grouped by format
  router.get("/by-format", (_req, res) => {
    const videos = parseContentLibrary(contentLibraryPath);
    const videoFormatMap = new Map(videos.map((v) => [v.code, v.format]));

    const rows = db
      .select({
        videoCode: performanceMetrics.videoCode,
        totalViews: sql<number>`SUM(${performanceMetrics.views})`,
        totalSaves: sql<number>`SUM(${performanceMetrics.saves})`,
        totalShares: sql<number>`SUM(${performanceMetrics.shares})`,
        totalLikes: sql<number>`SUM(${performanceMetrics.likes})`,
        totalComments: sql<number>`SUM(${performanceMetrics.comments})`,
      })
      .from(performanceMetrics)
      .groupBy(performanceMetrics.videoCode)
      .all();

    const byFormat: Record<string, { views: number; saves: number; shares: number; likes: number; comments: number; count: number }> = {};

    for (const row of rows) {
      const format = videoFormatMap.get(row.videoCode) ?? "?";
      if (!byFormat[format]) {
        byFormat[format] = { views: 0, saves: 0, shares: 0, likes: 0, comments: 0, count: 0 };
      }
      byFormat[format].views += row.totalViews ?? 0;
      byFormat[format].saves += row.totalSaves ?? 0;
      byFormat[format].shares += row.totalShares ?? 0;
      byFormat[format].likes += row.totalLikes ?? 0;
      byFormat[format].comments += row.totalComments ?? 0;
      byFormat[format].count += 1;
    }

    const result = Object.entries(byFormat).map(([format, data]) => ({
      format,
      ...data,
      avgViews: data.count > 0 ? Math.round(data.views / data.count) : 0,
      avgSaves: data.count > 0 ? Math.round(data.saves / data.count) : 0,
      engagementRate:
        data.views > 0
          ? Math.round(((data.likes + data.saves + data.shares + data.comments) / data.views) * 10000) / 100
          : 0,
      saveRate: data.views > 0 ? Math.round((data.saves / data.views) * 10000) / 100 : 0,
    }));

    res.json({ byFormat: result });
  });

  // GET /api/metrics/by-platform - Aggregate metrics grouped by platform
  router.get("/by-platform", (_req, res) => {
    const rows = db
      .select({
        platform: performanceMetrics.platform,
        totalViews: sql<number>`SUM(${performanceMetrics.views})`,
        totalSaves: sql<number>`SUM(${performanceMetrics.saves})`,
        totalShares: sql<number>`SUM(${performanceMetrics.shares})`,
        totalLikes: sql<number>`SUM(${performanceMetrics.likes})`,
        totalComments: sql<number>`SUM(${performanceMetrics.comments})`,
        videoCount: sql<number>`COUNT(DISTINCT ${performanceMetrics.videoCode})`,
      })
      .from(performanceMetrics)
      .groupBy(performanceMetrics.platform)
      .all();

    const result = rows.map((row) => ({
      ...row,
      engagementRate:
        row.totalViews && row.totalViews > 0
          ? Math.round(
              (((row.totalLikes ?? 0) + (row.totalSaves ?? 0) + (row.totalShares ?? 0) + (row.totalComments ?? 0)) /
                row.totalViews) *
                10000,
            ) / 100
          : 0,
    }));

    res.json({ byPlatform: result });
  });

  // GET /api/metrics/intelligence - Unified intelligence (digest + research + hooks)
  router.get("/intelligence", (_req, res) => {
    const { date } = _req.query;
    const digest = parseViralInsights(viralInsightsDir, typeof date === "string" ? date : undefined);
    const availableDates = listDigestDates(viralInsightsDir);
    const research = parseResearchReport();
    const hookLibrary = parseHookPatterns(hookPatternsPath);

    res.json({
      digest,
      availableDates,
      research,
      hookLibrary,
      counts: {
        redditThreads: research?.reddit?.length ?? 0,
        xPosts: research?.x?.length ?? 0,
        webResults: research?.web?.length ?? 0,
        instagramResults: research?.instagram?.length ?? 0,
        tiktokResults: research?.tiktok?.length ?? 0,
        facebookResults: research?.facebook?.length ?? 0,
        hookPatterns: hookLibrary.reduce((n, c) => n + c.patterns.length, 0),
      },
    });
  });

  // POST /api/metrics/research - Trigger /last30days research
  router.post("/research", (req, res) => {
    const { topic } = req.body;
    if (!topic || typeof topic !== "string") {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    if (researchProcess) {
      res.status(409).json({ error: "Research already running" });
      return;
    }

    const child = spawn("python3", [last30daysScript, topic, "--emit=json"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        SSL_CERT_FILE: process.env.SSL_CERT_FILE || "/Users/jordanharper/Library/Python/3.11/lib/python/site-packages/certifi/cacert.pem",
      },
    });

    researchProcess = child;
    let stderr = "";

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      researchProcess = null;
      if (code !== 0) {
        console.error(`[research] last30days exited with code ${code}: ${stderr.slice(0, 500)}`);
      } else {
        console.log(`[research] Completed for topic: ${topic}`);
        // Run platform-specific web searches as follow-up
        runPlatformResearch(topic).catch((err) => {
          console.error("[research] Platform search failed:", err);
        });
      }
    });

    child.on("error", (err) => {
      researchProcess = null;
      console.error(`[research] Failed to spawn: ${err.message}`);
    });

    res.json({ status: "started", topic });
  });

  // GET /api/metrics/research/status - Check research status
  router.get("/research/status", (_req, res) => {
    const report = parseResearchReport();
    res.json({
      running: researchProcess !== null || platformSearchRunning,
      report: report
        ? { topic: report.topic, generated_at: report.generated_at, from_cache: report.from_cache }
        : null,
    });
  });

  // DELETE /api/metrics/entry/:id - Delete a specific metrics entry
  router.delete("/entry/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    db.delete(performanceMetrics).where(eq(performanceMetrics.id, id)).run();
    res.json({ success: true });
  });

  // GET /api/metrics/trends - Time-series data for trend charts
  router.get("/trends", (_req, res) => {
    const { videoCode, platform, days } = _req.query;
    const daysNum = parseInt(days as string) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysNum);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    let rows = db
      .select()
      .from(performanceMetrics)
      .where(gte(performanceMetrics.recordedAt, cutoffStr))
      .orderBy(performanceMetrics.recordedAt)
      .all();

    if (videoCode && typeof videoCode === "string") {
      rows = rows.filter((r) => r.videoCode === videoCode.toUpperCase());
    }
    if (platform && typeof platform === "string") {
      rows = rows.filter((r) => r.platform === platform);
    }

    // Aggregate by date
    const byDate: Record<string, { views: number; likes: number; saves: number; shares: number; comments: number }> = {};
    for (const row of rows) {
      const d = row.recordedAt;
      if (!byDate[d]) byDate[d] = { views: 0, likes: 0, saves: 0, shares: 0, comments: 0 };
      byDate[d].views += row.views ?? 0;
      byDate[d].likes += row.likes ?? 0;
      byDate[d].saves += row.saves ?? 0;
      byDate[d].shares += row.shares ?? 0;
      byDate[d].comments += row.comments ?? 0;
    }

    const trends = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    res.json({ trends });
  });

  // POST /api/metrics/bulk - Bulk import metric entries with dedup
  router.post("/bulk", (req, res) => {
    const { entries } = req.body as { entries?: MetricsSyncEntry[] };
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: "entries array is required" });
      return;
    }

    // Fetch existing entries for dedup
    const existing = db.select().from(performanceMetrics).all();
    const existingKeys = new Set(
      existing.map((e) => `${e.videoCode}|${e.platform}|${e.recordedAt}`),
    );

    let inserted = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (!entry.platform) {
        skipped++;
        continue;
      }
      const code = (entry.videoCode || entry.platformPostId || "UNKNOWN").toUpperCase();
      const key = `${code}|${entry.platform}|${entry.recordedAt}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      db.insert(performanceMetrics)
        .values({
          videoCode: code,
          platform: entry.platform,
          recordedAt: entry.recordedAt || new Date().toISOString().split("T")[0],
          views: entry.views ?? 0,
          likes: entry.likes ?? 0,
          saves: entry.saves ?? 0,
          shares: entry.shares ?? 0,
          comments: entry.comments ?? 0,
          watchTimeSeconds: entry.watchTimeSeconds ?? null,
        })
        .run();

      existingKeys.add(key);
      inserted++;
    }

    res.status(201).json({ inserted, skipped });
  });

  // POST /api/metrics/sync-n8n - Pull metrics from n8n workflow execution
  router.post("/sync-n8n", async (_req, res) => {
    const apiUrl = process.env.N8N_API_URL;
    const apiKey = process.env.N8N_API_KEY;
    const workflowId = process.env.N8N_METRICS_WORKFLOW_ID;

    if (!apiUrl || !apiKey) {
      res.status(500).json({ error: "N8N_API_URL and N8N_API_KEY must be set in .env" });
      return;
    }
    if (!workflowId) {
      res.status(500).json({ error: "N8N_METRICS_WORKFLOW_ID must be set in .env" });
      return;
    }

    try {
      // Fetch latest successful execution
      const listRes = await fetch(
        `${apiUrl}/executions?workflowId=${workflowId}&status=success&limit=1`,
        { headers: { "X-N8N-API-KEY": apiKey } },
      );
      if (!listRes.ok) {
        res.status(502).json({ error: `n8n API error: ${listRes.status} ${listRes.statusText}` });
        return;
      }

      const listData = (await listRes.json()) as { data: Array<{ id: string }> };
      if (!listData.data?.length) {
        res.json({ synced: 0, skipped: 0, message: "No successful executions found" });
        return;
      }

      const executionId = listData.data[0].id;

      // Fetch execution with full data
      const execRes = await fetch(
        `${apiUrl}/executions/${executionId}?includeData=true`,
        { headers: { "X-N8N-API-KEY": apiKey } },
      );
      if (!execRes.ok) {
        res.status(502).json({ error: `n8n API error fetching execution: ${execRes.status}` });
        return;
      }

      const execData = (await execRes.json()) as {
        data: { resultData: { runData: Record<string, Array<{ data: { main: Array<Array<{ json: Record<string, unknown> }>> } }>> } };
      };

      // Extract metrics from "Metrics Output" node
      const runData = execData.data?.resultData?.runData;
      let metricsEntries: MetricsSyncEntry[] = [];

      for (const nodeName of ["Metrics Output", "Format Metrics", "Merge Metrics"]) {
        const nodeRuns = runData?.[nodeName];
        if (!nodeRuns?.length) continue;

        // Collect all output items from this node
        const outputs = nodeRuns[0]?.data?.main?.[0];
        if (!outputs?.length) continue;

        for (const item of outputs) {
          const json = item.json;
          if (json && typeof json === "object" && json.platform) {
            metricsEntries.push(json as unknown as MetricsSyncEntry);
          }
        }
        if (metricsEntries.length > 0) break;
      }

      if (metricsEntries.length === 0) {
        res.json({ synced: 0, skipped: 0, message: "No metrics data found in latest execution" });
        return;
      }

      // Try to match post titles to content library video codes
      const videos = parseContentLibrary(contentLibraryPath);
      const titleToCode = new Map(videos.map((v) => [v.title.toLowerCase().trim(), v.code]));

      for (const entry of metricsEntries) {
        if (!entry.videoCode && entry.postTitle) {
          const match = titleToCode.get(entry.postTitle.toLowerCase().trim());
          if (match) entry.videoCode = match;
        }
      }

      // Dedup and insert
      const existing = db.select().from(performanceMetrics).all();
      const existingKeys = new Set(
        existing.map((e) => `${e.videoCode}|${e.platform}|${e.recordedAt}`),
      );

      let synced = 0;
      let skipped = 0;
      const unmatched: string[] = [];

      for (const entry of metricsEntries) {
        const code = (entry.videoCode || entry.platformPostId || "").toUpperCase();
        if (!code) {
          if (entry.postTitle) unmatched.push(entry.postTitle);
          skipped++;
          continue;
        }

        const recordedAt = entry.recordedAt || new Date().toISOString().split("T")[0];
        const key = `${code}|${entry.platform}|${recordedAt}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        db.insert(performanceMetrics)
          .values({
            videoCode: code,
            platform: entry.platform,
            recordedAt,
            views: entry.views ?? 0,
            likes: entry.likes ?? 0,
            saves: entry.saves ?? 0,
            shares: entry.shares ?? 0,
            comments: entry.comments ?? 0,
            watchTimeSeconds: entry.watchTimeSeconds ?? null,
          })
          .run();

        existingKeys.add(key);
        synced++;
      }

      res.status(201).json({ synced, skipped, unmatched, executionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync metrics from n8n";
      console.error("[metrics-sync-n8n] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // GET /api/metrics/summary - Quick stats for dashboard home
  router.get("/summary", (_req, res) => {
    const rows = db
      .select({
        videoCode: performanceMetrics.videoCode,
        totalViews: sql<number>`SUM(${performanceMetrics.views})`,
      })
      .from(performanceMetrics)
      .groupBy(performanceMetrics.videoCode)
      .all();

    const totalViews = rows.reduce((s, r) => s + (r.totalViews ?? 0), 0);
    let topPerformer: { code: string; title: string; views: number } | null = null;
    for (const r of rows) {
      if (!topPerformer || (r.totalViews ?? 0) > topPerformer.views) {
        topPerformer = { code: r.videoCode, title: r.videoCode, views: r.totalViews ?? 0 };
      }
    }

    res.json({ totalViews, thisWeek: 0, topPerformer });
  });

  // GET /api/metrics/attribution - Get social attribution counts by month
  router.get("/attribution", (_req, res) => {
    const rows = db.select().from(socialAttributions).orderBy(socialAttributions.monthKey).all();
    const total = rows.reduce((s, r) => s + r.count, 0);
    res.json({ attributions: rows, total });
  });

  // POST /api/metrics/attribution/tap - Increment attribution count for current month
  router.post("/attribution/tap", (_req, res) => {
    const monthKey = new Date().toISOString().slice(0, 7); // "2026-03"
    const existing = db
      .select()
      .from(socialAttributions)
      .where(eq(socialAttributions.monthKey, monthKey))
      .get();

    if (existing) {
      const updated = db
        .update(socialAttributions)
        .set({
          count: existing.count + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(socialAttributions.monthKey, monthKey))
        .returning()
        .get();
      res.json({ attribution: updated });
    } else {
      const created = db
        .insert(socialAttributions)
        .values({ monthKey, count: 1 })
        .returning()
        .get();
      res.json({ attribution: created });
    }
  });

  // GET /api/metrics/pattern-analysis - Hook × format × platform performance matrix
  router.get("/pattern-analysis", (_req, res) => {
    // Hook pattern aggregations
    const hookRows = sqlite.prepare(`
      SELECT
        LOWER(hook_pattern_used) as hook_pattern,
        platform,
        COUNT(*) as video_count,
        AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as avg_save_rate,
        AVG(CAST(shares AS FLOAT) / NULLIF(views, 0)) as avg_share_rate,
        AVG(CAST(comments AS FLOAT) / NULLIF(views, 0)) as avg_comment_rate
      FROM performance_metrics
      WHERE hook_pattern_used IS NOT NULL AND views > 0
      GROUP BY LOWER(hook_pattern_used), platform
      ORDER BY avg_save_rate DESC
    `).all() as Array<{
      hook_pattern: string; platform: string; video_count: number;
      avg_save_rate: number; avg_share_rate: number; avg_comment_rate: number;
    }>;

    const hookPatterns = hookRows.map((r) => {
      const weightedEngagement = (0.4 * (r.avg_save_rate ?? 0)) + (0.3 * (r.avg_share_rate ?? 0)) + (0.3 * (r.avg_comment_rate ?? 0));
      return {
        hookPattern: r.hook_pattern,
        platform: r.platform,
        videoCount: r.video_count,
        avgSaveRate: r.avg_save_rate ?? 0,
        avgShareRate: r.avg_share_rate ?? 0,
        avgCommentRate: r.avg_comment_rate ?? 0,
        weightedEngagement,
        confidence: r.video_count >= 5 ? "high" as const : r.video_count >= 3 ? "medium" as const : "low" as const,
      };
    });

    // Format aggregations — derive formatId from video code prefix if not set
    const formatRows = sqlite.prepare(`
      SELECT
        COALESCE(UPPER(format_id), UPPER(SUBSTR(video_code, 1, 1))) as format_id,
        platform,
        COUNT(*) as video_count,
        AVG(views) as avg_views,
        AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as avg_save_rate,
        AVG(CAST(shares AS FLOAT) / NULLIF(views, 0)) as avg_share_rate,
        AVG(CAST(comments AS FLOAT) / NULLIF(views, 0)) as avg_comment_rate
      FROM performance_metrics
      WHERE views > 0
        AND UPPER(COALESCE(format_id, SUBSTR(video_code, 1, 1))) IN ('A','B','C','D','E','F','G')
      GROUP BY UPPER(COALESCE(format_id, SUBSTR(video_code, 1, 1))), platform
      ORDER BY avg_save_rate DESC
    `).all() as Array<{
      format_id: string; platform: string; video_count: number;
      avg_views: number; avg_save_rate: number; avg_share_rate: number; avg_comment_rate: number;
    }>;

    const byFormat = formatRows.map((r) => ({
      formatId: r.format_id,
      platform: r.platform,
      videoCount: r.video_count,
      avgViews: Math.round(r.avg_views ?? 0),
      avgSaveRate: r.avg_save_rate ?? 0,
      weightedEngagement: (0.4 * (r.avg_save_rate ?? 0)) + (0.3 * (r.avg_share_rate ?? 0)) + (0.3 * (r.avg_comment_rate ?? 0)),
    }));

    // Coverage stats
    const coverageRow = sqlite.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN hook_pattern_used IS NOT NULL THEN 1 ELSE 0 END) as with_hook,
        SUM(CASE WHEN format_id IS NOT NULL OR UPPER(SUBSTR(video_code,1,1)) IN ('A','B','C','D','E','F','G') THEN 1 ELSE 0 END) as with_format
      FROM performance_metrics
    `).get() as { total: number; with_hook: number; with_format: number };

    const coverage = {
      totalVideos: coverageRow.total,
      withHookPattern: coverageRow.with_hook,
      withFormatId: coverageRow.with_format,
      hookCoveragePct: coverageRow.total > 0 ? Math.round((coverageRow.with_hook / coverageRow.total) * 100) : 0,
      formatCoveragePct: coverageRow.total > 0 ? Math.round((coverageRow.with_format / coverageRow.total) * 100) : 0,
    };

    // Top outliers by save rate
    const outlierRows = sqlite.prepare(`
      SELECT video_code, platform, views, saves,
        CAST(saves AS FLOAT) / NULLIF(views, 0) as save_rate,
        hook_pattern_used, format_id
      FROM performance_metrics
      WHERE views > 0
      ORDER BY save_rate DESC
      LIMIT 5
    `).all() as Array<{
      video_code: string; platform: string; views: number; saves: number;
      save_rate: number; hook_pattern_used: string | null; format_id: string | null;
    }>;

    const topOutliers = outlierRows.map((r) => ({
      videoCode: r.video_code,
      platform: r.platform,
      views: r.views,
      saves: r.saves,
      saveRate: r.save_rate ?? 0,
      hookPatternUsed: r.hook_pattern_used,
      formatId: r.format_id ?? (["A","B","C","D","E","F","G"].includes(r.video_code[0].toUpperCase()) ? r.video_code[0].toUpperCase() : null),
    }));

    // Data range
    const rangeRow = sqlite.prepare(`
      SELECT MIN(recorded_at) as earliest, MAX(recorded_at) as latest FROM performance_metrics
    `).get() as { earliest: string | null; latest: string | null };

    const dataRange = rangeRow.earliest ? {
      earliest: rangeRow.earliest,
      latest: rangeRow.latest!,
      days: Math.round((new Date(rangeRow.latest!).getTime() - new Date(rangeRow.earliest).getTime()) / 86400000),
    } : null;

    const avgWeightedEngagement = hookPatterns.length > 0
      ? hookPatterns.reduce((s, p) => s + p.weightedEngagement, 0) / hookPatterns.length
      : 0;

    res.json({ hookPatterns, byFormat, coverage, topOutliers, avgWeightedEngagement, dataRange });
  });

  // POST /api/metrics/strategy-analysis - AI-powered KEEP/PROMOTE/DEMOTE analysis
  router.post("/strategy-analysis", async (_req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const hookRows = sqlite.prepare(`
        SELECT LOWER(hook_pattern_used) as hook_pattern, platform, COUNT(*) as n,
          AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as save_rate
        FROM performance_metrics WHERE hook_pattern_used IS NOT NULL AND views > 0
        GROUP BY LOWER(hook_pattern_used), platform ORDER BY save_rate DESC
      `).all() as Array<{ hook_pattern: string; platform: string; n: number; save_rate: number }>;

      if (hookRows.length === 0) {
        res.status(422).json({ error: "No hook pattern data yet. Tag some videos with hookPatternUsed first." });
        return;
      }

      const hookSummary = hookRows.map((r) =>
        `${r.hook_pattern} on ${r.platform}: ${(r.save_rate * 100).toFixed(1)}% save rate (n=${r.n})`
      ).join("\n");

      const hookPatternsContent = fs.existsSync(hookPatternsPath)
        ? fs.readFileSync(hookPatternsPath, "utf-8").slice(0, 4000)
        : "Hook patterns file not found.";

      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `You are analyzing content performance data for a chiropractic practice's social media strategy.

PERFORMANCE DATA (real audience metrics):
${hookSummary}

CURRENT hook-patterns.md emphasis (first 4000 chars):
${hookPatternsContent}

Compare the performance data to what hook-patterns.md currently emphasizes. Identify discrepancies.

Respond with JSON only:
{
  "findings": [
    {
      "verdict": "KEEP|PROMOTE|DEMOTE|INVESTIGATE",
      "hookPattern": "exact pattern name from data",
      "platform": "Instagram|TikTok|YouTube|All",
      "evidence": "specific data citation: e.g. '18.2% save rate (n=8), 2.1x above average'",
      "confidence": "HIGH|MEDIUM|LOW",
      "recommendation": "specific actionable change in 1-2 sentences"
    }
  ],
  "summary": "2-3 sentence overview of biggest strategic opportunities"
}

Rules:
- KEEP: current strategy matches data (evidence confirms it)
- PROMOTE: data shows underemphasized pattern is winning (move it up)
- DEMOTE: high-priority pattern in hook-patterns.md but underperforming in data
- INVESTIGATE: less than 3 data points, inconclusive
- Only include patterns that appear in the data
- Be specific about save rates and n counts
- Minimum 1 finding per verdict type if data supports it`,
        }],
      }, { timeout: 60_000 });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      const parsed = JSON.parse(cleaned) as { findings: unknown[]; summary: string };
      res.json({ ...parsed, generatedAt: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Strategy analysis failed";
      console.error("[strategy-analysis] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/metrics/strategy-log - Append analysis findings to strategy-optimizer/results.md
  router.post("/strategy-log", (req, res) => {
    const { findings, summary } = req.body as { findings: Array<{ verdict: string; hookPattern: string; platform: string; evidence: string; recommendation: string }>; summary: string };
    if (!findings?.length) {
      res.status(400).json({ error: "findings required" });
      return;
    }

    const strategyDir = path.join(industryDir, "strategy-optimizer");
    const resultsPath = path.join(strategyDir, "results.md");

    try {
      if (!fs.existsSync(strategyDir)) fs.mkdirSync(strategyDir, { recursive: true });

      const date = new Date().toISOString().split("T")[0];
      const entry = [
        `\n## ${date} Strategy Analysis\n`,
        `**Summary:** ${summary}\n`,
        `### Findings\n`,
        ...findings.map((f) => `- **${f.verdict}** ${f.hookPattern} on ${f.platform} — ${f.evidence}\n  → ${f.recommendation}`),
        "",
      ].join("\n");

      const existing = fs.existsSync(resultsPath) ? fs.readFileSync(resultsPath, "utf-8") : "";
      const updated = existing.includes("*No runs yet*") ? existing.replace("*No runs yet. Run \"strategy optimizer\" to generate the first entry.*", entry.trim()) : existing + entry;
      fs.writeFileSync(resultsPath, updated);

      res.json({ saved: true, path: resultsPath });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to save" });
    }
  });

  // GET /api/metrics/:code - Get metrics for a specific video
  // IMPORTANT: Must be after all named routes to avoid catching /trends, /bulk, etc.
  router.get("/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const rows = db
      .select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.videoCode, code))
      .orderBy(desc(performanceMetrics.recordedAt))
      .all();

    res.json({ metrics: rows });
  });

  // POST /api/metrics/:code - Add a metrics entry for a video
  router.post("/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const { platform, views, likes, saves, shares, comments, watchTimeSeconds, recordedAt, hookPatternUsed } = req.body;

    if (!platform) {
      res.status(400).json({ error: "platform is required" });
      return;
    }

    const entry = db
      .insert(performanceMetrics)
      .values({
        videoCode: code,
        platform,
        recordedAt: recordedAt || new Date().toISOString().split("T")[0],
        views: views ?? 0,
        likes: likes ?? 0,
        saves: saves ?? 0,
        shares: shares ?? 0,
        comments: comments ?? 0,
        watchTimeSeconds: watchTimeSeconds ?? null,
        hookPatternUsed: hookPatternUsed ?? null,
      })
      .returning()
      .get();

    res.status(201).json({ metric: entry });
  });

  return router;
}
