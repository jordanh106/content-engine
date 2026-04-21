import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db.js";
import { videoStatus, statusHistory, productionChecklist } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import type { ProductionStatus, ProductionStyle } from "../../shared/types.js";
import { PRODUCTION_STATUSES, isValidTransition } from "../../shared/types.js";
import { getStyleFilteredGateItems } from "../../shared/production-knowledge.js";

export function createPipelineRouter(contentLibraryPath: string) {
  const router = Router();

  // GET /api/pipeline - videos grouped by status
  router.get("/", (_req, res) => {
    const videos = parseContentLibrary(contentLibraryPath);
    const statusRecords = db.select().from(videoStatus).all();
    const statusMap = new Map(
      statusRecords.map((s) => [s.videoCode, s]),
    );

    const styleFilter = _req.query.style as string | undefined;

    // Load all quality gate completions for pipeline display
    const allGateChecks = db.select().from(productionChecklist).where(eq(productionChecklist.checklistType, "quality_gate")).all();
    const gateByVideo = new Map<string, { completed: number; total: number }>();
    for (const check of allGateChecks) {
      const entry = gateByVideo.get(check.videoCode) || { completed: 0, total: 0 };
      entry.total++;
      if (check.completed) entry.completed++;
      gateByVideo.set(check.videoCode, entry);
    }

    const stages: Record<string, Array<{ code: string; title: string; format: string; audience: string; audienceLabel: string; daysInStage: number; productionStyle: ProductionStyle | null; qualityCompletion: number }>> = {};
    for (const s of PRODUCTION_STATUSES) {
      stages[s] = [];
    }

    for (const v of videos) {
      const record = statusMap.get(v.code);
      const status = (record?.currentStatus || "SCRIPTED") as ProductionStatus;
      const pStyle = (record?.productionStyle as ProductionStyle) || null;

      if (styleFilter) {
        if (styleFilter === "none" && pStyle !== null) continue;
        if (styleFilter !== "none" && pStyle !== styleFilter) continue;
      }

      const updatedAt = record?.statusUpdatedAt
        ? new Date(record.statusUpdatedAt)
        : new Date();
      const daysInStage = Math.floor(
        (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      const gateData = gateByVideo.get(v.code);
      const qualityCompletion = gateData && gateData.total > 0
        ? Math.round((gateData.completed / gateData.total) * 100)
        : 0;

      if (stages[status]) {
        stages[status].push({
          code: v.code,
          title: v.title,
          format: v.format,
          audience: v.audience,
          audienceLabel: v.audienceLabel,
          daysInStage,
          productionStyle: pStyle,
          qualityCompletion,
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

    const previousStatus = (record?.currentStatus || "SCRIPTED") as ProductionStatus;

    // Validate state transition (warn but don't block — allows manual override)
    if (record && !isValidTransition(previousStatus, status)) {
      console.warn(`[pipeline] Non-standard transition: ${previousStatus} → ${status} for ${code}`);
    }
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

    // Check if the next stage can be skipped based on production style
    const style = (record?.productionStyle || db.select().from(videoStatus).where(eq(videoStatus.videoCode, code)).get()?.productionStyle) as ProductionStyle | null;
    let suggestSkip: string | null = null;

    if (style) {
      const statusIdx = PRODUCTION_STATUSES.indexOf(status);
      const nextStatus = statusIdx < PRODUCTION_STATUSES.length - 1 ? PRODUCTION_STATUSES[statusIdx + 1] : null;

      if (nextStatus === "RECORDING" && (style === "full_ai")) {
        suggestSkip = "RECORDING";
      } else if (nextStatus === "GENERATING" && style === "real") {
        suggestSkip = "GENERATING";
      }
    }

    res.json({ code, previousStatus, currentStatus: status, suggestSkip });
  });

  // PUT /api/pipeline/bulk-status - update multiple videos at once
  router.put("/bulk-status", (req, res) => {
    const { codes, status, notes } = req.body as {
      codes: string[];
      status: ProductionStatus;
      notes?: string;
    };

    if (!Array.isArray(codes) || codes.length === 0) {
      res.status(400).json({ error: "codes array is required" });
      return;
    }

    if (!PRODUCTION_STATUSES.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const now = new Date().toISOString();
    const results: Array<{ code: string; previousStatus: string; currentStatus: string }> = [];

    for (const code of codes) {
      const record = db
        .select()
        .from(videoStatus)
        .where(eq(videoStatus.videoCode, code))
        .get();

      const previousStatus = record?.currentStatus || "SCRIPTED";

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

      db.insert(statusHistory)
        .values({
          videoCode: code,
          fromStatus: previousStatus,
          toStatus: status,
          notes: notes || null,
        })
        .run();

      results.push({ code, previousStatus, currentStatus: status });
    }

    res.json({ updated: results.length, results });
  });

  // GET /api/pipeline/:code/quality-gate - Get quality gate items for a transition
  router.get("/:code/quality-gate", (req, res) => {
    const code = req.params.code.toUpperCase();
    const targetStatus = req.query.targetStatus as string;

    if (!targetStatus || !PRODUCTION_STATUSES.includes(targetStatus as ProductionStatus)) {
      res.status(400).json({ error: "Valid targetStatus query param required" });
      return;
    }

    const record = db.select().from(videoStatus).where(eq(videoStatus.videoCode, code)).get();
    const currentStatus = (record?.currentStatus || "SCRIPTED") as ProductionStatus;
    const style = (record?.productionStyle as ProductionStyle) || null;

    const items = getStyleFilteredGateItems(currentStatus, targetStatus, style);

    // Load completion state
    const transition = `${currentStatus}->${targetStatus}`;
    const checks = db
      .select()
      .from(productionChecklist)
      .where(
        and(
          eq(productionChecklist.videoCode, code),
          eq(productionChecklist.checklistType, "quality_gate"),
          eq(productionChecklist.stageTransition, transition),
        ),
      )
      .all();
    const completedKeys = new Set(checks.filter((c) => c.completed).map((c) => c.itemKey));

    const gateItems = items.map((item) => ({
      ...item,
      category: "quality_gate" as const,
      completed: completedKeys.has(item.key),
    }));

    const completedCount = gateItems.filter((i) => i.completed).length;

    res.json({
      items: gateItems,
      completionPercent: gateItems.length > 0 ? Math.round((completedCount / gateItems.length) * 100) : 100,
      fromStatus: currentStatus,
      toStatus: targetStatus,
    });
  });

  // PUT /api/pipeline/:code/quality-gate - Toggle a quality gate item
  router.put("/:code/quality-gate", (req, res) => {
    const code = req.params.code.toUpperCase();
    const { itemKey, completed, stageTransition } = req.body as {
      itemKey: string;
      completed: boolean;
      stageTransition: string;
    };

    if (!itemKey || !stageTransition) {
      res.status(400).json({ error: "itemKey and stageTransition required" });
      return;
    }

    const now = new Date().toISOString();
    const existing = db
      .select()
      .from(productionChecklist)
      .where(
        and(
          eq(productionChecklist.videoCode, code),
          eq(productionChecklist.checklistType, "quality_gate"),
          eq(productionChecklist.itemKey, itemKey),
          eq(productionChecklist.stageTransition, stageTransition),
        ),
      )
      .get();

    if (existing) {
      db.update(productionChecklist)
        .set({ completed, completedAt: completed ? now : null })
        .where(eq(productionChecklist.id, existing.id))
        .run();
    } else {
      db.insert(productionChecklist)
        .values({
          videoCode: code,
          checklistType: "quality_gate",
          itemKey,
          completed,
          completedAt: completed ? now : null,
          stageTransition,
        })
        .run();
    }

    res.json({ code, itemKey, completed, stageTransition });
  });

  return router;
}
