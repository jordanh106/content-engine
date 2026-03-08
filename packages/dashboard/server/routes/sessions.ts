import { Router } from "express";
import { db } from "../db.js";
import { productionSessions, sessionItems, videoStatus, statusHistory } from "../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";
import type { SessionType, ProductionStatus } from "../../shared/types.js";

const SESSION_STATUS_MAP: Record<SessionType, { from: ProductionStatus; to: ProductionStatus }> = {
  voiceover: { from: "SCRIPTED", to: "RECORDING" },
  generation: { from: "RECORDING", to: "GENERATING" },
  assembly: { from: "GENERATING", to: "ASSEMBLED" },
};

export function createSessionsRouter(contentLibraryPath: string) {
  const router = Router();

  // GET /api/sessions - List past sessions
  router.get("/", (_req, res) => {
    const sessions = db
      .select()
      .from(productionSessions)
      .orderBy(desc(productionSessions.createdAt))
      .limit(50)
      .all();

    const result = sessions.map((s) => {
      const items = db
        .select()
        .from(sessionItems)
        .where(eq(sessionItems.sessionId, s.id))
        .all();

      return {
        id: s.id,
        sessionType: s.sessionType,
        audienceCategory: s.audienceCategory,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        durationMinutes: s.durationMinutes,
        videoCodes: s.videoCodes ? JSON.parse(s.videoCodes) : [],
        itemsCompleted: items.filter((i) => i.completed).length,
        itemsTotal: items.length,
      };
    });

    res.json({ sessions: result });
  });

  // GET /api/sessions/available-videos - Get videos eligible for a session type
  router.get("/available-videos", (req, res) => {
    const type = req.query.type as SessionType;
    if (!type || !SESSION_STATUS_MAP[type]) {
      res.status(400).json({ error: "type must be voiceover, generation, or assembly" });
      return;
    }

    const targetStatus = SESSION_STATUS_MAP[type].from;
    const videos = parseContentLibrary(contentLibraryPath);
    const statusRecords = db.select().from(videoStatus).all();
    const statusMap = new Map(statusRecords.map((s) => [s.videoCode, s.currentStatus]));

    const available = videos
      .filter((v) => {
        const status = statusMap.get(v.code) || "SCRIPTED";
        return status === targetStatus;
      })
      .map((v) => ({
        code: v.code,
        title: v.title,
        format: v.format,
        audience: v.audience,
        audienceLabel: v.audienceLabel,
      }));

    res.json({ videos: available, sessionType: type });
  });

  // GET /api/sessions/recommendations - Smart batching suggestions
  router.get("/recommendations", (req, res) => {
    const type = (req.query.type as SessionType) || "voiceover";
    if (!SESSION_STATUS_MAP[type]) {
      res.status(400).json({ error: "Invalid session type" });
      return;
    }

    const targetStatus = SESSION_STATUS_MAP[type].from;
    const videos = parseContentLibrary(contentLibraryPath);
    const statusRecords = db.select().from(videoStatus).all();
    const statusMap = new Map(statusRecords.map((s) => [s.videoCode, s.currentStatus]));

    const available = videos.filter((v) => {
      const status = statusMap.get(v.code) || "SCRIPTED";
      return status === targetStatus;
    });

    if (available.length === 0) {
      res.json({ batches: [], total: 0 });
      return;
    }

    // Group by audience for tone consistency
    const byAudience = new Map<string, typeof available>();
    for (const v of available) {
      const key = v.audienceLabel || v.audience;
      if (!byAudience.has(key)) byAudience.set(key, []);
      byAudience.get(key)!.push(v);
    }

    const batches = Array.from(byAudience.entries()).map(([audience, vids]) => {
      // Estimate recording time based on format
      const formatMinutes: Record<string, number> = { A: 5, B: 5, C: 7, D: 3, E: 7, F: 2, G: 4 };
      const estMinutes = vids.reduce((sum, v) => sum + (formatMinutes[v.format] || 5), 0);

      // Group by format within audience for set consistency
      const formats = [...new Set(vids.map((v) => v.format))];

      return {
        audience,
        videos: vids.map((v) => ({ code: v.code, title: v.title, format: v.format, audienceLabel: v.audienceLabel })),
        count: vids.length,
        estimatedMinutes: estMinutes,
        formats,
        reason: `${vids.length} ${audience} videos share the same tone and audience. Formats: ${formats.join(", ")}. Est. ${estMinutes} min.`,
      };
    });

    // Sort by count descending (biggest batch first)
    batches.sort((a, b) => b.count - a.count);

    res.json({ batches, total: available.length });
  });

  // POST /api/sessions - Create a new session
  router.post("/", (req, res) => {
    const { sessionType, audienceCategory, videoCodes } = req.body as {
      sessionType: SessionType;
      audienceCategory?: string;
      videoCodes: string[];
    };

    if (!sessionType || !SESSION_STATUS_MAP[sessionType]) {
      res.status(400).json({ error: "Invalid sessionType" });
      return;
    }
    if (!Array.isArray(videoCodes) || videoCodes.length === 0) {
      res.status(400).json({ error: "videoCodes array is required" });
      return;
    }

    const now = new Date().toISOString();

    const result = db.insert(productionSessions).values({
      sessionType,
      audienceCategory: audienceCategory || null,
      startedAt: now,
      videoCodes: JSON.stringify(videoCodes),
    }).run();

    const sessionId = Number(result.lastInsertRowid);

    // Create checklist items
    const videos = parseContentLibrary(contentLibraryPath);
    const videoMap = new Map(videos.map((v) => [v.code, v]));

    const items = videoCodes.map((code, index) => {
      db.insert(sessionItems).values({
        sessionId,
        videoCode: code,
        completed: false,
        orderIndex: index,
      }).run();

      const video = videoMap.get(code);
      return {
        videoCode: code,
        title: video?.title || code,
        format: video?.format || "A",
        completed: false,
        completedAt: null,
        orderIndex: index,
      };
    });

    res.json({
      session: {
        id: sessionId,
        sessionType,
        audienceCategory: audienceCategory || null,
        startedAt: now,
        completedAt: null,
        durationMinutes: null,
        videoCodes,
        items,
      },
    });
  });

  // PUT /api/sessions/:id/items/:videoCode/complete - Mark item done + auto-advance status
  router.put("/:id/items/:videoCode/complete", (req, res) => {
    const sessionId = parseInt(req.params.id);
    const { videoCode } = req.params;

    // Get session to determine type
    const session = db
      .select()
      .from(productionSessions)
      .where(eq(productionSessions.id, sessionId))
      .get();

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const now = new Date().toISOString();

    // Mark item complete
    db.update(sessionItems)
      .set({ completed: true, completedAt: now })
      .where(eq(sessionItems.sessionId, sessionId))
      .run();

    // Actually we need to match both sessionId AND videoCode
    // Drizzle doesn't have a simple AND for updates, so do it via raw
    const item = db
      .select()
      .from(sessionItems)
      .where(eq(sessionItems.sessionId, sessionId))
      .all()
      .find((i) => i.videoCode === videoCode);

    if (item) {
      db.update(sessionItems)
        .set({ completed: true, completedAt: now })
        .where(eq(sessionItems.id, item.id))
        .run();
    }

    // Auto-advance video status
    const statusTransition = SESSION_STATUS_MAP[session.sessionType as SessionType];
    if (statusTransition) {
      const record = db
        .select()
        .from(videoStatus)
        .where(eq(videoStatus.videoCode, videoCode))
        .get();

      const previousStatus = record?.currentStatus || "SCRIPTED";

      if (record) {
        db.update(videoStatus)
          .set({
            currentStatus: statusTransition.to,
            statusUpdatedAt: now,
            updatedAt: now,
          })
          .where(eq(videoStatus.videoCode, videoCode))
          .run();
      } else {
        db.insert(videoStatus)
          .values({
            videoCode,
            currentStatus: statusTransition.to,
            statusUpdatedAt: now,
          })
          .run();
      }

      db.insert(statusHistory)
        .values({
          videoCode,
          fromStatus: previousStatus,
          toStatus: statusTransition.to,
          notes: `Auto-advanced by ${session.sessionType} session`,
        })
        .run();
    }

    res.json({ videoCode, completed: true, newStatus: statusTransition?.to });
  });

  // PUT /api/sessions/:id/complete - End the session
  router.put("/:id/complete", (req, res) => {
    const sessionId = parseInt(req.params.id);
    const { durationMinutes } = req.body as { durationMinutes?: number };

    const now = new Date().toISOString();
    db.update(productionSessions)
      .set({
        completedAt: now,
        ...(durationMinutes !== undefined && { durationMinutes }),
      })
      .where(eq(productionSessions.id, sessionId))
      .run();

    res.json({ id: sessionId, completedAt: now, durationMinutes: durationMinutes ?? null });
  });

  return router;
}
