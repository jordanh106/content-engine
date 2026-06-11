import fs from "fs";
import { Router } from "express";
import path from "path";
import { spawn } from "child_process";
import Anthropic from "@anthropic-ai/sdk";
import { db, sqlite } from "../db.js";
import { performanceMetrics, socialAttributions } from "../../shared/schema.js";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseViralInsights, listDigestDates } from "../parsers/viral-insights.js";
import { parseResearchReport, getReportPath, invalidateResearchCache } from "../parsers/last30days.js";
import { parseHookPatterns } from "../parsers/hook-patterns.js";
import type { MetricsSyncEntry, PlatformResearchItem } from "../../shared/types.js";

// Track running research process
let researchProcess: ReturnType<typeof spawn> | null = null;
// Track platform research phase
let platformSearchRunning = false;

async function runPlatformResearch(topic: string): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[research] Skipping platform search: no ANTHROPIC_API_KEY");
    return;
  }

  platformSearchRunning = true;
  console.log(`[research] Starting platform-specific web searches for: ${topic}`);

  try {
    const client = new Anthropic({ apiKey });
    const platforms = [
      { name: "instagram", query: `${topic} trending Instagram Reels content creators 2026` },
      { name: "tiktok", query: `${topic} trending TikTok viral content 2026` },
      { name: "facebook", query: `${topic} Facebook groups discussions community 2026` },
    ];

    const results: Record<string, PlatformResearchItem[]> = {
      instagram: [],
      tiktok: [],
      facebook: [],
    };

    // Run all platform searches in parallel
    await Promise.all(platforms.map(async (platform) => {
      try {
        const response = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          tools: [{
            type: "web_search_20250305" as const,
            name: "web_search" as const,
            max_uses: 3,
          }],
          messages: [{
            role: "user",
            content: `Search for recent ${platform.name === "instagram" ? "Instagram Reels" : platform.name === "tiktok" ? "TikTok" : "Facebook group"} content and trends about "${topic}".

Search query: ${platform.query}

Return a JSON array of 3-8 relevant findings. Each item should have:
- "title": What the content/trend is about
- "url": Source URL (the article/post where you found this)
- "source": Domain name of the source
- "snippet": 1-2 sentence summary of what's trending and why it matters
- "relevance": 0-100 how relevant to "${topic}"
- "score": 0-100 overall quality/usefulness

Focus on: trending formats, popular creators covering this topic, engagement patterns, hashtags, sounds/audio trends (TikTok), content strategies that are working.

Return ONLY valid JSON array, no other text.`,
          }],
        }, { timeout: 60_000 });

        const textBlock = response.content.find((b) => b.type === "text");
        if (textBlock && textBlock.type === "text") {
          let cleaned = textBlock.text.trim();
          if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
          }
          try {
            const parsed = JSON.parse(cleaned);
            const items = Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.items ?? []);
            results[platform.name] = items.map((item: Record<string, unknown>) => ({
              title: String(item.title || ""),
              url: String(item.url || ""),
              source: String(item.source || ""),
              snippet: String(item.snippet || ""),
              relevance: Number(item.relevance) || 0,
              score: Number(item.score) || 0,
            }));
          } catch {
            console.warn(`[research] Failed to parse ${platform.name} results`);
          }
        }
        console.log(`[research] ${platform.name}: found ${results[platform.name].length} results`);
      } catch (err) {
        console.warn(`[research] ${platform.name} search failed:`, err instanceof Error ? err.message : err);
      }
    }));

    // Merge results into existing report.json
    const reportPath = getReportPath();
    if (fs.existsSync(reportPath)) {
      const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
      report.instagram = results.instagram;
      report.tiktok = results.tiktok;
      report.facebook = results.facebook;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      invalidateResearchCache();
      console.log(`[research] Platform data merged into report.json (IG: ${results.instagram.length}, TT: ${results.tiktok.length}, FB: ${results.facebook.length})`);
    }
  } finally {
    platformSearchRunning = false;
  }
}

export function createMetricsRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const viralInsightsDir = path.join(industryDir, "viral-insights");
  const hookPatternsPath = path.join(industryDir, "hook-patterns.md");
  const repoRoot = path.resolve(industryDir, "..", "..");
  const last30daysScript = path.join(repoRoot, "skills", "last30days", "scripts", "last30days.py");

  // GET /api/metrics/today — live signals for the Home Now strip.
  // Returns: { publishedToday, inFlight (Higgsfield running jobs), sessionInProgress }
  router.get("/today", async (_req, res) => {
    try {
      // Use SQLite directly for the date filter — Drizzle's date functions are awkward for "today in local TZ"
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const publishedRow = sqlite
        .prepare("SELECT COUNT(*) AS c FROM video_status WHERE published_at >= ?")
        .get(todayIso) as { c: number } | undefined;

      // Active production session
      const sessionRow = sqlite
        .prepare("SELECT id, session_type, audience_category FROM production_sessions WHERE started_at IS NOT NULL AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1")
        .get() as { id: number; session_type: string; audience_category: string | null } | undefined;

      res.json({
        publishedToday: publishedRow?.c ?? 0,
        sessionInProgress: !!sessionRow,
        session: sessionRow ? { id: sessionRow.id, type: sessionRow.session_type, audience: sessionRow.audience_category } : null,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/metrics - List all metrics, optionally filtered by video code or platform
  router.get("/", (_req, res) => {
    const { videoCode, platform } = _req.query;

    let query = db.select().from(performanceMetrics).orderBy(desc(performanceMetrics.recordedAt));

    const results = query.all();

    const filtered = results.filter((row) => {
      if (videoCode && row.videoCode !== videoCode) return false;
      if (platform && row.platform !== platform) return false;
      return true;
    });

    res.json({ metrics: filtered });
  });

  // GET /api/metrics/top-decile?days=30 — Top-decile performers in the window,
  // joined with content-library video info. Used by the Weekly Studio chain to
  // ground idea generation in actual outcome data, and by the IdeaRanker's
  // historicalFit scorer.
  router.get("/top-decile", (req, res) => {
    const days = req.query.days ? Math.max(1, Math.min(365, Number(req.query.days))) : 30;
    try {
      const rows = sqlite.prepare(
        `SELECT video_code,
                SUM(saves) AS saves,
                SUM(shares) AS shares,
                SUM(likes) AS likes,
                SUM(views) AS views,
                SUM(comments) AS comments,
                MAX(hook_pattern_used) AS hook_pattern,
                MAX(format_id) AS format_id
         FROM performance_metrics
         WHERE recorded_at >= date('now', '-' || ? || ' days')
         GROUP BY video_code
         ORDER BY (COALESCE(SUM(saves),0) + COALESCE(SUM(shares),0) * 2 + COALESCE(SUM(likes),0) * 0.2) DESC`,
      ).all(days) as Array<{
        video_code: string; saves: number; shares: number; likes: number; views: number; comments: number;
        hook_pattern: string | null; format_id: string | null;
      }>;

      const cutoffIdx = Math.max(1, Math.ceil(rows.length * 0.1));
      const topDecile = rows.slice(0, cutoffIdx);

      // Annotate with audience derived from code prefix (P/B/K/A/D/S/G → audiences)
      const PREFIX_TO_AUDIENCE: Record<string, string> = {
        P: "prenatal", B: "infant", K: "kids", A: "athlete",
        D: "adult", S: "senior", G: "general",
      };
      const enriched = topDecile.map((r) => ({
        videoCode: r.video_code,
        audience: PREFIX_TO_AUDIENCE[r.video_code.charAt(0).toUpperCase()] ?? "unknown",
        format: r.format_id,
        hookPattern: r.hook_pattern,
        saves: r.saves ?? 0,
        shares: r.shares ?? 0,
        likes: r.likes ?? 0,
        views: r.views ?? 0,
        comments: r.comments ?? 0,
        compositeScore: (r.saves ?? 0) + (r.shares ?? 0) * 2 + (r.likes ?? 0) * 0.2,
      }));

      res.json({ days, sampleSize: rows.length, topDecile: enriched });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "top-decile query failed" });
    }
  });

  // GET /api/metrics/top-performers - Aggregate top performers by total engagement
  router.get("/top-performers", (_req, res) => {
    // Fetch all videos with views to compute median
    const allViewRows = db
      .select({
        videoCode: performanceMetrics.videoCode,
        totalViews: sql<number>`SUM(${performanceMetrics.views})`,
      })
      .from(performanceMetrics)
      .groupBy(performanceMetrics.videoCode)
      .all();

    // Compute median total views across all tracked videos
    const allViews = allViewRows.map((r) => r.totalViews ?? 0).sort((a, b) => a - b);
    let medianViews = 0;
    if (allViews.length > 0) {
      const mid = Math.floor(allViews.length / 2);
      medianViews = allViews.length % 2 === 0
        ? (allViews[mid - 1] + allViews[mid]) / 2
        : allViews[mid];
    }

    const rows = db
      .select({
        videoCode: performanceMetrics.videoCode,
        totalViews: sql<number>`SUM(${performanceMetrics.views})`,
        totalLikes: sql<number>`SUM(${performanceMetrics.likes})`,
        totalSaves: sql<number>`SUM(${performanceMetrics.saves})`,
        totalShares: sql<number>`SUM(${performanceMetrics.shares})`,
        totalComments: sql<number>`SUM(${performanceMetrics.comments})`,
        entryCount: sql<number>`COUNT(*)`,
      })
      .from(performanceMetrics)
      .groupBy(performanceMetrics.videoCode)
      .orderBy(sql`SUM(${performanceMetrics.views}) DESC`)
      .limit(20)
      .all();

    // Enrich with video metadata
    const videos = parseContentLibrary(contentLibraryPath);
    const enriched = rows.map((row) => {
      const video = videos.find((v) => v.code === row.videoCode);
      const totalEngagement =
        (row.totalLikes ?? 0) +
        (row.totalSaves ?? 0) +
        (row.totalShares ?? 0) +
        (row.totalComments ?? 0);
      const engagementRate =
        row.totalViews && row.totalViews > 0
          ? totalEngagement / row.totalViews
          : 0;
      const saveRate =
        row.totalViews && row.totalViews > 0
          ? (row.totalSaves ?? 0) / row.totalViews
          : 0;
      const outlierScore =
        medianViews > 0 && row.totalViews
          ? Math.round((row.totalViews / medianViews) * 10) / 10
          : null;

      return {
        ...row,
        title: video?.title ?? row.videoCode,
        format: video?.format ?? null,
        audience: video?.audience ?? null,
        totalEngagement,
        engagementRate: Math.round(engagementRate * 10000) / 100,
        saveRate: Math.round(saveRate * 10000) / 100,
        outlierScore,
        medianViews: Math.round(medianViews),
      };
    });

    res.json({ topPerformers: enriched });
  });

  // GET /api/metrics/by-format - Aggregate metrics grouped by format
  router.get("/by-format", (_req, res) => {
    const videos = parseContentLibrary(contentLibraryPath);
    const videoFormatMap = new Map(videos.map((v) => [v.code, v.format]));

    const rows = db
      .select({
        videoCode: performanceMetrics.videoCode,
        totalViews: sql<number>`SUM(${performanceMetrics.views})`,
        totalSaves: sql<number>`SUM(${performanceMetrics.saves})`,
        totalShares: sql<number>`SUM(${performanceMetrics.shares})`,
        totalLikes: sql<number>`SUM(${performanceMetrics.likes})`,
        totalComments: sql<number>`SUM(${performanceMetrics.comments})`,
      })
      .from(performanceMetrics)
      .groupBy(performanceMetrics.videoCode)
      .all();

    const byFormat: Record<string, { views: number; saves: number; shares: number; likes: number; comments: number; count: number }> = {};

    for (const row of rows) {
      const format = videoFormatMap.get(row.videoCode) ?? "?";
      if (!byFormat[format]) {
        byFormat[format] = { views: 0, saves: 0, shares: 0, likes: 0, comments: 0, count: 0 };
      }
      byFormat[format].views += row.totalViews ?? 0;
      byFormat[format].saves += row.totalSaves ?? 0;
      byFormat[format].shares += row.totalShares ?? 0;
      byFormat[format].likes += row.totalLikes ?? 0;
      byFormat[format].comments += row.totalComments ?? 0;
      byFormat[format].count += 1;
    }

    const result = Object.entries(byFormat).map(([format, data]) => ({
      format,
      ...data,
      avgViews: data.count > 0 ? Math.round(data.views / data.count) : 0,
      avgSaves: data.count > 0 ? Math.round(data.saves / data.count) : 0,
      engagementRate:
        data.views > 0
          ? Math.round(((data.likes + data.saves + data.shares + data.comments) / data.views) * 10000) / 100
          : 0,
      saveRate: data.views > 0 ? Math.round((data.saves / data.views) * 10000) / 100 : 0,
    }));

    res.json({ byFormat: result });
  });

  // GET /api/metrics/by-platform - Aggregate metrics grouped by platform
  router.get("/by-platform", (_req, res) => {
    const rows = db
      .select({
        platform: performanceMetrics.platform,
        totalViews: sql<number>`SUM(${performanceMetrics.views})`,
        totalSaves: sql<number>`SUM(${performanceMetrics.saves})`,
        totalShares: sql<number>`SUM(${performanceMetrics.shares})`,
        totalLikes: sql<number>`SUM(${performanceMetrics.likes})`,
        totalComments: sql<number>`SUM(${performanceMetrics.comments})`,
        videoCount: sql<number>`COUNT(DISTINCT ${performanceMetrics.videoCode})`,
      })
      .from(performanceMetrics)
      .groupBy(performanceMetrics.platform)
      .all();

    const result = rows.map((row) => ({
      ...row,
      engagementRate:
        row.totalViews && row.totalViews > 0
          ? Math.round(
              (((row.totalLikes ?? 0) + (row.totalSaves ?? 0) + (row.totalShares ?? 0) + (row.totalComments ?? 0)) /
                row.totalViews) *
                10000,
            ) / 100
          : 0,
    }));

    res.json({ byPlatform: result });
  });

  // GET /api/metrics/intelligence - Unified intelligence (digest + research + hooks)
  router.get("/intelligence", (_req, res) => {
    const { date } = _req.query;
    const digest = parseViralInsights(viralInsightsDir, typeof date === "string" ? date : undefined);
    const availableDates = listDigestDates(viralInsightsDir);
    const research = parseResearchReport();
    const hookLibrary = parseHookPatterns(hookPatternsPath);

    res.json({
      digest,
      availableDates,
      research,
      hookLibrary,
      counts: {
        redditThreads: research?.reddit?.length ?? 0,
        xPosts: research?.x?.length ?? 0,
        webResults: research?.web?.length ?? 0,
        instagramResults: research?.instagram?.length ?? 0,
        tiktokResults: research?.tiktok?.length ?? 0,
        facebookResults: research?.facebook?.length ?? 0,
        hookPatterns: hookLibrary.reduce((n, c) => n + c.patterns.length, 0),
      },
    });
  });

  // POST /api/metrics/research - Trigger /last30days research
  router.post("/research", (req, res) => {
    const { topic } = req.body;
    if (!topic || typeof topic !== "string") {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    if (researchProcess) {
      res.status(409).json({ error: "Research already running" });
      return;
    }

    const child = spawn("python3", [last30daysScript, topic, "--emit=json"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        SSL_CERT_FILE: process.env.SSL_CERT_FILE || "/Users/jordanharper/Library/Python/3.11/lib/python/site-packages/certifi/cacert.pem",
      },
    });

    researchProcess = child;
    let stderr = "";

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      researchProcess = null;
      if (code !== 0) {
        console.error(`[research] last30days exited with code ${code}: ${stderr.slice(0, 500)}`);
      } else {
        console.log(`[research] Completed for topic: ${topic}`);
        // Run platform-specific web searches as follow-up
        runPlatformResearch(topic).catch((err) => {
          console.error("[research] Platform search failed:", err);
        });
      }
    });

    child.on("error", (err) => {
      researchProcess = null;
      console.error(`[research] Failed to spawn: ${err.message}`);
    });

    res.json({ status: "started", topic });
  });

  // GET /api/metrics/research/status - Check research status
  router.get("/research/status", (_req, res) => {
    const report = parseResearchReport();
    res.json({
      running: researchProcess !== null || platformSearchRunning,
      report: report
        ? { topic: report.topic, generated_at: report.generated_at, from_cache: report.from_cache }
        : null,
    });
  });

  // DELETE /api/metrics/entry/:id - Delete a specific metrics entry
  router.delete("/entry/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    db.delete(performanceMetrics).where(eq(performanceMetrics.id, id)).run();
    res.json({ success: true });
  });

  // GET /api/metrics/trends - Time-series data for trend charts
  router.get("/trends", (_req, res) => {
    const { videoCode, platform, days } = _req.query;
    const daysNum = parseInt(days as string) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysNum);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    let rows = db
      .select()
      .from(performanceMetrics)
      .where(gte(performanceMetrics.recordedAt, cutoffStr))
      .orderBy(performanceMetrics.recordedAt)
      .all();

    if (videoCode && typeof videoCode === "string") {
      rows = rows.filter((r) => r.videoCode === videoCode.toUpperCase());
    }
    if (platform && typeof platform === "string") {
      rows = rows.filter((r) => r.platform === platform);
    }

    // Aggregate by date
    const byDate: Record<string, { views: number; likes: number; saves: number; shares: number; comments: number }> = {};
    for (const row of rows) {
      const d = row.recordedAt;
      if (!byDate[d]) byDate[d] = { views: 0, likes: 0, saves: 0, shares: 0, comments: 0 };
      byDate[d].views += row.views ?? 0;
      byDate[d].likes += row.likes ?? 0;
      byDate[d].saves += row.saves ?? 0;
      byDate[d].shares += row.shares ?? 0;
      byDate[d].comments += row.comments ?? 0;
    }

    const trends = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    res.json({ trends });
  });

  // POST /api/metrics/bulk - Bulk import metric entries with dedup
  router.post("/bulk", (req, res) => {
    const { entries } = req.body as { entries?: MetricsSyncEntry[] };
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: "entries array is required" });
      return;
    }

    // Fetch existing entries for dedup
    const existing = db.select().from(performanceMetrics).all();
    const existingKeys = new Set(
      existing.map((e) => `${e.videoCode}|${e.platform}|${e.recordedAt}`),
    );

    let inserted = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (!entry.platform) {
        skipped++;
        continue;
      }
      const code = (entry.videoCode || entry.platformPostId || "UNKNOWN").toUpperCase();
      const key = `${code}|${entry.platform}|${entry.recordedAt}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      db.insert(performanceMetrics)
        .values({
          videoCode: code,
          platform: entry.platform,
          recordedAt: entry.recordedAt || new Date().toISOString().split("T")[0],
          views: entry.views ?? 0,
          likes: entry.likes ?? 0,
          saves: entry.saves ?? 0,
          shares: entry.shares ?? 0,
          comments: entry.comments ?? 0,
          watchTimeSeconds: entry.watchTimeSeconds ?? null,
        })
        .run();

      existingKeys.add(key);
      inserted++;
    }

    res.status(201).json({ inserted, skipped });
  });

  // POST /api/metrics/sync-n8n - Pull metrics from n8n workflow execution
  router.post("/sync-n8n", async (_req, res) => {
    const apiUrl = process.env.N8N_API_URL;
    const apiKey = process.env.N8N_API_KEY;
    const workflowId = process.env.N8N_METRICS_WORKFLOW_ID;

    if (!apiUrl || !apiKey) {
      res.status(500).json({ error: "N8N_API_URL and N8N_API_KEY must be set in .env" });
      return;
    }
    if (!workflowId) {
      res.status(500).json({ error: "N8N_METRICS_WORKFLOW_ID must be set in .env" });
      return;
    }

    try {
      // Fetch latest successful execution
      const listRes = await fetch(
        `${apiUrl}/executions?workflowId=${workflowId}&status=success&limit=1`,
        { headers: { "X-N8N-API-KEY": apiKey } },
      );
      if (!listRes.ok) {
        res.status(502).json({ error: `n8n API error: ${listRes.status} ${listRes.statusText}` });
        return;
      }

      const listData = (await listRes.json()) as { data: Array<{ id: string }> };
      if (!listData.data?.length) {
        res.json({ synced: 0, skipped: 0, message: "No successful executions found" });
        return;
      }

      const executionId = listData.data[0].id;

      // Fetch execution with full data
      const execRes = await fetch(
        `${apiUrl}/executions/${executionId}?includeData=true`,
        { headers: { "X-N8N-API-KEY": apiKey } },
      );
      if (!execRes.ok) {
        res.status(502).json({ error: `n8n API error fetching execution: ${execRes.status}` });
        return;
      }

      const execData = (await execRes.json()) as {
        data: { resultData: { runData: Record<string, Array<{ data: { main: Array<Array<{ json: Record<string, unknown> }>> } }>> } };
      };

      // Extract metrics from "Metrics Output" node
      const runData = execData.data?.resultData?.runData;
      let metricsEntries: MetricsSyncEntry[] = [];

      for (const nodeName of ["Metrics Output", "Format Metrics", "Merge Metrics"]) {
        const nodeRuns = runData?.[nodeName];
        if (!nodeRuns?.length) continue;

        // Collect all output items from this node
        const outputs = nodeRuns[0]?.data?.main?.[0];
        if (!outputs?.length) continue;

        for (const item of outputs) {
          const json = item.json;
          if (json && typeof json === "object" && json.platform) {
            metricsEntries.push(json as unknown as MetricsSyncEntry);
          }
        }
        if (metricsEntries.length > 0) break;
      }

      if (metricsEntries.length === 0) {
        res.json({ synced: 0, skipped: 0, message: "No metrics data found in latest execution" });
        return;
      }

      // Try to match post titles to content library video codes
      const videos = parseContentLibrary(contentLibraryPath);
      const titleToCode = new Map(videos.map((v) => [v.title.toLowerCase().trim(), v.code]));

      for (const entry of metricsEntries) {
        if (!entry.videoCode && entry.postTitle) {
          const match = titleToCode.get(entry.postTitle.toLowerCase().trim());
          if (match) entry.videoCode = match;
        }
      }

      // Dedup and insert
      const existing = db.select().from(performanceMetrics).all();
      const existingKeys = new Set(
        existing.map((e) => `${e.videoCode}|${e.platform}|${e.recordedAt}`),
      );

      let synced = 0;
      let skipped = 0;
      const unmatched: string[] = [];

      for (const entry of metricsEntries) {
        const code = (entry.videoCode || entry.platformPostId || "").toUpperCase();
        if (!code) {
          if (entry.postTitle) unmatched.push(entry.postTitle);
          skipped++;
          continue;
        }

        const recordedAt = entry.recordedAt || new Date().toISOString().split("T")[0];
        const key = `${code}|${entry.platform}|${recordedAt}`;
        if (existingKeys.has(key)) {
          skipped++;
          continue;
        }

        db.insert(performanceMetrics)
          .values({
            videoCode: code,
            platform: entry.platform,
            recordedAt,
            views: entry.views ?? 0,
            likes: entry.likes ?? 0,
            saves: entry.saves ?? 0,
            shares: entry.shares ?? 0,
            comments: entry.comments ?? 0,
            watchTimeSeconds: entry.watchTimeSeconds ?? null,
          })
          .run();

        existingKeys.add(key);
        synced++;
      }

      res.status(201).json({ synced, skipped, unmatched, executionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync metrics from n8n";
      console.error("[metrics-sync-n8n] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/metrics/video-thumbnail - Upload a thumbnail for a video code
  router.post("/video-thumbnail", async (req, res) => {
    try {
      const { videoCode, imageBase64 } = req.body as { videoCode: string; imageBase64: string };
      if (!videoCode || !imageBase64) { res.status(400).json({ error: "videoCode and imageBase64 required" }); return; }

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      const thumbDir = path.join(import.meta.dirname, "..", "..", "data", "thumbnails");
      if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

      const filename = `${videoCode.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
      const filepath = path.join(thumbDir, filename);
      fs.writeFileSync(filepath, buffer);

      const servingPath = `/thumbnails/${filename}`;

      // Update video_post_urls table
      sqlite.prepare(`
        UPDATE video_post_urls SET thumbnail_path = ? WHERE video_code = ?
      `).run(servingPath, videoCode);

      // If no row existed, create one
      const existing = sqlite.prepare("SELECT id FROM video_post_urls WHERE video_code = ?").get(videoCode);
      if (!existing) {
        sqlite.prepare("INSERT INTO video_post_urls (video_code, platform, post_url, thumbnail_path) VALUES (?, 'instagram_reels', '', ?)").run(videoCode, servingPath);
      }

      res.json({ ok: true, thumbnailPath: servingPath });
    } catch (err) {
      console.error("[metrics] video-thumbnail upload error:", err);
      res.status(500).json({ error: "Failed to upload thumbnail" });
    }
  });

  // POST /api/metrics/video-thumbnail-from-url - Scrape thumbnail from Instagram URL via Playwright
  router.post("/video-thumbnail-from-url", async (req, res) => {
    try {
      const { videoCode, url } = req.body as { videoCode: string; url: string };
      if (!videoCode || !url) { res.status(400).json({ error: "videoCode and url required" }); return; }

      const thumbDir = path.join(import.meta.dirname, "..", "..", "data", "thumbnails");
      if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
      const filename = `${videoCode.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
      const filepath = path.join(thumbDir, filename);

      // Use Playwright to screenshot the Instagram post
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({
        viewport: { width: 430, height: 932 },
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      });

      try {
        // Navigate to the post (mobile view loads faster, less login nag)
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(2000);

        // Try to find the main post image/video poster
        let element = await page.$("article img[src*='cdninstagram'], article video, img[src*='cdninstagram']");

        if (element) {
          // Screenshot just the media element
          await element.screenshot({ path: filepath, type: "jpeg", quality: 90 });
        } else {
          // Fallback: screenshot the top portion of the page
          await page.screenshot({
            path: filepath,
            type: "jpeg",
            quality: 90,
            clip: { x: 0, y: 0, width: 430, height: 430 },
          });
        }
      } finally {
        await browser.close();
      }

      // Verify file was created and has content
      if (!fs.existsSync(filepath) || fs.statSync(filepath).size < 500) {
        res.status(500).json({ error: "Failed to capture thumbnail" });
        return;
      }

      const servingPath = `/thumbnails/${filename}`;

      // Update database
      const existing = sqlite.prepare("SELECT id FROM video_post_urls WHERE video_code = ?").get(videoCode);
      if (existing) {
        sqlite.prepare("UPDATE video_post_urls SET thumbnail_path = ?, post_url = COALESCE(NULLIF(post_url, ''), ?) WHERE video_code = ?").run(servingPath, url, videoCode);
      } else {
        sqlite.prepare("INSERT INTO video_post_urls (video_code, platform, post_url, thumbnail_path) VALUES (?, 'instagram_reels', ?, ?)").run(videoCode, url, servingPath);
      }

      res.json({ ok: true, thumbnailPath: servingPath });
    } catch (err) {
      console.error("[metrics] video-thumbnail-from-url error:", err);
      res.status(500).json({ error: "Failed to scrape thumbnail" });
    }
  });

  // GET /api/metrics/summary - Rich dashboard home stats (Command Center data)
  router.get("/summary", (_req, res) => {
    try {
      // ── Aggregate totals across all videos
      const totals = sqlite.prepare(`
        SELECT
          SUM(views) as totalViews,
          SUM(likes) as totalLikes,
          SUM(saves) as totalSaves,
          SUM(shares) as totalShares,
          SUM(comments) as totalComments,
          COUNT(DISTINCT video_code) as totalTracked
        FROM performance_metrics
      `).get() as { totalViews: number; totalLikes: number; totalSaves: number; totalShares: number; totalComments: number; totalTracked: number };

      const tv = totals.totalViews || 0;
      const totalEngagement = (totals.totalLikes || 0) + (totals.totalSaves || 0) + (totals.totalShares || 0) + (totals.totalComments || 0);
      const engagementRate = tv > 0 ? Math.round((totalEngagement / tv) * 10000) / 100 : 0;
      const saveRate = tv > 0 ? Math.round(((totals.totalSaves || 0) / tv) * 10000) / 100 : 0;

      // ── Published count
      const publishedCount = sqlite.prepare(
        "SELECT COUNT(*) as c FROM video_status WHERE current_status = 'PUBLISHED'"
      ).get() as { c: number };

      // ── Views trend (last 7 recorded dates)
      const trendRows = sqlite.prepare(`
        SELECT recorded_at as date, SUM(views) as dayViews
        FROM performance_metrics
        GROUP BY recorded_at
        ORDER BY recorded_at DESC
        LIMIT 14
      `).all() as Array<{ date: string; dayViews: number }>;

      const viewsTrend = trendRows.slice(0, 7).reverse().map((r) => r.dayViews || 0);
      const thisWeek = trendRows.slice(0, 7).reduce((s, r) => s + (r.dayViews || 0), 0);
      const lastWeek = trendRows.slice(7, 14).reduce((s, r) => s + (r.dayViews || 0), 0);
      const weekOverWeekDelta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;

      // ── Top performer (fully enriched)
      const perfRows = sqlite.prepare(`
        SELECT
          video_code,
          SUM(views) as totalViews,
          SUM(likes) as totalLikes,
          SUM(saves) as totalSaves,
          SUM(shares) as totalShares,
          SUM(comments) as totalComments
        FROM performance_metrics
        GROUP BY video_code
        ORDER BY SUM(views) DESC
        LIMIT 1
      `).get() as { video_code: string; totalViews: number; totalLikes: number; totalSaves: number; totalShares: number; totalComments: number } | undefined;

      let topPerformer: Record<string, unknown> | null = null;
      if (perfRows) {
        // Try content library first, then video_titles table
        const videos = parseContentLibrary(contentLibraryPath);
        let video = videos.find((v) => v.code === perfRows.video_code);
        let videoTitle = video?.title ?? perfRows.video_code;
        let videoFormat = video?.format ?? null;
        let videoFormatName = video?.formatName ?? null;
        let videoAudience = video?.audienceLabel ?? null;

        // Fallback: check video_titles table for real Instagram post titles
        if (!video) {
          const titleRow = sqlite.prepare("SELECT title, caption FROM video_titles WHERE video_code = ?").get(perfRows.video_code) as { title: string; caption: string } | undefined;
          if (titleRow) {
            videoTitle = titleRow.title;
          }
        }

        // Get post URL and thumbnail
        const postUrlRow = sqlite.prepare("SELECT post_url, thumbnail_path FROM video_post_urls WHERE video_code = ?").get(perfRows.video_code) as { post_url: string; thumbnail_path: string | null } | undefined;

        // Compute median for outlier score
        const allViews = sqlite.prepare(
          "SELECT SUM(views) as v FROM performance_metrics GROUP BY video_code"
        ).all() as Array<{ v: number }>;
        const sorted = allViews.map((r) => r.v).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const medianViews = sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid] || 1;

        const pViews = perfRows.totalViews || 1;
        const pEngagement = (perfRows.totalLikes || 0) + (perfRows.totalSaves || 0) + (perfRows.totalShares || 0) + (perfRows.totalComments || 0);

        // YouTube thumbnail lookup
        const ytLink = sqlite.prepare(
          "SELECT youtube_video_id FROM youtube_video_links WHERE video_code = ? LIMIT 1"
        ).get(perfRows.video_code) as { youtube_video_id: string } | undefined;

        // Determine thumbnail: YouTube > cached local > creator_videos > null
        let thumbnailUrl: string | null = null;
        let videoUrl: string | null = null;

        if (ytLink) {
          thumbnailUrl = `https://img.youtube.com/vi/${ytLink.youtube_video_id}/hqdefault.jpg`;
          videoUrl = `https://youtube.com/shorts/${ytLink.youtube_video_id}`;
        }
        if (postUrlRow) {
          videoUrl = videoUrl || postUrlRow.post_url;
          if (postUrlRow.thumbnail_path) thumbnailUrl = postUrlRow.thumbnail_path;
        }
        // Fallback: check creator_videos for a cached thumbnail matching this video's URL
        if (!thumbnailUrl && videoUrl) {
          const cvThumb = sqlite.prepare(
            "SELECT thumbnail_url FROM creator_videos WHERE video_url = ? AND thumbnail_url IS NOT NULL AND thumbnail_url != '' LIMIT 1"
          ).get(videoUrl) as { thumbnail_url: string } | undefined;
          if (cvThumb) thumbnailUrl = cvThumb.thumbnail_url;
        }
        // Last resort: check creator_videos matching the video title
        if (!thumbnailUrl && videoTitle) {
          const cvThumb = sqlite.prepare(
            "SELECT thumbnail_url FROM creator_videos WHERE video_title LIKE ? AND thumbnail_url IS NOT NULL AND thumbnail_url != '' LIMIT 1"
          ).get(`%${videoTitle.slice(0, 30)}%`) as { thumbnail_url: string } | undefined;
          if (cvThumb) thumbnailUrl = cvThumb.thumbnail_url;
        }

        topPerformer = {
          code: perfRows.video_code,
          title: videoTitle,
          format: videoFormat ?? null,
          formatName: videoFormatName ?? null,
          audience: videoAudience ?? null,
          views: perfRows.totalViews,
          likes: perfRows.totalLikes || 0,
          saves: perfRows.totalSaves || 0,
          shares: perfRows.totalShares || 0,
          comments: perfRows.totalComments || 0,
          engagementRate: Math.round((pEngagement / pViews) * 10000) / 100,
          saveRate: Math.round(((perfRows.totalSaves || 0) / pViews) * 10000) / 100,
          outlierScore: Math.round((perfRows.totalViews / medianViews) * 10) / 10,
          thumbnailUrl,
          videoUrl,
          platform: "instagram_reels",
        };
      }

      // ── Best performing format
      const formatRows = sqlite.prepare(`
        SELECT
          UPPER(SUBSTR(video_code, 1, 1)) as format,
          COUNT(DISTINCT video_code) as videoCount,
          AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as avgSaveRate
        FROM performance_metrics
        WHERE views > 0
        GROUP BY UPPER(SUBSTR(video_code, 1, 1))
        HAVING videoCount >= 1
        ORDER BY avgSaveRate DESC
        LIMIT 1
      `).get() as { format: string; videoCount: number; avgSaveRate: number } | undefined;

      const bestFormat = formatRows
        ? { format: formatRows.format, avgSaveRate: Math.round(formatRows.avgSaveRate * 10000) / 100, videoCount: formatRows.videoCount }
        : null;

      // ── Production velocity (avg days to publish)
      const velocityRow = sqlite.prepare(`
        SELECT AVG(julianday(sh2.changed_at) - julianday(sh1.changed_at)) as avgDays
        FROM status_history sh1
        JOIN status_history sh2 ON sh1.video_code = sh2.video_code
        WHERE sh1.to_status = 'SCRIPTED' AND sh2.to_status = 'PUBLISHED'
      `).get() as { avgDays: number | null } | undefined;

      res.json({
        totalViews: tv,
        totalLikes: totals.totalLikes || 0,
        totalSaves: totals.totalSaves || 0,
        totalShares: totals.totalShares || 0,
        engagementRate,
        saveRate,
        viewsTrend,
        thisWeek,
        weekOverWeekDelta,
        topPerformer,
        bestFormat,
        avgDaysToPublish: velocityRow?.avgDays ? Math.round(velocityRow.avgDays * 10) / 10 : null,
        totalPublished: publishedCount?.c || 0,
        totalTracked: totals.totalTracked || 0,
      });
    } catch (err) {
      console.error("[metrics] summary error:", err);
      res.status(500).json({ error: "Failed to compute summary" });
    }
  });

  // GET /api/metrics/attribution - Get social attribution counts by month
  router.get("/attribution", (_req, res) => {
    const rows = db.select().from(socialAttributions).orderBy(socialAttributions.monthKey).all();
    const total = rows.reduce((s, r) => s + r.count, 0);
    res.json({ attributions: rows, total });
  });

  // POST /api/metrics/attribution/tap - Increment attribution count for current month
  router.post("/attribution/tap", (_req, res) => {
    const monthKey = new Date().toISOString().slice(0, 7); // "2026-03"
    const existing = db
      .select()
      .from(socialAttributions)
      .where(eq(socialAttributions.monthKey, monthKey))
      .get();

    if (existing) {
      const updated = db
        .update(socialAttributions)
        .set({
          count: existing.count + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(socialAttributions.monthKey, monthKey))
        .returning()
        .get();
      res.json({ attribution: updated });
    } else {
      const created = db
        .insert(socialAttributions)
        .values({ monthKey, count: 1 })
        .returning()
        .get();
      res.json({ attribution: created });
    }
  });

  // GET /api/metrics/pattern-analysis - Hook × format × platform performance matrix
  router.get("/pattern-analysis", (_req, res) => {
    // Hook pattern aggregations
    const hookRows = sqlite.prepare(`
      SELECT
        LOWER(hook_pattern_used) as hook_pattern,
        platform,
        COUNT(*) as video_count,
        AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as avg_save_rate,
        AVG(CAST(shares AS FLOAT) / NULLIF(views, 0)) as avg_share_rate,
        AVG(CAST(comments AS FLOAT) / NULLIF(views, 0)) as avg_comment_rate
      FROM performance_metrics
      WHERE hook_pattern_used IS NOT NULL AND views > 0
      GROUP BY LOWER(hook_pattern_used), platform
      ORDER BY avg_save_rate DESC
    `).all() as Array<{
      hook_pattern: string; platform: string; video_count: number;
      avg_save_rate: number; avg_share_rate: number; avg_comment_rate: number;
    }>;

    const hookPatterns = hookRows.map((r) => {
      const weightedEngagement = (0.4 * (r.avg_save_rate ?? 0)) + (0.3 * (r.avg_share_rate ?? 0)) + (0.3 * (r.avg_comment_rate ?? 0));
      return {
        hookPattern: r.hook_pattern,
        platform: r.platform,
        videoCount: r.video_count,
        avgSaveRate: r.avg_save_rate ?? 0,
        avgShareRate: r.avg_share_rate ?? 0,
        avgCommentRate: r.avg_comment_rate ?? 0,
        weightedEngagement,
        confidence: r.video_count >= 5 ? "high" as const : r.video_count >= 3 ? "medium" as const : "low" as const,
      };
    });

    // Format aggregations — derive formatId from video code prefix if not set
    const formatRows = sqlite.prepare(`
      SELECT
        COALESCE(UPPER(format_id), UPPER(SUBSTR(video_code, 1, 1))) as format_id,
        platform,
        COUNT(*) as video_count,
        AVG(views) as avg_views,
        AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as avg_save_rate,
        AVG(CAST(shares AS FLOAT) / NULLIF(views, 0)) as avg_share_rate,
        AVG(CAST(comments AS FLOAT) / NULLIF(views, 0)) as avg_comment_rate
      FROM performance_metrics
      WHERE views > 0
        AND UPPER(COALESCE(format_id, SUBSTR(video_code, 1, 1))) IN ('A','B','C','D','E','F','G')
      GROUP BY UPPER(COALESCE(format_id, SUBSTR(video_code, 1, 1))), platform
      ORDER BY avg_save_rate DESC
    `).all() as Array<{
      format_id: string; platform: string; video_count: number;
      avg_views: number; avg_save_rate: number; avg_share_rate: number; avg_comment_rate: number;
    }>;

    const byFormat = formatRows.map((r) => ({
      formatId: r.format_id,
      platform: r.platform,
      videoCount: r.video_count,
      avgViews: Math.round(r.avg_views ?? 0),
      avgSaveRate: r.avg_save_rate ?? 0,
      weightedEngagement: (0.4 * (r.avg_save_rate ?? 0)) + (0.3 * (r.avg_share_rate ?? 0)) + (0.3 * (r.avg_comment_rate ?? 0)),
    }));

    // Coverage stats
    const coverageRow = sqlite.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN hook_pattern_used IS NOT NULL THEN 1 ELSE 0 END) as with_hook,
        SUM(CASE WHEN format_id IS NOT NULL OR UPPER(SUBSTR(video_code,1,1)) IN ('A','B','C','D','E','F','G') THEN 1 ELSE 0 END) as with_format
      FROM performance_metrics
    `).get() as { total: number; with_hook: number; with_format: number };

    const coverage = {
      totalVideos: coverageRow.total,
      withHookPattern: coverageRow.with_hook,
      withFormatId: coverageRow.with_format,
      hookCoveragePct: coverageRow.total > 0 ? Math.round((coverageRow.with_hook / coverageRow.total) * 100) : 0,
      formatCoveragePct: coverageRow.total > 0 ? Math.round((coverageRow.with_format / coverageRow.total) * 100) : 0,
    };

    // Top outliers by save rate
    const outlierRows = sqlite.prepare(`
      SELECT video_code, platform, views, saves,
        CAST(saves AS FLOAT) / NULLIF(views, 0) as save_rate,
        hook_pattern_used, format_id
      FROM performance_metrics
      WHERE views > 0
      ORDER BY save_rate DESC
      LIMIT 5
    `).all() as Array<{
      video_code: string; platform: string; views: number; saves: number;
      save_rate: number; hook_pattern_used: string | null; format_id: string | null;
    }>;

    const topOutliers = outlierRows.map((r) => ({
      videoCode: r.video_code,
      platform: r.platform,
      views: r.views,
      saves: r.saves,
      saveRate: r.save_rate ?? 0,
      hookPatternUsed: r.hook_pattern_used,
      formatId: r.format_id ?? (["A","B","C","D","E","F","G"].includes(r.video_code[0].toUpperCase()) ? r.video_code[0].toUpperCase() : null),
    }));

    // Data range
    const rangeRow = sqlite.prepare(`
      SELECT MIN(recorded_at) as earliest, MAX(recorded_at) as latest FROM performance_metrics
    `).get() as { earliest: string | null; latest: string | null };

    const dataRange = rangeRow.earliest ? {
      earliest: rangeRow.earliest,
      latest: rangeRow.latest!,
      days: Math.round((new Date(rangeRow.latest!).getTime() - new Date(rangeRow.earliest).getTime()) / 86400000),
    } : null;

    const avgWeightedEngagement = hookPatterns.length > 0
      ? hookPatterns.reduce((s, p) => s + p.weightedEngagement, 0) / hookPatterns.length
      : 0;

    res.json({ hookPatterns, byFormat, coverage, topOutliers, avgWeightedEngagement, dataRange });
  });

  // POST /api/metrics/strategy-analysis - AI-powered KEEP/PROMOTE/DEMOTE analysis
  router.post("/strategy-analysis", async (_req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const hookRows = sqlite.prepare(`
        SELECT LOWER(hook_pattern_used) as hook_pattern, platform, COUNT(*) as n,
          AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as save_rate
        FROM performance_metrics WHERE hook_pattern_used IS NOT NULL AND views > 0
        GROUP BY LOWER(hook_pattern_used), platform ORDER BY save_rate DESC
      `).all() as Array<{ hook_pattern: string; platform: string; n: number; save_rate: number }>;

      if (hookRows.length === 0) {
        res.status(422).json({ error: "No hook pattern data yet. Tag some videos with hookPatternUsed first." });
        return;
      }

      const hookSummary = hookRows.map((r) =>
        `${r.hook_pattern} on ${r.platform}: ${(r.save_rate * 100).toFixed(1)}% save rate (n=${r.n})`
      ).join("\n");

      const hookPatternsContent = fs.existsSync(hookPatternsPath)
        ? fs.readFileSync(hookPatternsPath, "utf-8").slice(0, 4000)
        : "Hook patterns file not found.";

      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `You are analyzing content performance data for a chiropractic practice's social media strategy.

PERFORMANCE DATA (real audience metrics):
${hookSummary}

CURRENT hook-patterns.md emphasis (first 4000 chars):
${hookPatternsContent}

Compare the performance data to what hook-patterns.md currently emphasizes. Identify discrepancies.

Respond with JSON only:
{
  "findings": [
    {
      "verdict": "KEEP|PROMOTE|DEMOTE|INVESTIGATE",
      "hookPattern": "exact pattern name from data",
      "platform": "Instagram|TikTok|YouTube|All",
      "evidence": "specific data citation: e.g. '18.2% save rate (n=8), 2.1x above average'",
      "confidence": "HIGH|MEDIUM|LOW",
      "recommendation": "specific actionable change in 1-2 sentences"
    }
  ],
  "summary": "2-3 sentence overview of biggest strategic opportunities"
}

Rules:
- KEEP: current strategy matches data (evidence confirms it)
- PROMOTE: data shows underemphasized pattern is winning (move it up)
- DEMOTE: high-priority pattern in hook-patterns.md but underperforming in data
- INVESTIGATE: less than 3 data points, inconclusive
- Only include patterns that appear in the data
- Be specific about save rates and n counts
- Minimum 1 finding per verdict type if data supports it`,
        }],
      }, { timeout: 60_000 });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      const parsed = JSON.parse(cleaned) as { findings: unknown[]; summary: string };
      res.json({ ...parsed, generatedAt: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Strategy analysis failed";
      console.error("[strategy-analysis] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/metrics/strategy-log - Append analysis findings to strategy-optimizer/results.md
  router.post("/strategy-log", (req, res) => {
    const { findings, summary } = req.body as { findings: Array<{ verdict: string; hookPattern: string; platform: string; evidence: string; recommendation: string }>; summary: string };
    if (!findings?.length) {
      res.status(400).json({ error: "findings required" });
      return;
    }

    const strategyDir = path.join(industryDir, "strategy-optimizer");
    const resultsPath = path.join(strategyDir, "results.md");

    try {
      if (!fs.existsSync(strategyDir)) fs.mkdirSync(strategyDir, { recursive: true });

      const date = new Date().toISOString().split("T")[0];
      const entry = [
        `\n## ${date} Strategy Analysis\n`,
        `**Summary:** ${summary}\n`,
        `### Findings\n`,
        ...findings.map((f) => `- **${f.verdict}** ${f.hookPattern} on ${f.platform} — ${f.evidence}\n  → ${f.recommendation}`),
        "",
      ].join("\n");

      const existing = fs.existsSync(resultsPath) ? fs.readFileSync(resultsPath, "utf-8") : "";
      const updated = existing.includes("*No runs yet*") ? existing.replace("*No runs yet. Run \"strategy optimizer\" to generate the first entry.*", entry.trim()) : existing + entry;
      fs.writeFileSync(resultsPath, updated);

      res.json({ saved: true, path: resultsPath });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to save" });
    }
  });

  // ============================================
  // Performance Feedback Loop Endpoints
  // (Must be before /:code catch-all route)
  // ============================================

  // GET /api/metrics/own-outliers - Detect your own content performing 2x+ above baseline
  router.get("/own-outliers", (_req, res) => {
    try {
      const allVideoViews = sqlite.prepare(`
        SELECT video_code, SUM(views) as total_views, SUM(saves) as total_saves,
          SUM(likes) as total_likes, SUM(shares) as total_shares, SUM(comments) as total_comments,
          MAX(hook_pattern_used) as hook_pattern, MAX(format_id) as format_id
        FROM performance_metrics
        WHERE views > 0
        GROUP BY video_code
        ORDER BY total_views ASC
      `).all() as Array<{
        video_code: string; total_views: number; total_saves: number;
        total_likes: number; total_shares: number; total_comments: number;
        hook_pattern: string | null; format_id: string | null;
      }>;

      if (allVideoViews.length === 0) {
        res.json({ outliers: [], baseline: { medianViews: 0, avgViews: 0, videoCount: 0 } });
        return;
      }

      const viewsList = allVideoViews.map((r) => r.total_views);
      const mid = Math.floor(viewsList.length / 2);
      const medianViews = viewsList.length % 2 === 0
        ? Math.round((viewsList[mid - 1] + viewsList[mid]) / 2)
        : viewsList[mid];
      const avgViews = Math.round(viewsList.reduce((s, v) => s + v, 0) / viewsList.length);

      const threshold = medianViews * 2;
      const outlierVideos = allVideoViews
        .filter((r) => r.total_views >= threshold)
        .sort((a, b) => b.total_views - a.total_views);

      const videos = parseContentLibrary(contentLibraryPath);
      const outliers = outlierVideos.map((r) => {
        const video = videos.find((v) => v.code === r.video_code);
        const totalEngagement = r.total_likes + r.total_saves + r.total_shares + r.total_comments;
        const engagementRate = r.total_views > 0 ? totalEngagement / r.total_views : 0;
        const saveRate = r.total_views > 0 ? r.total_saves / r.total_views : 0;
        const outlierScore = medianViews > 0 ? Math.round((r.total_views / medianViews) * 100) / 100 : 0;
        const formatId = r.format_id || (r.video_code[0]?.match(/[A-G]/) ? r.video_code[0] : null);

        return {
          videoCode: r.video_code,
          title: video?.title ?? r.video_code,
          format: formatId,
          formatName: video?.formatName ?? null,
          audience: video?.audienceLabel ?? null,
          hookPattern: r.hook_pattern,
          views: r.total_views,
          saves: r.total_saves,
          likes: r.total_likes,
          shares: r.total_shares,
          comments: r.total_comments,
          outlierScore,
          engagementRate: Math.round(engagementRate * 10000) / 100,
          saveRate: Math.round(saveRate * 10000) / 100,
        };
      });

      res.json({ outliers, baseline: { medianViews, avgViews, videoCount: allVideoViews.length } });
    } catch (error) {
      console.error("[metrics] Error computing own outliers:", error);
      res.status(500).json({ error: "Failed to compute outliers" });
    }
  });

  // GET /api/metrics/format-platform-heatmap - Performance matrix: format x platform x metric
  router.get("/format-platform-heatmap", (_req, res) => {
    try {
      const metric = (_req.query.metric as string) || "saveRate";

      const rows = sqlite.prepare(`
        SELECT
          UPPER(COALESCE(format_id, SUBSTR(video_code, 1, 1))) as format_id,
          platform,
          COUNT(DISTINCT video_code) as video_count,
          AVG(views) as avg_views,
          AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as avg_save_rate,
          AVG(CAST((likes + saves + shares + comments) AS FLOAT) / NULLIF(views, 0)) as avg_engagement_rate,
          AVG(CAST(shares AS FLOAT) / NULLIF(views, 0)) as avg_share_rate
        FROM performance_metrics
        WHERE views > 0
          AND UPPER(COALESCE(format_id, SUBSTR(video_code, 1, 1))) IN ('A','B','C','D','E','F','G')
        GROUP BY format_id, platform
      `).all() as Array<{
        format_id: string; platform: string; video_count: number;
        avg_views: number; avg_save_rate: number; avg_engagement_rate: number; avg_share_rate: number;
      }>;

      const formats = ["A", "B", "C", "D", "E", "F", "G"];
      const platforms = [...new Set(rows.map((r) => r.platform))].sort();
      const matrix: Record<string, Record<string, { value: number; videoCount: number }>> = {};

      for (const fmt of formats) {
        matrix[fmt] = {};
        for (const plat of platforms) {
          const row = rows.find((r) => r.format_id === fmt && r.platform === plat);
          let value = 0;
          if (row) {
            if (metric === "saveRate") value = row.avg_save_rate ?? 0;
            else if (metric === "engagementRate") value = row.avg_engagement_rate ?? 0;
            else if (metric === "shareRate") value = row.avg_share_rate ?? 0;
            else if (metric === "avgViews") value = row.avg_views ?? 0;
          }
          matrix[fmt][plat] = { value, videoCount: row?.video_count ?? 0 };
        }
      }

      const flatCells = rows.map((r) => {
        let value = 0;
        if (metric === "saveRate") value = r.avg_save_rate ?? 0;
        else if (metric === "engagementRate") value = r.avg_engagement_rate ?? 0;
        else if (metric === "shareRate") value = r.avg_share_rate ?? 0;
        else if (metric === "avgViews") value = r.avg_views ?? 0;
        return { format: r.format_id, platform: r.platform, value, videoCount: r.video_count };
      }).sort((a, b) => b.value - a.value);

      res.json({ matrix, platforms, formats, metric, topCombinations: flatCells.slice(0, 5) });
    } catch (error) {
      console.error("[metrics] Error computing heatmap:", error);
      res.status(500).json({ error: "Failed to compute heatmap" });
    }
  });

  // GET /api/metrics/auto-insights - AI-free performance digest with actionable findings
  router.get("/auto-insights", (_req, res) => {
    try {
      const insights: Array<{ type: string; severity: "info" | "warning" | "success"; title: string; detail: string; data?: Record<string, unknown> }> = [];

      const videoPerf = sqlite.prepare(`
        SELECT video_code, SUM(views) as v, SUM(saves) as s, SUM(likes) as l,
          MAX(hook_pattern_used) as hook, MAX(format_id) as fmt
        FROM performance_metrics WHERE views > 0
        GROUP BY video_code ORDER BY v DESC
      `).all() as Array<{ video_code: string; v: number; s: number; l: number; hook: string | null; fmt: string | null }>;

      if (videoPerf.length === 0) {
        res.json({ insights: [{ type: "empty", severity: "info" as const, title: "No performance data yet", detail: "Publish videos and log metrics to see insights." }], generatedAt: new Date().toISOString() });
        return;
      }

      const viewsList2 = videoPerf.map((r) => r.v).sort((a, b) => a - b);
      const mid2 = Math.floor(viewsList2.length / 2);
      const median = viewsList2.length % 2 === 0 ? (viewsList2[mid2 - 1] + viewsList2[mid2]) / 2 : viewsList2[mid2];
      const top = videoPerf[0];
      const videos = parseContentLibrary(contentLibraryPath);
      const topVideo = videos.find((v) => v.code === top.video_code);

      if (top.v >= median * 3) {
        insights.push({
          type: "top_performer", severity: "success",
          title: `"${topVideo?.title ?? top.video_code}" is a breakout hit`,
          detail: `${Math.round(top.v / median)}x your median views. ${top.hook ? `Hook pattern: ${top.hook}.` : ""} ${top.fmt ? `Format: ${top.fmt}.` : ""} Consider making more like this.`,
          data: { videoCode: top.video_code, views: top.v, outlierMultiple: Math.round(top.v / median) },
        });
      }

      const formatPerf = sqlite.prepare(`
        SELECT UPPER(COALESCE(format_id, SUBSTR(video_code, 1, 1))) as fmt,
          COUNT(DISTINCT video_code) as cnt,
          AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as sr
        FROM performance_metrics WHERE views > 0
          AND UPPER(COALESCE(format_id, SUBSTR(video_code, 1, 1))) IN ('A','B','C','D','E','F','G')
        GROUP BY fmt HAVING cnt >= 2 ORDER BY sr DESC
      `).all() as Array<{ fmt: string; cnt: number; sr: number }>;

      if (formatPerf.length >= 2) {
        const best = formatPerf[0];
        const worst = formatPerf[formatPerf.length - 1];
        const fmtNames: Record<string, string> = { A: "Explainer", B: "Checklist", C: "Demo", D: "Myth Buster", E: "Walkthrough", F: "Quick Tip", G: "Patient Story" };
        insights.push({
          type: "format_ranking", severity: "info",
          title: `${fmtNames[best.fmt] || best.fmt} has your highest save rate`,
          detail: `${(best.sr * 100).toFixed(1)}% save rate across ${best.cnt} videos. ${fmtNames[worst.fmt] || worst.fmt} is lowest at ${(worst.sr * 100).toFixed(1)}%.`,
          data: { bestFormat: best.fmt, bestSaveRate: best.sr, worstFormat: worst.fmt, worstSaveRate: worst.sr },
        });
      }

      const hookPerf = sqlite.prepare(`
        SELECT LOWER(hook_pattern_used) as hook,
          COUNT(DISTINCT video_code) as cnt,
          AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as sr
        FROM performance_metrics
        WHERE hook_pattern_used IS NOT NULL AND views > 0
        GROUP BY hook HAVING cnt >= 2 ORDER BY sr DESC
      `).all() as Array<{ hook: string; cnt: number; sr: number }>;

      if (hookPerf.length >= 2) {
        const bestHook = hookPerf[0];
        insights.push({
          type: "hook_ranking", severity: "success",
          title: `"${bestHook.hook}" hooks drive the most saves`,
          detail: `${(bestHook.sr * 100).toFixed(1)}% save rate across ${bestHook.cnt} videos.`,
          data: { hookPattern: bestHook.hook, saveRate: bestHook.sr, videoCount: bestHook.cnt },
        });
      }

      const bottom20Pct = Math.ceil(videoPerf.length * 0.2);
      const underperformers = videoPerf.slice(-bottom20Pct);
      if (underperformers.length >= 2) {
        const underFormats = underperformers.map((r) => r.fmt || r.video_code[0]).filter(Boolean);
        const formatCounts: Record<string, number> = {};
        underFormats.forEach((f) => { formatCounts[f] = (formatCounts[f] || 0) + 1; });
        const mostUnderFormat = Object.entries(formatCounts).sort((a, b) => b[1] - a[1])[0];
        if (mostUnderFormat && mostUnderFormat[1] >= 2) {
          const fmtNames: Record<string, string> = { A: "Explainer", B: "Checklist", C: "Demo", D: "Myth Buster", E: "Walkthrough", F: "Quick Tip", G: "Patient Story" };
          insights.push({
            type: "underperforming_format", severity: "warning",
            title: `${fmtNames[mostUnderFormat[0]] || mostUnderFormat[0]} shows up in your bottom performers`,
            detail: `${mostUnderFormat[1]} of your bottom ${bottom20Pct} videos use this format.`,
            data: { format: mostUnderFormat[0], count: mostUnderFormat[1] },
          });
        }
      }

      const weekRows = sqlite.prepare(`
        SELECT
          CASE WHEN recorded_at >= date('now', '-7 days') THEN 'this' ELSE 'last' END as period,
          SUM(views) as views, SUM(saves) as saves
        FROM performance_metrics
        WHERE recorded_at >= date('now', '-14 days')
        GROUP BY period
      `).all() as Array<{ period: string; views: number; saves: number }>;

      const thisWeekData = weekRows.find((r) => r.period === "this");
      const lastWeekData = weekRows.find((r) => r.period === "last");
      if (thisWeekData && lastWeekData && lastWeekData.views > 0) {
        const viewsDelta = Math.round(((thisWeekData.views - lastWeekData.views) / lastWeekData.views) * 100);
        if (Math.abs(viewsDelta) >= 20) {
          insights.push({
            type: "weekly_trend", severity: viewsDelta > 0 ? "success" : "warning",
            title: `Views ${viewsDelta > 0 ? "up" : "down"} ${Math.abs(viewsDelta)}% week-over-week`,
            detail: `This week: ${thisWeekData.views.toLocaleString()} views. Last week: ${lastWeekData.views.toLocaleString()} views.`,
            data: { thisWeek: thisWeekData.views, lastWeek: lastWeekData.views, delta: viewsDelta },
          });
        }
      }

      res.json({ insights, generatedAt: new Date().toISOString(), videoCount: videoPerf.length });
    } catch (error) {
      console.error("[metrics] Error computing auto-insights:", error);
      res.status(500).json({ error: "Failed to compute insights" });
    }
  });

  // GET /api/metrics/:code - Get metrics for a specific video
  // IMPORTANT: Must be after all named routes to avoid catching /trends, /bulk, etc.
  router.get("/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const rows = db
      .select()
      .from(performanceMetrics)
      .where(eq(performanceMetrics.videoCode, code))
      .orderBy(desc(performanceMetrics.recordedAt))
      .all();

    res.json({ metrics: rows });
  });

  // POST /api/metrics/:code - Add a metrics entry for a video
  router.post("/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const { platform, views, likes, saves, shares, comments, watchTimeSeconds, recordedAt, hookPatternUsed } = req.body;

    if (!platform) {
      res.status(400).json({ error: "platform is required" });
      return;
    }

    const entry = db
      .insert(performanceMetrics)
      .values({
        videoCode: code,
        platform,
        recordedAt: recordedAt || new Date().toISOString().split("T")[0],
        views: views ?? 0,
        likes: likes ?? 0,
        saves: saves ?? 0,
        shares: shares ?? 0,
        comments: comments ?? 0,
        watchTimeSeconds: watchTimeSeconds ?? null,
        hookPatternUsed: hookPatternUsed ?? null,
      })
      .returning()
      .get();

    res.status(201).json({ metric: entry });
  });

  return router;
}
