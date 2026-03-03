import { Router } from "express";
import path from "path";
import { db } from "../db.js";
import { performanceMetrics } from "../../shared/schema.js";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseViralInsights, listDigestDates } from "../parsers/viral-insights.js";
import type { MetricsSyncEntry } from "../../shared/types.js";

export function createMetricsRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const viralInsightsDir = path.join(industryDir, "viral-insights");

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

  // GET /api/metrics/intelligence - Content intelligence from viral insights digests
  router.get("/intelligence", (_req, res) => {
    const { date } = _req.query;
    const latest = parseViralInsights(viralInsightsDir, typeof date === "string" ? date : undefined);
    const availableDates = listDigestDates(viralInsightsDir);

    if (!latest) {
      res.json({ latest: null, availableDates: [] });
      return;
    }

    res.json({ latest, availableDates });
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
    const { platform, views, likes, saves, shares, comments, watchTimeSeconds, recordedAt } = req.body;

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
      })
      .returning()
      .get();

    res.status(201).json({ metric: entry });
  });

  return router;
}
