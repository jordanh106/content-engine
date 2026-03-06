import { Router } from "express";
import path from "path";
import { db } from "../db.js";
import { statusHistory, videoStatus, performanceMetrics, calendarEntries, savedCaptions } from "../../shared/schema.js";
import { sql, eq } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseConfig } from "../parsers/config.js";
import type { StageTransition, ActionItem } from "../../shared/types.js";
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

  // GET /api/analytics/actions - Smart prioritized action feed
  router.get("/actions", (_req, res) => {
    const actions: ActionItem[] = [];
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    // 1. Calendar entries due today/this week that are missing captions
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const upcomingEntries = db
      .select()
      .from(calendarEntries)
      .where(sql`${calendarEntries.date} >= ${today} AND ${calendarEntries.date} <= ${weekEndStr} AND ${calendarEntries.videoCode} IS NOT NULL`)
      .all();

    if (upcomingEntries.length > 0) {
      // Check which have captions
      const allCaptions = db.select().from(savedCaptions).all();
      const captionsByVideo = new Map<string, Set<string>>();
      for (const c of allCaptions) {
        const set = captionsByVideo.get(c.videoCode) || new Set();
        set.add(c.platform);
        captionsByVideo.set(c.videoCode, set);
      }

      const todayEntries = upcomingEntries.filter((e) => e.date === today);
      const todayNeedCaptions = todayEntries.filter(
        (e) => e.videoCode && !captionsByVideo.get(e.videoCode)?.has(e.platform),
      );
      const weekNeedCaptions = upcomingEntries.filter(
        (e) => e.date !== today && e.videoCode && !captionsByVideo.get(e.videoCode)?.has(e.platform),
      );

      if (todayNeedCaptions.length > 0) {
        actions.push({
          type: "captions",
          priority: 10,
          title: `${todayNeedCaptions.length} post${todayNeedCaptions.length > 1 ? "s" : ""} due today need captions`,
          detail: todayNeedCaptions
            .map((e) => `${e.videoCode} on ${e.platform}`)
            .slice(0, 3)
            .join(", "),
          actionLabel: "Open Captions",
          targetView: "CAPTIONS",
          urgency: "today",
        });
      }

      if (weekNeedCaptions.length > 0) {
        actions.push({
          type: "captions",
          priority: 7,
          title: `${weekNeedCaptions.length} upcoming post${weekNeedCaptions.length > 1 ? "s" : ""} need captions`,
          detail: weekNeedCaptions
            .map((e) => `${e.videoCode} on ${e.platform}`)
            .slice(0, 3)
            .join(", "),
          actionLabel: "Open Captions",
          targetView: "CAPTIONS",
          urgency: "this_week",
        });
      }
    }

    // 2. Platform cadence gaps this week
    const config = parseConfig(configPath);
    const cadenceConfig = config.postingCadence || {};
    const targets: Record<string, number> = {};
    for (const [platform, cadence] of Object.entries(cadenceConfig)) {
      if (cadence.toLowerCase().includes("daily")) {
        targets[platform] = 7;
      } else {
        const match = cadence.match(/(\d+)/);
        targets[platform] = match ? parseInt(match[1], 10) : 0;
      }
    }

    // Count this week's posts per platform
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const thisWeekMetrics = db
      .select()
      .from(performanceMetrics)
      .where(sql`${performanceMetrics.recordedAt} >= ${weekStartStr}`)
      .all();

    const platformCounts: Record<string, number> = {};
    for (const m of thisWeekMetrics) {
      platformCounts[m.platform] = (platformCounts[m.platform] || 0) + 1;
    }

    const behindPlatforms: string[] = [];
    for (const [platform, target] of Object.entries(targets)) {
      const actual = platformCounts[platform] || 0;
      const deficit = target - actual;
      if (deficit > 0) {
        behindPlatforms.push(`${platform} (${deficit} behind)`);
      }
    }

    if (behindPlatforms.length > 0) {
      actions.push({
        type: "cadence",
        priority: 6,
        title: `${behindPlatforms.length} platform${behindPlatforms.length > 1 ? "s" : ""} behind cadence`,
        detail: behindPlatforms.slice(0, 3).join(", "),
        actionLabel: "View Calendar",
        targetView: "CALENDAR",
        urgency: "this_week",
      });
    }

    // 3. Videos stuck in a stage for 5+ days
    const allStatuses = db.select().from(videoStatus).all();
    const stuckVideos: Array<{ code: string; stage: string; days: number }> = [];
    for (const v of allStatuses) {
      if (v.currentStatus === "PUBLISHED") continue;
      if (v.statusUpdatedAt) {
        const updatedAt = new Date(v.statusUpdatedAt);
        const daysSince = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 5) {
          stuckVideos.push({ code: v.videoCode, stage: v.currentStatus, days: daysSince });
        }
      }
    }

    if (stuckVideos.length > 0) {
      // Group by stage
      const byStage = new Map<string, number>();
      for (const v of stuckVideos) {
        byStage.set(v.stage, (byStage.get(v.stage) || 0) + 1);
      }

      const stageDetails = Array.from(byStage.entries())
        .map(([stage, count]) => `${count} in ${stage}`)
        .join(", ");

      actions.push({
        type: "stuck",
        priority: 5,
        title: `${stuckVideos.length} video${stuckVideos.length > 1 ? "s" : ""} stuck 5+ days`,
        detail: stageDetails,
        actionLabel: "View Pipeline",
        targetView: "PIPELINE",
        urgency: "this_week",
      });
    }

    // 4. Session recommendation (from pipeline data)
    const videos = parseContentLibrary(contentLibraryPath);
    const statusMap = new Map<string, string>();
    for (const s of allStatuses) {
      statusMap.set(s.videoCode, s.currentStatus);
    }

    const stageGroups: Record<string, Array<{ code: string; audience: string; audienceLabel: string }>> = {};
    for (const status of PRODUCTION_STATUSES) {
      if (status === "PUBLISHED") continue;
      stageGroups[status] = [];
    }

    for (const v of videos) {
      const status = statusMap.get(v.code) || "SCRIPTED";
      if (status !== "PUBLISHED" && stageGroups[status]) {
        stageGroups[status].push({ code: v.code, audience: v.audience, audienceLabel: v.audienceLabel });
      }
    }

    const stageActions: Record<string, string> = {
      SCRIPTED: "Record voiceovers for",
      RECORDING: "Generate motion graphics for",
      GENERATING: "Assemble final cuts for",
      ASSEMBLED: "Schedule",
      SCHEDULED: "Publish",
    };

    for (const status of PRODUCTION_STATUSES) {
      if (status === "PUBLISHED") continue;
      const group = stageGroups[status];
      if (!group || group.length === 0) continue;

      // Find largest audience batch
      const byAudience = new Map<string, typeof group>();
      for (const v of group) {
        const arr = byAudience.get(v.audience) || [];
        arr.push(v);
        byAudience.set(v.audience, arr);
      }

      let bestLabel = "";
      let bestCount = 0;
      for (const [, vids] of byAudience) {
        if (vids.length > bestCount) {
          bestCount = vids.length;
          bestLabel = vids[0].audienceLabel;
        }
      }

      actions.push({
        type: "session",
        priority: 3,
        title: `${stageActions[status]} ${bestLabel}`,
        detail: `${bestCount} of ${group.length} videos in ${status.toLowerCase()} stage`,
        actionLabel: "Start Session",
        targetView: "SESSION",
        urgency: "recommendation",
      });
      break; // Only show the top session recommendation
    }

    // Sort by priority descending
    actions.sort((a, b) => b.priority - a.priority);

    res.json({ actions });
  });

  return router;
}
