import express from "express";
import path from "path";
import ViteExpress from "vite-express";
import chokidar from "chokidar";
import { createVideosRouter } from "./routes/videos.js";
import { createPipelineRouter } from "./routes/pipeline.js";
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

// API routes
app.use("/api/videos", createVideosRouter(contentLibraryPath, configPath));
app.use("/api/pipeline", createPipelineRouter(contentLibraryPath));

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
