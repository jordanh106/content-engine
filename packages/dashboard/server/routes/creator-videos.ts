import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db.js";
import { creatorVideos, videoBreakdowns, channelSnapshots, vaultHooks } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned;
}

function extractVariables(pattern: string): string[] {
  const matches = pattern.match(/\[([A-Z][A-Z0-9_ ]*)\]/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

export function createCreatorVideosRouter(contentLibraryPath: string) {
  const router = Router();

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn("[creator-videos] ANTHROPIC_API_KEY not set.");
  }

  // Helper: get average views for a creator
  function getAvgViews(handle: string): number | null {
    // First try channel_snapshots
    const snapshot = db
      .select()
      .from(channelSnapshots)
      .where(eq(channelSnapshots.handle, handle))
      .orderBy(desc(channelSnapshots.recordedAt))
      .limit(1)
      .all();
    if (snapshot.length > 0 && snapshot[0].avgViews) {
      return snapshot[0].avgViews;
    }

    // Fallback: compute from creator_videos
    const videos = db
      .select({ views: creatorVideos.views })
      .from(creatorVideos)
      .where(eq(creatorVideos.creatorHandle, handle))
      .all();
    if (videos.length === 0) return null;
    const total = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    return Math.round(total / videos.length);
  }

  // GET /api/creator-videos - List all tracked videos with filters
  router.get("/", async (req, res) => {
    try {
      const {
        handle,
        minOutlierScore,
        dateFrom,
        dateTo,
        sort = "outlierScore",
        platform,
      } = req.query as Record<string, string | undefined>;

      let query = db.select().from(creatorVideos);

      // Build conditions
      const conditions = [];
      if (handle) conditions.push(eq(creatorVideos.creatorHandle, handle));
      if (platform) conditions.push(eq(creatorVideos.platform, platform));
      if (minOutlierScore) {
        conditions.push(gte(creatorVideos.outlierScoreX100, parseInt(minOutlierScore)));
      }
      if (dateFrom) conditions.push(gte(creatorVideos.publishedAt, dateFrom));
      if (dateTo) conditions.push(lte(creatorVideos.publishedAt, dateTo));

      const rows = conditions.length > 0
        ? db.select().from(creatorVideos).where(and(...conditions)).all()
        : db.select().from(creatorVideos).all();

      // Sort
      const sorted = [...rows].sort((a, b) => {
        if (sort === "views") return (b.views || 0) - (a.views || 0);
        if (sort === "publishedAt") return (b.publishedAt || "").localeCompare(a.publishedAt || "");
        // Default: outlierScore
        return (b.outlierScoreX100 || 0) - (a.outlierScoreX100 || 0);
      });

      res.json({ videos: sorted, total: sorted.length });
    } catch (error) {
      console.error("[creator-videos] Error listing videos:", error);
      res.status(500).json({ error: "Failed to list creator videos" });
    }
  });

  // POST /api/creator-videos - Manually log a video
  router.post("/", async (req, res) => {
    try {
      const { creatorHandle, platform, videoUrl, videoTitle, publishedAt, views, likes, comments, shares, saves, durationSeconds } = req.body;
      if (!creatorHandle || !platform) {
        res.status(400).json({ error: "creatorHandle and platform are required" });
        return;
      }

      // Calculate outlier score
      const avgViews = getAvgViews(creatorHandle);
      const outlierScoreX100 = avgViews && views
        ? Math.round((views / avgViews) * 100)
        : null;

      const result = db
        .insert(creatorVideos)
        .values({
          creatorHandle,
          platform,
          videoUrl: videoUrl || null,
          videoTitle: videoTitle || null,
          publishedAt: publishedAt || null,
          durationSeconds: durationSeconds || null,
          views: views || 0,
          likes: likes || 0,
          comments: comments || 0,
          shares: shares || 0,
          saves: saves || 0,
          outlierScoreX100,
          recordedAt: new Date().toISOString(),
        })
        .returning()
        .get();

      res.json({ video: result });
    } catch (error) {
      console.error("[creator-videos] Error saving video:", error);
      res.status(500).json({ error: "Failed to save video" });
    }
  });

  // POST /api/creator-videos/scan/:handle - AI scan for recent videos
  router.post("/scan/:handle", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const handle = req.params.handle.replace(/^@/, "");
      const platform = (req.body.platform as string) || "Instagram";
      console.log(`[creator-videos] Scanning @${handle} on ${platform}...`);

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        tools: [{
          type: "web_search_20250305" as const,
          name: "web_search" as const,
          max_uses: 3,
        }],
        messages: [{
          role: "user",
          content: `Search for the most recent and top-performing videos from @${handle} on ${platform}. Find 5-10 of their recent videos with view counts, likes, and any engagement data available.

For each video found, provide:
- title or description
- approximate view count
- likes count (if available)
- comments count (if available)
- approximate publish date
- video URL (if available)

Respond with JSON only:
{
  "creator": "@${handle}",
  "platform": "${platform}",
  "avgViews": estimated average views across their recent content,
  "videos": [
    {
      "title": "video title or description",
      "views": 12500,
      "likes": 450,
      "comments": 23,
      "publishedAt": "2026-03-01",
      "videoUrl": "url if found"
    }
  ]
}`,
        }],
      }, { timeout: 60_000 });

      // Extract text from response
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));
      const avgViews = parsed.avgViews || null;

      // Update channel snapshot with latest avgViews
      if (avgViews) {
        db.insert(channelSnapshots)
          .values({
            handle: `@${handle}`,
            platform,
            avgViews,
            recordedAt: new Date().toISOString(),
          })
          .run();
      }

      // Insert videos
      const savedVideos = [];
      for (const v of (parsed.videos || [])) {
        const outlierScoreX100 = avgViews && v.views
          ? Math.round((v.views / avgViews) * 100)
          : null;

        const result = db
          .insert(creatorVideos)
          .values({
            creatorHandle: `@${handle}`,
            platform,
            videoUrl: v.videoUrl || null,
            videoTitle: v.title || null,
            publishedAt: v.publishedAt || null,
            views: v.views || 0,
            likes: v.likes || 0,
            comments: v.comments || 0,
            shares: v.shares || 0,
            saves: v.saves || 0,
            outlierScoreX100,
            recordedAt: new Date().toISOString(),
          })
          .returning()
          .get();
        savedVideos.push(result);
      }

      console.log(`[creator-videos] Scanned @${handle}: ${savedVideos.length} videos, avgViews=${avgViews}`);
      res.json({
        scanned: true,
        handle: `@${handle}`,
        platform,
        avgViews,
        videosFound: savedVideos.length,
        videos: savedVideos,
      });
    } catch (error) {
      console.error("[creator-videos] Scan error:", error);
      res.status(500).json({ error: "Failed to scan creator videos" });
    }
  });

  // GET /api/creator-videos/:id/breakdown - Get 7-variable breakdown
  router.get("/:id/breakdown", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const breakdown = db
        .select()
        .from(videoBreakdowns)
        .where(eq(videoBreakdowns.creatorVideoId, id))
        .limit(1)
        .all();

      if (breakdown.length === 0) {
        res.json({ breakdown: null });
        return;
      }
      res.json({ breakdown: breakdown[0] });
    } catch (error) {
      console.error("[creator-videos] Error getting breakdown:", error);
      res.status(500).json({ error: "Failed to get breakdown" });
    }
  });

  // POST /api/creator-videos/:id/breakdown - AI generates 7-variable breakdown
  router.post("/:id/breakdown", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const id = parseInt(req.params.id);
      const video = db.select().from(creatorVideos).where(eq(creatorVideos.id, id)).limit(1).all();
      if (video.length === 0) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      const v = video[0];
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Analyze this video and break it down into the 7-variable framework:

VIDEO: "${v.videoTitle || "Unknown"}" by ${v.creatorHandle} on ${v.platform}
Views: ${v.views}, Likes: ${v.likes}, Comments: ${v.comments}
${v.videoUrl ? `URL: ${v.videoUrl}` : ""}

Provide the 7-variable breakdown as JSON:
{
  "topic": "What the video is fundamentally about (1-2 words)",
  "angle": "The unique perspective or approach taken",
  "hookFormat": "The hook type used (e.g., Question, Shock, Transformation, List, etc.)",
  "storyStyle": "How the content is structured (e.g., Problem-solution, Before-after, Listicle, Narrative arc, Tutorial, Rant)",
  "visualFormat": "Primary visual approach (e.g., Talking head, B-roll heavy, Text overlay, Split screen, POV, Montage)",
  "visuals": "Specific visual elements and style choices",
  "audio": "Audio approach (e.g., Voiceover, Direct to camera, Trending sound, Original music, ASMR)"
}`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      const result = db
        .insert(videoBreakdowns)
        .values({
          creatorVideoId: id,
          creatorHandle: v.creatorHandle,
          videoUrl: v.videoUrl,
          topic: parsed.topic,
          angle: parsed.angle,
          hookFormat: parsed.hookFormat,
          storyStyle: parsed.storyStyle,
          visualFormat: parsed.visualFormat,
          visuals: parsed.visuals,
          audio: parsed.audio,
        })
        .returning()
        .get();

      res.json({ breakdown: result });
    } catch (error) {
      console.error("[creator-videos] Breakdown error:", error);
      res.status(500).json({ error: "Failed to generate breakdown" });
    }
  });

  // POST /api/creator-videos/:id/save-hook - Extract hook and save to vault
  router.post("/:id/save-hook", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const id = parseInt(req.params.id);
      const video = db.select().from(creatorVideos).where(eq(creatorVideos.id, id)).limit(1).all();
      if (video.length === 0) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      const v = video[0];
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Extract the hook from this video title and convert it to a reusable Mad Lib template.

Video: "${v.videoTitle}" by ${v.creatorHandle}
Platform: ${v.platform}, Views: ${v.views}

Replace specific nouns, verbs, and adjectives with [UPPERCASE_VARIABLE] placeholders.

Respond with JSON:
{
  "pattern": "the Mad Lib template",
  "variables": ["VAR1", "VAR2"],
  "category": "question|statistic|myth|emotional|mystery|list|problem|shock|callout|transformation|exclusivity|controversial|fomo|urgency|custom",
  "optimizes": "watch time|saves|comments|shares"
}`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      const result = db
        .insert(vaultHooks)
        .values({
          pattern: parsed.pattern,
          example: v.videoTitle,
          category: parsed.category || "custom",
          sourceCreator: v.creatorHandle,
          sourceUrl: v.videoUrl,
          bestFormat: null,
          platform: v.platform,
          optimizes: parsed.optimizes || null,
          variables: JSON.stringify(parsed.variables || extractVariables(parsed.pattern)),
        })
        .returning()
        .get();

      res.json({ hook: { ...result, variables: JSON.parse(result.variables || "[]") } });
    } catch (error) {
      console.error("[creator-videos] Save hook error:", error);
      res.status(500).json({ error: "Failed to extract and save hook" });
    }
  });

  // DELETE /api/creator-videos/:id
  router.delete("/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      db.delete(creatorVideos).where(eq(creatorVideos.id, id)).run();
      res.json({ deleted: true });
    } catch (error) {
      console.error("[creator-videos] Delete error:", error);
      res.status(500).json({ error: "Failed to delete video" });
    }
  });

  // GET /api/creator-videos/outliers - Find videos that significantly outperform creator's median
  router.get("/outliers", (_req, res) => {
    try {
      const allVideos = db.select().from(creatorVideos).orderBy(desc(creatorVideos.views)).all();

      // Group by creator
      const byCreator = new Map<string, typeof allVideos>();
      for (const v of allVideos) {
        if (!byCreator.has(v.creatorHandle)) byCreator.set(v.creatorHandle, []);
        byCreator.get(v.creatorHandle)!.push(v);
      }

      const outliers: Array<{
        id: number;
        creatorHandle: string;
        platform: string;
        title: string;
        views: number;
        medianViews: number;
        multiplier: number;
        url: string | null;
        postedAt: string | null;
        hasBreakdown: boolean;
      }> = [];

      for (const [handle, videos] of byCreator.entries()) {
        if (videos.length < 3) continue; // Need enough data

        // Calculate median views
        const sortedViews = videos.map((v) => v.views ?? 0).sort((a, b) => a - b);
        const mid = Math.floor(sortedViews.length / 2);
        const median = sortedViews.length % 2 !== 0
          ? sortedViews[mid]
          : Math.round((sortedViews[mid - 1] + sortedViews[mid]) / 2);

        if (median === 0) continue;

        // Find outliers (3x+ median)
        for (const v of videos) {
          const views = v.views ?? 0;
          const multiplier = views / median;
          if (multiplier >= 3) {
            const breakdown = db.select().from(videoBreakdowns).all()
              .find((b) => b.creatorVideoId === v.id);
            outliers.push({
              id: v.id,
              creatorHandle: handle,
              platform: v.platform,
              title: v.videoTitle || "Untitled",
              views,
              medianViews: median,
              multiplier: Number(multiplier.toFixed(1)),
              url: v.videoUrl,
              postedAt: v.publishedAt,
              hasBreakdown: !!breakdown,
            });
          }
        }
      }

      // Sort by multiplier descending
      outliers.sort((a, b) => b.multiplier - a.multiplier);

      res.json({ outliers: outliers.slice(0, 20), total: outliers.length });
    } catch (error) {
      console.error("[creator-videos] Outlier detection error:", error);
      res.status(500).json({ error: "Failed to detect outliers" });
    }
  });

  // GET /api/creator-videos/competitor-gaps - Topics they cover that you don't
  router.get("/competitor-gaps", (_req, res) => {
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const myTopics = new Set(videos.map((v) => v.title.toLowerCase()));

      // Get all breakdowns for topic analysis
      const breakdowns = db.select().from(videoBreakdowns).all();

      // Extract unique topics from competitor breakdowns
      const competitorTopics = new Map<string, { topic: string; creators: Set<string>; count: number }>();

      for (const b of breakdowns) {
        if (!b.topic) continue;
        const topicLower = b.topic.toLowerCase();
        const existing = competitorTopics.get(topicLower);
        if (existing) {
          existing.count++;
          if (b.creatorHandle) existing.creators.add(b.creatorHandle);
        } else {
          competitorTopics.set(topicLower, {
            topic: b.topic,
            creators: new Set(b.creatorHandle ? [b.creatorHandle] : []),
            count: 1,
          });
        }
      }

      // Classify: blue ocean (they have, you don't), overlap, unique to you
      const blueOcean: Array<{ topic: string; creators: string[]; count: number }> = [];
      const overlap: Array<{ topic: string; creators: string[]; count: number }> = [];

      for (const [topicLower, data] of competitorTopics) {
        const isOverlap = [...myTopics].some((mt) =>
          mt.includes(topicLower) || topicLower.includes(mt) ||
          topicLower.split(" ").filter((w) => w.length > 3).some((w) => mt.includes(w)),
        );

        const entry = { topic: data.topic, creators: [...data.creators], count: data.count };
        if (isOverlap) {
          overlap.push(entry);
        } else {
          blueOcean.push(entry);
        }
      }

      blueOcean.sort((a, b) => b.count - a.count);
      overlap.sort((a, b) => b.count - a.count);

      res.json({
        blueOcean: blueOcean.slice(0, 15),
        overlap: overlap.slice(0, 10),
        uniqueToYou: videos.length,
        totalCompetitorTopics: competitorTopics.size,
      });
    } catch (error) {
      console.error("[creator-videos] Competitor gaps error:", error);
      res.status(500).json({ error: "Failed to analyze competitor gaps" });
    }
  });

  // GET /api/creator-videos/compare - Compare 2-4 creators side-by-side
  router.get("/compare", (req, res) => {
    try {
      const handles = ((req.query.handles as string) || "").split(",").map((h) => h.trim()).filter(Boolean);
      if (handles.length < 2 || handles.length > 4) {
        res.status(400).json({ error: "Provide 2-4 creator handles separated by commas" });
        return;
      }

      const snapshots = db.select().from(channelSnapshots).all();
      const videos = db.select().from(creatorVideos).all();
      const breakdowns = db.select().from(videoBreakdowns).all();

      const comparison = handles.map((handle) => {
        const snap = snapshots
          .filter((s) => s.handle === handle)
          .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];

        const creatorVids = videos.filter((v) => v.creatorHandle === handle);
        const totalViews = creatorVids.reduce((s, v) => s + (v.views ?? 0), 0);
        const avgViews = creatorVids.length > 0 ? Math.round(totalViews / creatorVids.length) : 0;
        const creatorBreakdowns = breakdowns.filter((b) => b.creatorHandle === handle);

        // Extract format preferences from breakdowns
        const formatCounts: Record<string, number> = {};
        for (const b of creatorBreakdowns) {
          if (b.visualFormat) {
            formatCounts[b.visualFormat] = (formatCounts[b.visualFormat] || 0) + 1;
          }
        }

        // Extract hook patterns
        const hookFormats: Record<string, number> = {};
        for (const b of creatorBreakdowns) {
          if (b.hookFormat) {
            hookFormats[b.hookFormat] = (hookFormats[b.hookFormat] || 0) + 1;
          }
        }

        return {
          handle,
          followers: snap?.followers ?? null,
          avgViews,
          engagementRateBps: snap?.engagementRateBps ?? null,
          saveRateBps: snap?.saveRateBps ?? null,
          postsPerWeek: snap?.postsPerWeek ?? null,
          platform: snap?.platform ?? "unknown",
          videoCount: creatorVids.length,
          breakdownCount: creatorBreakdowns.length,
          topFormats: Object.entries(formatCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, c]) => ({ format: f, count: c })),
          topHookStyles: Object.entries(hookFormats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, c]) => ({ style: h, count: c })),
        };
      });

      res.json({ comparison });
    } catch (error) {
      console.error("[creator-videos] Compare error:", error);
      res.status(500).json({ error: "Failed to compare creators" });
    }
  });

  return router;
}
