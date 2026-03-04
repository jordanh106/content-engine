import { Router } from "express";
import path from "path";
import { db } from "../db.js";
import { calendarEntries, videoStatus, statusHistory } from "../../shared/schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseConfig } from "../parsers/config.js";

export function createCalendarRouter(contentLibraryPath: string) {
  const router = Router();
  const configPath = path.join(path.dirname(contentLibraryPath), "config.json");

  // GET /api/calendar - Get entries for a date range
  router.get("/", (req, res) => {
    const start = (req.query.start as string) || new Date().toISOString().split("T")[0];
    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + 7);
    const end = (req.query.end as string) || endDate.toISOString().split("T")[0];

    const entries = db
      .select()
      .from(calendarEntries)
      .where(and(gte(calendarEntries.date, start), lte(calendarEntries.date, end)))
      .all();

    const videos = parseContentLibrary(contentLibraryPath);
    const videoMap = new Map(videos.map((v) => [v.code, v]));

    const config = parseConfig(configPath);
    const platforms = config.platforms || [];

    const enriched = entries.map((e) => {
      const video = e.videoCode ? videoMap.get(e.videoCode) : null;
      return {
        id: e.id,
        date: e.date,
        platform: e.platform,
        videoCode: e.videoCode,
        slotLabel: e.slotLabel,
        status: e.status,
        notes: e.notes,
        videoTitle: video?.title,
        videoFormat: video?.format,
      };
    });

    res.json({ entries: enriched, platforms });
  });

  // POST /api/calendar - Create a new entry
  router.post("/", (req, res) => {
    const { date, platform, videoCode, slotLabel, notes } = req.body as {
      date: string;
      platform: string;
      videoCode?: string;
      slotLabel?: string;
      notes?: string;
    };

    if (!date || !platform) {
      res.status(400).json({ error: "date and platform are required" });
      return;
    }

    const result = db.insert(calendarEntries).values({
      date,
      platform,
      videoCode: videoCode || null,
      slotLabel: slotLabel || null,
      notes: notes || null,
      status: "planned",
    }).run();

    const entry = db
      .select()
      .from(calendarEntries)
      .where(eq(calendarEntries.id, Number(result.lastInsertRowid)))
      .get();

    res.json({ entry });
  });

  // PUT /api/calendar/:id - Update an entry
  router.put("/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const { date, platform, videoCode, slotLabel, notes, status } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (date !== undefined) updates.date = date;
    if (platform !== undefined) updates.platform = platform;
    if (videoCode !== undefined) updates.videoCode = videoCode;
    if (slotLabel !== undefined) updates.slotLabel = slotLabel;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;

    db.update(calendarEntries).set(updates).where(eq(calendarEntries.id, id)).run();

    const entry = db.select().from(calendarEntries).where(eq(calendarEntries.id, id)).get();
    res.json({ entry });
  });

  // DELETE /api/calendar/:id - Remove an entry
  router.delete("/:id", (req, res) => {
    const id = parseInt(req.params.id);
    db.delete(calendarEntries).where(eq(calendarEntries.id, id)).run();
    res.json({ deleted: true });
  });

  // POST /api/calendar/schedule-video - Schedule a video (sets status to SCHEDULED)
  router.post("/schedule-video", (req, res) => {
    const { videoCode, date, platform } = req.body as {
      videoCode: string;
      date: string;
      platform: string;
    };

    if (!videoCode || !date || !platform) {
      res.status(400).json({ error: "videoCode, date, and platform are required" });
      return;
    }

    // Create calendar entry
    db.insert(calendarEntries).values({
      date,
      platform,
      videoCode,
      status: "scheduled",
    }).run();

    // Update video status to SCHEDULED
    const now = new Date().toISOString();
    const record = db
      .select()
      .from(videoStatus)
      .where(eq(videoStatus.videoCode, videoCode))
      .get();

    const previousStatus = record?.currentStatus || "ASSEMBLED";

    if (record) {
      db.update(videoStatus)
        .set({ currentStatus: "SCHEDULED", statusUpdatedAt: now, updatedAt: now })
        .where(eq(videoStatus.videoCode, videoCode))
        .run();
    } else {
      db.insert(videoStatus)
        .values({ videoCode, currentStatus: "SCHEDULED", statusUpdatedAt: now })
        .run();
    }

    db.insert(statusHistory).values({
      videoCode,
      fromStatus: previousStatus,
      toStatus: "SCHEDULED",
      notes: `Scheduled for ${platform} on ${date}`,
    }).run();

    res.json({ videoCode, date, platform, status: "SCHEDULED" });
  });

  // GET /api/calendar/gaps - Detect cadence gaps
  router.get("/gaps", (req, res) => {
    const weeksParam = parseInt(req.query.weeks as string) || 4;
    const config = parseConfig(configPath);
    const cadenceConfig = config.postingCadence || {};

    // Parse targets
    const targets: Record<string, number> = {};
    for (const [platform, cadence] of Object.entries(cadenceConfig)) {
      if (cadence.toLowerCase().includes("daily")) {
        targets[platform] = 7;
      } else {
        const match = cadence.match(/(\d+)/);
        targets[platform] = match ? parseInt(match[1], 10) : 0;
      }
    }

    const allEntries = db.select().from(calendarEntries).all();
    const now = new Date();
    const gaps: Array<{ platform: string; week: string; target: number; actual: number; deficit: number }> = [];

    for (let w = 0; w < weeksParam; w++) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 + w * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekStr = weekStart.toISOString().split("T")[0];

      for (const [platform, target] of Object.entries(targets)) {
        const actual = allEntries.filter((e) => {
          const d = new Date(e.date);
          return d >= weekStart && d < weekEnd && e.platform === platform;
        }).length;

        if (actual < target) {
          gaps.push({ platform, week: weekStr, target, actual, deficit: target - actual });
        }
      }
    }

    res.json({ gaps });
  });

  return router;
}
