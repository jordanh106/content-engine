import { Router } from "express";
import { db } from "../db.js";
import { performanceMetrics } from "../../shared/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";

export function createMetricsRouter(contentLibraryPath: string) {
  const router = Router();

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

  // GET /api/metrics/:code - Get metrics for a specific video
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

  return router;
}
