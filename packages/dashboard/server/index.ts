import fs from "fs";
import express from "express";
import path from "path";
import ViteExpress from "vite-express";
import chokidar from "chokidar";

// Load .env file (lightweight, no dependency)
const envPath = path.resolve(import.meta.dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}
import { createVideosRouter } from "./routes/videos.js";
import { createPipelineRouter } from "./routes/pipeline.js";
import { createRendersRouter } from "./routes/renders.js";
import { createMetricsRouter } from "./routes/metrics.js";
import { createIdeasRouter } from "./routes/ideas.js";
import { createIdeasAiRouter } from "./routes/ideas-ai.js";
import { createWatchlistRouter } from "./routes/watchlist.js";
import { createMetricsAiRouter } from "./routes/metrics-ai.js";
import { createOpportunitiesRouter } from "./routes/opportunities.js";
import { createAnalyticsRouter } from "./routes/analytics.js";
import { createSessionsRouter } from "./routes/sessions.js";
import { createCalendarRouter } from "./routes/calendar.js";
import { createWatchlistIntelRouter } from "./routes/watchlist-intel.js";
import { createVideoDirectorAiRouter } from "./routes/video-director-ai.js";
import { createCreatorAnalysisAiRouter } from "./routes/creator-analysis-ai.js";
import { createCaptionsRouter } from "./routes/captions.js";
import { createVideoAnalysisRouter } from "./routes/video-analysis.js";
import { createBenchmarkingRouter } from "./routes/benchmarking.js";
import { createVaultRouter } from "./routes/vault.js";
import { createCreatorVideosRouter } from "./routes/creator-videos.js";
import { createSearchRouter } from "./routes/search.js";
import { createAutomationRouter } from "./routes/automation.js";
import { createStoryboardsRouter } from "./routes/storyboards.js";
import { createAiPromptsRouter } from "./routes/ai-prompts.js";
import { createProductionCompanionRouter } from "./routes/production-companion.js";
import { createYoutubeRouter } from "./routes/youtube.js";
import { createN8nRunnerRouter } from "./routes/n8n-runner.js";
import { createResearchRouter } from "./routes/research.js";
import { invalidateCache } from "./parsers/content-library.js";
import { invalidateConfigCache } from "./parsers/config.js";
import { invalidateIdeaCache } from "./parsers/idea-bank.js";
import { invalidateWatchlistCache } from "./parsers/watchlist.js";
import { invalidateIntelCache } from "./parsers/viral-insights.js";
import { invalidateHookCache } from "./parsers/hook-patterns.js";
import { invalidateResearchCache, getReportPath } from "./parsers/last30days.js";
import { invalidateCreatorInsightsCache } from "./parsers/creator-insights.js";
import { invalidateProductionPlanCache } from "./parsers/production-plans.js";
import { invalidateWatchlistIntelCache } from "./parsers/watchlist-insights.js";

// Initialize database (creates tables on import)
import "./db.js";

const app = express();
app.use(express.json());

// Resolve content-engine root (two levels up from packages/dashboard)
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const industryDir = path.join(repoRoot, "industries", "chiropractic");
const contentLibraryPath = path.join(industryDir, "content-library.md");
const configPath = path.join(industryDir, "config.json");
const renderOutputDir = path.join(repoRoot, "packages", "dashboard", "data", "renders");
const formatsDir = path.join(repoRoot, "formats");

// API routes
app.use("/api/videos", createVideosRouter(contentLibraryPath, configPath, formatsDir));
app.use("/api/pipeline", createPipelineRouter(contentLibraryPath));
app.use("/api/renders", createRendersRouter(contentLibraryPath, repoRoot, renderOutputDir));
app.use("/api/metrics", createMetricsRouter(contentLibraryPath));
app.use("/api/ideas", createIdeasRouter(contentLibraryPath));
app.use("/api/ideas-ai", createIdeasAiRouter(contentLibraryPath));
app.use("/api/watchlist", createWatchlistRouter(contentLibraryPath));
app.use("/api/metrics-ai", createMetricsAiRouter(contentLibraryPath));
app.use("/api/opportunities", createOpportunitiesRouter(contentLibraryPath));
app.use("/api/analytics", createAnalyticsRouter(contentLibraryPath));
app.use("/api/sessions", createSessionsRouter(contentLibraryPath));
app.use("/api/calendar", createCalendarRouter(contentLibraryPath));
app.use("/api/watchlist-intel", createWatchlistIntelRouter(contentLibraryPath));
app.use("/api/video-director", createVideoDirectorAiRouter(contentLibraryPath));
app.use("/api/creator-analysis", createCreatorAnalysisAiRouter(contentLibraryPath));
app.use("/api/captions", createCaptionsRouter(contentLibraryPath));
app.use("/api/video-analysis", createVideoAnalysisRouter(contentLibraryPath));
app.use("/api/benchmarking", createBenchmarkingRouter(contentLibraryPath));
app.use("/api/vault", createVaultRouter(contentLibraryPath));
app.use("/api/creator-videos", createCreatorVideosRouter(contentLibraryPath));
app.use("/api/search", createSearchRouter(contentLibraryPath));
app.use("/api/automation", createAutomationRouter());
app.use("/api/storyboards", createStoryboardsRouter(contentLibraryPath));
app.use("/api/ai-prompts", createAiPromptsRouter());
app.use("/api/produce", createProductionCompanionRouter(contentLibraryPath));
app.use("/api/metrics/youtube", createYoutubeRouter(contentLibraryPath));
app.use("/api/n8n", createN8nRunnerRouter(contentLibraryPath));
app.use("/api/research", createResearchRouter(contentLibraryPath));
app.use("/rendered", express.static(renderOutputDir));

// File watcher - invalidate caches when source files change
const ideaBankPath = path.join(industryDir, "idea-bank.md");
const watchlistPath = path.join(industryDir, "watchlist.md");

const viralInsightsDir = path.join(industryDir, "viral-insights");
const hookPatternsPath = path.join(industryDir, "hook-patterns.md");

const creatorInsightsDir = path.join(industryDir, "creator-insights");
const productionPlansDir = path.join(industryDir, "production-plans");
const watchlistIntelDir = path.join(industryDir, "watchlist-insights");

const watcher = chokidar.watch(
  [contentLibraryPath, configPath, ideaBankPath, watchlistPath, hookPatternsPath, productionPlansDir, viralInsightsDir, creatorInsightsDir, watchlistIntelDir],
  { ignoreInitial: true },
);

watcher.on("change", (filePath) => {
  console.log(`[watcher] File changed: ${filePath}`);
  if (filePath.includes("content-library")) {
    invalidateCache();
  }
  if (filePath.includes("config.json")) {
    invalidateConfigCache();
  }
  if (filePath.includes("idea-bank")) {
    invalidateIdeaCache();
  }
  if (filePath.includes("watchlist")) {
    invalidateWatchlistCache();
  }
  if (filePath.includes("viral-insights")) {
    invalidateIntelCache();
  }
  if (filePath.includes("hook-patterns")) {
    invalidateHookCache();
  }
  if (filePath.includes("creator-insights")) {
    invalidateCreatorInsightsCache();
  }
  if (filePath.includes("production-plans")) {
    invalidateProductionPlanCache();
  }
  if (filePath.includes("watchlist-insights")) {
    invalidateWatchlistIntelCache();
  }
});

// Watch last30days research output (separate watcher for external directory)
const researchOutDir = path.dirname(getReportPath());
const researchWatcher = chokidar.watch(researchOutDir, { ignoreInitial: true, depth: 0 });
researchWatcher.on("change", (filePath) => {
  if (filePath.endsWith("report.json")) {
    console.log(`[watcher] Research report updated: ${filePath}`);
    invalidateResearchCache();
  }
});

const PORT = parseInt(process.env.PORT || "3001", 10);

ViteExpress.listen(app, PORT, () => {
  console.log(`Content Engine Dashboard running at http://localhost:${PORT}`);
});
