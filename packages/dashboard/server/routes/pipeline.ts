import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { videoStatus, statusHistory } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import type { ProductionStatus } from "../../shared/types.js";
import { PRODUCTION_STATUSES } from "../../shared/types.js";

export function createPipelineRouter(contentLibraryPath: string) {
  const router = Router();

  // GET /api/pipeline - videos grouped by status
  router.get("/", (_req, res) => {
    const videos = parseContentLibrary(contentLibraryPath);
    const statusRecords = db.select().from(videoStatus).all();
    const statusMap = new Map(
      statusRecords.map((s) => [s.videoCode, s]),
    );

    const stages: Record<string, Array<{ code: string; title: string; format: string; audience: string; audienceLabel: string; daysInStage: number }>> = {};
    for (const s of PRODUCTION_STATUSES) {
      stages[s] = [];
    }

    for (const v of videos) {
      const record = statusMap.get(v.code);
      const status = (record?.currentStatus || "SCRIPTED") as ProductionStatus;
      const updatedAt = record?.statusUpdatedAt
        ? new Date(record.statusUpdatedAt)
        : new Date();
      const daysInStage = Math.floor(
        (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (stages[status]) {
        stages[status].push({
          code: v.code,
          title: v.title,
          format: v.format,
          audience: v.audience,
          audienceLabel: v.audienceLabel,
          daysInStage,
        });
      }
    }

    const summary: Record<string, number> = {};
    for (const [key, val] of Object.entries(stages)) {
      summary[key] = val.length;
    }

    res.json({ stages, summary, total: videos.length });
  });

  // PUT /api/pipeline/:code/status - update video status
  router.put("/:code/status", (req, res) => {
    const { code } = req.params;
    const { status, notes } = req.body as {
      status: ProductionStatus;
      notes?: string;
    };

    if (!PRODUCTION_STATUSES.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    // Get or create status record
    let record = db
      .select()
      .from(videoStatus)
      .where(eq(videoStatus.videoCode, code))
      .get();

    const previousStatus = record?.currentStatus || "SCRIPTED";
    const now = new Date().toISOString();

    if (record) {
      db.update(videoStatus)
        .set({
          currentStatus: status,
          statusUpdatedAt: now,
          updatedAt: now,
          ...(notes !== undefined && { notes }),
        })
        .where(eq(videoStatus.videoCode, code))
        .run();
    } else {
      db.insert(videoStatus)
        .values({
          videoCode: code,
          currentStatus: status,
          statusUpdatedAt: now,
          ...(notes !== undefined && { notes }),
        })
        .run();
    }

    // Record status history
    db.insert(statusHistory)
      .values({
        videoCode: code,
        fromStatus: previousStatus,
        toStatus: status,
        notes: notes || null,
      })
      .run();

    res.json({ code, previousStatus, currentStatus: status });
  });

  return router;
}
