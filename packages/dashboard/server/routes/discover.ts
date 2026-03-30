import { Router } from "express";
import { desc, eq, gte, lte, and, sql, like, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { creatorVideos } from "../../shared/schema.js";
import { parseViralInsights } from "../parsers/viral-insights.js";
import { ensureThumbnail, resolveThumbnailUrl, cacheThumbnail, backfillAllThumbnails } from "../lib/thumbnail-resolver.js";
import type { CreatorVideo, TrendingTopic } from "../../shared/types.js";

export function createDiscoverRouter(
  contentLibraryPath: string,
  viralInsightsDir: string,
  thumbnailsDir: string,
) {
  const router = Router();

  // GET /api/discover/feed - Paginated creator videos with filters + trending topics
  router.get("/feed", (_req, res) => {
    try {
      const {
        status,
        sort = "dateAdded",
        platform,
        dateRange,
        search,
        handle,
        limit: limitStr,
        offset: offsetStr,
      } = _req.query as Record<string, string | undefined>;

      const limit = Math.min(parseInt(limitStr || "30", 10) || 30, 100);
      const offset = parseInt(offsetStr || "0", 10) || 0;

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
      if (handle) {
        conditions.push(eq(creatorVideos.creatorHandle, handle));
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

      // Paginate
      const page = sorted.slice(offset, offset + limit);
      const hasMore = offset + limit < sorted.length;

      // Fire-and-forget thumbnail resolution for current page
      for (const row of page) {
        if (row.videoUrl && row.videoUrl !== "unknown" && (!row.thumbnailUrl || !row.thumbnailUrl.startsWith("/thumbnails/"))) {
          ensureThumbnail(row, thumbnailsDir).catch(() => {});
        }
      }

      // Status counts + trending only on first page
      let statusCounts: Record<string, number> | null = null;
      let trending: TrendingTopic[] | null = null;

      if (offset === 0) {
        const allRows = db.select().from(creatorVideos).all();
        statusCounts = { all: allRows.length, inbox: 0, starred: 0, saved: 0, archived: 0 };
        for (const r of allRows) {
          const s = r.status || "inbox";
          statusCounts[s] = (statusCounts[s] || 0) + 1;
        }

        const digest = parseViralInsights(viralInsightsDir);
        trending = digest?.trendingTopics ?? [];
      }

      res.json({
        videos: page,
        total: sorted.length,
        statusCounts,
        trending,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
      });
    } catch (error) {
      console.error("[discover] Error building feed:", error);
      res.status(500).json({ error: "Failed to build discover feed" });
    }
  });

  // PUT /api/discover/batch-status - Bulk update video statuses
  router.put("/batch-status", (req, res) => {
    try {
      const { ids, status: newStatus } = req.body as { ids: number[]; status: string };
      if (!ids?.length || !newStatus) {
        res.status(400).json({ error: "ids and status are required" });
        return;
      }
      const validStatuses = ["inbox", "starred", "saved", "archived"];
      if (!validStatuses.includes(newStatus)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
        return;
      }
      db.update(creatorVideos).set({ status: newStatus }).where(inArray(creatorVideos.id, ids)).run();
      res.json({ updated: ids.length });
    } catch (error) {
      console.error("[discover] Error batch updating status:", error);
      res.status(500).json({ error: "Failed to batch update" });
    }
  });

  // DELETE /api/discover/batch - Bulk delete videos
  router.delete("/batch", (req, res) => {
    try {
      const { ids } = req.body as { ids: number[] };
      if (!ids?.length) {
        res.status(400).json({ error: "ids are required" });
        return;
      }
      db.delete(creatorVideos).where(inArray(creatorVideos.id, ids)).run();
      res.json({ deleted: ids.length });
    } catch (error) {
      console.error("[discover] Error batch deleting:", error);
      res.status(500).json({ error: "Failed to batch delete" });
    }
  });

  // GET /api/discover/channels - Unique creator handles for filter dropdown
  router.get("/channels", (_req, res) => {
    try {
      const rows = db
        .selectDistinct({ handle: creatorVideos.creatorHandle })
        .from(creatorVideos)
        .orderBy(creatorVideos.creatorHandle)
        .all();
      res.json({ channels: rows.map((r) => r.handle) });
    } catch (error) {
      console.error("[discover] Error fetching channels:", error);
      res.status(500).json({ error: "Failed to fetch channels" });
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
      const stats = await backfillAllThumbnails(thumbnailsDir);
      res.json(stats);
    } catch (error) {
      console.error("[discover] Error backfilling thumbnails:", error);
      res.status(500).json({ error: "Failed to backfill thumbnails" });
    }
  });

  return router;
}
