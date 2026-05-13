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
import { createViralInsightsRouter } from "./routes/viral-insights.js";
import { createInboxRouter } from "./routes/inbox.js";
import { createIntelRouter } from "./routes/intel.js";
import { createStudioRouter } from "./routes/studio.js";
import { createIdeaLabRouter } from "./routes/idea-lab.js";
import { createPersonasRouter } from "./routes/personas.js";
import { createCarouselsRouter } from "./routes/carousels.js";
import { createDiscoverRouter } from "./routes/discover.js";
import { createGrowthRouter } from "./routes/growth.js";
import { createMasterBlueprintRouter } from "./routes/master-blueprint.js";
import { createIngestRouter } from "./routes/ingest.js";
import { createHiggsfieldRouter } from "./routes/higgsfield.js";
import { createHiggsfieldCharactersRouter } from "./routes/higgsfield-characters.js";
import { createStorytellingRouter } from "./routes/storytelling.js";
import { createProjectsRouter } from "./routes/projects.js";
import { invalidateStorytellingStylesCache } from "./parsers/storytelling-styles.js";
import { invalidateBlueprintCache } from "./parsers/master-blueprint.js";
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
const dataDir = path.resolve(import.meta.dirname, "..", "data");
const viralInsightsDir = path.join(industryDir, "viral-insights");

// Static: storyboard frame images
const storyboardImagesDir = path.join(dataDir, "storyboard-images");
if (!fs.existsSync(storyboardImagesDir)) fs.mkdirSync(storyboardImagesDir, { recursive: true });
app.use("/storyboard-images", express.static(storyboardImagesDir));

// Static: carousel images
const carouselImagesDir = path.join(dataDir, "carousel-images");
if (!fs.existsSync(carouselImagesDir)) fs.mkdirSync(carouselImagesDir, { recursive: true });
app.use("/carousel-images", express.static(carouselImagesDir));

// Static: cached video thumbnails
const thumbnailsDir = path.join(dataDir, "thumbnails");
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });
app.use("/thumbnails", express.static(thumbnailsDir));

// Storytelling reel engine data dirs + static mounts
const voiceoversDir = path.join(dataDir, "voiceovers");
const reelsDir = path.join(dataDir, "reels");
const storytellingStylesPath = path.join(repoRoot, "industries", "_shared", "storytelling-styles.md");
if (!fs.existsSync(voiceoversDir)) fs.mkdirSync(voiceoversDir, { recursive: true });
if (!fs.existsSync(reelsDir)) fs.mkdirSync(reelsDir, { recursive: true });
app.use("/voiceovers", express.static(voiceoversDir));
app.use("/reels", express.static(reelsDir));

// Projects data directory + static mount
const projectsDir = path.join(dataDir, "projects");
if (!fs.existsSync(projectsDir)) fs.mkdirSync(projectsDir, { recursive: true });
app.use("/projects", express.static(projectsDir));

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
app.use("/api/creator-videos", createCreatorVideosRouter(contentLibraryPath, thumbnailsDir));
app.use("/api/search", createSearchRouter(contentLibraryPath));
app.use("/api/automation", createAutomationRouter());
app.use("/api/storyboards", createStoryboardsRouter(contentLibraryPath, dataDir));
app.use("/api/ai-prompts", createAiPromptsRouter());
app.use("/api/produce", createProductionCompanionRouter(contentLibraryPath));
app.use("/api/metrics/youtube", createYoutubeRouter(contentLibraryPath));
app.use("/api/n8n", createN8nRunnerRouter(contentLibraryPath));
app.use("/api/research", createResearchRouter(contentLibraryPath));
app.use("/api/viral-insights", createViralInsightsRouter(viralInsightsDir));
app.use("/api/inbox", createInboxRouter(contentLibraryPath));
app.use("/api/intel", createIntelRouter(industryDir));
app.use("/api/studio", createStudioRouter());
app.use("/api/idea-lab", createIdeaLabRouter(contentLibraryPath));
app.use("/api/personas", createPersonasRouter());
app.use("/api/carousels", createCarouselsRouter(contentLibraryPath, carouselImagesDir));
app.use("/api/discover", createDiscoverRouter(contentLibraryPath, viralInsightsDir, thumbnailsDir));
app.use("/api/growth", createGrowthRouter());
app.use("/api/blueprint", createMasterBlueprintRouter(industryDir, contentLibraryPath));
app.use("/api/ingest", createIngestRouter(industryDir));
app.use("/api/higgsfield", createHiggsfieldRouter());
app.use("/api/higgsfield/characters", createHiggsfieldCharactersRouter());
const PORT = parseInt(process.env.PORT || "3001", 10);
app.use("/api/storytelling", createStorytellingRouter(storytellingStylesPath, reelsDir, voiceoversDir, PORT));
const quickstartTemplatesPath = path.join(repoRoot, "industries", "_shared", "quickstart-templates.md");
const blueprintPathForProjects = path.join(industryDir, "master-blueprint.md");
app.use("/api/projects", createProjectsRouter(projectsDir, quickstartTemplatesPath, blueprintPathForProjects));
app.use("/rendered", express.static(renderOutputDir));

// Health check endpoint
import { sqlite } from "./db.js";
const startedAt = new Date().toISOString();
app.get("/health", (_req, res) => {
  try {
    const row = sqlite.prepare("SELECT COUNT(*) as c FROM video_status").get() as { c: number };
    res.json({
      status: "ok",
      startedAt,
      uptime: Math.round(process.uptime()),
      db: { connected: true, videoCount: row.c },
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  } catch (error) {
    res.status(503).json({ status: "error", error: error instanceof Error ? error.message : "Unknown" });
  }
});

// File watcher - invalidate caches when source files change
const ideaBankPath = path.join(industryDir, "idea-bank.md");
const watchlistPath = path.join(industryDir, "watchlist.md");

const hookPatternsPath = path.join(industryDir, "hook-patterns.md");

const creatorInsightsDir = path.join(industryDir, "creator-insights");
const productionPlansDir = path.join(industryDir, "production-plans");
const watchlistIntelDir = path.join(industryDir, "watchlist-insights");

const masterBlueprintPath = path.join(industryDir, "master-blueprint.md");

const watcher = chokidar.watch(
  [contentLibraryPath, configPath, ideaBankPath, watchlistPath, hookPatternsPath, productionPlansDir, viralInsightsDir, creatorInsightsDir, watchlistIntelDir, masterBlueprintPath],
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
  if (filePath.includes("master-blueprint")) {
    invalidateBlueprintCache();
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

// Watch storytelling styles for changes (industry-agnostic shared dir)
const stylesWatcher = chokidar.watch(storytellingStylesPath, { ignoreInitial: true });
stylesWatcher.on("change", () => {
  console.log("[watcher] storytelling-styles.md changed");
  invalidateStorytellingStylesCache();
});

ViteExpress.listen(app, PORT, () => {
  console.log(`Content Engine Dashboard running at http://localhost:${PORT}`);
});

// Graceful shutdown: close file watchers to prevent FD leaks on hot-reload
function cleanup() {
  console.log("[server] Shutting down file watchers...");
  watcher.close();
  researchWatcher.close();
  stylesWatcher.close();
  process.exit(0);
}
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
