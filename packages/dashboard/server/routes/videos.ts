import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { videoStatus } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseConfig } from "../parsers/config.js";
import { loadAllFormatTimings } from "../parsers/format-timing.js";
import { parseVibeMotion } from "../parsers/vibe-motion.js";
import { buildTimeline } from "../parsers/timeline-builder.js";
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

  return router;
}
