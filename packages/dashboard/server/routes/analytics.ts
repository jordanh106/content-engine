import { Router } from "express";
import path from "path";
import { db } from "../db.js";
import { statusHistory, videoStatus, performanceMetrics, calendarEntries, savedCaptions, notifications } from "../../shared/schema.js";
import { sql, eq, desc } from "drizzle-orm";
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

  // GET /api/analytics/health-score - Content cadence health score
  router.get("/health-score", (_req, res) => {
    try {
      const config = parseConfig(configPath);
      const videos = parseContentLibrary(contentLibraryPath);
      const statuses = db.select().from(videoStatus).all();
      const statusMap = new Map(statuses.map((s) => [s.videoCode, s.currentStatus]));
      const calendar = db.select().from(calendarEntries).all();
      const metrics = db.select().from(performanceMetrics).all();

      // 1. Publishing consistency (0-25)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentPublishes = calendar.filter((e) => new Date(e.date) >= thirtyDaysAgo && new Date(e.date) <= now);
      const publishedCount = recentPublishes.length;
      const targetMonthly = 20; // ~5/week across platforms
      const consistencyScore = Math.min(25, Math.round((publishedCount / targetMonthly) * 25));

      // 2. Format diversity (0-25)
      const publishedVideos = videos.filter((v) => statusMap.get(v.code) === "PUBLISHED");
      const formatSet = new Set(publishedVideos.map((v) => v.format));
      const totalFormats = 7; // A-G
      const diversityScore = Math.min(25, Math.round((formatSet.size / totalFormats) * 25));

      // 3. Audience coverage (0-25)
      const audienceSet = new Set(publishedVideos.map((v) => v.audience));
      const totalAudiences = config.audiences?.length || 7;
      const coverageScore = Math.min(25, Math.round((audienceSet.size / totalAudiences) * 25));

      // 4. Pipeline health (0-25) - videos in progress
      const inProgress = statuses.filter((s) =>
        s.currentStatus !== "PUBLISHED" && s.currentStatus !== "SCRIPTED",
      );
      const pipelineScore = Math.min(25, inProgress.length >= 5 ? 25 : Math.round((inProgress.length / 5) * 25));

      const totalScore = consistencyScore + diversityScore + coverageScore + pipelineScore;

      res.json({
        score: totalScore,
        dimensions: {
          consistency: { score: consistencyScore, max: 25, detail: `${publishedCount} publishes in last 30 days` },
          diversity: { score: diversityScore, max: 25, detail: `${formatSet.size}/${totalFormats} formats used` },
          coverage: { score: coverageScore, max: 25, detail: `${audienceSet.size}/${totalAudiences} audiences reached` },
          pipeline: { score: pipelineScore, max: 25, detail: `${inProgress.length} videos in production` },
        },
      });
    } catch (error) {
      console.error("[analytics] Health score error:", error);
      res.status(500).json({ error: "Failed to calculate health score" });
    }
  });

  // GET /api/analytics/best-times - Optimal posting times from historical data
  router.get("/best-times", (_req, res) => {
    try {
      const calendar = db.select().from(calendarEntries).all();
      const metrics = db.select().from(performanceMetrics).all();
      const metricsMap = new Map<string, typeof metrics[0]>();

      // Group metrics by videoCode+platform, keep best
      for (const m of metrics) {
        const key = `${m.videoCode}:${m.platform}`;
        const existing = metricsMap.get(key);
        if (!existing || (m.views ?? 0) > (existing.views ?? 0)) {
          metricsMap.set(key, m);
        }
      }

      // Aggregate views by day of week and platform
      const dayStats = new Map<string, { totalViews: number; count: number }>();

      for (const entry of calendar) {
        const date = new Date(entry.date);
        const dayOfWeek = date.getDay(); // 0=Sun
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = dayNames[dayOfWeek];
        const key = `${dayName}:${entry.platform}`;

        const metric = metricsMap.get(`${entry.videoCode}:${entry.platform}`);
        if (metric) {
          if (!dayStats.has(key)) dayStats.set(key, { totalViews: 0, count: 0 });
          const stat = dayStats.get(key)!;
          stat.totalViews += metric.views ?? 0;
          stat.count++;
        }
      }

      const bestTimes = Array.from(dayStats.entries())
        .map(([key, stat]) => {
          const [day, platform] = key.split(":");
          return {
            day,
            platform,
            avgViews: stat.count > 0 ? Math.round(stat.totalViews / stat.count) : 0,
            sampleSize: stat.count,
          };
        })
        .filter((t) => t.sampleSize >= 1)
        .sort((a, b) => b.avgViews - a.avgViews);

      res.json({
        bestTimes,
        hasEnoughData: bestTimes.some((t) => t.sampleSize >= 3),
      });
    } catch (error) {
      console.error("[analytics] Best times error:", error);
      res.status(500).json({ error: "Failed to calculate best times" });
    }
  });

  // GET /api/analytics/content-gaps - Audience x Format matrix showing gaps
  router.get("/content-gaps", (_req, res) => {
    try {
      const config = parseConfig(configPath);
      const videos = parseContentLibrary(contentLibraryPath);
      const statuses = db.select().from(videoStatus).all();
      const statusMap = new Map(statuses.map((s) => [s.videoCode, s.currentStatus]));

      const audiences = (config.audiences || []).map((a) => ({ id: a.id, label: a.label }));
      const formats: Array<{ id: string; name: string }> = [
        { id: "A", name: "Explainer" },
        { id: "B", name: "Checklist" },
        { id: "C", name: "Demo" },
        { id: "D", name: "Myth Buster" },
        { id: "E", name: "Walkthrough" },
        { id: "F", name: "Quick Tip" },
        { id: "G", name: "Patient Story" },
      ];

      // Build matrix: audience x format = count of videos
      const matrix: Record<string, Record<string, { total: number; published: number }>> = {};
      for (const aud of audiences) {
        matrix[aud.id] = {};
        for (const fmt of formats) {
          matrix[aud.id][fmt.id] = { total: 0, published: 0 };
        }
      }

      for (const v of videos) {
        if (matrix[v.audience] && matrix[v.audience][v.format]) {
          matrix[v.audience][v.format].total++;
          const status = statusMap.get(v.code) || "SCRIPTED";
          if (status === "PUBLISHED") {
            matrix[v.audience][v.format].published++;
          }
        }
      }

      // Find gaps (cells with 0 videos)
      const gaps: Array<{ audience: string; audienceLabel: string; format: string; formatName: string }> = [];
      for (const aud of audiences) {
        for (const fmt of formats) {
          if (matrix[aud.id][fmt.id].total === 0) {
            gaps.push({
              audience: aud.id,
              audienceLabel: aud.label,
              format: fmt.id,
              formatName: fmt.name,
            });
          }
        }
      }

      res.json({ audiences, formats, matrix, gaps, totalGaps: gaps.length });
    } catch (error) {
      console.error("[analytics] Content gaps error:", error);
      res.status(500).json({ error: "Failed to calculate content gaps" });
    }
  });

  // =======================================
  // Notifications
  // =======================================

  // GET /api/analytics/notifications - List notifications
  router.get("/notifications", (req, res) => {
    const unreadOnly = req.query.unread === "true";
    let rows = db.select().from(notifications).orderBy(desc(notifications.createdAt)).all();
    if (unreadOnly) rows = rows.filter((n) => !n.read);
    res.json({ notifications: rows.slice(0, 50), unreadCount: rows.filter((n) => !n.read).length });
  });

  // PUT /api/analytics/notifications/:id/read - Mark notification as read
  router.put("/notifications/:id/read", (req, res) => {
    const id = parseInt(req.params.id);
    db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).run();
    res.json({ success: true });
  });

  // PUT /api/analytics/notifications/read-all - Mark all as read
  router.put("/notifications/read-all", (_req, res) => {
    db.update(notifications).set({ read: true }).run();
    res.json({ success: true });
  });

  // POST /api/analytics/notifications - Create a notification (internal use)
  router.post("/notifications", (req, res) => {
    const { type, title, detail, targetView, targetId } = req.body;
    if (!type || !title) { res.status(400).json({ error: "type and title required" }); return; }
    db.insert(notifications).values({
      type, title, detail: detail || null,
      targetView: targetView || null,
      targetId: targetId || null,
    }).run();
    res.json({ success: true });
  });

  // =======================================
  // Cross-Platform Publishing Tracker
  // =======================================

  // GET /api/analytics/cross-platform/:code - Publishing progress for a video
  router.get("/cross-platform/:code", (req, res) => {
    const { code } = req.params;
    const config = parseConfig(configPath);
    const platforms = config.platforms || ["Instagram Reels", "TikTok", "YouTube Shorts", "YouTube Long"];

    const entries = db.select().from(calendarEntries).all().filter((e) => e.videoCode === code);
    const metrics = db.select().from(performanceMetrics).all().filter((m) => m.videoCode === code);

    const platformStatus = platforms.map((platform) => {
      const calEntry = entries.find((e) => e.platform === platform);
      const metric = metrics.find((m) => m.platform === platform);
      return {
        platform,
        scheduled: !!calEntry,
        scheduledDate: calEntry?.date || null,
        hasMetrics: !!metric,
        views: metric?.views ?? 0,
      };
    });

    const publishedCount = platformStatus.filter((p) => p.hasMetrics).length;

    res.json({
      videoCode: code,
      platforms: platformStatus,
      publishedCount,
      totalPlatforms: platforms.length,
      allPublished: publishedCount === platforms.length,
    });
  });

  // GET /api/analytics/last-publish - Days since last published content
  router.get("/last-publish", (_req, res) => {
    // Check most recent PUBLISHED status change
    const lastPublished = db
      .select({ changedAt: statusHistory.changedAt })
      .from(statusHistory)
      .where(sql`${statusHistory.toStatus} = 'PUBLISHED'`)
      .orderBy(desc(statusHistory.changedAt))
      .limit(1)
      .all();

    if (lastPublished.length === 0 || !lastPublished[0].changedAt) {
      // Also check videoStatus table for any PUBLISHED entries
      const publishedVideos = db
        .select({ updatedAt: videoStatus.statusUpdatedAt })
        .from(videoStatus)
        .where(sql`${videoStatus.currentStatus} = 'PUBLISHED'`)
        .orderBy(desc(videoStatus.statusUpdatedAt))
        .limit(1)
        .all();

      if (publishedVideos.length === 0 || !publishedVideos[0].updatedAt) {
        return res.json({ daysSinceLastPublish: null, lastPublishDate: null });
      }

      const lastDate = new Date(publishedVideos[0].updatedAt);
      const days = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      return res.json({ daysSinceLastPublish: days, lastPublishDate: publishedVideos[0].updatedAt });
    }

    const lastDate = new Date(lastPublished[0].changedAt);
    const days = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    res.json({ daysSinceLastPublish: days, lastPublishDate: lastPublished[0].changedAt });
  });

  // GET /api/analytics/production-timeline - Videos with projected completion dates
  router.get("/production-timeline", (_req, res) => {
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const statuses = db.select().from(videoStatus).all();
      const statusMap = new Map(statuses.map((s) => [s.videoCode, s]));
      const history = db.select().from(statusHistory).orderBy(statusHistory.changedAt).all();

      // Calculate average days per stage from history
      const stageDurations: Record<string, number[]> = {};
      const byVideo = new Map<string, typeof history>();
      for (const h of history) {
        const list = byVideo.get(h.videoCode) || [];
        list.push(h);
        byVideo.set(h.videoCode, list);
      }

      for (const [, transitions] of byVideo) {
        for (let i = 1; i < transitions.length; i++) {
          const prev = transitions[i - 1];
          const curr = transitions[i];
          if (prev.changedAt && curr.changedAt) {
            const days = (new Date(curr.changedAt).getTime() - new Date(prev.changedAt).getTime()) / (1000 * 60 * 60 * 24);
            const stage = prev.toStatus;
            if (!stageDurations[stage]) stageDurations[stage] = [];
            stageDurations[stage].push(days);
          }
        }
      }

      const avgDays: Record<string, number> = {};
      for (const [stage, days] of Object.entries(stageDurations)) {
        avgDays[stage] = days.length > 0 ? Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10 : 3;
      }

      // Default avg if no data
      const defaultAvg: Record<string, number> = { SCRIPTED: 3, RECORDING: 2, GENERATING: 2, ASSEMBLED: 1, SCHEDULED: 3 };

      const STAGE_ORDER = ["SCRIPTED", "RECORDING", "GENERATING", "ASSEMBLED", "SCHEDULED", "PUBLISHED"];

      const timeline = videos.slice(0, 30).map((v) => {
        const statusRecord = statusMap.get(v.code);
        const currentStatus = statusRecord?.currentStatus || "SCRIPTED";
        const currentIdx = STAGE_ORDER.indexOf(currentStatus);
        const startDate = statusRecord?.statusUpdatedAt || statusRecord?.createdAt || new Date().toISOString();

        // Project remaining stages
        let projectedDays = 0;
        for (let i = currentIdx; i < STAGE_ORDER.length - 1; i++) {
          projectedDays += avgDays[STAGE_ORDER[i]] || defaultAvg[STAGE_ORDER[i]] || 3;
        }

        const projectedComplete = new Date(new Date(startDate).getTime() + projectedDays * 24 * 60 * 60 * 1000);

        return {
          code: v.code,
          title: v.title,
          format: v.format,
          audienceLabel: v.audienceLabel,
          currentStatus,
          stageIndex: currentIdx,
          totalStages: STAGE_ORDER.length,
          startDate: startDate.split("T")[0],
          projectedComplete: projectedComplete.toISOString().split("T")[0],
          projectedDaysRemaining: Math.round(projectedDays),
        };
      }).filter((v) => v.currentStatus !== "PUBLISHED");

      timeline.sort((a, b) => a.projectedDaysRemaining - b.projectedDaysRemaining);

      res.json({ timeline, avgDaysPerStage: { ...defaultAvg, ...avgDays } });
    } catch (error) {
      console.error("[analytics] Production timeline error:", error);
      res.status(500).json({ error: "Failed to build production timeline" });
    }
  });

  // =======================================
  // Audience Segment Analytics (2.5)
  // =======================================

  // GET /api/analytics/by-audience - Metrics aggregated by audience segment
  router.get("/by-audience", (_req, res) => {
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const videoAudienceMap = new Map(videos.map((v) => [v.code, { audience: v.audience, audienceLabel: v.audienceLabel }]));
      const metrics = db.select().from(performanceMetrics).all();

      const byAudience: Record<string, {
        label: string;
        views: number;
        likes: number;
        saves: number;
        shares: number;
        comments: number;
        videoCount: number;
        codes: Set<string>;
      }> = {};

      for (const m of metrics) {
        const info = videoAudienceMap.get(m.videoCode);
        if (!info) continue;
        if (!byAudience[info.audience]) {
          byAudience[info.audience] = { label: info.audienceLabel, views: 0, likes: 0, saves: 0, shares: 0, comments: 0, videoCount: 0, codes: new Set() };
        }
        const seg = byAudience[info.audience];
        seg.views += m.views ?? 0;
        seg.likes += m.likes ?? 0;
        seg.saves += m.saves ?? 0;
        seg.shares += m.shares ?? 0;
        seg.comments += m.comments ?? 0;
        seg.codes.add(m.videoCode);
      }

      const result = Object.entries(byAudience).map(([audience, data]) => ({
        audience,
        label: data.label,
        views: data.views,
        likes: data.likes,
        saves: data.saves,
        shares: data.shares,
        comments: data.comments,
        videoCount: data.codes.size,
        avgViews: data.codes.size > 0 ? Math.round(data.views / data.codes.size) : 0,
        engagementRate: data.views > 0
          ? Math.round(((data.likes + data.saves + data.shares + data.comments) / data.views) * 10000) / 100
          : 0,
        saveRate: data.views > 0 ? Math.round((data.saves / data.views) * 10000) / 100 : 0,
      }));

      result.sort((a, b) => b.avgViews - a.avgViews);
      res.json({ byAudience: result });
    } catch (error) {
      console.error("[analytics] By-audience error:", error);
      res.status(500).json({ error: "Failed to calculate audience analytics" });
    }
  });

  // =======================================
  // Content Decay Detection (2.6)
  // =======================================

  // GET /api/analytics/content-decay - Identify evergreen vs spike-and-die content
  router.get("/content-decay", (_req, res) => {
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      const videoMap = new Map(videos.map((v) => [v.code, v]));
      const metrics = db.select().from(performanceMetrics).orderBy(performanceMetrics.recordedAt).all();

      // Group metrics by videoCode, ordered by date
      const byVideo = new Map<string, Array<{ date: string; views: number }>>();
      for (const m of metrics) {
        const list = byVideo.get(m.videoCode) || [];
        list.push({ date: m.recordedAt, views: m.views ?? 0 });
        byVideo.set(m.videoCode, list);
      }

      const results: Array<{
        code: string;
        title: string;
        format: string;
        audienceLabel: string;
        totalViews: number;
        dataPoints: number;
        trend: "evergreen" | "spike" | "growing" | "stable" | "insufficient";
        decayRate: number;
        recommendation: string;
      }> = [];

      for (const [code, entries] of byVideo) {
        const video = videoMap.get(code);
        if (!video || entries.length < 2) {
          if (video) {
            results.push({
              code, title: video.title, format: video.format, audienceLabel: video.audienceLabel,
              totalViews: entries.reduce((s, e) => s + e.views, 0), dataPoints: entries.length,
              trend: "insufficient", decayRate: 0, recommendation: "Need more data points",
            });
          }
          continue;
        }

        const totalViews = entries.reduce((s, e) => s + e.views, 0);
        const firstHalf = entries.slice(0, Math.ceil(entries.length / 2));
        const secondHalf = entries.slice(Math.ceil(entries.length / 2));

        const firstAvg = firstHalf.reduce((s, e) => s + e.views, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((s, e) => s + e.views, 0) / secondHalf.length;

        let trend: "evergreen" | "spike" | "growing" | "stable" | "insufficient";
        let decayRate = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;
        let recommendation: string;

        if (decayRate > 20) {
          trend = "growing";
          recommendation = "Growing content. Consider cross-posting to more platforms.";
        } else if (decayRate >= -20) {
          trend = secondAvg > 50 ? "evergreen" : "stable";
          recommendation = trend === "evergreen"
            ? "Evergreen content. Repost on different platforms."
            : "Stable but low views. Consider refreshing with new hook.";
        } else if (decayRate >= -60) {
          trend = "spike";
          recommendation = "Normal decay. Repurpose key points into new content.";
        } else {
          trend = "spike";
          recommendation = "Spike and die. Extract what worked for the hook.";
        }

        results.push({
          code, title: video.title, format: video.format, audienceLabel: video.audienceLabel,
          totalViews, dataPoints: entries.length, trend, decayRate, recommendation,
        });
      }

      results.sort((a, b) => b.totalViews - a.totalViews);

      const summary = {
        evergreen: results.filter((r) => r.trend === "evergreen").length,
        growing: results.filter((r) => r.trend === "growing").length,
        spike: results.filter((r) => r.trend === "spike").length,
        stable: results.filter((r) => r.trend === "stable").length,
        insufficient: results.filter((r) => r.trend === "insufficient").length,
      };

      res.json({ videos: results, summary });
    } catch (error) {
      console.error("[analytics] Content decay error:", error);
      res.status(500).json({ error: "Failed to analyze content decay" });
    }
  });

  // =======================================
  // Backup & Restore (9.2)
  // =======================================

  // GET /api/analytics/backup - Export all data as JSON
  router.get("/backup", (_req, res) => {
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        videoStatus: db.select().from(videoStatus).all(),
        statusHistory: db.select().from(statusHistory).all(),
        calendarEntries: db.select().from(calendarEntries).all(),
        performanceMetrics: db.select().from(performanceMetrics).all(),
        savedCaptions: db.select().from(savedCaptions).all(),
        notifications: db.select().from(notifications).all(),
      };

      res.setHeader("Content-Disposition", `attachment; filename=content-engine-backup-${new Date().toISOString().split("T")[0]}.json`);
      res.json(data);
    } catch (error) {
      console.error("[analytics] Backup error:", error);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  return router;
}
