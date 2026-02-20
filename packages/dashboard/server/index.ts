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
import { createComposerAiRouter } from "./routes/composer-ai.js";
import { invalidateCache } from "./parsers/content-library.js";
import { invalidateConfigCache } from "./parsers/config.js";

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
app.use("/api/composer", createComposerAiRouter(contentLibraryPath));
app.use("/rendered", express.static(renderOutputDir));

// File watcher - invalidate caches when source files change
const watcher = chokidar.watch(
  [contentLibraryPath, configPath, path.join(industryDir, "production-plans")],
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
});

const PORT = parseInt(process.env.PORT || "3001", 10);

ViteExpress.listen(app, PORT, () => {
  console.log(`Content Engine Dashboard running at http://localhost:${PORT}`);
});
