import { Router } from "express";
import { desc, eq, gte, lte, and, sql, like } from "drizzle-orm";
import { db } from "../db.js";
import { creatorVideos } from "../../shared/schema.js";
import { parseViralInsights } from "../parsers/viral-insights.js";
import { ensureThumbnail, resolveThumbnailUrl, cacheThumbnail } from "../lib/thumbnail-resolver.js";
import type { CreatorVideo, TrendingTopic } from "../../shared/types.js";

export function createDiscoverRouter(
  contentLibraryPath: string,
  viralInsightsDir: string,
  thumbnailsDir: string,
) {
  const router = Router();

  // GET /api/discover/feed - All creator videos with filters + trending topics
  router.get("/feed", (_req, res) => {
    try {
      const {
        status,
        sort = "dateAdded",
        platform,
        dateRange,
        search,
      } = _req.query as Record<string, string | undefined>;

      // Build conditions
      const conditions = [];
      if (status && status !== "all") {
        conditions.push(eq(creatorVideos.status, status));
      }
      if (platform) {
        conditions.push(eq(creatorVideos.platform, platform));
      }
      if (dateRange && dateRange !== "all") {
        const days = parseInt(dateRange);
        if (!isNaN(days)) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          conditions.push(gte(creatorVideos.createdAt, cutoff.toISOString()));
        }
      }
      if (search) {
        conditions.push(
          sql`(${creatorVideos.videoTitle} LIKE ${"%" + search + "%"} OR ${creatorVideos.creatorHandle} LIKE ${"%" + search + "%"})`,
        );
      }

      const rows = conditions.length > 0
        ? db.select().from(creatorVideos).where(and(...conditions)).all()
        : db.select().from(creatorVideos).all();

      // Sort
      const sorted = [...rows].sort((a, b) => {
        switch (sort) {
          case "views":
            return (b.views || 0) - (a.views || 0);
          case "outlier":
            return (b.outlierScoreX100 || 0) - (a.outlierScoreX100 || 0);
          case "creator":
            return (a.creatorHandle || "").localeCompare(b.creatorHandle || "");
          case "dateAdded":
          default:
            return (b.createdAt || "").localeCompare(a.createdAt || "");
        }
      });

      // Fire-and-forget thumbnail resolution for any missing
      for (const row of sorted.slice(0, 30)) {
        if (row.videoUrl && row.videoUrl !== "unknown" && (!row.thumbnailUrl || !row.thumbnailUrl.startsWith("/thumbnails/"))) {
          ensureThumbnail(row, thumbnailsDir).catch(() => {});
        }
      }

      // Status counts
      const allRows = db.select().from(creatorVideos).all();
      const statusCounts: Record<string, number> = { all: allRows.length, inbox: 0, starred: 0, saved: 0, archived: 0 };
      for (const r of allRows) {
        const s = r.status || "inbox";
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }

      // Trending topics from latest viral insights
      const digest = parseViralInsights(viralInsightsDir);
      const trending: TrendingTopic[] = digest?.trendingTopics ?? [];

      res.json({
        videos: sorted,
        total: sorted.length,
        statusCounts,
        trending,
      });
    } catch (error) {
      console.error("[discover] Error building feed:", error);
      res.status(500).json({ error: "Failed to build discover feed" });
    }
  });

  // POST /api/discover/add-url - Quick-add a video by URL
  router.post("/add-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        res.status(400).json({ error: "URL is required" });
        return;
      }

      // Detect platform
      let platform = "Unknown";
      if (url.includes("youtube.com") || url.includes("youtu.be")) platform = "YouTube";
      else if (url.includes("tiktok.com")) platform = "TikTok";
      else if (url.includes("instagram.com")) platform = "Instagram";

      // Check for duplicate
      const existing = db
        .select()
        .from(creatorVideos)
        .where(eq(creatorVideos.videoUrl, url))
        .limit(1)
        .all();
      if (existing.length > 0) {
        res.json({ video: existing[0], duplicate: true });
        return;
      }

      // Try to get title and thumbnail from oEmbed
      let title: string | null = null;
      let thumbnailUrl: string | null = null;
      let creatorHandle = "unknown";

      if (platform === "YouTube") {
        try {
          const oembedResp = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: AbortSignal.timeout(8000) });
          if (oembedResp.ok) {
            const data = await oembedResp.json();
            title = data.title || null;
            creatorHandle = data.author_name ? `@${data.author_name.replace(/\s+/g, "")}` : "unknown";
          }
        } catch { /* oEmbed failed, continue */ }
        // YouTube thumbnail from URL directly
        const resolved = await resolveThumbnailUrl(url, "YouTube");
        if (resolved) {
          thumbnailUrl = resolved;
        }
      } else if (platform === "TikTok") {
        try {
          const oembedResp = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) });
          if (oembedResp.ok) {
            const data = await oembedResp.json();
            title = data.title || null;
            creatorHandle = data.author_name ? `@${data.author_name}` : "unknown";
            thumbnailUrl = data.thumbnail_url || null;
          }
        } catch { /* oEmbed failed */ }
      }

      // Insert
      const result = db
        .insert(creatorVideos)
        .values({
          creatorHandle,
          platform,
          videoUrl: url,
          videoTitle: title,
          thumbnailUrl: null, // will be set by ensureThumbnail
          status: "inbox",
          recordedAt: new Date().toISOString(),
        })
        .returning()
        .get();

      // Cache thumbnail
      if (thumbnailUrl) {
        const cached = await cacheThumbnail(thumbnailUrl, result.id, thumbnailsDir);
        if (cached) {
          db.update(creatorVideos).set({ thumbnailUrl: cached }).where(eq(creatorVideos.id, result.id)).run();
          result.thumbnailUrl = cached;
        }
      } else {
        // Try ensureThumbnail as fallback
        ensureThumbnail(result, thumbnailsDir).catch(() => {});
      }

      res.json({ video: result, duplicate: false });
    } catch (error) {
      console.error("[discover] Error adding URL:", error);
      res.status(500).json({ error: "Failed to add video" });
    }
  });

  // POST /api/discover/backfill-thumbnails - Resolve missing thumbnails for all creator videos
  router.post("/backfill-thumbnails", async (_req, res) => {
    try {
      const rows = db.select().from(creatorVideos).all();

      const needsResolution = rows.filter(
        (r) => r.videoUrl && r.videoUrl !== "unknown" && (!r.thumbnailUrl || !r.thumbnailUrl.startsWith("/thumbnails/")),
      );

      let resolved = 0;
      for (const row of needsResolution) {
        const result = await ensureThumbnail(row, thumbnailsDir);
        if (result) resolved++;
      }

      res.json({ total: rows.length, resolved, alreadyCached: rows.length - needsResolution.length });
    } catch (error) {
      console.error("[discover] Error backfilling thumbnails:", error);
      res.status(500).json({ error: "Failed to backfill thumbnails" });
    }
  });

  return router;
}
