import fs from "fs";
import path from "path";
import { Router } from "express";
import { db } from "../db.js";
import { performanceMetrics } from "../../shared/schema.js";
import { parseContentLibrary } from "../parsers/content-library.js";
import { parseIdeaBank, invalidateIdeaCache } from "../parsers/idea-bank.js";
import { invalidateWatchlistIntelCache } from "../parsers/watchlist-insights.js";
import { appendIdeasToFile } from "./ideas.js";
import { generatedCarousels, carouselSlides } from "../../shared/schema.js";
import type { MetricsSyncEntry, IdeaCategory } from "../../shared/types.js";

const INITIAL_POLL_MS = 2_000;
const MAX_POLL_MS = 15_000;
const TIMEOUT_MS = 10 * 60 * 1_000; // 10 minutes (up from 4)

// Circuit breaker: track consecutive failures
let consecutiveFailures = 0;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1_000; // 5 min cooldown
let circuitBreakerTrippedAt = 0;

type RunResult =
  | { triggered: true; ingested: boolean; executionId: string | number; durationMs: number; detail: Record<string, unknown> }
  | { triggered: false; error: string };

async function triggerAndWait(
  apiUrl: string,
  apiKey: string,
  workflowId: string,
): Promise<{ executionId: string | number; durationMs: number }> {
  const start = Date.now();

  // Trigger the workflow
  const triggerRes = await fetch(`${apiUrl}/workflows/${workflowId}/execute`, {
    method: "POST",
    headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!triggerRes.ok) {
    const body = await triggerRes.text();
    throw new Error(`n8n trigger failed: ${triggerRes.status} ${body.slice(0, 200)}`);
  }

  const triggerData = (await triggerRes.json()) as { executionId?: string | number; id?: string | number };
  const executionId = triggerData.executionId ?? triggerData.id;
  if (!executionId) {
    throw new Error("n8n did not return an executionId");
  }

  // Poll with exponential backoff until success, error, or timeout
  let pollInterval = INITIAL_POLL_MS;
  while (true) {
    const elapsed = Date.now() - start;
    if (elapsed > TIMEOUT_MS) {
      throw new Error(`Execution timed out after ${Math.round(elapsed / 1000)}s`);
    }

    await new Promise((r) => setTimeout(r, pollInterval));
    // Exponential backoff: 2s → 4s → 8s → 15s (capped)
    pollInterval = Math.min(pollInterval * 2, MAX_POLL_MS);

    const pollRes = await fetch(`${apiUrl}/executions/${executionId}`, {
      headers: { "X-N8N-API-KEY": apiKey },
    });

    if (!pollRes.ok) {
      // Tolerate transient poll errors
      continue;
    }

    const pollData = (await pollRes.json()) as { status?: string };
    const status = pollData.status;

    if (status === "success") {
      return { executionId, durationMs: Date.now() - start };
    }
    if (status === "error" || status === "crashed" || status === "canceled") {
      throw new Error(`Execution ended with status: ${status}`);
    }
    // "running" or "waiting" — keep polling
  }
}

async function ingestContentIntel(
  apiUrl: string,
  apiKey: string,
  executionId: string | number,
  contentLibraryPath: string,
): Promise<Record<string, unknown>> {
  const execRes = await fetch(`${apiUrl}/executions/${executionId}?includeData=true`, {
    headers: { "X-N8N-API-KEY": apiKey },
  });
  if (!execRes.ok) {
    throw new Error(`Failed to fetch execution data: ${execRes.status}`);
  }

  const execData = (await execRes.json()) as {
    data: { resultData: { runData: Record<string, Array<{ data: { main: Array<Array<{ json: Record<string, unknown> }>> } }>> } };
  };

  const runData = execData.data?.resultData?.runData;
  let metricsEntries: MetricsSyncEntry[] = [];

  for (const nodeName of ["Metrics Output", "Format Metrics", "Merge Metrics"]) {
    const nodeRuns = runData?.[nodeName];
    if (!nodeRuns?.length) continue;
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
    return { synced: 0, skipped: 0, message: "No metrics data found in execution" };
  }

  const videos = parseContentLibrary(contentLibraryPath);
  const titleToCode = new Map(videos.map((v) => [v.title.toLowerCase().trim(), v.code]));

  for (const entry of metricsEntries) {
    if (!entry.videoCode && entry.postTitle) {
      const match = titleToCode.get(entry.postTitle.toLowerCase().trim());
      if (match) entry.videoCode = match;
    }
  }

  const existing = db.select().from(performanceMetrics).all();
  const existingKeys = new Set(existing.map((e) => `${e.videoCode}|${e.platform}|${e.recordedAt}`));

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

  return { synced, skipped, unmatched };
}

async function ingestWatchlistIntel(
  apiUrl: string,
  apiKey: string,
  executionId: string | number,
  contentLibraryPath: string,
): Promise<Record<string, unknown>> {
  const execRes = await fetch(`${apiUrl}/executions/${executionId}?includeData=true`, {
    headers: { "X-N8N-API-KEY": apiKey },
  });
  if (!execRes.ok) {
    throw new Error(`Failed to fetch execution data: ${execRes.status}`);
  }

  const execData = (await execRes.json()) as {
    data: { resultData: { runData: Record<string, Array<{ data: { main: Array<Array<{ json: Record<string, unknown> }>> } }>> } };
  };

  const runData = execData.data?.resultData?.runData;
  const nodeRuns = runData?.["Format Watchlist Report"];
  const output = nodeRuns?.[0]?.data?.main?.[0]?.[0]?.json;

  if (!output?.markdown || !output?.date) {
    return { synced: false, message: "No report data found in execution" };
  }

  const markdown = output.markdown as string;
  const date = output.date as string;
  const ideas = Array.isArray(output.ideas) ? output.ideas as Array<{
    topic: string; suggestedFormat?: string; hookAngle?: string;
    priority?: string; source?: string; category?: IdeaCategory;
    inspiredBy?: string; whyNonObvious?: string; targetAudience?: string;
  }> : [];

  const industryDir = path.dirname(contentLibraryPath);
  const watchlistIntelDir = path.join(industryDir, "watchlist-insights");
  const ideaBankPath = path.join(industryDir, "idea-bank.md");
  const reportPath = path.join(watchlistIntelDir, `watchlist-intel-${date}.md`);
  const wasNew = !fs.existsSync(reportPath);

  fs.mkdirSync(watchlistIntelDir, { recursive: true });
  fs.writeFileSync(reportPath, markdown);
  invalidateWatchlistIntelCache();

  let ideasAdded = 0;
  let duplicatesSkipped = 0;

  if (ideas.length > 0) {
    const existing = parseIdeaBank(ideaBankPath);
    const existingTopics = new Set(existing.map((e) => e.topic.toLowerCase().trim()));

    const newIdeas = ideas.filter((i) => {
      if (!i.topic || existingTopics.has(i.topic.toLowerCase().trim())) {
        duplicatesSkipped++;
        return false;
      }
      return true;
    });

    if (newIdeas.length > 0) {
      ideasAdded = appendIdeasToFile(
        ideaBankPath,
        newIdeas.map((i) => ({
          topic: i.topic,
          suggestedFormat: i.suggestedFormat,
          hookAngle: i.hookAngle,
          priority: i.priority,
          source: i.source || "n8n Watchlist Intelligence",
          category: (i.category || "competitor") as IdeaCategory,
        })),
      );
      invalidateIdeaCache();
    }
  }

  return { synced: true, date, reportSaved: true, wasNew, ideasAdded, duplicatesSkipped };
}

export function createN8nRunnerRouter(contentLibraryPath: string) {
  const router = Router();

  // POST /api/n8n/run - trigger n8n workflow and ingest results
  router.post("/run", async (req, res) => {
    const { workflowType } = req.body as { workflowType?: string };
    if (workflowType !== "content-intel" && workflowType !== "watchlist-intel" && workflowType !== "carousel-batch") {
      res.status(400).json({ error: "workflowType must be 'content-intel', 'watchlist-intel', or 'carousel-batch'" });
      return;
    }

    const apiUrl = process.env.N8N_API_URL;
    const apiKey = process.env.N8N_API_KEY;
    if (!apiUrl || !apiKey) {
      res.status(500).json({ error: "N8N_API_URL and N8N_API_KEY must be set in .env" });
      return;
    }

    const workflowIdMap: Record<string, { envVar: string; id: string | undefined }> = {
      "content-intel": { envVar: "N8N_METRICS_WORKFLOW_ID", id: process.env.N8N_METRICS_WORKFLOW_ID },
      "watchlist-intel": { envVar: "N8N_WATCHLIST_INTEL_WORKFLOW_ID", id: process.env.N8N_WATCHLIST_INTEL_WORKFLOW_ID },
      "carousel-batch": { envVar: "N8N_CAROUSEL_BATCH_WORKFLOW_ID", id: process.env.N8N_CAROUSEL_BATCH_WORKFLOW_ID },
    };

    const { envVar, id: workflowId } = workflowIdMap[workflowType];

    if (!workflowId) {
      res.status(500).json({ error: `${envVar} must be set in .env` });
      return;
    }

    // Circuit breaker check
    if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      const elapsed = Date.now() - circuitBreakerTrippedAt;
      if (elapsed < CIRCUIT_BREAKER_RESET_MS) {
        const remainingSec = Math.round((CIRCUIT_BREAKER_RESET_MS - elapsed) / 1000);
        res.status(503).json({ error: `n8n circuit breaker open after ${CIRCUIT_BREAKER_THRESHOLD} failures. Retry in ${remainingSec}s.` });
        return;
      }
      // Reset after cooldown
      consecutiveFailures = 0;
    }

    try {
      console.log(`[n8n-runner] Triggering ${workflowType} workflow (${workflowId})...`);
      const { executionId, durationMs } = await triggerAndWait(apiUrl, apiKey, workflowId);
      console.log(`[n8n-runner] Execution ${executionId} succeeded in ${Math.round(durationMs / 1000)}s. Ingesting...`);

      // Reset circuit breaker on success
      consecutiveFailures = 0;

      let detail: Record<string, unknown>;
      if (workflowType === "content-intel") {
        detail = await ingestContentIntel(apiUrl, apiKey, executionId, contentLibraryPath);
      } else if (workflowType === "watchlist-intel") {
        detail = await ingestWatchlistIntel(apiUrl, apiKey, executionId, contentLibraryPath);
      } else {
        // carousel-batch: execution data is ingested via POST /api/carousels/ingest from the workflow itself
        detail = { message: "Carousel batch workflow completed. Images ingested via webhook callback." };
      }

      const result: RunResult = { triggered: true, ingested: true, executionId, durationMs, detail };
      res.status(200).json(result);
    } catch (error) {
      consecutiveFailures++;
      if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        circuitBreakerTrippedAt = Date.now();
        console.error(`[n8n-runner] Circuit breaker tripped after ${consecutiveFailures} consecutive failures`);
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[n8n-runner] Error (failure ${consecutiveFailures}/${CIRCUIT_BREAKER_THRESHOLD}):`, message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
