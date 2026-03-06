import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db.js";
import { videoStatus, contentWaterfall } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseConfig } from "../parsers/config.js";
import { loadAllFormatTimings } from "../parsers/format-timing.js";
import { parseVibeMotion } from "../parsers/vibe-motion.js";
import { buildTimeline } from "../parsers/timeline-builder.js";
import { parseProductionPlans } from "../parsers/production-plans.js";
import path from "path";
import type { VideoSummary, ProductionStatus, FormatId } from "../../shared/types.js";

export function createVideosRouter(
  contentLibraryPath: string,
  configPath: string,
  formatsDir: string,
) {
  const router = Router();

  // GET /api/videos - list all videos with optional filters
  router.get("/", (_req, res) => {
    const { audience, format, status, search } = _req.query;

    let videos = parseContentLibrary(contentLibraryPath);

    // Get all status records
    const statusRecords = db.select().from(videoStatus).all();
    const statusMap = new Map(
      statusRecords.map((s) => [s.videoCode, s]),
    );

    // Build summaries
    let summaries: VideoSummary[] = videos.map((v) => {
      const statusRecord = statusMap.get(v.code);
      return {
        code: v.code,
        title: v.title,
        format: v.format,
        formatName: v.formatName,
        duration: v.duration,
        audience: v.audience,
        audienceLabel: v.audienceLabel,
        tags: v.tags,
        status: (statusRecord?.currentStatus as ProductionStatus) || "SCRIPTED",
        scriptPreview:
          v.script.split("\n").find((l) => l.trim() && !l.startsWith("["))?.slice(0, 120) || "",
        remotionGraphicsRequired: Boolean(v.vibeMotion),
        remotionGraphicsNotes: v.vibeMotion,
      };
    });

    // Apply filters
    if (audience && typeof audience === "string") {
      summaries = summaries.filter((v) => v.audience === audience);
    }
    if (format && typeof format === "string") {
      summaries = summaries.filter((v) => v.format === format);
    }
    if (status && typeof status === "string") {
      summaries = summaries.filter((v) => v.status === status);
    }
    if (search && typeof search === "string") {
      const q = search.toLowerCase();
      summaries = summaries.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.code.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q)) ||
          v.scriptPreview.toLowerCase().includes(q),
      );
    }

    res.json(summaries);
  });

  // GET /api/videos/:code - full video detail
  router.get("/:code", (req, res) => {
    const { code } = req.params;
    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find(
      (v) => v.code.toLowerCase() === code.toLowerCase(),
    );

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const statusRecord = db
      .select()
      .from(videoStatus)
      .where(eq(videoStatus.videoCode, video.code))
      .get();

    res.json({
      ...video,
      status: (statusRecord?.currentStatus as ProductionStatus) || "SCRIPTED",
      statusUpdatedAt: statusRecord?.statusUpdatedAt || null,
      notes: statusRecord?.notes || null,
      remotionGraphicsRequired: Boolean(video.vibeMotion),
      remotionGraphicsNotes: video.vibeMotion,
    });
  });

  // GET /api/videos/:code/timeline - unified timeline
  router.get("/:code/timeline", (req, res) => {
    const { code: videoCode } = req.params;
    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find(
      (v) => v.code.toLowerCase() === videoCode.toLowerCase(),
    );

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const formatTimings = loadAllFormatTimings(formatsDir);
    const formatTiming = formatTimings.get(video.format);

    if (!formatTiming) {
      res.status(404).json({ error: `No timing data for format ${video.format}` });
      return;
    }

    const components = parseVibeMotion(video.vibeMotion ?? "", video);
    const items = buildTimeline(video, components, formatTiming);

    res.json({
      items,
      formatTiming,
      totalDuration: video.duration,
    });
  });

  // GET /api/config - industry config
  router.get("/config/industry", (_req, res) => {
    const config = parseConfig(configPath);
    res.json(config);
  });

  // GET /api/videos/:code/production-plan - Get production plan if available
  router.get("/:code/production-plan", (req, res) => {
    const { code } = req.params;
    const productionPlansDir = path.join(path.dirname(contentLibraryPath), "production-plans");
    const plans = parseProductionPlans(productionPlansDir);
    const plan = plans.get(code);

    if (plan) {
      res.json({ available: true, plan });
    } else {
      res.json({ available: false, plan: null });
    }
  });

  // GET /api/videos/:code/waterfall - List waterfall derivatives
  router.get("/:code/waterfall", (req, res) => {
    try {
      const items = db.select().from(contentWaterfall)
        .where(eq(contentWaterfall.sourceVideoCode, req.params.code))
        .orderBy(desc(contentWaterfall.createdAt))
        .all();
      res.json({ items });
    } catch (error) {
      console.error("[videos] Waterfall error:", error);
      res.status(500).json({ error: "Failed to list waterfall items" });
    }
  });

  // POST /api/videos/:code/waterfall - Add waterfall derivative
  router.post("/:code/waterfall", (req, res) => {
    try {
      const { tier, platform, description, status } = req.body;
      if (!tier) {
        res.status(400).json({ error: "tier is required" });
        return;
      }
      const result = db.insert(contentWaterfall).values({
        sourceVideoCode: req.params.code,
        tier,
        platform: platform || null,
        description: description || null,
        status: status || "idea",
      }).returning().get();
      res.json({ item: result });
    } catch (error) {
      console.error("[videos] Waterfall add error:", error);
      res.status(500).json({ error: "Failed to add waterfall item" });
    }
  });

  // PUT /api/videos/:code/waterfall/:id - Update waterfall item
  router.put("/:code/waterfall/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, performanceNote, description } = req.body;
      const updates: Record<string, string> = {};
      if (status) updates.status = status;
      if (performanceNote !== undefined) updates.performanceNote = performanceNote;
      if (description !== undefined) updates.description = description;

      db.update(contentWaterfall)
        .set(updates)
        .where(eq(contentWaterfall.id, id))
        .run();
      res.json({ updated: true });
    } catch (error) {
      console.error("[videos] Waterfall update error:", error);
      res.status(500).json({ error: "Failed to update waterfall item" });
    }
  });

  // DELETE /api/videos/:code/waterfall/:id - Remove waterfall item
  router.delete("/:code/waterfall/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id);
      db.delete(contentWaterfall).where(eq(contentWaterfall.id, id)).run();
      res.json({ deleted: true });
    } catch (error) {
      console.error("[videos] Waterfall delete error:", error);
      res.status(500).json({ error: "Failed to delete waterfall item" });
    }
  });

  return router;
}
