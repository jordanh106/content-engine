import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import fs from "fs";
import os from "os";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { db } from "../db.js";
import { creatorVideos, videoBreakdowns, channelSnapshots, vaultHooks } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import { downloadVideo, isYtDlpAvailable, cleanupDownload } from "../lib/video-downloader.js";
import { ensureThumbnail } from "../lib/thumbnail-resolver.js";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }
  // If the result still isn't a JSON object (e.g. Claude responded with prose),
  // extract the first {...} block from the original text
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return match[0];
  }
  return cleaned;
}

function extractVariables(pattern: string): string[] {
  const matches = pattern.match(/\[([A-Z][A-Z0-9_ ]*)\]/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

export function createCreatorVideosRouter(contentLibraryPath: string, thumbnailsDir?: string) {
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

      // Resolve thumbnail in background
      if (thumbnailsDir && result.videoUrl) {
        ensureThumbnail(result, thumbnailsDir).catch(() => {});
      }

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

      // Platform-specific search strategy for better results
      const platformSearchHints: Record<string, string> = {
        Instagram: `Search strategy: First search "site:instagram.com/${handle}" to find their profile. Then search "@${handle} instagram reels viral" and "@${handle} instagram chiropractic" to find their popular content. Look for any articles, compilations, or social blade/similar stats pages that list their video performance.`,
        TikTok: `Search strategy: First search "site:tiktok.com/@${handle}" to find their profile. Then search "@${handle} tiktok viral video" and "@${handle} tiktok most viewed". Also try searching "${handle} tiktok" without the @ symbol. Look for any compilation articles or social media analytics pages.`,
        YouTube: `Search strategy: Search "site:youtube.com/@${handle}" or "site:youtube.com/c/${handle}" to find their channel. Then search "@${handle} youtube most popular video" to find top content.`,
      };

      const searchHint = platformSearchHints[platform] || `Search for @${handle} on ${platform} and find their recent videos.`;

      const scanPrompt = `Find 5-10 recent or popular videos from the content creator @${handle} on ${platform}.

${searchHint}

IMPORTANT: Use multiple search queries to maximize results. If your first search doesn't find individual videos, try different search terms. Even partial data (just titles or just a profile description) is better than returning zero results.

For each video found, provide:
- title or description (from the video caption or article mentioning it)
- approximate view count (0 if unknown)
- likes count (0 if unknown)
- comments count (0 if unknown)
- approximate publish date ("unknown" if not found)
- video URL (the direct link to the video, or the creator's profile URL if individual video URL not found)

If you truly cannot find ANY videos after multiple searches, still return at least the creator's profile information and set videos to an empty array.

Respond with JSON only (no markdown, no explanation):
{
  "creator": "@${handle}",
  "platform": "${platform}",
  "avgViews": estimated average views or null if unknown,
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
}`;

      // Agentic tool use loop: keep calling until we get a text response
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: scanPrompt }];
      let finalText = "";
      let loopCount = 0;
      const maxLoops = 5;

      while (loopCount < maxLoops) {
        loopCount++;
        console.log(`[creator-videos] Scan loop ${loopCount} for @${handle}...`);

        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          tools: [{
            type: "web_search_20250305" as const,
            name: "web_search" as const,
            max_uses: 5,
          }],
          messages,
        }, { timeout: 90_000 });

        // Collect all text blocks from this response
        const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
        if (textBlocks.length > 0) {
          finalText = textBlocks.map((b) => b.text).join("\n");
        }

        // If Claude is done, break
        if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
          break;
        }

        // If Claude wants to use more tools, feed the response back as assistant message
        // and add an empty user turn to continue
        if (response.stop_reason === "tool_use") {
          messages.push({ role: "assistant", content: response.content });
          // For server-side tools like web_search, the results are already in the response.
          // We need to provide tool_result blocks for any tool_use blocks.
          const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
          if (toolUseBlocks.length > 0) {
            messages.push({
              role: "user",
              content: toolUseBlocks.map((tu) => ({
                type: "tool_result" as const,
                tool_use_id: tu.id,
                content: "Search completed. Please provide the JSON response now.",
              })),
            });
          }
          continue;
        }

        // Any other stop reason, break
        break;
      }

      if (!finalText) {
        console.error(`[creator-videos] No text response after ${loopCount} loops for @${handle}`);
        res.status(500).json({ error: "No response from AI after web search" });
        return;
      }

      console.log(`[creator-videos] Got ${finalText.length} chars of text for @${handle}`);
      const parsed = JSON.parse(stripCodeFences(finalText));
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

        // Resolve and cache thumbnail in background
        if (thumbnailsDir && result.videoUrl && result.videoUrl !== "unknown") {
          ensureThumbnail(result, thumbnailsDir).catch((err) =>
            console.warn(`[creator-videos] Thumbnail resolve failed for ${result.id}:`, err)
          );
        }
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
      const message = error instanceof Error ? error.message : "Failed to scan creator videos";
      res.status(500).json({ error: message });
    }
  });

  // PUT /api/creator-videos/:id/status - Update video status
  router.put("/:id/status", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const validStatuses = ["inbox", "starred", "saved", "archived"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
        return;
      }
      db.update(creatorVideos).set({ status }).where(eq(creatorVideos.id, id)).run();
      res.json({ id, status });
    } catch (error) {
      console.error("[creator-videos] Error updating status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // PUT /api/creator-videos/:id/notes - Update video notes
  router.put("/:id/notes", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      db.update(creatorVideos).set({ notes: notes || null }).where(eq(creatorVideos.id, id)).run();
      res.json({ id, notes });
    } catch (error) {
      console.error("[creator-videos] Error updating notes:", error);
      res.status(500).json({ error: "Failed to update notes" });
    }
  });

  // DELETE /api/creator-videos/:id - Remove a video and its cached thumbnail
  router.delete("/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const video = db.select().from(creatorVideos).where(eq(creatorVideos.id, id)).get();
      if (!video) {
        res.status(404).json({ error: "Video not found" });
        return;
      }

      // Remove cached thumbnail file
      if (video.thumbnailUrl && video.thumbnailUrl.startsWith("/thumbnails/") && thumbnailsDir) {
        const thumbPath = path.join(thumbnailsDir, path.basename(video.thumbnailUrl));
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      }

      db.delete(creatorVideos).where(eq(creatorVideos.id, id)).run();
      res.json({ deleted: true, id });
    } catch (error) {
      console.error("[creator-videos] Error deleting video:", error);
      res.status(500).json({ error: "Failed to delete video" });
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

  // DELETE /api/creator-videos/breakdowns - Clear all video breakdown topic data
  router.delete("/breakdowns", (_req, res) => {
    db.delete(videoBreakdowns).run();
    res.json({ cleared: true });
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

  // ============================================
  // Deep DNA Analysis (Feature 1 - Replaces Manis AI)
  // ============================================

  function extractFramesFromVideo(videoPath: string, outputDir: string, intervalSeconds = 2): Promise<string[]> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          `-vf`, `fps=1/${intervalSeconds},scale=810:1440:force_original_aspect_ratio=decrease`,
          `-q:v`, `3`,
        ])
        .output(path.join(outputDir, "frame_%04d.jpg"))
        .on("end", () => {
          const files = fs.readdirSync(outputDir)
            .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
            .sort()
            .map((f) => path.join(outputDir, f));
          resolve(files);
        })
        .on("error", (err) => reject(err))
        .run();
    });
  }

  function getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration || 0);
      });
    });
  }

  async function transcribeAudio(videoPath: string): Promise<string | null> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return null;
    const audioPath = videoPath + ".audio.mp3";
    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions(["-vn", "-ac", "1", "-ab", "64k", "-f", "mp3"])
          .output(audioPath)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });
      const audioSize = fs.statSync(audioPath).size;
      if (audioSize < 1024) return null;
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: openaiKey });
      const transcription = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: fs.createReadStream(audioPath) as unknown as File,
      });
      return transcription.text || null;
    } catch (err) {
      console.warn("[creator-videos] Whisper transcription failed:", err);
      return null;
    } finally {
      try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch { /* cleanup */ }
    }
  }

  const DEEP_DNA_PROMPT = `You are a professional video analyst. You have been given extracted frames from a video and its full transcript. Extract the complete creative DNA.

1. ONE-SENTENCE CONCEPT: The core idea in under 20 words (technically interesting + emotionally resonant)
2. STORY STRUCTURE: Map to 5-act model with approximate timestamps:
   - Hook (first 3s): What grabs attention?
   - Conflict/Setup: What tension or question is introduced?
   - Build: How does the content develop?
   - Resolution/Payoff: What's the satisfying answer?
   - CTA: How does it end?
3. AESTHETIC KEYWORDS: 5-8 words describing the visual feel
4. TYPOGRAPHY SYSTEM: Title card style, section headers, caption/subtitle style, overlay approach
5. COLOR PALETTE: Primary, secondary, accent colors (hex if visible), overall mood, grading approach
6. SET DESIGN: Key environmental elements, lighting approach, props, background composition
7. MUSIC/AUDIO: Mood, approximate BPM range, genre classification, energy curve
8. TRANSITION STYLE: Cut types (hard cut, dissolve, AI morph), pacing between shots, any signatures
9. B-ROLL TYPES: Categorize shots as macro/close-up, process/behind-scenes, or product/reveal
10. REPLICATION PLAN: 5-8 ordered steps to recreate this style for different content

Also extract the standard 7 fields:
- topic: What the video is fundamentally about (1-2 words)
- angle: The unique perspective or approach taken
- hookFormat: The hook type used (Question, Shock, Transformation, List, etc.)
- storyStyle: How the content is structured (Problem-solution, Before-after, Narrative arc, Tutorial, etc.)
- visualFormat: Primary visual approach (Talking head, B-roll heavy, Text overlay, Split screen, etc.)
- visuals: Specific visual elements and style choices
- audio: Audio approach (Voiceover, Direct to camera, Trending sound, Original music, etc.)

Return as structured JSON with these exact keys:
{
  "topic": "...",
  "angle": "...",
  "hookFormat": "...",
  "storyStyle": "...",
  "visualFormat": "...",
  "visuals": "...",
  "audio": "...",
  "oneSentenceConcept": "...",
  "storyStructure": { "hook": {...}, "conflict": {...}, "build": {...}, "resolution": {...}, "cta": {...} },
  "aestheticKeywords": ["..."],
  "typographySystem": { "titleStyle": "...", "headerStyle": "...", "captionStyle": "...", "overlayApproach": "..." },
  "colorPalette": { "primary": "...", "secondary": "...", "accent": "...", "mood": "...", "grading": "..." },
  "setDesign": { "elements": [...], "lighting": "...", "environment": "..." },
  "musicAudio": { "mood": "...", "bpmRange": "...", "genre": "...", "energyCurve": "..." },
  "transitionStyle": { "types": [...], "pacing": "...", "signature": "..." },
  "brollTypes": { "macro": [...], "process": [...], "reveal": [...] },
  "replicationPlan": ["step 1", "step 2", ...]
}

No emdashes. Return JSON only.`;

  // POST /api/creator-videos/:id/deep-breakdown - Full DNA analysis with video frames + transcript
  router.post("/:id/deep-breakdown", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    const id = parseInt(req.params.id);
    const video = db.select().from(creatorVideos).where(eq(creatorVideos.id, id)).limit(1).all();
    if (video.length === 0) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const v = video[0];
    let downloadedPath: string | null = null;
    const framesDir = path.join(os.tmpdir(), `ce-dna-frames-${Date.now()}`);
    fs.mkdirSync(framesDir, { recursive: true });

    try {
      let videoFilePath: string | null = null;

      // Try to download video if URL exists
      if (v.videoUrl) {
        const hasYtDlp = await isYtDlpAvailable();
        if (hasYtDlp) {
          console.log(`[creator-videos] Downloading video: ${v.videoUrl}`);
          try {
            const result = await downloadVideo(v.videoUrl);
            videoFilePath = result.filePath;
            downloadedPath = result.filePath;
            console.log(`[creator-videos] Downloaded: ${result.title} (${result.duration}s)`);
          } catch (dlErr) {
            console.warn("[creator-videos] Download failed, falling back to web search:", dlErr);
          }
        }
      }

      let framePaths: string[] = [];
      let transcript: string | null = null;

      if (videoFilePath) {
        // Extract frames + transcribe from downloaded video
        let interval = 2;
        try {
          const duration = await getVideoDuration(videoFilePath);
          if (duration > 30) interval = Math.ceil(duration / 10);
        } catch { /* default interval */ }

        [framePaths, transcript] = await Promise.all([
          extractFramesFromVideo(videoFilePath, framesDir, interval),
          transcribeAudio(videoFilePath),
        ]);
        console.log(`[creator-videos] Extracted ${framePaths.length} frames, transcript: ${transcript ? "yes" : "no"}`);
      }

      // Build AI message
      const imageContent: Anthropic.ImageBlockParam[] = framePaths.slice(0, 10).map((fp) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: "image/jpeg" as const,
          data: fs.readFileSync(fp).toString("base64"),
        },
      }));

      const contextText = `VIDEO: "${v.videoTitle || "Unknown"}" by ${v.creatorHandle} on ${v.platform}
Views: ${v.views}, Likes: ${v.likes}, Comments: ${v.comments}
${v.videoUrl ? `URL: ${v.videoUrl}` : ""}
${transcript ? `\nTRANSCRIPT:\n${transcript}` : "\n(No transcript available)"}
${framePaths.length > 0 ? `\n${framePaths.length} video frames attached.` : "\n(No video frames available - analyze based on metadata and web search results)"}`;

      // If we have frames, use vision. Otherwise fall back to web_search.
      let response;
      if (imageContent.length > 0) {
        response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          messages: [{
            role: "user",
            content: [
              ...imageContent,
              { type: "text", text: `${DEEP_DNA_PROMPT}\n\n${contextText}` },
            ],
          }],
        }, { timeout: 180_000 });
      } else {
        // Fallback: use web_search to find information about the video
        response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          tools: [{
            type: "web_search_20250305" as const,
            name: "web_search" as const,
            max_uses: 5,
          }],
          messages: [{
            role: "user",
            content: `${DEEP_DNA_PROMPT}\n\n${contextText}\n\nSince no video frames are available, use web search to find information about this video and creator to inform your analysis. Search for the creator and their content style.`,
          }],
        }, { timeout: 120_000 });
      }

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      // Save to database (upsert: delete existing then insert)
      db.delete(videoBreakdowns).where(eq(videoBreakdowns.creatorVideoId, id)).run();

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
          typographySystem: JSON.stringify(parsed.typographySystem),
          storyStructure: JSON.stringify(parsed.storyStructure),
          aestheticKeywords: JSON.stringify(parsed.aestheticKeywords),
          colorPalette: JSON.stringify(parsed.colorPalette),
          setDesign: JSON.stringify(parsed.setDesign),
          musicAudio: JSON.stringify(parsed.musicAudio),
          transitionStyle: JSON.stringify(parsed.transitionStyle),
          replicationPlan: JSON.stringify(parsed.replicationPlan),
          brollTypes: JSON.stringify(parsed.brollTypes),
          oneSentenceConcept: parsed.oneSentenceConcept,
        })
        .returning()
        .get();

      res.json({ breakdown: result, hasVideo: !!videoFilePath, hasTranscript: !!transcript, frameCount: framePaths.length });
    } catch (error) {
      console.error("[creator-videos] Deep breakdown error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate deep breakdown" });
    } finally {
      // Cleanup
      try {
        if (downloadedPath) cleanupDownload(downloadedPath);
        if (fs.existsSync(framesDir)) {
          for (const f of fs.readdirSync(framesDir)) fs.unlinkSync(path.join(framesDir, f));
          fs.rmdirSync(framesDir);
        }
      } catch { /* best effort */ }
    }
  });

  // POST /api/creator-videos/analyze-url - One-off analysis from any video URL
  router.post("/analyze-url", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    const { url, save } = req.body;
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    let downloadedPath: string | null = null;
    const framesDir = path.join(os.tmpdir(), `ce-dna-url-${Date.now()}`);
    fs.mkdirSync(framesDir, { recursive: true });

    try {
      const hasYtDlp = await isYtDlpAvailable();
      if (!hasYtDlp) {
        res.status(503).json({ error: "yt-dlp not available. Install with: pip3 install yt-dlp" });
        return;
      }

      console.log(`[creator-videos] Downloading video from URL: ${url}`);
      const dlResult = await downloadVideo(url);
      downloadedPath = dlResult.filePath;
      console.log(`[creator-videos] Downloaded: ${dlResult.title} (${dlResult.duration}s)`);

      // Extract frames + transcribe
      let interval = 2;
      try {
        const duration = await getVideoDuration(dlResult.filePath);
        if (duration > 30) interval = Math.ceil(duration / 10);
      } catch { /* default */ }

      const [framePaths, transcript] = await Promise.all([
        extractFramesFromVideo(dlResult.filePath, framesDir, interval),
        transcribeAudio(dlResult.filePath),
      ]);

      const imageContent: Anthropic.ImageBlockParam[] = framePaths.slice(0, 10).map((fp) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: "image/jpeg" as const,
          data: fs.readFileSync(fp).toString("base64"),
        },
      }));

      const contextText = `VIDEO: "${dlResult.title}" from URL: ${url}
Duration: ${dlResult.duration ? `${dlResult.duration}s` : "unknown"}
${transcript ? `\nTRANSCRIPT:\n${transcript}` : "\n(No transcript available)"}
${framePaths.length} video frames attached.`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            ...imageContent,
            { type: "text", text: `${DEEP_DNA_PROMPT}\n\n${contextText}` },
          ],
        }],
      }, { timeout: 180_000 });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      // Optionally save to database
      let savedBreakdown = null;
      if (save) {
        savedBreakdown = db
          .insert(videoBreakdowns)
          .values({
            creatorVideoId: null,
            creatorHandle: null,
            videoUrl: url,
            topic: parsed.topic,
            angle: parsed.angle,
            hookFormat: parsed.hookFormat,
            storyStyle: parsed.storyStyle,
            visualFormat: parsed.visualFormat,
            visuals: parsed.visuals,
            audio: parsed.audio,
            typographySystem: JSON.stringify(parsed.typographySystem),
            storyStructure: JSON.stringify(parsed.storyStructure),
            aestheticKeywords: JSON.stringify(parsed.aestheticKeywords),
            colorPalette: JSON.stringify(parsed.colorPalette),
            setDesign: JSON.stringify(parsed.setDesign),
            musicAudio: JSON.stringify(parsed.musicAudio),
            transitionStyle: JSON.stringify(parsed.transitionStyle),
            replicationPlan: JSON.stringify(parsed.replicationPlan),
            brollTypes: JSON.stringify(parsed.brollTypes),
            oneSentenceConcept: parsed.oneSentenceConcept,
          })
          .returning()
          .get();
      }

      res.json({
        breakdown: parsed,
        saved: !!savedBreakdown,
        savedId: savedBreakdown?.id ?? null,
        videoTitle: dlResult.title,
        duration: dlResult.duration,
        frameCount: framePaths.length,
        hasTranscript: !!transcript,
      });
    } catch (error) {
      console.error("[creator-videos] Analyze URL error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to analyze video" });
    } finally {
      try {
        if (downloadedPath) cleanupDownload(downloadedPath);
        if (fs.existsSync(framesDir)) {
          for (const f of fs.readdirSync(framesDir)) fs.unlinkSync(path.join(framesDir, f));
          fs.rmdirSync(framesDir);
        }
      } catch { /* best effort */ }
    }
  });

  // POST /api/creator-videos/:id/summarize - Generate AI summary from breakdown data
  router.post("/:id/summarize", async (req, res) => {
    let client: Anthropic | null = null;
    try { client = new Anthropic(); } catch {
      res.status(503).json({ error: "AI unavailable" });
      return;
    }

    try {
      const id = parseInt(req.params.id, 10);
      const rows = db.select().from(videoBreakdowns).where(eq(videoBreakdowns.creatorVideoId, id)).limit(1).all();
      if (!rows.length) {
        res.status(404).json({ error: "No breakdown found for this video" });
        return;
      }

      const bd = rows[0];

      // Return cached summary if exists
      if (bd.summary) {
        res.json({ summary: bd.summary });
        return;
      }

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `Write a concise 2-3 sentence summary of this video. Focus on what makes it effective and what content creators can learn from it.

Topic: ${bd.topic || "Unknown"}
Angle: ${bd.angle || "Unknown"}
Hook Format: ${bd.hookFormat || "Unknown"}
Story Structure: ${bd.storyStyle || bd.storyStructure || "Unknown"}
Visual Format: ${bd.visualFormat || "Unknown"}
Core Concept: ${bd.oneSentenceConcept || "Unknown"}

Rules:
- No emdashes
- Be specific about why this video works
- Mention the hook technique and content structure
- Keep it to 2-3 sentences max`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const summary = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

      // Cache it
      if (summary) {
        db.update(videoBreakdowns).set({ summary }).where(eq(videoBreakdowns.creatorVideoId, id)).run();
      }

      res.json({ summary });
    } catch (err) {
      console.error("[creator-videos] summarize error:", err);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  // POST /api/creator-videos/recalculate-scores - Batch recalculate outlier scores for all videos
  router.post("/recalculate-scores", (_req, res) => {
    try {
      const allVideos = db.select().from(creatorVideos).all();

      // Group by creator handle
      const byCreator = new Map<string, typeof allVideos>();
      for (const v of allVideos) {
        const handle = v.creatorHandle;
        if (!handle) continue;
        if (!byCreator.has(handle)) byCreator.set(handle, []);
        byCreator.get(handle)!.push(v);
      }

      let updated = 0;
      let skipped = 0;

      for (const [handle, videos] of byCreator) {
        const avgViews = getAvgViews(handle);
        if (!avgViews || avgViews <= 0) {
          skipped += videos.length;
          continue;
        }

        for (const v of videos) {
          if (!v.views || v.views <= 0) {
            skipped++;
            continue;
          }
          const score = Math.round((v.views / avgViews) * 100);
          db.update(creatorVideos)
            .set({ outlierScoreX100: score })
            .where(eq(creatorVideos.id, v.id))
            .run();
          updated++;
        }
      }

      res.json({ updated, skipped, total: allVideos.length });
    } catch (err) {
      console.error("[creator-videos] recalculate-scores error:", err);
      res.status(500).json({ error: "Failed to recalculate scores" });
    }
  });

  return router;
}
