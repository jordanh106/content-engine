import { Router } from "express";
import path from "path";
import { db } from "../db.js";
import { statusHistory, videoStatus, performanceMetrics } from "../../shared/schema.js";
import { sql, eq } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseConfig } from "../parsers/config.js";
import type { StageTransition } from "../../shared/types.js";
import { PRODUCTION_STATUSES } from "../../shared/types.js";

export function createAnalyticsRouter(contentLibraryPath: string) {
  const router = Router();
  const configPath = path.join(path.dirname(contentLibraryPath), "config.json");

  // GET /api/analytics/velocity - Production velocity metrics from status_history
  router.get("/velocity", (_req, res) => {
    const rows = db
      .select()
      .from(statusHistory)
      .orderBy(statusHistory.videoCode, statusHistory.changedAt)
      .all();

    // Group by videoCode, compute days between consecutive transitions
    const byVideo = new Map<string, Array<{ from: string; to: string; at: string }>>();
    for (const row of rows) {
      const list = byVideo.get(row.videoCode) || [];
      list.push({
        from: row.fromStatus || "SCRIPTED",
        to: row.toStatus,
        at: row.changedAt || new Date().toISOString(),
      });
      byVideo.set(row.videoCode, list);
    }

    // Aggregate by transition pair
    const transitionDays = new Map<string, number[]>();
    let totalDaysAccum: number[] = [];

    for (const [, transitions] of byVideo) {
      let firstAt: string | null = null;
      let lastAt: string | null = null;

      for (let i = 0; i < transitions.length; i++) {
        const t = transitions[i];
        if (i === 0) firstAt = t.at;
        lastAt = t.at;

        if (i > 0) {
          const prevAt = new Date(transitions[i - 1].at).getTime();
          const currAt = new Date(t.at).getTime();
          const days = Math.max(0, (currAt - prevAt) / (1000 * 60 * 60 * 24));
          const key = `${transitions[i - 1].to}→${t.to}`;
          const arr = transitionDays.get(key) || [];
          arr.push(days);
          transitionDays.set(key, arr);
        }
      }

      // Total time from first to last transition
      if (firstAt && lastAt && transitions.length > 1) {
        const totalDays = (new Date(lastAt).getTime() - new Date(firstAt).getTime()) / (1000 * 60 * 60 * 24);
        totalDaysAccum.push(totalDays);
      }
    }

    // Build transition summaries
    const transitions: StageTransition[] = [];
    let bottleneck: { stage: string; avgDays: number } | null = null;

    for (const [key, days] of transitionDays) {
      const [fromStatus, toStatus] = key.split("→");
      const sorted = [...days].sort((a, b) => a - b);
      const avgDays = Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10;
      const medianDays = Math.round(sorted[Math.floor(sorted.length / 2)] * 10) / 10;

      transitions.push({ fromStatus, toStatus, avgDays, medianDays, count: days.length });

      if (!bottleneck || avgDays > bottleneck.avgDays) {
        bottleneck = { stage: `${fromStatus}→${toStatus}`, avgDays };
      }
    }

    // Sort by production order
    const statusOrder = PRODUCTION_STATUSES as readonly string[];
    transitions.sort((a, b) => {
      const aIdx = statusOrder.indexOf(a.fromStatus);
      const bIdx = statusOrder.indexOf(b.fromStatus);
      return aIdx - bIdx;
    });

    // Count completed (reached PUBLISHED)
    let completedVideos = 0;
    for (const [, t] of byVideo) {
      if (t.some((tr) => tr.to === "PUBLISHED")) completedVideos++;
    }

    const avgDaysTotal =
      totalDaysAccum.length > 0
        ? Math.round((totalDaysAccum.reduce((s, d) => s + d, 0) / totalDaysAccum.length) * 10) / 10
        : 0;

    res.json({ transitions, bottleneck, avgDaysTotal, completedVideos });
  });

  // GET /api/analytics/content-mix - Content mix compliance vs config targets
  router.get("/content-mix", (_req, res) => {
    const config = parseConfig(configPath);
    const videos = parseContentLibrary(contentLibraryPath);
    const targets = config.contentMix || {};

    // Get published videos
    const published = db
      .select()
      .from(videoStatus)
      .where(eq(videoStatus.currentStatus, "PUBLISHED"))
      .all();

    const publishedCodes = new Set(published.map((p) => p.videoCode));
    const publishedVideos = videos.filter((v) => publishedCodes.has(v.code));

    // Classify: C/E/G = filmed (demo, walkthrough, patient story), A/B/D/F = ai_generated
    const FILMED_FORMATS = new Set(["C", "E", "G"]);
    let filmed = 0;
    let aiGenerated = 0;
    for (const v of publishedVideos) {
      if (FILMED_FORMATS.has(v.format)) filmed++;
      else aiGenerated++;
    }

    const total = publishedVideos.length;
    const actual: Record<string, number> = {
      filmed: total > 0 ? Math.round((filmed / total) * 100) / 100 : 0,
      ai_generated: total > 0 ? Math.round((aiGenerated / total) * 100) / 100 : 0,
    };

    const deviations: Array<{ type: string; target: number; actual: number; delta: number }> = [];
    for (const [type, target] of Object.entries(targets)) {
      const act = actual[type] ?? 0;
      const delta = Math.round((act - target) * 100) / 100;
      if (Math.abs(delta) > 0.1) {
        deviations.push({ type, target, actual: act, delta });
      }
    }

    res.json({
      targets,
      actual,
      totalPublished: total,
      compliant: deviations.length === 0,
      deviations,
    });
  });

  // GET /api/analytics/cadence - Platform posting cadence vs targets
  router.get("/cadence", (req, res) => {
    const weeksParam = parseInt(req.query.weeks as string) || 4;
    const config = parseConfig(configPath);
    const cadenceConfig = config.postingCadence || {};

    // Parse cadence targets
    const targets: Record<string, number> = {};
    for (const [platform, cadence] of Object.entries(cadenceConfig)) {
      if (cadence.toLowerCase().includes("daily")) {
        targets[platform] = 7;
      } else {
        const match = cadence.match(/(\d+)/);
        targets[platform] = match ? parseInt(match[1], 10) : 0;
      }
    }

    // Get metrics grouped by platform and week
    const allMetrics = db.select().from(performanceMetrics).all();

    // Build week buckets
    const now = new Date();
    const weeks: Array<{
      weekLabel: string;
      weekStart: string;
      platforms: Array<{ platform: string; target: number; actual: number; onTrack: boolean }>;
    }> = [];

    for (let w = weeksParam - 1; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - w * 7); // Monday
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(weekEnd.getTime() - 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      const platformCounts: Record<string, number> = {};
      for (const m of allMetrics) {
        const recordDate = new Date(m.recordedAt);
        if (recordDate >= weekStart && recordDate < weekEnd) {
          platformCounts[m.platform] = (platformCounts[m.platform] || 0) + 1;
        }
      }

      const platforms = Object.keys(targets).map((platform) => ({
        platform,
        target: targets[platform],
        actual: platformCounts[platform] || 0,
        onTrack: (platformCounts[platform] || 0) >= targets[platform],
      }));

      weeks.push({
        weekLabel,
        weekStart: weekStart.toISOString().split("T")[0],
        platforms,
      });
    }

    // Overall averages
    const overall = Object.keys(targets).map((platform) => {
      const totalActual = weeks.reduce((sum, w) => {
        const p = w.platforms.find((pp) => pp.platform === platform);
        return sum + (p?.actual || 0);
      }, 0);
      const avgPerWeek = Math.round((totalActual / weeksParam) * 10) / 10;
      return {
        platform,
        avgPerWeek,
        target: targets[platform],
        onTrack: avgPerWeek >= targets[platform],
      };
    });

    res.json({ weeks, overall });
  });

  return router;
}
